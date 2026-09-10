const express = require('express');
const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const productValidator = require('../validators/productValidator');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/role');
const optionalAuth = require('../middlewares/optionalAuth');

const router = express.Router();

// Public browsing endpoints (optionalAuth lets an admin see inactive products too)
router.get('/', optionalAuth, validate(productValidator.listProducts), productController.listProducts);
router.get('/:id', validate(productValidator.idParam), productController.getProduct);

// Admin-only write endpoints
router.post(
  '/',
  protect,
  authorize('admin'),
  validate(productValidator.createProduct),
  productController.createProduct
);
router.patch(
  '/:id',
  protect,
  authorize('admin'),
  validate(productValidator.updateProduct),
  productController.updateProduct
);
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validate(productValidator.idParam),
  productController.deleteProduct
);

module.exports = router;
