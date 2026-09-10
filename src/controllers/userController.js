const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const User = require('../models/User');

// GET /api/users (admin)
const listUsers = asyncHandler(async (req, res) => {
  const { role, isActive, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  sendResponse(res, 200, 'Users fetched successfully', users, {
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  });
});

// GET /api/users/:id (admin)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  sendResponse(res, 200, 'User fetched successfully', user);
});

// PATCH /api/users/:id/status (admin) - activate/deactivate
const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    throw ApiError.badRequest('isActive must be a boolean.');
  }

  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot change the active status of your own account.');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  user.isActive = isActive;
  await user.save();

  sendResponse(res, 200, `User has been ${isActive ? 'activated' : 'deactivated'}.`, user);
});

module.exports = { listUsers, getUser, setUserStatus };
