const express = require("express");
const router = express.Router();
const controller = require("../controller/checkout.controller");
const middleware = require("../middlewares/authMiddleware");
const validate = require("../validates/checkout.validate");
router.post(
  "/payment",
  middleware.isAuthenticated,
  validate.checkout,
  controller.payMent,
);
router.post("/result", middleware.isAuthenticated, controller.resultPayment);
router.get("/:id", middleware.isAuthenticated, controller.fetchSingleOrder);
router.get("/orders/me", middleware.isAuthenticated, controller.fetchMyOrders);
router.get(
  "/admin/getall",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.fetchAllOrders,
);
router.put(
  "/admin/update/:orderId",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.updateOrderStatus,
);
router.delete(
  "/admin/delete/:orderId",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.deleteOrder,
);
module.exports = router;
