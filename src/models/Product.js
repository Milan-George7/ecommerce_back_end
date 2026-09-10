const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    salePrice: {
      type: Number,
      min: [0, 'Sale price cannot be negative'],
      default: null,
      validate: {
        validator: function validateSalePrice(value) {
          if (value === null || value === undefined) return true;
          return value <= this.price;
        },
        message: 'Sale price cannot be greater than the regular price',
      },
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    images: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });
// Text index for search across name/description
productSchema.index({ name: 'text', description: 'text' });

// Effective selling price (sale price if valid and set, else regular price)
productSchema.virtual('effectivePrice').get(function getEffectivePrice() {
  if (this.salePrice !== null && this.salePrice !== undefined) {
    return this.salePrice;
  }
  return this.price;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
