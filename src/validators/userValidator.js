const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const idParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listUsers = {
  query: Joi.object({
    role: Joi.string().valid('admin', 'customer'),
    isActive: Joi.boolean(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const setStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    isActive: Joi.boolean().required(),
  }),
};

module.exports = { idParam, listUsers, setStatus };
