const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/users.db');

function initDatabase() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Connected to the SQLite database.');
    
    createTables(db);
  });
  
  return db;
}

function createTables(db) {
  db.serialize(() => {
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

    db.run(`CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model_name VARCHAR(50) NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      cost DECIMAL(10, 4) DEFAULT 0.0000,
      api_type VARCHAR(20),
      request_type VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model_name VARCHAR(50) NOT NULL,
      model_type VARCHAR(20),
      api_key TEXT,
      endpoint VARCHAR(255),
      is_enabled BOOLEAN DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      system_prompt TEXT,
      model_name VARCHAR(50),
      temperature DECIMAL(3, 2) DEFAULT 0.70,
      max_tokens INTEGER DEFAULT 2000,
      is_public BOOLEAN DEFAULT 0,
      icon VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_tokens_used INTEGER DEFAULT 0,
      total_cost DECIMAL(10, 4) DEFAULT 0.0000,
      total_requests INTEGER DEFAULT 0,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, date)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      type VARCHAR(50) DEFAULT 'document',
      file_type VARCHAR(50) DEFAULT '.md',
      metadata TEXT,
      tags TEXT,
      hash VARCHAR(64),
      size INTEGER,
      embedding BLOB,
      last_viewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Create indexes for duplicate detection optimization
    db.run(`CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_documents_user_filename ON documents(user_id, title)`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      color VARCHAR(20),
      document_ids TEXT,
      document_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, category_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      model VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE (user_id, document_id, model)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS kg_build_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('pending', 'building', 'completed', 'failed')),
      error_message TEXT,
      error_category TEXT CHECK(error_category IN ('user_error', 'system_error', 'unknown_error')),
      entity_count INTEGER DEFAULT 0,
      relation_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_kg_build_status_doc_id ON kg_build_status(doc_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_kg_build_status_status ON kg_build_status(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_kg_build_status_updated_at ON kg_build_status(updated_at)`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      web_sources TEXT,
      timestamp TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    title VARCHAR(255),
    summary TEXT,
    cover_image VARCHAR(500),
    tags TEXT,
    likes INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'published',
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
  )`);
  
  // 检查是否需要添加 is_public 列（针对旧数据库）
  db.all("PRAGMA table_info(community_posts)", (err, rows) => {
    if (err) {
      console.error('Check table info failed:', err);
      return;
    }
    const hasIsPublic = rows.some(row => row.name === 'is_public');
    if (!hasIsPublic) {
      console.log('Adding is_public column to community_posts table...');
      db.run("ALTER TABLE community_posts ADD COLUMN is_public BOOLEAN DEFAULT 0", (err) => {
        if (err) console.error('Add is_public column failed:', err);
        else console.log('Added is_public column successfully');
      });
    }
  });

    db.run(`CREATE TABLE IF NOT EXISTS community_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS community_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS community_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
    )`);

    // ============================================================
    // IM / Chat Tables
    // ============================================================
    db.run(`CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'group'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS conversation_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, user_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT,
      type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'note'
      metadata TEXT, -- JSON string for extra data
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    console.log('Database tables created successfully.');
    
    createDefaultAdmin(db);
  });
}

function createDefaultAdmin(db) {
  const adminUsername = 'admin';
  const adminPassword = 'admin123';
  
  db.get('SELECT id FROM users WHERE username = ?', [adminUsername], (err, row) => {
    if (err) {
      console.error('Error checking admin user:', err.message);
      return;
    }
    
    if (!row) {
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      
      db.run(`INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)`,
        [adminUsername, hashedPassword, 'admin', 'active'],
        (err) => {
          if (err) {
            console.error('Error creating admin user:', err.message);
          } else {
            console.log('Default admin user created successfully.');
            console.log('Username:', adminUsername);
            console.log('Password:', adminPassword);
            console.log('Please change the default password after first login!');
          }
        });
    } else {
      console.log('Admin user already exists.');
    }
  });
}

module.exports = { initDatabase, DB_PATH };