const jwt = require("jsonwebtoken");
const { catchAsyncError } = require("./catchAsyncError");
const { ErrorHandler } = require("./errorMiddleware");
const { database } = require("../config/database");
module.exports.isAuthenticated = catchAsyncError(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Please log in to access this resource", 401));
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const user = await database.query(
    `select id, name,password, email,role,avatar,created_at from users where id=$1`,
    [decoded.id],
  );
  req.user = user.rows[0];
  next();
});
module.exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role: ${req.user.role} is not allowed to access this resource`,
          403,
        ),
      );
    }
    next();
  };
};
