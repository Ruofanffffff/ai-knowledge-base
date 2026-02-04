#!/bin/bash

# 安全推送脚本 - 避免冲突的智能推送工具
# 使用方法: ./safe-push.sh "你的提交信息"

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查是否提供了提交信息
if [ -z "$1" ]; then
    print_error "请提供提交信息"
    echo "使用方法: ./safe-push.sh \"你的提交信息\""
    exit 1
fi

COMMIT_MESSAGE="$1"

echo ""
print_info "=== 安全推送流程开始 ==="
echo ""

# 1. 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
print_info "当前分支: $CURRENT_BRANCH"

# 2. 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    print_info "发现未提交的更改"
    git status -s
    echo ""
    
    # 3. 暂存所有更改
    print_info "暂存所有更改..."
    git add .
    print_success "更改已暂存"
else
    print_warning "没有发现未提交的更改"
    exit 0
fi

# 4. 拉取远程更新
print_info "拉取远程更新..."
echo ""

if git pull origin $CURRENT_BRANCH; then
    print_success "成功拉取远程更新"
else
    print_warning "拉取时发现冲突,需要手动解决"
    echo ""
    print_info "冲突文件:"
    git status -s | grep "^UU"
    echo ""
    print_info "请按以下步骤解决:"
    echo "  1. 编辑冲突文件,删除冲突标记"
    echo "  2. 运行: git add <冲突文件>"
    echo "  3. 运行: git commit -m \"merge: 解决冲突\""
    echo "  4. 重新运行此脚本"
    exit 1
fi

# 5. 运行测试(如果存在)
if [ -f "package.json" ]; then
    if grep -q "\"test\":" package.json; then
        print_info "运行测试..."
        if npm test 2>/dev/null; then
            print_success "测试通过"
        else
            print_warning "测试失败,但继续推送(请确保代码正确)"
        fi
    fi
fi

# 6. 提交更改
print_info "提交更改..."
if git commit -m "$COMMIT_MESSAGE"; then
    print_success "提交成功"
else
    print_error "提交失败"
    exit 1
fi

# 7. 推送到远程
print_info "推送到远程..."
echo ""

if git push origin $CURRENT_BRANCH; then
    print_success "推送成功!"
    echo ""
    print_success "=== 完成! ==="
    echo ""
    print_info "你的更改已安全推送到: origin/$CURRENT_BRANCH"
    
    # 如果是feature分支,提示创建PR
    if [[ $CURRENT_BRANCH != "main" ]] && [[ $CURRENT_BRANCH != "master" ]]; then
        echo ""
        print_info "💡 提示: 你在feature分支上,可以创建Pull Request:"
        echo "   https://github.com/Ruofanffffff/ai-knowledge-base/compare/$CURRENT_BRANCH"
    fi
else
    print_error "推送失败"
    print_info "可能的原因:"
    echo "  1. 远程分支有新的提交,需要先拉取"
    echo "  2. 没有推送权限"
    echo "  3. 网络问题"
    exit 1
fi

echo ""
