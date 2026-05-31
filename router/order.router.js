const express = require("express");
const router = express.Router();
const controller = require("../controller/checkout.controller");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const validate = require("../validates/checkout.validate");
router.post("/payment", isAuthenticated, validate.checkout, controller.payMent);
router.post("/result", isAuthenticated, controller.resultPayment);
module.exports = router;
