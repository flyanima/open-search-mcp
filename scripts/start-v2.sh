#!/bin/bash

# Open Search MCP v2.0 启动脚本
# 阶段一：多API聚合与智能调度

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 显示横幅
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 Open Search MCP v2.0                        ║"
    echo "║            下一代自主搜索引擎启动器                           ║"
    echo "║                                                              ║"
    echo "║  阶段一: 多API聚合与智能调度                                  ║"
    echo "║  - ✅ 多API聚合器                                            ║"
    echo "║  - ✅ 智能负载均衡                                           ║"
    echo "║  - ✅ 自动故障转移                                           ║"
    echo "║  - ✅ Searx集群支持                                          ║"
    echo "║  - ✅ 智能缓存系统                                           ║"
    echo "║  - ✅ 健康监控                                               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查依赖
check_dependencies() {
    log_step "检查系统依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装。请安装 Node.js 18+ 版本"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js 版本过低。需要 18+ 版本，当前版本: $(node --version)"
        exit 1
    fi
    
    log_info "Node.js 版本: $(node --version) ✅"
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_info "npm 版本: $(npm --version) ✅"
    
    # 检查Docker (可选)
    if command -v docker &> /dev/null; then
        log_info "Docker 版本: $(docker --version) ✅"
        DOCKER_AVAILABLE=true
    else
        log_warn "Docker 未安装，Searx集群功能将不可用"
        DOCKER_AVAILABLE=false
    fi
}

# 安装依赖
install_dependencies() {
    log_step "安装项目依赖..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json 文件不存在"
        exit 1
    fi
    
    npm install
    log_info "依赖安装完成 ✅"
}

# 构建项目
build_project() {
    log_step "构建项目..."
    
    npm run build
    log_info "项目构建完成 ✅"
}

# 设置环境变量
setup_environment() {
    log_step "设置环境变量..."
    
    # 创建 .env 文件（如果不存在）
    if [ ! -f ".env" ]; then
        log_info "创建 .env 文件..."
        cat > .env << EOF
# Open Search MCP v2.0 环境配置

# 基础配置
NODE_ENV=development
LOG_LEVEL=info
APP_VERSION=2.0.0

# API配置
DUCKDUCKGO_ENABLED=true
DUCKDUCKGO_PRIORITY=10
DUCKDUCKGO_RATE_LIMIT=100
DUCKDUCKGO_TIMEOUT=5000
DUCKDUCKGO_RETRY_ATTEMPTS=3

# 缓存配置
CACHE_ENABLED=true
CACHE_TTL=3600
CACHE_MAX_SIZE=1000

# Searx集群配置
SEARX_NODES=http://localhost:8080,http://localhost:8081,http://localhost:8082

# 监控配置
MONITORING_ENABLED=true
MONITORING_PORT=9090
MONITORING_PATH=/metrics
MONITORING_COLLECT_INTERVAL=10000
MONITORING_RETENTION_DAYS=7

# Searx集群密钥（请修改为安全的密钥）
SEARXNG_SECRET=your-very-long-secret-key-here-please-change-this

# Grafana密码
GRAFANA_PASSWORD=admin
EOF
        log_info ".env 文件已创建 ✅"
        log_warn "请编辑 .env 文件并设置适当的配置值"
    else
        log_info ".env 文件已存在 ✅"
    fi
}

# 部署Searx集群
deploy_searx_cluster() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        log_step "部署Searx集群..."
        
        # 检查Docker Compose
        if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
            log_info "启动Searx集群..."
            
            # 创建必要的目录
            mkdir -p deployment/searx-config
            mkdir -p deployment/grafana-dashboards
            mkdir -p deployment/grafana-datasources
            
            # 启动集群
            cd deployment
            if command -v docker-compose &> /dev/null; then
                docker-compose -f searx-cluster.yml up -d
            else
                docker compose -f searx-cluster.yml up -d
            fi
            cd ..
            
            log_info "Searx集群启动完成 ✅"
            log_info "访问地址:"
            log_info "  - Searx负载均衡器: http://localhost:8080"
            log_info "  - Searx节点1: http://localhost:8081"
            log_info "  - Searx节点2: http://localhost:8082"
            log_info "  - Prometheus监控: http://localhost:9090"
            log_info "  - Grafana仪表板: http://localhost:3001"
        else
            log_warn "Docker Compose 未安装，跳过Searx集群部署"
        fi
    else
        log_warn "Docker 不可用，跳过Searx集群部署"
    fi
}

# 启动服务器
start_server() {
    log_step "启动 Open Search MCP v2.0 服务器..."
    
    log_info "服务器配置:"
    log_info "  - 版本: v2.0.0"
    log_info "  - 环境: development"
    log_info "  - 日志级别: info"
    log_info "  - 多API聚合: 启用"
    log_info "  - 智能缓存: 启用"
    log_info "  - 健康监控: 启用"
    
    echo ""
    log_info "🚀 启动服务器..."
    echo ""
    
    # 启动v2.0服务器
    npm run dev:v2
}

# 显示帮助信息
show_help() {
    echo "Open Search MCP v2.0 启动脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h          显示此帮助信息"
    echo "  --no-deps          跳过依赖安装"
    echo "  --no-build         跳过项目构建"
    echo "  --no-searx         跳过Searx集群部署"
    echo "  --production       生产环境模式"
    echo ""
    echo "示例:"
    echo "  $0                 完整启动（推荐）"
    echo "  $0 --no-searx      不部署Searx集群"
    echo "  $0 --production    生产环境启动"
}

# 主函数
main() {
    local skip_deps=false
    local skip_build=false
    local skip_searx=false
    local production=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --no-deps)
                skip_deps=true
                shift
                ;;
            --no-build)
                skip_build=true
                shift
                ;;
            --no-searx)
                skip_searx=true
                shift
                ;;
            --production)
                production=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 显示横幅
    show_banner
    
    # 设置生产环境
    if [ "$production" = true ]; then
        export NODE_ENV=production
        log_info "生产环境模式已启用"
    fi
    
    # 执行启动步骤
    check_dependencies
    
    if [ "$skip_deps" = false ]; then
        install_dependencies
    fi
    
    if [ "$skip_build" = false ]; then
        build_project
    fi
    
    setup_environment
    
    if [ "$skip_searx" = false ]; then
        deploy_searx_cluster
    fi
    
    start_server
}

# 运行主函数
main "$@"
