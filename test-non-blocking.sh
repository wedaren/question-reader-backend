#!/bin/bash

PORT=3666

echo "🚀 启动服务（后台）..."
cd /Users/wedaren/repositoryDestinationOfGithub/question-reader-backend
PORT=$PORT node src/app.js > server.log 2>&1 &
SERVER_PID=$!

echo "⏳ 等待服务启动..."
sleep 3

echo "🧪 测试非阻塞响应..."

# 测试 1: 第一次请求（有本地仓库的情况）
echo "测试 1: 第一次请求响应时间"
start_time=$(date +%s%N)
response=$(curl -s http://localhost:$PORT/v1/kb/structure 2>/dev/null)
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ $? -eq 0 ]; then
    node_count=$(echo "$response" | jq -r '.tree.rootNodes | length' 2>/dev/null)
    echo "✅ 第一次请求成功 - 响应时间: ${duration}ms, 节点数: $node_count"
else
    echo "❌ 第一次请求失败"
fi

# 测试 2: 第二次请求（应该更快）
echo "测试 2: 第二次请求响应时间"
start_time=$(date +%s%N)
response=$(curl -s http://localhost:$PORT/v1/kb/structure 2>/dev/null)
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ $? -eq 0 ]; then
    echo "✅ 第二次请求成功 - 响应时间: ${duration}ms"
else
    echo "❌ 第二次请求失败"
fi

# 测试 3: 同步状态
echo "测试 3: 检查同步状态"
sync_status=$(curl -s http://localhost:$PORT/v1/kb/sync-status 2>/dev/null)
if [ $? -eq 0 ]; then
    status=$(echo "$sync_status" | jq -r '.status' 2>/dev/null)
    echo "✅ 同步状态: $status"
else
    echo "❌ 无法获取同步状态"
fi

echo "📋 查看服务日志..."
tail -20 server.log

echo "🧹 清理..."
kill $SERVER_PID 2>/dev/null
rm -f server.log

echo "🎉 测试完成！"
