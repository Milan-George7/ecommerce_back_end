const mongoose = require('mongoose');

/**
 * Multi-level category tree.
 *
 * We use a hybrid model:
 *  - `parent`: direct parent reference (or null for a root category)
 *  - `ancestors`: materialized path containing every ancestor id from
 *     root -> immediate parent. This makes "give me this category + all
 *     descendants" (used for product filtering) a single indexed query
 *     instead of a recursive walk, while `parent` keeps single-level
 *     operations (siblings, direct children) simple.
 *
 * Depth is NOT fixed - `ancestors` can grow to any length.
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    ancestors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A category name must be unique among siblings (same parent), not globally.
categorySchema.index({ parent: 1, slug: 1 }, { unique: true });
categorySchema.index({ ancestors: 1 });

categorySchema.virtual('level').get(function getLevel() {
  return this.ancestors ? this.ancestors.length : 0;
});

categorySchema.set('toJSON', { virtuals: true });
categorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', categorySchema);
