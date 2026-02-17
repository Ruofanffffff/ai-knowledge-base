#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}开始安装环境...${NC}"

# 1. 更新系统
echo -e "${GREEN}1. 更新系统软件包...${NC}"
sudo apt update
# sudo apt upgrade -y # 可选，避免升级过久

# 2. 安装 Node.js (v20)
echo -e "${GREEN}2. 安装 Node.js v20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js 已安装: $(node -v)"
fi

# 3. 安装构建工具 (某些 npm 包可能需要编译)
echo -e "${GREEN}3. 安装构建工具...${NC}"
sudo apt install -y build-essential

# 4. 安装 PM2
echo -e "${GREEN}4. 安装 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "PM2 已安装: $(pm2 -v)"
fi

# 5. 安装 Nginx
echo -e "${GREEN}5. 安装 Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
else
    echo "Nginx 已安装: $(nginx -v)"
fi

echo -e "${GREEN}环境安装完成！${NC}"
echo "请继续按照 DEPLOY_GUIDE.md 进行配置。"
