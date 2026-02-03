# Schema 驱动知识图谱系统 - 部署指南

## 1. 概述

本文档详细说明如何部署 Schema 驱动知识图谱系统,包括环境要求、安装步骤、配置说明和运维指南。

### 1.1 部署架构

```
┌─────────────────────────────────────────────┐
│           负载均衡器 (可选)                  │
│         Nginx / HAProxy                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         应用服务器 (Node.js)                 │
│  - Express Server                           │
│  - KG Modules                               │
│  - API Routes                               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│           数据库服务器                       │
│  - PostgreSQL / SQLite                      │
│  - Prisma ORM                               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│           外部服务                           │
│  - Qwen API (通义千问)                      │
│  - DeepSeek API                             │
└─────────────────────────────────────────────┘
```

## 2. 环境要求

### 2.1 硬件要求

**最低配置**:
- CPU: 2 核
- 内存: 4 GB
- 磁盘: 20 GB

**推荐配置**:
- CPU: 4 核或更多
- 内存: 8 GB 或更多
- 磁盘: 50 GB 或更多 (SSD 推荐)

### 2.2 软件要求

**必需软件**:
- Node.js: >= 18.0.0
- npm: >= 9.0.0 或 yarn >= 1.22.0
- Git: >= 2.0.0

**数据库** (选择其一):
- SQLite: >= 3.35.0 (开发环境)
- PostgreSQL: >= 13.0 (生产环境推荐)

**可选软件**:
- PM2: 进程管理器
- Nginx: 反向代理和负载均衡
- Docker: 容器化部署

### 2.3 操作系统

支持以下操作系统:
- Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- macOS (10.15+)
- Windows (10+, 需要 WSL2)

## 3. 安装步骤

### 3.1 克隆代码仓库

```bash
# 克隆仓库
git clone https://github.com/your-org/knowledge-graph.git
cd knowledge-graph

# 切换到稳定分支
git checkout main
```

### 3.2 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 3.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**必需配置项**:
```bash
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/kg_db"
# 或使用 SQLite (开发环境)
# DATABASE_URL="file:./prisma/knowledge-base.db"

# LLM API 配置
QWEN_API_KEY="your_qwen_api_key_here"
QWEN_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 知识图谱配置
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=100000
KG_TOKEN_PER_DOCUMENT_LIMIT=5000
```

详细配置说明请参考 [CONFIG.md](./CONFIG.md)

### 3.4 初始化数据库

```bash
# 运行数据库迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

### 3.5 导入 Schema

```bash
# 导入预定义的 250 个 Schema
node kg/schema/load_schemas.js
```

### 3.6 启动服务

**开发环境**:
```bash
npm run dev
```

**生产环境**:
```bash
npm start
```


## 4. 生产环境部署

### 4.1 使用 PM2 部署

PM2 是推荐的 Node.js 进程管理器。

**安装 PM2**:
```bash
npm install -g pm2
```

**创建 PM2 配置文件** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'kg-server',
    script: './server.js',
    instances: 'max',  // 使用所有 CPU 核心
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

**启动服务**:
```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs kg-server

# 重启应用
pm2 restart kg-server

# 停止应用
pm2 stop kg-server

# 设置开机自启
pm2 startup
pm2 save
```

### 4.2 使用 Nginx 反向代理

**安装 Nginx**:
```bash
# Ubuntu/Debian
sudo apt-get install nginx

# CentOS/RHEL
sudo yum install nginx
```

**配置 Nginx** (`/etc/nginx/sites-available/kg-server`):
```nginx
upstream kg_backend {
    server 127.0.0.1:3000;
    # 如果有多个实例,添加更多服务器
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name your-domain.com;

    # 日志配置
    access_log /var/log/nginx/kg-access.log;
    error_log /var/log/nginx/kg-error.log;

    # 客户端请求体大小限制
    client_max_body_size 100M;

    # 代理配置
    location /api/knowledge-graph {
        proxy_pass http://kg_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件
    location / {
        root /var/www/kg-frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

**启用配置**:
```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/kg-server /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4.3 使用 Docker 部署

**创建 Dockerfile**:
```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
```

**创建 docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://kg_user:kg_password@db:5432/kg_db
      - QWEN_API_KEY=${QWEN_API_KEY}
    depends_on:
      - db
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=kg_user
      - POSTGRES_PASSWORD=kg_password
      - POSTGRES_DB=kg_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

**启动容器**:
```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止容器
docker-compose down

# 重启容器
docker-compose restart
```

## 5. 数据库配置

### 5.1 PostgreSQL 配置

**安装 PostgreSQL**:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
```

**创建数据库和用户**:
```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 创建数据库
CREATE DATABASE kg_db;

# 创建用户
CREATE USER kg_user WITH PASSWORD 'your_secure_password';

# 授予权限
GRANT ALL PRIVILEGES ON DATABASE kg_db TO kg_user;

# 退出
\q
```

**配置连接**:
```bash
# 编辑 .env 文件
DATABASE_URL="postgresql://kg_user:your_secure_password@localhost:5432/kg_db"
```

**运行迁移**:
```bash
npx prisma migrate deploy
```

### 5.2 SQLite 配置 (开发环境)

SQLite 无需额外安装,直接配置即可:

```bash
# 编辑 .env 文件
DATABASE_URL="file:./prisma/knowledge-base.db"

# 运行迁移
npx prisma migrate deploy
```

### 5.3 数据库优化

**PostgreSQL 优化**:
```sql
-- 创建索引
CREATE INDEX idx_entity_type ON "Entity"(type);
CREATE INDEX idx_entity_confidence ON "Entity"(confidence);
CREATE INDEX idx_relation_type ON "Relation"(type);
CREATE INDEX idx_relation_confidence ON "Relation"(confidence);
CREATE INDEX idx_schema_scene ON "Schema"(scene);
CREATE INDEX idx_schema_active ON "Schema"(active);

-- 分析表
ANALYZE "Entity";
ANALYZE "Relation";
ANALYZE "Schema";
ANALYZE "CKB";
```

**连接池配置**:
```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // 连接池配置
  connection_limit = 10
  pool_timeout = 30
}
```

## 6. 环境变量配置

### 6.1 核心配置

```bash
# ============================================
# 基础配置
# ============================================
NODE_ENV=production
PORT=3000

# ============================================
# 数据库配置
# ============================================
DATABASE_URL="postgresql://user:password@localhost:5432/kg_db"

# ============================================
# LLM API 配置
# ============================================
QWEN_API_KEY="your_api_key"
QWEN_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_MODEL="qwen-plus"

# ============================================
# 知识图谱配置
# ============================================
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=100000
KG_TOKEN_PER_DOCUMENT_LIMIT=5000
```

### 6.2 性能配置

```bash
# ============================================
# 性能配置
# ============================================
KG_BATCH_SIZE=10
KG_BATCH_CONCURRENCY=3
KG_LLM_CALL_TIMEOUT_MS=10000
KG_TOTAL_PROCESSING_TIMEOUT_MS=30000
```

### 6.3 LLM 调用频率配置

```bash
# ============================================
# LLM 调用频率
# ============================================
KG_LLM_FIELD_MAPPING_RATE=0.5
KG_LLM_ENTITY_CANONICAL_NAME_RATE=0.5
KG_LLM_ENTITY_DISAMBIGUATION_RATE=0.3
KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE=0.3
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.2
```

### 6.4 缓存配置

```bash
# ============================================
# 缓存配置
# ============================================
KG_CACHE_ENABLED=true
KG_CACHE_TTL_SECONDS=86400
KG_CACHE_MAX_SIZE=1000
```

完整配置说明请参考 [CONFIG.md](./CONFIG.md)


## 7. 监控和日志

### 7.1 日志配置

**创建日志目录**:
```bash
mkdir -p logs
```

**日志级别**:
- `error`: 错误日志
- `warn`: 警告日志
- `info`: 信息日志
- `debug`: 调试日志

**日志文件**:
- `logs/error.log`: 错误日志
- `logs/combined.log`: 所有日志
- `logs/kg.log`: KG 模块日志

### 7.2 性能监控

**使用 PM2 监控**:
```bash
# 查看实时监控
pm2 monit

# 查看详细信息
pm2 show kg-server

# 查看内存使用
pm2 list
```

**使用 API 监控**:
```bash
# 获取性能统计
curl http://localhost:3000/api/knowledge-graph/stats/performance

# 获取性能仪表板
curl http://localhost:3000/api/knowledge-graph/stats/performance/dashboard
```

### 7.3 Token 使用监控

```bash
# 获取 Token 使用统计
curl http://localhost:3000/api/knowledge-graph/stats/tokens

# 获取每日预算状态
curl http://localhost:3000/api/knowledge-graph/stats/tokens/budget

# 获取优化建议
curl http://localhost:3000/api/knowledge-graph/stats/tokens/recommendations
```

### 7.4 健康检查

**创建健康检查端点**:
```javascript
// server.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

**配置监控脚本**:
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
  echo "Service is healthy"
  exit 0
else
  echo "Service is unhealthy (HTTP $RESPONSE)"
  exit 1
fi
```

**设置定时检查**:
```bash
# 添加到 crontab
*/5 * * * * /path/to/health-check.sh >> /var/log/health-check.log 2>&1
```

## 8. 备份和恢复

### 8.1 数据库备份

**PostgreSQL 备份**:
```bash
# 创建备份目录
mkdir -p backups

# 备份数据库
pg_dump -U kg_user -h localhost kg_db > backups/kg_db_$(date +%Y%m%d_%H%M%S).sql

# 压缩备份
gzip backups/kg_db_$(date +%Y%m%d_%H%M%S).sql
```

**自动备份脚本**:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backups"
DB_NAME="kg_db"
DB_USER="kg_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

# 创建备份
pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

# 压缩备份
gzip $BACKUP_FILE

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

**设置定时备份**:
```bash
# 添加到 crontab (每天凌晨 2 点备份)
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

### 8.2 数据库恢复

**PostgreSQL 恢复**:
```bash
# 解压备份
gunzip backups/kg_db_20250201_020000.sql.gz

# 恢复数据库
psql -U kg_user -h localhost kg_db < backups/kg_db_20250201_020000.sql
```

### 8.3 文件备份

**备份重要文件**:
```bash
# 备份配置文件
tar -czf backups/config_$(date +%Y%m%d).tar.gz .env kg/CONFIG.md

# 备份 Schema 定义
tar -czf backups/schemas_$(date +%Y%m%d).tar.gz SchemaList.md kg/schema/

# 备份同义词词典
tar -czf backups/synonym_dict_$(date +%Y%m%d).tar.gz kg/field_normalizer/synonym_dict.json
```

## 9. 安全配置

### 9.1 环境变量安全

**保护 .env 文件**:
```bash
# 设置文件权限
chmod 600 .env

# 确保 .env 在 .gitignore 中
echo ".env" >> .gitignore
```

**使用密钥管理服务** (推荐):
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

### 9.2 API 安全

**启用 HTTPS**:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... 其他配置
}
```

**配置防火墙**:
```bash
# 只允许必要的端口
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**限流配置**:
```nginx
# Nginx 限流
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/knowledge-graph {
    limit_req zone=api_limit burst=20 nodelay;
    # ... 其他配置
}
```

### 9.3 数据库安全

**PostgreSQL 安全配置**:
```bash
# 编辑 pg_hba.conf
# 只允许本地连接
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5

# 重启 PostgreSQL
sudo systemctl restart postgresql
```

**使用强密码**:
```sql
-- 修改用户密码
ALTER USER kg_user WITH PASSWORD 'your_very_strong_password_here';
```

## 10. 故障排查

### 10.1 常见问题

**问题 1: 服务无法启动**

**症状**: `npm start` 失败

**解决方案**:
```bash
# 检查端口占用
lsof -i :3000

# 检查日志
tail -f logs/error.log

# 检查环境变量
cat .env

# 检查数据库连接
npx prisma db pull
```

**问题 2: Token 超限**

**症状**: 系统进入紧急模式

**解决方案**:
```bash
# 检查 Token 使用
curl http://localhost:3000/api/knowledge-graph/stats/tokens/budget

# 启用紧急模式
curl -X POST http://localhost:3000/api/knowledge-graph/stats/budget/emergency/enable

# 调整配置
# 编辑 .env,降低 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.3
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.1
```

**问题 3: 处理超时**

**症状**: 文档处理失败,提示超时

**解决方案**:
```bash
# 增加超时时间
# 编辑 .env
KG_TOTAL_PROCESSING_TIMEOUT_MS=60000
KG_LLM_CALL_TIMEOUT_MS=15000

# 重启服务
pm2 restart kg-server
```

**问题 4: Schema 数量不足**

**症状**: 系统启动时提示 Schema 数量不足

**解决方案**:
```bash
# 手动导入 Schema
node kg/schema/load_schemas.js

# 或通过 API 导入
curl -X POST http://localhost:3000/api/knowledge-graph/schemas/reimport
```

### 10.2 日志分析

**查看错误日志**:
```bash
# 查看最近的错误
tail -n 100 logs/error.log

# 搜索特定错误
grep "Token limit exceeded" logs/error.log

# 实时监控日志
tail -f logs/combined.log
```

**使用 PM2 日志**:
```bash
# 查看所有日志
pm2 logs

# 查看错误日志
pm2 logs --err

# 清空日志
pm2 flush
```

### 10.3 性能问题

**检查性能指标**:
```bash
# 获取性能统计
curl http://localhost:3000/api/knowledge-graph/stats/performance

# 检查内存使用
pm2 list

# 检查数据库性能
# PostgreSQL
psql -U kg_user -d kg_db -c "SELECT * FROM pg_stat_activity;"
```

**优化建议**:
1. 增加服务器资源 (CPU, 内存)
2. 启用缓存
3. 优化数据库索引
4. 降低 LLM 调用频率
5. 使用批量处理


## 11. 升级和维护

### 11.1 版本升级

**升级流程**:

1. **备份数据**:
```bash
# 备份数据库
./backup.sh

# 备份配置文件
cp .env .env.backup
```

2. **拉取新代码**:
```bash
# 拉取最新代码
git fetch origin
git checkout v1.1.0  # 切换到新版本

# 查看变更
git log v1.0.0..v1.1.0
```

3. **更新依赖**:
```bash
# 更新 npm 包
npm install

# 或使用 yarn
yarn install
```

4. **运行数据库迁移**:
```bash
# 检查待执行的迁移
npx prisma migrate status

# 执行迁移
npx prisma migrate deploy

# 生成新的 Prisma Client
npx prisma generate
```

5. **更新配置**:
```bash
# 对比配置文件
diff .env.example .env

# 添加新的配置项
nano .env
```

6. **重启服务**:
```bash
# 使用 PM2
pm2 restart kg-server

# 或使用 Docker
docker-compose restart
```

7. **验证升级**:
```bash
# 检查服务状态
curl http://localhost:3000/health

# 检查版本信息
curl http://localhost:3000/api/knowledge-graph/stats
```

### 11.2 回滚操作

如果升级失败,可以回滚到之前的版本:

```bash
# 停止服务
pm2 stop kg-server

# 切换到旧版本
git checkout v1.0.0

# 恢复依赖
npm install

# 回滚数据库 (如果需要)
psql -U kg_user -d kg_db < backups/kg_db_before_upgrade.sql

# 恢复配置
cp .env.backup .env

# 重启服务
pm2 start kg-server
```

### 11.3 定期维护

**每日维护**:
- 检查服务状态
- 查看错误日志
- 监控 Token 使用
- 检查磁盘空间

**每周维护**:
- 分析性能指标
- 清理旧日志
- 检查数据库性能
- 更新同义词词典

**每月维护**:
- 数据库优化 (VACUUM, ANALYZE)
- 检查备份完整性
- 更新依赖包
- 安全审计

**维护脚本示例**:
```bash
#!/bin/bash
# maintenance.sh

echo "=== 开始维护 ==="

# 清理旧日志 (保留 30 天)
find logs/ -name "*.log" -mtime +30 -delete
echo "✓ 清理旧日志"

# 数据库优化
psql -U kg_user -d kg_db -c "VACUUM ANALYZE;"
echo "✓ 数据库优化"

# 检查磁盘空间
df -h
echo "✓ 磁盘空间检查"

# 检查服务状态
pm2 status
echo "✓ 服务状态检查"

echo "=== 维护完成 ==="
```

## 12. 扩展和优化

### 12.1 水平扩展

**使用负载均衡**:

```nginx
# Nginx 配置
upstream kg_backend {
    least_conn;  # 最少连接算法
    server 192.168.1.10:3000 weight=3;
    server 192.168.1.11:3000 weight=2;
    server 192.168.1.12:3000 weight=1;
}

server {
    listen 80;
    location /api/knowledge-graph {
        proxy_pass http://kg_backend;
        # ... 其他配置
    }
}
```

**会话保持**:
```nginx
upstream kg_backend {
    ip_hash;  # 基于 IP 的会话保持
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}
```

### 12.2 数据库优化

**读写分离**:
```javascript
// 配置主从数据库
const masterDB = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_MASTER_URL
    }
  }
});

const slaveDB = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_SLAVE_URL
    }
  }
});

// 写操作使用主库
await masterDB.entity.create({...});

// 读操作使用从库
await slaveDB.entity.findMany({...});
```

**连接池优化**:
```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  connection_limit = 20
  pool_timeout = 30
}
```

### 12.3 缓存优化

**使用 Redis 缓存**:
```bash
# 安装 Redis
sudo apt-get install redis-server

# 启动 Redis
sudo systemctl start redis
```

**配置 Redis 缓存**:
```javascript
// kg/utils/redis_cache.js
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

async function getCached(key) {
  return await client.get(key);
}

async function setCached(key, value, ttl = 3600) {
  await client.setex(key, ttl, JSON.stringify(value));
}
```

### 12.4 CDN 配置

对于静态资源,使用 CDN 加速:

```nginx
# Nginx 配置
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 13. 监控告警

### 13.1 配置告警

**邮件告警**:
```javascript
// kg/utils/alert.js
const nodemailer = require('nodemailer');

async function sendAlert(subject, message) {
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.ALERT_FROM,
    to: process.env.ALERT_TO,
    subject: `[KG Alert] ${subject}`,
    text: message
  });
}
```

**告警规则**:
- Token 使用超过 80%
- 处理失败率超过 10%
- 服务响应时间超过 5 秒
- 磁盘空间不足 20%
- 数据库连接失败

### 13.2 监控工具

**推荐工具**:
- **Prometheus + Grafana**: 指标监控和可视化
- **ELK Stack**: 日志收集和分析
- **Sentry**: 错误追踪
- **New Relic / DataDog**: APM 监控

## 14. 参考资源

### 14.1 相关文档

- [README.md](./README.md) - KG 模块概述
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构设计
- [CONFIG.md](./CONFIG.md) - 配置说明
- [API.md](./API.md) - API 参考文档
- [SCHEMA_GUIDE.md](./SCHEMA_GUIDE.md) - Schema 定义指南

### 14.2 外部资源

- [Node.js 官方文档](https://nodejs.org/docs/)
- [Prisma 文档](https://www.prisma.io/docs/)
- [PM2 文档](https://pm2.keymetrics.io/docs/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

### 14.3 社区支持

- GitHub Issues: 报告问题和建议
- 技术论坛: 讨论和交流
- 邮件列表: 获取更新通知

## 15. 检查清单

### 15.1 部署前检查

- [ ] 服务器资源满足要求
- [ ] 所有依赖已安装
- [ ] 环境变量已配置
- [ ] 数据库已初始化
- [ ] Schema 已导入
- [ ] 防火墙规则已配置
- [ ] SSL 证书已配置 (生产环境)
- [ ] 备份策略已设置
- [ ] 监控告警已配置

### 15.2 部署后检查

- [ ] 服务正常启动
- [ ] 健康检查通过
- [ ] API 端点可访问
- [ ] 数据库连接正常
- [ ] LLM API 连接正常
- [ ] 日志正常输出
- [ ] 性能指标正常
- [ ] Token 使用正常

### 15.3 运维检查

- [ ] 每日检查服务状态
- [ ] 每日检查错误日志
- [ ] 每周检查性能指标
- [ ] 每周清理旧日志
- [ ] 每月数据库优化
- [ ] 每月安全审计
- [ ] 定期备份验证
- [ ] 定期更新依赖

---

**文档版本**: v1.0.0  
**最后更新**: 2025-02-01  
**维护者**: Schema-Driven KG Team

