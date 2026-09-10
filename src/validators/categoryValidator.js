const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(150).required(),
    description: Joi.string().trim().max(1000).allow(''),
    parent: objectId.allow(null),
    isActive: Joi.boolean(),
  }),
};

const updateCategory = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(150),
    description: Joi.string().trim().max(1000).allow(''),
    parent: objectId.allow(null),
    isActive: Joi.boolean(),
  }).min(1),
};

const idParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listCategories = {
  query: Joi.object({
    isActive: Joi.boolean(),
    parent: objectId.allow('null'),
  }),
};

module.exports = { createCategory, updateCategory, idParam, listCategories };
