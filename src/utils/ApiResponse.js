/**
 * Small helper to keep success response shape consistent across the API.
 */
class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode < 400;
    this.message = message;
    if (data !== null) this.data = data;
    if (meta !== null) this.meta = meta;
  }
}

const sendResponse = (res, statusCode, message, data = null, meta = null) => {
  return res.status(statusCode).json(new ApiResponse(statusCode, message, data, meta));
};

module.exports = { ApiResponse, sendResponse };
