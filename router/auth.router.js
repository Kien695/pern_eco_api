const express = require("express");
const router = express.Router();
const controller = require("../controller/auth.controller");
const validate = require("../validates/authValidate");
const { isAuthenticated } = require("../middlewares/authMiddleware");
router.post("/register", validate.register, controller.register);
router.post("/login", validate.login, controller.login);
router.get("/me", isAuthenticated, controller.getUserDetails);
router.get("/logout", isAuthenticated, controller.logout);
router.post("/forgotpassword", controller.forgotPassword);
router.post(
  "/resetpassword/:token",
  validate.resetPassword,
  controller.resetPassword,
);
router.put(
  "/updatepassword",
  validate.updatePassword,
  isAuthenticated,
  controller.updatePassword,
);
router.patch("/updateprofile", isAuthenticated, controller.updateProfile);
module.exports = router;
