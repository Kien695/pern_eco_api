const { catchAsyncError } = require("../middlewares/catchAsyncError");
const { ErrorHandler } = require("../middlewares/errorMiddleware");

module.exports.register = catchAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new ErrorHandler("Please enter a valid email address", 400));
  }
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return next(
      new ErrorHandler(
        "Password must be at least 8 characters long and contain at least one letter, one number, and one special character",
        400,
      ),
    );
  }

  next();
});
module.exports.login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  next();
});
module.exports.resetPassword = catchAsyncError(async (req, res, next) => {
  if (!req.body.password || !req.body.confirmPassword) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  console.log(req.body.password, req.body.confirmPassword);
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
  if (!passwordRegex.test(req.body.password)) {
    return next(
      new ErrorHandler(
        "Password must be at least 8 characters long and contain at least one letter, one number, and one special character",
        400,
      ),
    );
  }
  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password and confirm password do not match", 400),
    );
  }
  next();
});
module.exports.updatePassword = catchAsyncError(async (req, res, next) => {
  if (
    !req.body.oldPassword ||
    !req.body.newPassword ||
    !req.body.confirmPassword
  ) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;
  if (!passwordRegex.test(req.body.newPassword)) {
    return next(
      new ErrorHandler(
        "Password must be at least 8 characters long and contain at least one letter, one number, and one special character",
        400,
      ),
    );
  }
  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("New password and confirm password do not match", 400),
    );
  }
  next();
});
