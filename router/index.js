const authRouter = require("./auth.router");
const productRouter = require("./product.router");
const adminRouter = require("./admin.router");
const checkoutRouter = require("./order.router");
module.exports = (app) => {
  app.use("/api/auth", authRouter);
  app.use("/api/products", productRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/checkout", checkoutRouter);
};
