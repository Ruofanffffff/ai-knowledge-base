# 网络访问配置指南

## 当前网络配置状态

### 服务器信息
- **本地访问地址**: http://localhost:3000
- **局域网访问地址**: http://192.168.0.121:3000
- **服务器状态**: ✅ 运行中
- **端口**: 3000
- **监听状态**: 0.0.0.0 (所有网络接口)

### 可用的网络接口
- 192.168.0.121 (主要局域网IP)
- 192.168.194.198 (备用局域网IP)

## 访问方式

### 1. 局域网内访问 (同一WiFi/网络)

其他设备连接到同一网络后，可以通过以下地址访问：

```
http://192.168.0.121:3000/index-simple.html
```

**适用场景**:
- 家庭网络内的其他设备
- 办公室内的同事电脑
- 同一WiFi下的手机和平板

### 2. 外网访问 (互联网访问)

要让其他网络的用户访问，需要以下几种方案：

#### 方案A: 端口映射 (路由器配置)

**步骤**:
1. 登录路由器管理界面 (通常是 192.168.0.1 或 192.168.1.1)
2. 找到"端口映射"或"虚拟服务器"设置
3. 添加映射规则:
   - 外部端口: 3000
   - 内部端口: 3000
   - 内部IP: 192.168.0.121
   - 协议: TCP

**访问地址**: `http://你的公网IP:3000/index-simple.html`

**获取公网IP**: 访问 http://whatismyipaddress.com

#### 方案B: 内网穿透工具 (推荐)

**使用 ngrok**:
```bash
# 安装 ngrok
brew install ngrok  # macOS
# 或下载: https://ngrok.com/download

# 启动隧道
ngrok http 3000
```

**访问地址**: ngrok会提供一个临时的公网地址，如 `https://xxx.ngrok.io`

**使用 frp**:
```bash
# 需要一台有公网IP的服务器
# 下载 frp 客户端
# 配置 frpc.ini
[common]
server_addr = 你的服务器IP
server_port = 7000

[web]
type = http
local_ip = 127.0.0.1
local_port = 3000
custom_domains = yourdomain.com
```

#### 方案C: 云服务器部署 (生产环境推荐)

将应用部署到云服务器:
- 阿里云 ECS
- 腾讯云 CVM
- AWS EC2
- DigitalOcean Droplet

**优势**:
- 稳定的公网IP
- 24/7 在线
- 专业运维支持
- 可扩展性强

## 安全配置

### 1. 防火墙设置

**macOS**:
```bash
# 检查防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 允许Node.js通过防火墙
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Users/ruofanfeng/Documents/trae_projects/node-v18.18.0-darwin-x64/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /Users/ruofanfeng/Documents/trae_projects/node-v18.18.0-darwin-x64/bin/node
```

**Linux (Ubuntu/Debian)**:
```bash
# 允许端口3000
sudo ufw allow 3000/tcp
sudo ufw reload
```

**Windows**:
- 控制面板 → 系统和安全 → Windows Defender 防火墙
- 高级设置 → 入站规则 → 新建规则
- 端口 → TCP → 特定本地端口: 3000
- 允许连接

### 2. 身份验证 (建议添加)

修改 [server.js](file:///Users/ruofanfeng/Documents/trae_projects/server.js)，添加基本认证:

```javascript
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
  users: { 'admin': 'your_password' },
  challenge: true,
  unauthorizedResponse: '未授权访问'
}));
```

### 3. HTTPS 配置 (生产环境必须)

使用 Let's Encrypt 免费SSL证书:
```bash
# 安装 certbot
brew install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 配置 HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/cert.pem')
};

https.createServer(options, app).listen(443);
```

## 测试访问

### 局域网测试
```bash
# 在同一网络的其他设备上测试
curl http://192.168.0.121:3000/api/health
```

### 外网测试
```bash
# 使用公网IP测试
curl http://你的公网IP:3000/api/health

# 或使用域名测试
curl http://yourdomain.com:3000/api/health
```

## 故障排查

### 问题1: 无法从局域网访问

**检查项**:
1. 确认设备在同一网络
2. 检查防火墙设置
3. 验证IP地址是否正确
4. 确认服务器正在运行

**解决方案**:
```bash
# 检查服务器状态
lsof -i :3000

# 测试本地访问
curl http://localhost:3000/api/health

# 检查网络连接
ping 192.168.0.121
```

### 问题2: 外网无法访问

**检查项**:
1. 路由器端口映射是否正确
2. 公网IP是否变化
3. 防火墙是否阻止外部访问
4. ISP是否封锁了端口

**解决方案**:
- 使用动态DNS服务 (如 No-IP, DuckDNS)
- 更换端口 (如使用8080而非3000)
- 联系ISP确认端口限制

### 问题3: 访问速度慢

**优化建议**:
1. 使用CDN加速
2. 优化图片和静态资源
3. 启用gzip压缩
4. 使用更快的网络连接

## 性能优化

### 1. 启用压缩
```javascript
const compression = require('compression');
app.use(compression());
```

### 2. 静态资源缓存
```javascript
app.use(express.static('public', {
  maxAge: '1d'
}));
```

### 3. 负载均衡 (多实例)
使用 PM2 管理多个进程:
```bash
npm install -g pm2
pm2 start server.js -i max
```

## 监控与日志

### 1. 访问日志
```javascript
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.ip} - ${req.method} ${req.url}`);
  next();
});
```

### 2. 性能监控
使用工具如:
- New Relic
- Datadog
- Prometheus + Grafana

## 备份与恢复

### 数据备份
```bash
# 定期备份数据目录
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 上传到云存储
aws s3 cp backup-$(date +%Y%m%d).tar.gz s3://your-backup-bucket/
```

### 自动备份脚本
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/knowledge-base-$DATE.tar.gz /path/to/data
find /backup -name "knowledge-base-*.tar.gz" -mtime +7 -delete
```

## 联系与支持

如有问题，请查看:
- 项目文档: [README.md](file:///Users/ruofanfeng/Documents/trae_projects/README.md)
- 部署文档: [knowledge_base_deployment.md](file:///Users/ruofanfeng/Documents/trae_projects/knowledge_base_deployment.md)
- API文档: [API.md](file:///Users/ruofanfeng/Documents/trae_projects/API.md)

---

**最后更新**: 2026-01-18
**版本**: 1.0.0
**状态**: ✅ 服务器运行正常