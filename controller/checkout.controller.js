const { catchAsyncError } = require("../middlewares/catchAsyncError");

const crypto = require("crypto");
const queryString = require("qs");
const moment = require("moment");
const { database } = require("../config/database");
//checkout
module.exports.payMent = async (req, res) => {
  try {
    await database.query("BEGIN");

    const buyerId = req.user.id;
    console.log("Buyer ID:", buyerId);
    const amount = parseInt(req.body.totalAmount);

    // 1. Tạo order
    const orderResult = await database.query(
      `
      INSERT INTO orders (
        buyer_id,
        total_price,
       
        shipping_price,
        order_status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [buyerId, amount, req.body.shipping_price || 0, "Processing"],
    );

    const order = orderResult.rows[0];

    // 2. Tạo order_items
    for (const item of req.body.productItems) {
      await database.query(
        `
        INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          price,
          image,
          title
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          item.productId,
          item.quantity,
          item.price,
          item.images,
          item.title,
        ],
      );
    }

    // 3. Tạo shipping_info
    await database.query(
      `
      INSERT INTO shipping_info (
        order_id,
        full_name,
        city,
        district,
        ward,
        address,
        
        phone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        order.id,
        req.body.full_name,
        req.body.city,
        req.body.district,
        req.body.ward,
        req.body.address,

        req.body.phone,
      ],
    );

    // 4. Tạo payment Pending
    await database.query(
      `
      INSERT INTO payments (
        order_id,
        payment_type,
        payment_status
      )
      VALUES ($1, $2, $3)
      `,
      [order.id, "Online", "Pending"],
    );

    await database.query("COMMIT");

    // 5. Tạo URL VNPay

    const vnp_TmnCode = process.env.TMN_CODE;
    const vnp_HashSecret = process.env.HASH_SECRET;
    const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = process.env.RETURN_URL;

    // --- Lấy IP người dùng (phòng khi req.ip bị sai định dạng)
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "127.0.0.1";

    // --- Tạo tham số thanh toán
    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: vnp_TmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: order.id.toString(),
      // vnp_TxnRef: Date.now().toString(),
      vnp_OrderInfo: "Thanh_toan_don_hang",
      vnp_OrderType: "billpayment",
      vnp_Amount: amount * 100, // nhân 100 theo yêu cầu VNPay
      vnp_ReturnUrl: vnp_ReturnUrl,
      vnp_IpAddr: ipAddr,
      vnp_BankCode: "NCB",
      vnp_CreateDate: moment().format("YYYYMMDDHHmmss"),
    };

    // --- Sắp xếp tham số theo thứ tự alphabet
    vnp_Params = Object.keys(vnp_Params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnp_Params[key];
        return acc;
      }, {});

    // --- Chuỗi ký (chú ý encode: false)
    const signData = queryString.stringify(vnp_Params, { encode: true });

    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const secureHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    // --- Thêm hash vào tham số
    vnp_Params["vnp_SecureHash"] = secureHash;

    // --- Tạo URL thanh toán
    const paymentUrl = `${vnp_Url}?${queryString.stringify(vnp_Params)}`;

    return res.status(200).json({
      success: true,
      url: paymentUrl,
      orderId: order.id,
    });
  } catch (error) {
    await database.query("ROLLBACK");

    return res.status(500).json({
      success: false,
      message: "Lỗi tạo thanh toán VNPay",
    });
  } finally {
  }
};
//result
module.exports.resultPayment = async (req, res) => {
  try {
    const query = { ...req.query };

    const vnp_SecureHash = query.vnp_SecureHash;

    delete query.vnp_SecureHash;
    delete query.vnp_SecureHashType;

    const sorted = Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key];
        return acc;
      }, {});

    const signData = queryString.stringify(sorted, { encode: true });

    const checkSum = crypto
      .createHmac("sha512", process.env.HASH_SECRET)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    if (vnp_SecureHash !== checkSum) {
      return res.status(400).json({
        success: false,
        message: "Chữ ký không hợp lệ",
      });
    }

    const orderId = query.vnp_TxnRef;

    if (query.vnp_ResponseCode === "00") {
      await database.query(
        `
        UPDATE payments
        SET payment_status = 'Paid'
        WHERE order_id = $1
        `,
        [orderId],
      );

      await database.query(
        `
        UPDATE orders
        SET paid_at = NOW()
        WHERE id = $1
        `,
        [orderId],
      );

      return res.json({
        success: true,
        message: "Thanh toán thành công",
      });
    }

    await database.query(
      `
      UPDATE payments
      SET payment_status = 'Failed'
      WHERE order_id = $1
      `,
      [orderId],
    );

    return res.json({
      success: false,
      message: "Thanh toán thất bại",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý kết quả thanh toán",
    });
  }
};
