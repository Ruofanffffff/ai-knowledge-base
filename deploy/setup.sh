#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m'

# 检查包管理器
if command -v apt &> /dev/null; then
    PKG_MANAGER="apt"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
else
    echo "未检测到支持的包管理器 (apt, dnf, yum)，请手动安装环境。"
    exit 1
fi

echo -e "${GREEN}检测到包管理器: ${PKG_MANAGER}${NC}"
echo -e "${GREEN}开始安装环境...${NC}"

# 1. 更新系统
echo -e "${GREEN}1. 更新系统软件包...${NC}"
if [ "$PKG_MANAGER" = "apt" ]; then
    sudo apt update
else
    sudo $PKG_MANAGER update -y
fi

# 2. 安装 Node.js (v20)
echo -e "${GREEN}2. 安装 Node.js v20...${NC}"
if ! command -v node &> /dev/null; then
    if [ "$PKG_MANAGER" = "apt" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo $PKG_MANAGER install -y nodejs
    fi
else
    echo "Node.js 已安装: $(node -v)"
fi

# 3. 安装构建工具 (某些 npm 包可能需要编译)
echo -e "${GREEN}3. 安装构建工具...${NC}"
if [ "$PKG_MANAGER" = "apt" ]; then
    sudo apt install -y build-essential
else
    sudo $PKG_MANAGER install -y gcc-c++ make
fi

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
    if [ "$PKG_MANAGER" = "apt" ]; then
        sudo apt install -y nginx
    else
        sudo $PKG_MANAGER install -y nginx
        # 某些 RHEL 系需要手动启动并设置开机自启
        sudo systemctl enable nginx
        sudo systemctl start nginx
    fi
else
    echo "Nginx 已安装: $(nginx -v)"
fi

echo -e "${GREEN}环境安装完成！${NC}"
echo "请继续按照 DEPLOY_GUIDE.md 进行配置。"
