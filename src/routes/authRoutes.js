const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const authValidator = require('../validators/authValidator');
const { protect } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, validate(authValidator.register), authController.register);
router.post('/login', authLimiter, validate(authValidator.login), authController.login);

router.get('/me', protect, authController.getProfile);
router.patch('/me', protect, validate(authValidator.updateProfile), authController.updateProfile);

module.exports = router;
