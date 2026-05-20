const authRouter = require("./auth.router");
module.exports = (app) => {
  app.use("/api/auth", authRouter);
};
