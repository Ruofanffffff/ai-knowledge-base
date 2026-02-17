const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const path = require('path');

// Mock bcrypt to avoid architecture mismatch issues
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  hashSync: jest.fn().mockReturnValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
  compareSync: jest.fn().mockReturnValue(true)
}));

const bcrypt = require('bcrypt');

// Create in-memory DB
// const db = new sqlite3.Database(':memory:');

// Mock initUserDB
// We need to mock the module that server.js imports
jest.mock('../database/initUserDB', () => {
  const sqlite3 = require('sqlite3').verbose();
  const mockDb = new sqlite3.Database(':memory:');
  return {
    initDatabase: () => mockDb,
    DB_PATH: ':memory:',
    _db: mockDb
  };
});

// Mock unificationScheduler to prevent background tasks
jest.mock('../services/unificationScheduler', () => ({
  start: jest.fn(),
  stop: jest.fn()
}));

// Mock minioService
jest.mock('../services/minioService', () => ({
  ensureBucket: jest.fn().mockResolvedValue(true)
}));

// Set test environment before requiring app
process.env.NODE_ENV = 'test';

// Mock console.log to keep test output clean, but keep error
const originalConsoleLog = console.log;
// console.log = jest.fn(); 

let app;
// Get the db instance from the mock
const { _db: db } = require('../database/initUserDB');

let adminToken;
let userToken;
let disabledUserToken;
let adminId;
let userId;
let disabledUserId;

// Helper to create token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key-change-in-production', { expiresIn: '1h' });
};

// Setup DB schema
const setupDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        wechat_openid VARCHAR(100) UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      )`);

      // Create user_sessions table
      db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token VARCHAR(500) UNIQUE NOT NULL,
        refresh_token VARCHAR(500),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);

      // Create documents table (for admin list query)
      db.run(`CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT,
        content TEXT,
        type TEXT,
        file_type TEXT,
        metadata TEXT,
        tags TEXT,
        embedding TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_viewed_at DATETIME,
        hash TEXT,
        size INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // Create token_usage table (for admin list query)
      db.run(`CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

// Create test users
const seedUsers = async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Admin user
      db.run(`INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
        ['admin', 'admin@example.com', passwordHash, 'admin', 'active'],
        function(err) {
          if (err) return reject(err);
          adminId = this.lastID;
          adminToken = generateToken(adminId);
          
          // Regular user
          db.run(`INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
            ['user', 'user@example.com', passwordHash, 'user', 'active'],
            function(err) {
              if (err) return reject(err);
              userId = this.lastID;
              userToken = generateToken(userId);
              
              // Disabled user (initially active, will be disabled in test)
              db.run(`INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
                ['disabled', 'disabled@example.com', passwordHash, 'user', 'active'], // Start active to test disable
                function(err) {
                  if (err) return reject(err);
                  disabledUserId = this.lastID;
                  // We don't generate token yet, or we generate one to test if it works before disable
                  disabledUserToken = generateToken(disabledUserId);
                  resolve();
                }
              );
            }
          );
        }
      );
    });
  });
};

beforeAll(async () => {
  await setupDb();
  // Load app after mocks and DB setup
  app = require('../server');
});

beforeEach(async () => {
  // Clear tables and re-seed for fresh state
  await new Promise((resolve) => db.run('DELETE FROM users', resolve));
  await seedUsers();
});

afterAll(async () => {
  await new Promise(resolve => db.close(resolve));
});

describe('Admin API & User Status Tests', () => {
  
  test('Admin should be able to get user list (200 OK)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(3); // admin, user, disabled
  });

  test('Regular user should NOT be able to get user list (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(res.statusCode).toEqual(403);
  });

  test('Admin should be able to disable a user', async () => {
    // 1. Verify user is active
    let res = await request(app)
      .get(`/api/admin/users/${disabledUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.status).toBe('active'); // Controller returns { success: true, data: user }

    // 2. Disable user
    res = await request(app)
      .put(`/api/admin/users/${disabledUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'disabled' }); 
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    // 3. Verify in DB
    const user = await new Promise((resolve) => {
      db.get('SELECT status FROM users WHERE id = ?', [disabledUserId], (err, row) => resolve(row));
    });
    expect(user.status).toBe('disabled');
  });

  test('Disabled user should fail to login', async () => {
    // 1. Disable the user first (or update DB directly)
    await new Promise((resolve) => {
      db.run('UPDATE users SET status = ? WHERE id = ?', ['disabled', disabledUserId], resolve);
    });

    // 2. Try to login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'disabled',
        password: 'password123'
      });
    
    expect(res.statusCode).not.toEqual(200);
    expect(res.body.error || res.body.message).toMatch(/禁用|disabled/);
  });

  test('Disabled user token should be rejected by middleware', async () => {
    // 1. Update user status to disabled
    await new Promise((resolve) => {
      db.run('UPDATE users SET status = ? WHERE id = ?', ['disabled', userId], (err) => {
        if (err) console.error('Update error:', err);
        resolve();
      });
    });

    // 2. Try to access protected route with valid token (issued before ban)
    const res = await request(app)
      .get('/api/auth/me') 
      .set('Authorization', `Bearer ${userToken}`);
    
    // authMiddleware checks status
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/禁用|disabled/);
  });
});
