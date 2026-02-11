/**
 * Monitoring Dashboard API Routes
 * 
 * Express routes for accessing monitoring dashboard data
 */

const express = require('express');
const router = express.Router();
const { MonitoringDashboard } = require('./monitoring_dashboard');

// Initialize dashboard
const dashboard = new MonitoringDashboard();

/**
 * GET /api/monitoring/dashboard
 * Get complete dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await dashboard.getDashboardData();
    res.json(data);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/token-metrics
 * Get token consumption metrics
 */
router.get('/token-metrics', async (req, res) => {
  try {
    const metrics = await dashboard.getTokenMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching token metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch token metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/accuracy-metrics
 * Get accuracy metrics
 */
router.get('/accuracy-metrics', async (req, res) => {
  try {
    const metrics = await dashboard.getAccuracyMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching accuracy metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch accuracy metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/latency-metrics
 * Get latency metrics
 */
router.get('/latency-metrics', async (req, res) => {
  try {
    const metrics = await dashboard.getLatencyMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching latency metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch latency metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/system-health
 * Get system health status
 */
router.get('/system-health', async (req, res) => {
  try {
    const health = await dashboard.getSystemHealth();
    res.json(health);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      error: 'Failed to fetch system health',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get all active alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = dashboard.getAllAlerts();
    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/summary
 * Get summary statistics
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await dashboard.getSummaryStats();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching summary stats:', error);
    res.status(500).json({
      error: 'Failed to fetch summary stats',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/export
 * Export dashboard data
 */
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = await dashboard.exportData(format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=monitoring-data.csv');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=monitoring-data.json');
    }
    
    res.send(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      error: 'Failed to export data',
      message: error.message
    });
  }
});

/**
 * POST /api/monitoring/auto-refresh/start
 * Start auto-refresh
 */
router.post('/auto-refresh/start', (req, res) => {
  try {
    dashboard.startAutoRefresh();
    res.json({ message: 'Auto-refresh started', interval: dashboard.config.refreshInterval });
  } catch (error) {
    console.error('Error starting auto-refresh:', error);
    res.status(500).json({
      error: 'Failed to start auto-refresh',
      message: error.message
    });
  }
});

/**
 * POST /api/monitoring/auto-refresh/stop
 * Stop auto-refresh
 */
router.post('/auto-refresh/stop', (req, res) => {
  try {
    dashboard.stopAutoRefresh();
    res.json({ message: 'Auto-refresh stopped' });
  } catch (error) {
    console.error('Error stopping auto-refresh:', error);
    res.status(500).json({
      error: 'Failed to stop auto-refresh',
      message: error.message
    });
  }
});

module.exports = router;
