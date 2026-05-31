const express = require("express");
const router = express.Router();
const controller = require("../controller/admin.controller");
const {
  isAuthenticated,
  authorizeRoles,
} = require("../middlewares/authMiddleware");
router.get(
  "/getAllUsers",
  isAuthenticated,
  authorizeRoles("admin"),
  controller.getAllUsers,
);
router.delete(
  "/deleteUser/:id",
  isAuthenticated,
  authorizeRoles("admin"),
  controller.deleteUser,
);
router.get(
  "/fetch/dashboard-stats",
  isAuthenticated,
  authorizeRoles("admin"),
  controller.dashboardStats,
);
module.exports = router;
