const express = require("express");
const router = express.Router();
const controller = require("../controller/auth.controller");
const { isAuthenticated } = require("../middlewares/authMiddleware");
router.post("/register", controller.register);
router.post("/login", controller.login);
router.get("/me", isAuthenticated, controller.getUserDetails);
router.get("/logout", isAuthenticated, controller.logout);
module.exports = router;
