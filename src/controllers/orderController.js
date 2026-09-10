const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Order = require('../models/Order');
const orderService = require('../services/orderService');

// POST /api/orders (customer)
const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress } = req.body;
  const order = await orderService.createOrder(req.user._id, items, shippingAddress);
  sendResponse(res, 201, 'Order placed successfully', order);
});

// GET /api/orders/my (customer) - only their own orders
const listMyOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  sendResponse(res, 200, 'Orders fetched successfully', orders, {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  });
});

// GET /api/orders/my/:id (customer) - only their own order
const getMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found.');
  sendResponse(res, 200, 'Order fetched successfully', order);
});

// GET /api/orders (admin) - all orders
const listAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  sendResponse(res, 200, 'Orders fetched successfully', orders, {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  });
});

// GET /api/orders/:id (admin)
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw ApiError.notFound('Order not found.');
  sendResponse(res, 200, 'Order fetched successfully', order);
});

// PATCH /api/orders/:id/status (admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found.');

  const updated = await orderService.transitionStatus(order, req.body.status, req.user._id);
  sendResponse(res, 200, 'Order status updated successfully', updated);
});

module.exports = {
  createOrder,
  listMyOrders,
  getMyOrder,
  listAllOrders,
  getOrder,
  updateOrderStatus,
};
