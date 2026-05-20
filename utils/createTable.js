const { connectDB } = require("../config/database");
const { createOrdersTable } = require("../models/ordersTable");
const { createPaymentsTable } = require("../models/paymentTable");
const { createProductReviewsTable } = require("../models/productReviewTable");
const { createproduct } = require("../models/producttable");
const { createOrderItemTable } = require("../models/orderItemsTable");
const { createShippingInfoTable } = require("../models/shippingInfoTable");
const { createUser } = require("../models/usertable");

module.exports.createTable = async () => {
  try {
    await connectDB();
    // 1. Nhóm bảng độc lập (Bảng cha lớn - tạo đầu tiên)
    await createUser();
    await createproduct();

    // 2. Nhóm bảng phụ thuộc vào User hoặc Product
    // Thường dính tới user_id
    await createProductReviewsTable(); // Dính tới cả user_id và product_id

    // 3. Nhóm bảng Đơn hàng (Cực kỳ quan trọng về thứ tự)
    await createOrdersTable(); // Phải tạo trước để lấy order_id cho các bảng dưới
    await createShippingInfoTable();
    // 4. Các bảng con của Orders (chạy sau cùng)
    await createPaymentsTable(); // Thường dính tới order_id
    await createOrderItemTable(); // Dính tới order_id và product_id
    console.log("All tables created successfully.");
  } catch (error) {
    console.error("Error occurred while creating tables:", error);
  }
};
