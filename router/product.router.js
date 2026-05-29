const express = require("express");
const router = express.Router();
const controller = require("../controller/product.controller");
const middleware = require("../middlewares/authMiddleware");
router.post(
  "/create",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.createProduct,
);
router.get("/all", controller.getAllProducts);
router.put(
  "/update/:productid",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.updateProduct,
);
router.delete(
  "/delete/:productid",
  middleware.isAuthenticated,
  middleware.authorizeRoles("admin"),
  controller.deleteProduct,
);
router.get("/details/:productid", controller.getProductDetails);
router.put(
  "/review/:productid",
  middleware.isAuthenticated,
  controller.postProductReview,
);
router.delete(
  "/review/:productid",
  middleware.isAuthenticated,
  controller.deleteProductReview,
);
router.post(
  "/ai-search",
  middleware.isAuthenticated,
  controller.fetchAIFilteredProducts,
);
module.exports = router;
