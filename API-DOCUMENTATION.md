# 问题阅读器 API 接口文档

## 📋 API 概览

基础 URL: `http://localhost:3000`  
版本: `v1`  
数据格式: `JSON`

## 🚀 接口列表

### 1. 健康检查

**接口描述**: 检查服务是否正常运行

```http
GET /health
```

**响应示例**:
```json
{
  "status": "ok",
  "message": "问题阅读器后台服务运行正常",
  "timestamp": "2025-08-10T09:30:45.123Z"
}
```

---

### 2. 获取知识库结构

**接口描述**: 获取完整的问题树结构和关注列表

```http
GET /v1/kb/structure
```

**请求头**:
```
Accept: application/json
If-None-Match: abc12345  # 可选，用于缓存控制
```

**响应头**:
```
ETag: abc12345
Cache-Control: public, max-age=300
Content-Type: application/json
```

**响应示例**:
```json
{
  "version": "abc12345",
  "tree": {
    "version": "1.0.0",
    "lastModified": "2025-08-10T07:51:01.381Z",
    "rootNodes": [
      {
        "id": "7d7efede-ad34-4eff-a232-2fb66bc16387",
        "filePath": "20250810-101411-835.md",
        "children": [],
        "expanded": true
      },
      {
        "id": "2828a2a0-9755-4124-8aae-e00339699b7e",
        "filePath": "20250810-135922-114.md",
        "children": [],
        "expanded": false
      }
    ]
  },
  "focused": {
    "version": "1.0.0",
    "focusList": [
      "7d7efede-ad34-4eff-a232-2fb66bc16387",
      "2828a2a0-9755-4124-8aae-e00339699b7e"
    ]
  },
  "titles": {
    "20250810-101411-835.md": "微信小程序后台接口需求文档：问题阅读器",
    "20250810-135922-114.md": "自动提取的标题示例"
  }
}
```

**响应状态码**:
- `200 OK`: 成功返回数据
- `304 Not Modified`: 数据未更新（基于 ETag）
- `500 Internal Server Error`: 服务器内部错误

---

### 3. 获取单个问题内容

**接口描述**: 根据文件路径获取具体问题的详细内容

```http
GET /v1/kb/issue?path={filePath}
```

**请求参数**:
| 参数名 | 类型 | 必选 | 描述 |
|--------|------|------|------|
| path | string | 是 | 问题文件的相对路径，如 `20250810-101411-835.md` |

**请求示例**:
```http
GET /v1/kb/issue?path=20250810-101411-835.md
```

**响应示例**:
```json
{
  "path": "20250810-101411-835.md",
  "title": "微信小程序后台接口需求文档：问题阅读器",
  "content": "# 微信小程序后台接口需求文档：问题阅读器\n\n## 项目概述\n\n本文档描述了问题阅读器微信小程序的后台 API 接口需求...",
  "last_modified": "2025-08-10T09:30:45.123Z"
}
```

**响应状态码**:
- `200 OK`: 成功返回问题内容
- `400 Bad Request`: 缺少必需参数 `path`
- `404 Not Found`: 指定的问题文件未找到
- `500 Internal Server Error`: 服务器内部错误

**错误响应示例**:
```json
{
  "error": {
    "code": "MISSING_PARAMETER",
    "message": "缺少必需的参数: path"
  }
}
```

---

### 4. 获取同步状态

**接口描述**: 查看 Git 仓库的同步状态

```http
GET /v1/kb/sync-status
```

**响应示例**:
```json
{
  "status": "completed",
  "repoName": "foam-notes",
  "lastSync": "2025-08-10T09:25:30.456Z",
  "syncDuration": 1250,
  "error": null
}
```

**状态说明**:
- `idle`: 空闲状态
- `syncing`: 正在同步
- `completed`: 同步成功
- `failed`: 同步失败
- `not_configured`: 未配置仓库

---

### 5. 手动触发同步

**接口描述**: 手动触发 Git 仓库同步

```http
POST /v1/kb/force-sync
```

**请求头**:
```
Content-Type: application/json
```

**响应示例**:
```json
{
  "success": true,
  "message": "已更新 3 个提交",
  "version": "abc12345",
  "updated": true,
  "repoPath": "/path/to/repos/foam-notes"
}
```

**响应状态码**:
- `200 OK`: 同步成功
- `500 Internal Server Error`: 同步失败

---

## 🧪 调试工具

### 使用 curl 测试

**1. 健康检查**
```bash
curl http://localhost:3000/health
```

**2. 获取知识库结构**
```bash
curl -H "Accept: application/json" http://localhost:3000/v1/kb/structure
```

**3. 获取具体问题**
```bash
curl "http://localhost:3000/v1/kb/issue?path=20250810-101411-835.md"
```

**4. 查看同步状态**
```bash
curl http://localhost:3000/v1/kb/sync-status
```

**5. 触发手动同步**
```bash
curl -X POST http://localhost:3000/v1/kb/force-sync
```

### 使用 JavaScript 调用

**获取知识库结构**
```javascript
async function fetchStructure() {
  try {
    const response = await fetch('http://localhost:3000/v1/kb/structure');
    const data = await response.json();
    console.log('知识库结构:', data);
    return data;
  } catch (error) {
    console.error('获取结构失败:', error);
  }
}
```

**获取问题内容**
```javascript
async function fetchIssue(filePath) {
  try {
    const response = await fetch(`http://localhost:3000/v1/kb/issue?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('问题内容:', data);
    return data;
  } catch (error) {
    console.error('获取问题失败:', error);
  }
}
```

**检查同步状态**
```javascript
async function checkSyncStatus() {
  try {
    const response = await fetch('http://localhost:3000/v1/kb/sync-status');
    const status = await response.json();
    console.log('同步状态:', status);
    return status;
  } catch (error) {
    console.error('获取状态失败:', error);
  }
}
```

### 使用 Postman 测试

**1. 导入集合**

创建新的 Postman 集合，添加以下请求：

```json
{
  "info": {
    "name": "问题阅读器 API",
    "description": "微信小程序后台 API 调试集合"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ],
  "item": [
    {
      "name": "健康检查",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "获取知识库结构",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/v1/kb/structure"
      }
    },
    {
      "name": "获取问题内容",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/v1/kb/issue",
        "query": [
          {
            "key": "path",
            "value": "20250810-101411-835.md"
          }
        ]
      }
    }
  ]
}
```

## 🔧 性能特性

### 缓存机制
- **ETag 缓存**: 基于 Git commit hash 的版本控制
- **内存缓存**: 1小时 TTL，避免重复处理
- **304 Not Modified**: 客户端缓存支持

### 异步同步
- **非阻塞响应**: API 响应不等待 Git 同步
- **后台更新**: 数据在后台自动保持最新
- **智能降级**: 网络问题时使用本地缓存

### 响应时间
- **首次请求**: < 100ms (有本地缓存时)
- **后续请求**: < 50ms (内存缓存命中)
- **并发处理**: 支持多用户同时访问

## 🐛 错误码说明

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|------------|------|----------|
| MISSING_PARAMETER | 400 | 缺少必需参数 | 检查请求参数 |
| ISSUE_NOT_FOUND | 404 | 问题文件未找到 | 检查文件路径是否正确 |
| SYNC_FAILED | 500 | Git 同步失败 | 检查网络连接和仓库配置 |
| INTERNAL_ERROR | 500 | 服务器内部错误 | 查看服务器日志 |

## 📊 数据结构说明

### TreeNode 结构
```typescript
interface TreeNode {
  id: string;           // 节点唯一ID
  filePath: string;     // 文件相对路径
  children: TreeNode[]; // 子节点数组
  expanded: boolean;    // 是否展开
}
```

### Issue 结构
```typescript
interface Issue {
  path: string;         // 文件路径
  title: string;        // 问题标题
  content: string;      // Markdown 内容
  lastModified: string; // 最后修改时间(ISO格式)
}
```

## 🔐 安全说明

目前版本未实现认证机制，仅供开发测试使用。生产环境建议添加：
- API 密钥认证
- 请求频率限制  
- CORS 配置优化
- HTTPS 支持

---

**📝 更新日志**
- v1.0.0 (2025-08-10): 初始版本，支持基础的知识库读取和同步功能
