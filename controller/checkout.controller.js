const { catchAsyncError } = require("../middlewares/catchAsyncError");

const crypto = require("crypto");
const queryString = require("qs");
const moment = require("moment");
const { database } = require("../config/database");
const { ErrorHandler } = require("../middlewares/errorMiddleware");
//checkout
module.exports.payMent = async (req, res) => {
  try {
    await database.query("BEGIN");

    const buyerId = req.user.id;
    const productItems = req.body.productItems; // Mảng [{productId, quantity}, ...]
    const paymentMethod = req.body.paymentMethod || "COD"; // "COD" hoặc "ONLINE"

    // =================================================================
    // BƯỚC 1: KIỂM TRA SẢN PHẨM & TỰ TÍNH LẠI TỔNG TIỀN TỪ DATABASE
    // =================================================================
    const productIds = productItems.map((item) => item.productId);

    const { rows: realProducts } = await database.query(
      `SELECT id, price, stock, name FROM products WHERE id = ANY($1::uuid[])`,
      [productIds],
    );

    const productMap = new Map(realProducts.map((p) => [p.id, p]));
    let calculatedTotalAmount = 0;
    const validatedItems = [];

    for (const item of productItems) {
      const dbProduct = productMap.get(item.productId);

      if (!dbProduct) {
        await database.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: `Sản phẩm với ID ${item.productId} không tồn tại!`,
        });
      }

      if (dbProduct.stock < item.quantity) {
        await database.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${dbProduct.name} đã hết hàng hoặc không đủ số lượng!`,
        });
      }

      // Tính tổng tiền dựa trên giá gốc trong database
      calculatedTotalAmount += dbProduct.price * item.quantity;

      validatedItems.push({
        productId: dbProduct.id,
        quantity: item.quantity,
        price: dbProduct.price,
        image: item.images, // Hoặc lấy từ dbProduct nếu DB có lưu
        title: item.title, // Hoặc lấy từ dbProduct nếu DB có lưu
      });

      // Trừ kho hàng
      await database.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, dbProduct.id],
      );
    }

    const shippingPrice = parseInt(req.body.shipping_price) || 0;
    calculatedTotalAmount += shippingPrice;

    // =================================================================
    // BƯỚC 2: TẠO ORDER, ORDER_ITEMS, SHIPPING, PAYMENTS
    // =================================================================

    // 1. Tạo order
    const orderResult = await database.query(
      `INSERT INTO orders (buyer_id, total_price, shipping_price, order_status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [buyerId, calculatedTotalAmount, shippingPrice, "Processing"],
    );
    const order = orderResult.rows[0];

    // 2. Tạo order_items
    for (const item of validatedItems) {
      await database.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, image, title)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.productId,
          item.quantity,
          item.price,
          item.image,
          item.title,
        ],
      );
    }

    // 3. Tạo shipping_info
    await database.query(
      `INSERT INTO shipping_info (order_id, full_name, city, district, ward, address, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

    // 4. Tạo payment dựa theo phương thức lựa chọn
    await database.query(
      `INSERT INTO payments (order_id, payment_type, payment_status) VALUES ($1, $2, $3)`,
      [order.id, paymentMethod, "Pending"],
    );

    // Hoàn tất lưu dữ liệu vào database thành công trước khi rẽ nhánh thanh toán
    await database.query("COMMIT");

    // =================================================================
    // BƯỚC 3: RẼ NHÁNH ĐIỀU KIỆN THANH TOÁN (CARD vs CASH)
    // =================================================================

    if (paymentMethod === "ONLINE") {
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
    } else {
      // --- Nếu là thanh toán bằng tiền mặt (COD) ---
      return res.status(200).json({
        success: true,
        paymentMethod: "COD",
        message: "Đặt hàng thành công! Vui lòng thanh toán khi nhận hàng.",
        orderId: order.id,
      });
    }
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
//getSingleOrder
module.exports.fetchSingleOrder = catchAsyncError(async (req, res, next) => {
  const { orderId } = req.params;
  const result = await database.query(
    `
    SELECT 
 o.*, 
 COALESCE(
 json_agg(
json_build_object(
'order_item_id', oi.id,
'order_id', oi.order_id,
'product_id', oi.product_id,
'quantity', oi.quantity,
'price', oi.price
 )
 ) FILTER (WHERE oi.id IS NOT NULL), '[]'
 ) AS order_items,
 json_build_object(
 'full_name', s.full_name,
 'city', s.city,
 'district',s.district,
  'ward', s.ward,
 'address', s.address,
 'phone', s.phone
 ) AS shipping_info
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN shipping_info s ON o.id = s.order_id
WHERE o.id = $1
GROUP BY o.id, s.id;
`,
    [orderId],
  );

  res.status(200).json({
    success: true,
    message: "Order fetched.",
    orders: result.rows[0],
  });
});
//getMyorder
module.exports.fetchMyOrders = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    `
        SELECT o.*, COALESCE(
 json_agg(
  json_build_object(
 'order_item_id', oi.id,
 'order_id', oi.order_id,
 'product_id', oi.product_id,
 'quantity', oi.quantity,
 'price', oi.price,
 'image', oi.image,
 'title', oi.title
  ) 
 ) FILTER (WHERE oi.id IS NOT NULL), '[]'
 ) AS order_items,
json_build_object(
 'full_name', s.full_name,

 'city', s.city,
 
 'district',s.district,
  'ward', s.ward,
 'address', s.address,
 'phone', s.phone
 ) AS shipping_info 
 FROM orders o
 LEFT JOIN order_items oi ON o.id = oi.order_id
 LEFT JOIN shipping_info s ON o.id = s.order_id
WHERE o.buyer_id = $1 AND o.paid_at IS NOT NULL
GROUP BY o.id, s.id
        `,
    [req.user.id],
  );

  res.status(200).json({
    success: true,
    message: "All your orders are fetched.",
    myOrders: result.rows,
  });
});
//getAllOrder
module.exports.fetchAllOrders = catchAsyncError(async (req, res, next) => {
  const result = await database.query(`
            SELECT o.*,
 COALESCE(json_agg(
 json_build_object(
 'order_item_id', oi.id,
 'order_id', oi.order_id,
 'product_id', oi.product_id,
 'quantity', oi.quantity,
 'price', oi.price,
 'image', oi.image,
 'title', oi.title
)
) FILTER (WHERE oi.id IS NOT NULL), '[]' ) AS order_items, json_build_object(
'full_name', s.full_name,
 'state', s.state,
 'city', s.city,
 'district',s.district,
  'ward', s.ward,
 'address', s.address,
 
 'phone', s.phone 
) AS shipping_info
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN shipping_info s ON o.id = s.order_id
WHERE o.paid_at IS NOT NULL
GROUP BY o.id, s.id
        `);

  res.status(200).json({
    success: true,
    message: "All orders fetched.",
    orders: result.rows,
  });
});
//updateOrder
module.exports.updateOrderStatus = catchAsyncError(async (req, res, next) => {
  const { status } = req.body;
  if (!status) {
    return next(new ErrorHandler("Provide a valid status for order.", 400));
  }
  const { orderId } = req.params;
  const results = await database.query(
    `
    SELECT * FROM orders WHERE id = $1
    `,
    [orderId],
  );

  if (results.rows.length === 0) {
    return next(new ErrorHandler("Invalid order ID.", 404));
  }

  const updatedOrder = await database.query(
    `
    UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *
    `,
    [status, orderId],
  );

  res.status(200).json({
    success: true,
    message: "Order status updated.",
    updatedOrder: updatedOrder.rows[0],
  });
});
//deleteOrder
module.exports.deleteOrder = catchAsyncError(async (req, res, next) => {
  const { orderId } = req.params;
  const results = await database.query(
    `
        DELETE FROM orders WHERE id = $1 RETURNING *
        `,
    [orderId],
  );
  if (results.rows.length === 0) {
    return next(new ErrorHandler("Invalid order ID.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Order deleted.",
    order: results.rows[0],
  });
});
