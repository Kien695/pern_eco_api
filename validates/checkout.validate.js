const { catchAsyncError } = require("../middlewares/catchAsyncError");

module.exports.checkout = catchAsyncError(async (req, res, next) => {
  if (
    !req.body.productItems ||
    !req.body.totalAmount ||
    !req.body.full_name ||
    !req.body.phone ||
    !req.body.city ||
    !req.body.district ||
    !req.body.ward ||
    !req.body.address
  ) {
    return next(new Error("Please fill in all fields", 400));
  }
  next();
});
