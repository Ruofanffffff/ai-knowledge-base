// 用户数据库模型设计

// 用户表
const UserSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  username: 'VARCHAR(50) UNIQUE NOT NULL',
  email: 'VARCHAR(100) UNIQUE',
  phone: 'VARCHAR(20) UNIQUE',
  wechat_openid: 'VARCHAR(100) UNIQUE',
  password: 'VARCHAR(255) NOT NULL',
  avatar: 'VARCHAR(255)',
  role: 'VARCHAR(20) DEFAULT "user"',
  status: 'VARCHAR(20) DEFAULT "active"',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  last_login_at: 'DATETIME'
};

// 用户会话表
const UserSessionSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER NOT NULL',
  token: 'VARCHAR(500) UNIQUE NOT NULL',
  refresh_token: 'VARCHAR(500)',
  expires_at: 'DATETIME NOT NULL',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  ip_address: 'VARCHAR(45)',
  user_agent: 'VARCHAR(255)'
};

// Token消耗记录表
const TokenUsageSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER NOT NULL',
  model_name: 'VARCHAR(50) NOT NULL',
  tokens_used: 'INTEGER DEFAULT 0',
  cost: 'DECIMAL(10, 4) DEFAULT 0.0000',
  api_type: 'VARCHAR(20)',
  request_type: 'VARCHAR(50)',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  FOREIGN_KEY: 'user_id REFERENCES users(id) ON DELETE CASCADE'
};

// 用户模型配置表
const UserModelSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER NOT NULL',
  model_name: 'VARCHAR(50) NOT NULL',
  model_type: 'VARCHAR(20)',
  api_key: 'TEXT',
  endpoint: 'VARCHAR(255)',
  is_enabled: 'BOOLEAN DEFAULT 1',
  priority: 'INTEGER DEFAULT 0',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  FOREIGN_KEY: 'user_id REFERENCES users(id) ON DELETE CASCADE'
};

// 智能体表
const AgentSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER NOT NULL',
  name: 'VARCHAR(100) NOT NULL',
  description: 'TEXT',
  system_prompt: 'TEXT',
  model_name: 'VARCHAR(50)',
  temperature: 'DECIMAL(3, 2) DEFAULT 0.70',
  max_tokens: 'INTEGER DEFAULT 2000',
  is_public: 'BOOLEAN DEFAULT 0',
  icon: 'VARCHAR(255)',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  updated_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  FOREIGN_KEY: 'user_id REFERENCES users(id) ON DELETE CASCADE'
};

// 用户统计表
const UserStatsSchema = {
  id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
  user_id: 'INTEGER NOT NULL',
  total_tokens_used: 'INTEGER DEFAULT 0',
  total_cost: 'DECIMAL(10, 4) DEFAULT 0.0000',
  total_requests: 'INTEGER DEFAULT 0',
  date: 'DATE NOT NULL',
  created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
  FOREIGN_KEY: 'user_id REFERENCES users(id) ON DELETE CASCADE',
  UNIQUE: '(user_id, date)'
};

// 导出表结构
module.exports = {
  UserSchema,
  UserSessionSchema,
  TokenUsageSchema,
  UserModelSchema,
  AgentSchema,
  UserStatsSchema
};