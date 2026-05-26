const crypto = require("crypto");

module.exports.generateResetPasswordToken = () => {
  // Generate a random token
  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  // Set token expiration time (e.g., 1 hour)
  const resetPasswordExpireTime = Date.now() + 15 * 60 * 1000; // 1 hour in milliseconds
  return { resetToken, hashedToken, resetPasswordExpireTime };
};
