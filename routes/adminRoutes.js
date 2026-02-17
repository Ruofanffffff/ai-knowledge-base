const express = require('express');
const { adminMiddleware } = require('../services/authService');
const adminController = require('../controllers/adminController');
const { initDatabase } = require('../database/initUserDB');

const router = express.Router();

function initAdminRoutes() {
  initDatabase();
  return router;
}

router.get('/users', adminMiddleware, adminController.getUsers);
router.get('/stats', adminMiddleware, adminController.getStats);
router.get('/users/:id', adminMiddleware, adminController.getUserById);
router.put('/users/:id', adminMiddleware, adminController.updateUser);
router.put('/users/:id/status', adminMiddleware, adminController.updateUserStatus);
router.put('/users/:id/role', adminMiddleware, adminController.updateUserRole);
router.delete('/users/:id', adminMiddleware, adminController.deleteUser);
router.get('/stats/users', adminMiddleware, adminController.getUserGrowthStats);
router.get('/stats/tokens', adminMiddleware, adminController.getTokenUsageStats);
router.get('/models', adminMiddleware, adminController.getModels);
router.get('/users/:id/stats', adminMiddleware, adminController.getUserStats);

module.exports = { router, initAdminRoutes };
