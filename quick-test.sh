#!/bin/bash

# 问题阅读器 API 快速测试脚本
# Usage: ./quick-test.sh [PORT]

PORT=${1:-3000}
BASE_URL="http://localhost:$PORT"

echo "🚀 问题阅读器 API 快速测试"
echo "=============================="
echo "📍 测试地址: $BASE_URL"
echo ""

# 测试函数
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    
    echo -n "🧪 测试 $name ... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$url" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ]; then
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
            echo "✅ HTTP $http_code"
            
            # 尝试解析 JSON 并提取关键信息
            if echo "$body" | jq . >/dev/null 2>&1; then
                case "$url" in
                    "/v1/kb/structure")
                        node_count=$(echo "$body" | jq -r '.tree.rootNodes | length' 2>/dev/null)
                        focus_count=$(echo "$body" | jq -r '.focused.focusList | length' 2>/dev/null)
                        version=$(echo "$body" | jq -r '.version' 2>/dev/null)
                        echo "   📊 根节点: $node_count 个, 关注项: $focus_count 个, 版本: $version"
                        ;;
                    "/v1/kb/sync-status")
                        status=$(echo "$body" | jq -r '.status' 2>/dev/null)
                        repo=$(echo "$body" | jq -r '.repoName' 2>/dev/null)
                        echo "   🔄 同步状态: $status, 仓库: $repo"
                        ;;
                    "/health")
                        status=$(echo "$body" | jq -r '.status' 2>/dev/null)
                        echo "   💚 服务状态: $status"
                        ;;
                esac
            fi
        else
            echo "⚠️  HTTP $http_code"
            if [ ${#body} -lt 200 ]; then
                echo "   错误: $body"
            fi
        fi
    else
        echo "❌ 连接失败"
    fi
}

# 测试响应时间
test_performance() {
    echo ""
    echo "⚡ 性能测试"
    echo "----------"
    
    for i in {1..3}; do
        echo -n "🏃‍♂️ 第 $i 次请求 ... "
        start_time=$(date +%s%N)
        
        response=$(curl -s "$BASE_URL/v1/kb/structure" 2>/dev/null)
        if [ $? -eq 0 ]; then
            end_time=$(date +%s%N)
            duration=$(( (end_time - start_time) / 1000000 ))
            echo "${duration}ms"
        else
            echo "失败"
        fi
        
        sleep 0.5
    done
}

# 主测试流程
main() {
    # 1. 健康检查
    test_endpoint "健康检查" "/health"
    
    # 2. 知识库结构
    test_endpoint "知识库结构" "/v1/kb/structure"
    
    # 3. 同步状态
    test_endpoint "同步状态" "/v1/kb/sync-status"
    
    # 4. 问题内容测试
    echo -n "🧪 测试问题内容 ... "
    # 先获取一个可用的文件路径
    structure_response=$(curl -s "$BASE_URL/v1/kb/structure" 2>/dev/null)
    if echo "$structure_response" | jq . >/dev/null 2>&1; then
        file_path=$(echo "$structure_response" | jq -r '.tree.rootNodes[0].filePath' 2>/dev/null)
        if [ "$file_path" != "null" ] && [ -n "$file_path" ]; then
            issue_response=$(curl -s "$BASE_URL/v1/kb/issue?path=$file_path" 2>/dev/null)
            if [ $? -eq 0 ] && echo "$issue_response" | jq . >/dev/null 2>&1; then
                title=$(echo "$issue_response" | jq -r '.title' 2>/dev/null)
                content_length=$(echo "$issue_response" | jq -r '.content | length' 2>/dev/null)
                echo "✅ HTTP 200"
                echo "   📄 标题: $title"
                echo "   📏 内容长度: $content_length 字符"
            else
                echo "❌ 获取内容失败"
            fi
        else
            echo "⚠️  未找到可用文件路径"
        fi
    else
        echo "❌ 无法解析结构数据"
    fi
    
    # 5. 性能测试
    test_performance
    
    # 6. 总结
    echo ""
    echo "🎉 测试完成！"
    echo ""
    echo "💡 提示:"
    echo "   - 打开 api-debug-tool.html 进行可视化调试"
    echo "   - 使用 ./quick-test.sh 3000 指定端口"
    echo "   - 查看 API-DOCUMENTATION.md 了解详细文档"
}

# 检查服务是否运行
echo -n "🔍 检查服务状态 ... "
if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
    echo "✅ 服务正在运行"
    echo ""
    main
else
    echo "❌ 服务未运行或无法连接"
    echo ""
    echo "🚀 启动建议:"
    echo "   cd /path/to/question-reader-backend"
    echo "   npm start"
    echo ""
    echo "   或使用自定义端口:"
    echo "   PORT=$PORT node src/app.js"
fi
