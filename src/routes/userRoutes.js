const express = require('express');
const userController = require('../controllers/userController');
const validate = require('../middlewares/validate');
const userValidator = require('../validators/userValidator');
const { protect } = require('../middlewares/auth');
const { authorize } = require('../middlewares/role');

const router = express.Router();

// All routes below are admin-only
router.use(protect, authorize('admin'));

router.get('/', validate(userValidator.listUsers), userController.listUsers);
router.get('/:id', validate(userValidator.idParam), userController.getUser);
router.patch('/:id/status', validate(userValidator.setStatus), userController.setUserStatus);

module.exports = router;
