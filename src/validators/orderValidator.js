const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createOrder = {
  body: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          product: objectId.required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .min(1)
      .required(),
    shippingAddress: Joi.object({
      line1: Joi.string().trim().allow(''),
      line2: Joi.string().trim().allow(''),
      city: Joi.string().trim().allow(''),
      state: Joi.string().trim().allow(''),
      postalCode: Joi.string().trim().allow(''),
      country: Joi.string().trim().allow(''),
    }),
  }),
};

const updateOrderStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    status: Joi.string()
      .valid('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')
      .required(),
  }),
};

const idParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listOrders = {
  query: Joi.object({
    status: Joi.string().valid(
      'Pending',
      'Confirmed',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled'
    ),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

module.exports = { createOrder, updateOrderStatus, idParam, listOrders };
