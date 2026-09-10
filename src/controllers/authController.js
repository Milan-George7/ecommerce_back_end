const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const { generateToken } = require('../utils/token');
const User = require('../models/User');

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  // Public registration always creates a customer account.
  const user = await User.create({
    name,
    email,
    password,
    phone,
    address,
    role: 'customer',
  });

  const token = generateToken(user);
  sendResponse(res, 201, 'Registration successful', {
    user: user.toSafeObject(),
    token,
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact support.');
  }

  const token = generateToken(user);
  sendResponse(res, 200, 'Login successful', {
    user: user.toSafeObject(),
    token,
  });
});

// GET /api/auth/me
const getProfile = asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'Profile fetched successfully', { user: req.user.toSafeObject() });
});

// PATCH /api/auth/me
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'address', 'password'];
  const user = await User.findById(req.user._id);

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  });

  await user.save();
  sendResponse(res, 200, 'Profile updated successfully', { user: user.toSafeObject() });
});

module.exports = { register, login, getProfile, updateProfile };
