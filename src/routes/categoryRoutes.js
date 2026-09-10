const express = require('express');
const categoryController = require('../controllers/categoryController');
const validate = require('../middlewares/validate');
const categoryValidator = require('../validators/categoryValidator');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/role');

const router = express.Router();

// Public read endpoints - anyone can browse categories
router.get('/tree', categoryController.getCategoryTree);
router.get('/', validate(categoryValidator.listCategories), categoryController.listCategories);
router.get('/:id', validate(categoryValidator.idParam), categoryController.getCategory);

// Admin-only write endpoints
router.post(
  '/',
  protect,
  authorize('admin'),
  validate(categoryValidator.createCategory),
  categoryController.createCategory
);
router.patch(
  '/:id',
  protect,
  authorize('admin'),
  validate(categoryValidator.updateCategory),
  categoryController.updateCategory
);
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validate(categoryValidator.idParam),
  categoryController.deleteCategory
);

module.exports = router;
