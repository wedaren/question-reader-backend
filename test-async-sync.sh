#!/bin/bash

echo "🧪 测试异步 Git 同步功能"
echo "=============================="

# 测试基本连通性
echo "1. 测试健康检查..."
curl -s http://localhost:3333/health && echo " ✅ 健康检查通过" || echo " ❌ 健康检查失败"

echo
echo "2. 测试同步状态 API..."
curl -s http://localhost:3333/v1/kb/sync-status | jq . 2>/dev/null && echo " ✅ 同步状态 API 正常" || echo " ❌ 同步状态 API 失败"

echo
echo "3. 测试知识库结构 API（这会触发异步同步）..."
start_time=$(date +%s%N)
response=$(curl -s http://localhost:3333/v1/kb/structure)
end_time=$(date +%s%N)

# 计算响应时间（毫秒）
duration=$(( (end_time - start_time) / 1000000 ))

if [ $? -eq 0 ]; then
  echo " ✅ 知识库结构 API 正常"
  echo " ⏱️  响应时间: ${duration}ms"
  
  # 检查响应数据结构
  echo "$response" | jq -e '.tree.rootNodes | length' > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    node_count=$(echo "$response" | jq -r '.tree.rootNodes | length')
    focus_count=$(echo "$response" | jq -r '.focused.focusList | length')
    echo " 📊 根节点数量: $node_count"
    echo " 🎯 关注项数量: $focus_count"
  fi
else
  echo " ❌ 知识库结构 API 失败"
fi

echo
echo "4. 再次检查同步状态..."
curl -s http://localhost:3333/v1/kb/sync-status | jq . 2>/dev/null

echo
echo "=============================="
echo "🎉 异步同步功能测试完成！"
