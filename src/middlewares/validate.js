const ApiError = require('../utils/ApiError');

/**
 * validate({ body: joiSchema, query: joiSchema, params: joiSchema })
 * Validates the relevant parts of the request against Joi schemas and
 * replaces req[part] with the sanitized/cast value on success.
 */
const validate = (schemas) => (req, res, next) => {
  const errors = [];

  ['body', 'query', 'params'].forEach((part) => {
    if (!schemas[part]) return;
    const { error, value } = schemas[part].validate(req[part], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      error.details.forEach((d) => errors.push(`${part}.${d.path.join('.')}: ${d.message}`));
    } else {
      req[part] = value;
    }
  });

  if (errors.length) {
    return next(ApiError.badRequest('Validation failed', errors));
  }

  next();
};

module.exports = validate;
