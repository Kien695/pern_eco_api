const ErrorHandler = require("../middlewares/errorMiddleware");
const { catchAsyncError } = require("../middlewares/catchAsyncError");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { database } = require("../config/database");
const { sendToken } = require("../utils/jwtToken");
//register
module.exports.register = catchAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  const isRegister = await database.query(
    ` select * from users where email=$1`,
    [email],
  );
  if (isRegister.rows.length > 0) {
    return next(new ErrorHandler("Email already exists", 400));
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await database.query(
    `insert into users(name,email,password) values($1,$2,$3) returning *`,
    [name, email, hashedPassword],
  );
  sendToken(user.rows[0], 201, "User registered successfully", res);
});
//login
module.exports.login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  const user = await database.query(`select * from users where email=$1`, [
    email,
  ]);
  if (user.rows.length === 0) {
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  const isPasswordMatch = await bcrypt.compare(password, user.rows[0].password);
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid email or password", 400));
  }
  sendToken(user.rows[0], 200, "User logged in successfully", res);
});
//get user details
module.exports.getUserDetails = catchAsyncError(async (req, res, next) => {
  const { user } = req;
  res.status(200).json({
    success: true,
    user,
  });
});
//logout
module.exports.logout = catchAsyncError(async (req, res, next) => {
  res
    .clearCookie("token", {
      httpOnly: true,
    })
    .status(200)
    .json({
      success: true,
      message: "User logged out successfully",
    });
});
