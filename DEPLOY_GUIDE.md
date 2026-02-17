# 阿里云 ECS 部署指南

本指南将帮助你将项目部署到阿里云 ECS 实例（假设操作系统为 Ubuntu 或 Alibaba Cloud Linux）。

## 1. 准备工作

确保你已经通过 SSH 连接到 ECS 实例。

## 2. 上传代码

推荐使用 Git 将代码拉取到服务器。

```bash
# 在服务器上
# 拉取指定分支 KnowlegeGraghpy (注意分支名大小写及拼写)
git clone -b KnowlegeGraghpy https://github.com/Ruofanffffff/ai-knowledge-base.git
cd ai-knowledge-base
```

或者使用 SCP 将本地代码上传（排除 node_modules）：

```bash
# 在本地机器上
scp -r ./* user@your_ecs_ip:/path/to/project
```

## 3. 安装环境

我们提供了一个脚本来自动检测并安装环境（支持 apt/yum/dnf 包管理器），包括 Node.js, PM2, Nginx 等。

```bash
# 赋予脚本执行权限
chmod +x deploy/setup.sh

# 运行脚本
./deploy/setup.sh
```

## 4. 安装依赖与构建

在服务器上安装依赖并构建前端。

```bash
# 安装根目录依赖
npm install

# 进入前端目录安装依赖并构建
cd client
npm install
npm run build

# 返回根目录
cd ..
```

## 5. 配置环境变量

复制示例配置文件并进行修改。

```bash
cp .env.example .env
nano .env
```

请确保配置以下关键项：
- `PORT`: 默认为 3000，无需更改。
- `API Keys`: 配置你的火山引擎、通义千问等 API Key。
- `DATABASE_URL`: 虽然项目主要使用 SQLite，但也建议保留或注释掉。

## 6. 初始化数据库

由于使用 SQLite，你需要运行迁移命令来生成数据库文件。

```bash
# 生成 Prisma Client
npx prisma generate

# 运行迁移
npx prisma migrate deploy
```

确保 `data/` 目录存在（Prisma 会自动创建数据库文件，但目录最好确认一下）。

```bash
mkdir -p data
mkdir -p uploads
```

## 7. 启动服务

使用 PM2 启动并守护进程。

```bash
# 启动服务
pm2 start server.js --name "shisi-app"

# 设置开机自启
pm2 startup
pm2 save
```

## 8. 配置 Nginx 反向代理

将 Nginx 配置为反向代理，以便通过 80 端口访问服务。

1. 编辑 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/shisi
```

2. 复制 `deploy/nginx.conf` 的内容到该文件中，并修改 `server_name` 为你的公网 IP 或域名。

3. 启用配置并重启 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/shisi /etc/nginx/sites-enabled/
sudo nginx -t # 检查配置是否正确
sudo systemctl restart nginx
```

## 9. 阿里云安全组设置

**重要**：请确保在阿里云控制台的安全组规则中，开放了 **80 (HTTP)** 和 **443 (HTTPS)** 端口，否则无法从外网访问。

---

现在，你应该可以通过浏览器访问 `http://你的公网IP` 来使用应用了！
