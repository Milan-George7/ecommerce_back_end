const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createProduct = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    sku: Joi.string().trim().min(1).max(50).required(),
    description: Joi.string().trim().allow('').max(5000),
    price: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0).allow(null),
    stock: Joi.number().integer().min(0).required(),
    category: objectId.required(),
    images: Joi.array().items(Joi.string().uri().allow('')),
    status: Joi.string().valid('active', 'inactive'),
  }),
};

const updateProduct = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200),
    sku: Joi.string().trim().min(1).max(50),
    description: Joi.string().trim().allow('').max(5000),
    price: Joi.number().min(0),
    salePrice: Joi.number().min(0).allow(null),
    stock: Joi.number().integer().min(0),
    category: objectId,
    images: Joi.array().items(Joi.string().uri().allow('')),
    status: Joi.string().valid('active', 'inactive'),
  }).min(1),
};

const idParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listProducts = {
  query: Joi.object({
    search: Joi.string().trim().allow(''),
    category: objectId,
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    sortBy: Joi.string().valid('price', '-price', 'createdAt', '-createdAt', 'name', '-name'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('active', 'inactive'),
  }),
};

module.exports = { createProduct, updateProduct, idParam, listProducts };
