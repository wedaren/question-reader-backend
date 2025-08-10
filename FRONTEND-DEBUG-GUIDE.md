# 📚 前端调试工具使用指南

## 🎯 工具概览

为了方便前端开发调试，我们提供了多种调试工具：

### 1. 📖 完整 API 文档
**文件**: `API-DOCUMENTATION.md`
- 详细的接口说明
- 请求/响应示例
- 错误码说明
- 性能特性介绍

### 2. 🌐 可视化调试工具
**文件**: `api-debug-tool.html`
- 浏览器中打开即可使用
- 可视化界面测试所有接口
- 实时响应时间监控
- 支持批量测试和性能测试

### 3. 🚀 快速测试脚本
**文件**: `quick-test.sh`
- 命令行快速测试工具
- 一键检查所有接口状态
- 自动提取关键信息
- 性能基准测试

### 4. 📱 微信小程序集成示例
**文件**: `wechat-miniprogram-example.js`
- 完整的前端集成代码
- 包含缓存策略
- 错误处理示例
- 页面使用样例

---

## 🛠️ 使用方法

### 方法一：可视化调试（推荐）

1. **启动 API 服务**
   ```bash
   cd /path/to/question-reader-backend
   npm start
   ```

2. **打开调试工具**
   ```bash
   # 在浏览器中打开
   open api-debug-tool.html
   # 或直接双击文件
   ```

3. **开始调试**
   - 🔧 右上角可配置服务地址
   - 🧪 点击各个接口进行测试
   - 📊 查看响应数据和性能指标
   - 🔄 支持自动刷新同步状态

### 方法二：命令行测试

1. **快速检查所有接口**
   ```bash
   ./quick-test.sh
   ```

2. **指定端口测试**
   ```bash
   ./quick-test.sh 3000
   ```

3. **查看详细输出**
   - ✅ 成功的接口会显示关键信息
   - ⚠️  异常接口会显示错误详情
   - ⚡ 自动执行性能测试

### 方法三：curl 手动测试

```bash
# 健康检查
curl http://localhost:3000/health

# 获取知识库结构
curl http://localhost:3000/v1/kb/structure

# 获取问题内容  
curl "http://localhost:3000/v1/kb/issue?path=your-file.md"

# 查看同步状态
curl http://localhost:3000/v1/kb/sync-status

# 触发手动同步
curl -X POST http://localhost:3000/v1/kb/force-sync
```

---

## 🎯 核心接口说明

### 1. GET /v1/kb/structure
**用途**: 获取完整的问题树结构
**响应时间**: < 50ms (有缓存时)
**缓存**: 支持 ETag 缓存
**关键数据**:
```json
{
  "tree": { "rootNodes": [...] },
  "focused": { "focusList": [...] },
  "titles": { "file.md": "标题" }
}
```

### 2. GET /v1/kb/issue?path=xxx
**用途**: 获取具体问题内容
**响应时间**: < 100ms
**参数**: path (必选) - 文件相对路径
**关键数据**:
```json
{
  "title": "问题标题",
  "content": "Markdown内容",
  "last_modified": "2025-08-10T..."
}
```

### 3. GET /v1/kb/sync-status
**用途**: 查看后台同步状态
**实时性**: 支持自动刷新
**状态值**:
- `idle`: 空闲
- `syncing`: 同步中  
- `completed`: 完成
- `failed`: 失败

---

## 🔧 开发建议

### 前端集成要点

1. **缓存策略**
   ```javascript
   // 结构数据：5分钟缓存
   // 问题内容：10分钟缓存
   // 同步状态：不缓存
   ```

2. **错误处理**
   ```javascript
   try {
     const data = await api.getStructure();
   } catch (error) {
     // 显示友好错误信息
     // 提供重试机制
   }
   ```

3. **性能优化**
   ```javascript
   // 并行加载
   const [structure, status] = await Promise.all([
     api.getStructure(),
     api.getSyncStatus()
   ]);
   ```

### 微信小程序特殊处理

1. **域名配置**
   ```
   # 开发时添加到信任域名
   http://localhost:3000
   
   # 生产时使用 HTTPS
   https://your-api-domain.com
   ```

2. **请求封装**
   ```javascript
   // 使用 wx.request() 而不是 fetch()
   // 添加超时处理
   // 实现重试机制
   ```

---

## 🐛 常见问题

### Q1: API 返回 404
**解决**: 检查服务是否启动，端口是否正确

### Q2: 响应时间太长
**解决**: 
- 检查网络连接
- 查看同步状态
- 考虑使用缓存

### Q3: 获取问题内容失败
**解决**:
- 确认文件路径正确
- 检查文件是否存在
- 验证路径编码

### Q4: 同步状态一直是 syncing
**解决**:
- 检查网络连接
- 查看服务器日志
- 尝试手动同步

---

## 📊 性能基准

基于异步同步优化后的性能指标：

| 场景 | 响应时间 | 备注 |
|------|----------|------|
| 健康检查 | < 10ms | 固定响应 |
| 知识库结构（缓存） | < 20ms | 内存缓存命中 |
| 知识库结构（本地） | < 50ms | 本地文件读取 |
| 问题内容 | < 100ms | 包含 Markdown 解析 |
| 同步状态 | < 30ms | 状态查询 |

**🎯 目标**: 90% 的请求在 100ms 内完成

---

## 🚀 部署建议

### 开发环境
```bash
# 启动开发服务
npm run dev

# 后台运行
nohup npm start > logs/app.log 2>&1 &
```

### 生产环境
```bash
# 使用 PM2 管理
pm2 start src/app.js --name "question-reader-api"

# 监控状态
pm2 status
pm2 logs
```

### Nginx 反向代理
```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📞 技术支持

如果遇到问题，请按以下步骤排查：

1. **检查服务状态**: 运行 `./quick-test.sh`
2. **查看详细日志**: 检查服务器输出
3. **测试网络连接**: 确认 Git 仓库访问正常
4. **清除缓存**: 重启服务或手动清理

**🎉 现在你可以开始愉快地进行前端开发了！**
