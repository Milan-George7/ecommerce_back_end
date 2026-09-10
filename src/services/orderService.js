const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');

/**
 * Creates an order for a customer:
 *  1. Loads all requested products.
 *  2. Validates each exists, is active, and has enough stock.
 *  3. Computes prices/subtotals/total on the SERVER (never trusts client price).
 *  4. Atomically decrements stock and creates the order inside a single
 *     MongoDB transaction, so a partial failure never leaves stock
 *     decremented without a corresponding order (or vice versa).
 *
 * Falls back to a non-transactional path automatically if the underlying
 * MongoDB deployment doesn't support transactions (e.g. a standalone
 * instance without a replica set, common in local dev).
 */
const createOrder = async (userId, items, shippingAddress) => {
  const productIds = items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });

  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = productMap.get(String(item.product));

    if (!product) {
      throw ApiError.notFound(`Product not found: ${item.product}`);
    }
    if (product.status !== 'active') {
      throw ApiError.badRequest(`Product '${product.name}' is not available for purchase.`);
    }
    if (product.stock < item.quantity) {
      throw ApiError.badRequest(
        `Insufficient stock for '${product.name}'. Available: ${product.stock}, requested: ${item.quantity}.`
      );
    }

    const unitPrice =
      product.salePrice !== null && product.salePrice !== undefined
        ? product.salePrice
        : product.price;
    const subtotal = Number((unitPrice * item.quantity).toFixed(2));
    totalAmount += subtotal;

    orderItems.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      price: unitPrice,
      quantity: item.quantity,
      subtotal,
    });
  }

  totalAmount = Number(totalAmount.toFixed(2));

  const attemptWithTransaction = async () => {
    const session = await mongoose.startSession();
    try {
      let order;
      await session.withTransaction(async () => {
        // Re-check + decrement stock atomically per product to avoid
        // overselling under concurrent requests.
        for (const item of orderItems) {
          const updated = await Product.findOneAndUpdate(
            { _id: item.product, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { session, new: true }
          );
          if (!updated) {
            throw ApiError.badRequest(
              `Insufficient stock for '${item.name}'. Please refresh and try again.`
            );
          }
        }

        const created = await Order.create(
          [
            {
              user: userId,
              items: orderItems,
              totalAmount,
              status: 'Pending',
              shippingAddress,
              statusHistory: [{ status: 'Pending', changedBy: userId }],
            },
          ],
          { session }
        );
        order = created[0];
      });
      return order;
    } finally {
      await session.endSession();
    }
  };

  const attemptWithoutTransaction = async () => {
    // Best-effort atomic-per-item decrement without a multi-document
    // transaction (works on standalone MongoDB instances).
    const decremented = [];
    try {
      for (const item of orderItems) {
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (!updated) {
          throw ApiError.badRequest(
            `Insufficient stock for '${item.name}'. Please refresh and try again.`
          );
        }
        decremented.push(item);
      }

      const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount,
        status: 'Pending',
        shippingAddress,
        statusHistory: [{ status: 'Pending', changedBy: userId }],
      });
      return order;
    } catch (err) {
      // Roll back any stock we already decremented before the failure.
      await Promise.all(
        decremented.map((item) =>
          Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
        )
      );
      throw err;
    }
  };

  try {
    return await attemptWithTransaction();
  } catch (err) {
    // Transactions require a replica set / mongos. If unsupported, fall back.
    const unsupported =
      err.code === 20 || /Transaction numbers|replica set/i.test(err.message || '');
    if (unsupported) {
      return attemptWithoutTransaction();
    }
    throw err;
  }
};

const transitionStatus = async (order, newStatus, changedBy) => {
  const allowed = Order.ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(newStatus)) {
    throw ApiError.badRequest(
      `Cannot transition order from '${order.status}' to '${newStatus}'.`
    );
  }

  // If cancelling, restock the items.
  if (newStatus === 'Cancelled') {
    await Promise.all(
      order.items.map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      )
    );
  }

  order.status = newStatus;
  order.statusHistory.push({ status: newStatus, changedBy });
  await order.save();
  return order;
};

module.exports = { createOrder, transitionStatus };
