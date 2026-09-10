const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Product = require('../models/Product');
const Category = require('../models/Category');
const categoryService = require('../services/categoryService');

// POST /api/products (admin)
const createProduct = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.body.category);
  if (!category) throw ApiError.badRequest('Category does not exist.');

  const existingSku = await Product.findOne({ sku: req.body.sku.toUpperCase() });
  if (existingSku) throw ApiError.conflict('A product with this SKU already exists.');

  const product = await Product.create(req.body);
  sendResponse(res, 201, 'Product created successfully', product);
});

// PATCH /api/products/:id (admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found.');

  if (req.body.category) {
    const category = await Category.findById(req.body.category);
    if (!category) throw ApiError.badRequest('Category does not exist.');
  }

  if (req.body.sku && req.body.sku.toUpperCase() !== product.sku) {
    const existingSku = await Product.findOne({ sku: req.body.sku.toUpperCase() });
    if (existingSku) throw ApiError.conflict('A product with this SKU already exists.');
  }

  Object.assign(product, req.body);
  await product.save();
  sendResponse(res, 200, 'Product updated successfully', product);
});

// DELETE /api/products/:id (admin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found.');
  await product.deleteOne();
  sendResponse(res, 200, 'Product deleted successfully');
});

// GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug');
  if (!product) throw ApiError.notFound('Product not found.');
  sendResponse(res, 200, 'Product fetched successfully', product);
});

/**
 * GET /api/products
 * Supports: search (text), category (includes subcategories), min/max
 * price, sorting, and pagination. Customers implicitly only see
 * 'active' products unless an admin explicitly requests otherwise.
 */
const listProducts = asyncHandler(async (req, res) => {
  const { search, category, minPrice, maxPrice, sortBy, page = 1, limit = 20, status } = req.query;

  const filter = {};

  // Non-admins only ever see active products.
  if (req.user && req.user.role === 'admin') {
    if (status) filter.status = status;
  } else {
    filter.status = 'active';
  }

  if (search) {
    filter.$text = { $search: search };
  }

  if (category) {
    const categoryIds = await categoryService.getSubtreeIds(category);
    filter.category = { $in: categoryIds };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    price: { price: 1 },
    '-price': { price: -1 },
    createdAt: { createdAt: 1 },
    '-createdAt': { createdAt: -1 },
    name: { name: 1 },
    '-name': { name: -1 },
  };
  const sort = sortMap[sortBy] || { createdAt: -1 };

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  sendResponse(res, 200, 'Products fetched successfully', products, {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  });
});

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
};
