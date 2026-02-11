/**
 * Database Configuration
 * Centralizes database connection settings
 */

const path = require('path');

module.exports = {
  DATABASE_PATH: path.join(__dirname, '..', 'data', 'user.db'),
  USER_DB_PATH: path.join(__dirname, '..', 'database', 'user.db'),
};
