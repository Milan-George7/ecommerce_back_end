const express = require('express');
const orderController = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const orderValidator = require('../validators/orderValidator');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/role');

const router = express.Router();

router.use(protect); // every order route requires authentication

// Customer routes
router.post('/', authorize('customer'), validate(orderValidator.createOrder), orderController.createOrder);
router.get('/my', authorize('customer'), validate(orderValidator.listOrders), orderController.listMyOrders);
router.get('/my/:id', authorize('customer'), validate(orderValidator.idParam), orderController.getMyOrder);

// Admin routes
router.get('/', authorize('admin'), validate(orderValidator.listOrders), orderController.listAllOrders);
router.get('/:id', authorize('admin'), validate(orderValidator.idParam), orderController.getOrder);
router.patch(
  '/:id/status',
  authorize('admin'),
  validate(orderValidator.updateOrderStatus),
  orderController.updateOrderStatus
);

module.exports = router;
