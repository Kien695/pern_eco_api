const authRouter = require("./auth.router");
const productRouter = require("./product.router");
module.exports = (app) => {
  app.use("/api/auth", authRouter);
  app.use("/api/products", productRouter);
};
