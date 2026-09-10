const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true }, // snapshot at order time
    sku: { type: String, required: true }, // snapshot at order time
    price: { type: Number, required: true, min: 0 }, // unit price at order time
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

// Allowed forward transitions - keeps status changes sane.
const ALLOWED_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'Pending',
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;
orderSchema.statics.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;

module.exports = mongoose.model('Order', orderSchema);
