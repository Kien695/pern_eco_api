const { ErrorHandler } = require("../middlewares/errorMiddleware");
const { catchAsyncError } = require("../middlewares/catchAsyncError");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const { database } = require("../config/database");
const { sendToken } = require("../utils/jwtToken");
const {
  generateEmailTemplate,
} = require("../utils/generateForgotPasswordEmailTemplate");
const {
  generateResetPasswordToken,
} = require("../utils/generateResetPasswordToken");
const { sendMail } = require("../utils/sendEmail");
//register
module.exports.register = catchAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;

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
//forgot password
module.exports.forgotPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  const { frontendUrl } = req.query;
  const userExit = await database.query(`select * from users where email=$1`, [
    email,
  ]);
  if (userExit.rows.length === 0) {
    return next(new ErrorHandler("User not found with this email", 404));
  }
  const user = userExit.rows[0];
  const { resetToken, hashedToken, resetPasswordExpireTime } =
    generateResetPasswordToken();
  await database.query(
    `
      update users set reset_password_token=$1, reset_password_expire=to_timestamp($2) where id=$3
    `,
    [hashedToken, resetPasswordExpireTime / 1000, user.id],
  );
  const resetPasswordUrl = `${frontendUrl}/password/reset/${resetToken}`;
  const message = generateEmailTemplate(resetPasswordUrl);
  try {
    await sendMail({
      email: user.email,
      subject: "Ecommerce Password Recovery",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    await database.query(
      `
        update users set reset_password_token=null, reset_password_expire=null where id=$1
      `,
      [user.id],
    );
    return next(new ErrorHandler(error.message, 500));
  }
});
//reset password
module.exports.resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await database.query(
    "select * from users where reset_password_token=$1 and reset_password_expire>NOW()",
    [resetPasswordToken],
  );
  if (user.rows.length === 0) {
    return next(new ErrorHandler("Invalid or expired reset token", 400));
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const updatedtedUser = await database.query(
    "update users set password=$1 ,reset_password_token=null,reset_password_expire=null where id=$2 returning *",
    [hashedPassword, user.rows[0].id],
  );
  sendToken(updatedtedUser.rows[0], 200, "Password reset successfully", res);
});
//update password
module.exports.updatePassword = catchAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  const isPasswordMatch = await bcrypt.compare(oldPassword, req.user.password);
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Old password is incorrect", 400));
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const updatedtedUser = await database.query(
    "update users set password=$1 where id=$2 returning *",
    [hashedPassword, req.user.id],
  );
  res.status(200).json({
    success: true,

    message: "Password updated successfully",
  });
});
//update profile
module.exports.updateProfile = catchAsyncError(async (req, res, next) => {
  const { name, email } = req.body;
  if (name.trim().length === 0 || email.trim().length === 0) {
    return next(new ErrorHandler("Please fill in all fields", 400));
  }
  let avatarData = {};
  if (req.files && req.files.avatar) {
    const { avatar } = req.files;
    if (req.user.avatar && req.user.avatar.public_id) {
      await cloudinary.uploader.destroy(req.user.avatar.public_id);
    }
    const result = await cloudinary.uploader.upload(avatar.tempFilePath, {
      folder: "eco_pern",
      width: 150,
      crop: "scale",
    });
    avatarData = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }
  let user;
  if (Object.keys(avatarData).length == 0) {
    user = await database.query(
      "update users set name=$1, email=$2 where id=$3 returning *",
      [name, email, req.user.id],
    );
  } else {
    user = await database.query(
      "update users set name=$1, email=$2, avatar=$3 where id=$4 returning *",
      [name, email, avatarData, req.user.id],
    );
  }
  res.status(200).json({
    success: true,
    user: user ? user.rows[0] : req.user,
    message: "Profile updated successfully",
  });
});
