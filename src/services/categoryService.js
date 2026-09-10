const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');

const slugify = (text) =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Resolves the parent's ancestor chain and builds this category's
 * `ancestors` array (root ... immediate parent). Also guards against
 * assigning a non-existent parent.
 */
const buildAncestors = async (parentId) => {
  if (!parentId) return [];
  const parent = await Category.findById(parentId);
  if (!parent) {
    throw ApiError.badRequest('Parent category does not exist.');
  }
  return [...parent.ancestors, parent._id];
};

/**
 * Prevents circular parent-child relationships when re-parenting a
 * category: the new parent cannot be the category itself, nor any of
 * its own descendants.
 */
const assertNoCycle = async (categoryId, newParentId) => {
  if (!newParentId) return;

  if (String(newParentId) === String(categoryId)) {
    throw ApiError.badRequest('A category cannot be its own parent.');
  }

  const newParent = await Category.findById(newParentId);
  if (!newParent) {
    throw ApiError.badRequest('Parent category does not exist.');
  }

  // If the intended new parent has the category being moved among its
  // ancestors, that would create a cycle (category becoming its own
  // descendant's parent).
  const isDescendant = newParent.ancestors.some(
    (ancestorId) => String(ancestorId) === String(categoryId)
  );
  if (isDescendant) {
    throw ApiError.badRequest(
      'Invalid parent: cannot move a category under one of its own descendants.'
    );
  }
};

const createCategory = async ({ name, description, parent, isActive }) => {
  const ancestors = await buildAncestors(parent || null);
  const slug = slugify(name);

  const existing = await Category.findOne({ parent: parent || null, slug });
  if (existing) {
    throw ApiError.conflict('A sibling category with the same name already exists.');
  }

  const category = await Category.create({
    name,
    slug,
    description,
    parent: parent || null,
    ancestors,
    isActive: isActive !== undefined ? isActive : true,
  });

  return category;
};

/**
 * Updates a category. If the parent changes, re-computes this category's
 * ancestors AND cascades the update to every descendant's ancestors array
 * so the materialized path stays correct throughout the subtree.
 */
const updateCategory = async (categoryId, updates) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found.');
  }

  const parentChanged =
    updates.parent !== undefined && String(updates.parent || '') !== String(category.parent || '');

  if (parentChanged) {
    await assertNoCycle(categoryId, updates.parent || null);
  }

  if (updates.name) {
    category.name = updates.name;
    category.slug = slugify(updates.name);
  }
  if (updates.description !== undefined) category.description = updates.description;
  if (updates.isActive !== undefined) category.isActive = updates.isActive;

  if (parentChanged) {
    const newAncestors = await buildAncestors(updates.parent || null);

    // Enforce sibling name uniqueness under the new parent
    const duplicate = await Category.findOne({
      _id: { $ne: category._id },
      parent: updates.parent || null,
      slug: category.slug,
    });
    if (duplicate) {
      throw ApiError.conflict('A sibling category with the same name already exists.');
    }

    const oldAncestorsLength = category.ancestors.length;
    category.parent = updates.parent || null;
    category.ancestors = newAncestors;
    await category.save();

    // Cascade: update ancestors for the whole subtree of this category.
    const descendants = await Category.find({ ancestors: category._id });
    const bulkOps = descendants.map((d) => {
      // Replace the old prefix (root..oldParent..thisCategory) with the new prefix
      const idx = d.ancestors.findIndex((a) => String(a) === String(category._id));
      const suffix = d.ancestors.slice(idx + 1); // ancestors after this category, unchanged
      const rebuiltAncestors = [...newAncestors, category._id, ...suffix];
      return {
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { ancestors: rebuiltAncestors } },
        },
      };
    });
    if (bulkOps.length) {
      await Category.bulkWrite(bulkOps);
    }

    return category;
  }

  await category.save();
  return category;
};

const deleteCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found.');
  }

  const childCount = await Category.countDocuments({ parent: category._id });
  if (childCount > 0) {
    throw ApiError.badRequest(
      'Cannot delete a category that has child categories. Delete or reassign children first.'
    );
  }

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.badRequest(
      'Cannot delete a category that has products assigned to it. Reassign products first.'
    );
  }

  await category.deleteOne();
};

/**
 * Returns every category id in the subtree rooted at categoryId
 * (including categoryId itself). Used for "filter by parent category
 * also returns products in subcategories".
 */
const getSubtreeIds = async (categoryId) => {
  const descendants = await Category.find({ ancestors: categoryId }, { _id: 1 });
  return [new mongoose.Types.ObjectId(categoryId), ...descendants.map((d) => d._id)];
};

/**
 * Builds the full nested category tree in a single query using each
 * category's ancestors array, avoiding N+1 recursive queries.
 */
const getCategoryTree = async () => {
  const all = await Category.find().sort({ name: 1 }).lean();

  const byId = new Map(all.map((c) => [String(c._id), { ...c, children: [] }]));
  const roots = [];

  all.forEach((cat) => {
    const node = byId.get(String(cat._id));
    if (cat.parent) {
      const parentNode = byId.get(String(cat.parent));
      if (parentNode) {
        parentNode.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  return roots;
};

module.exports = {
  slugify,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubtreeIds,
  getCategoryTree,
};
