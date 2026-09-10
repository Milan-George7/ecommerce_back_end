const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Category = require('../models/Category');
const categoryService = require('../services/categoryService');

// POST /api/categories (admin)
const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  sendResponse(res, 201, 'Category created successfully', category);
});

// PATCH /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  sendResponse(res, 200, 'Category updated successfully', category);
});

// DELETE /api/categories/:id (admin)
const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  sendResponse(res, 200, 'Category deleted successfully');
});

// GET /api/categories - flat list (optionally filtered by parent/isActive)
const listCategories = asyncHandler(async (req, res) => {
  const { parent, isActive } = req.query;
  const filter = {};

  if (parent !== undefined) {
    filter.parent = parent === 'null' ? null : parent;
  }
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true' || isActive === true;
  }

  const categories = await Category.find(filter).sort({ name: 1 });
  sendResponse(res, 200, 'Categories fetched successfully', categories);
});

// GET /api/categories/tree - full nested hierarchy
const getCategoryTree = asyncHandler(async (req, res) => {
  const tree = await categoryService.getCategoryTree();
  sendResponse(res, 200, 'Category tree fetched successfully', tree);
});

// GET /api/categories/:id
const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found.');
  sendResponse(res, 200, 'Category fetched successfully', category);
});

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  getCategoryTree,
  getCategory,
};
