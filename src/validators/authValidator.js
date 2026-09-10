const Joi = require('joi');

const addressSchema = Joi.object({
  line1: Joi.string().trim().allow(''),
  line2: Joi.string().trim().allow(''),
  city: Joi.string().trim().allow(''),
  state: Joi.string().trim().allow(''),
  postalCode: Joi.string().trim().allow(''),
  country: Joi.string().trim().allow(''),
});

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(6).max(128).required(),
    phone: Joi.string().trim().allow(''),
    address: addressSchema,
    // role is intentionally NOT accepted from the public register endpoint.
    // Admin accounts are created via seeding or by an existing admin.
  }),
};

const login = {
  body: Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().required(),
  }),
};

const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100),
    phone: Joi.string().trim().allow(''),
    address: addressSchema,
    password: Joi.string().min(6).max(128),
  }).min(1),
};

const objectIdParam = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = { register, login, updateProfile, objectIdParam };
