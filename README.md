# 问题阅读器后台服务

这是为"问题阅读器"微信小程序提供数据支持的后台 API 服务。

## 功能特性

- 📚 知识库结构同步
- 📖 问题内容获取
- 🗂️ Git 仓库自动同步
- ⚡ 智能缓存机制
- 🔒 ETag 缓存控制

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

复制 `.env` 文件并根据需要修改配置：

```bash
cp .env .env.local
```

主要配置项：
- `PORT`: 服务端口（默认 3000）
- `DEFAULT_REPO_URL`: 默认知识库仓库地址
- `REPOS_BASE_PATH`: 本地仓库存储路径
- `CACHE_TTL`: 缓存过期时间（秒）

### 3. 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## API 接口

### 健康检查

```http
GET /health
```

### 获取知识库结构

```http
GET /v1/kb/structure
```

支持 ETag 缓存控制：
```http
GET /v1/kb/structure
If-None-Match: abcd1234
```

响应示例：
```json
{
  "version": "abcd1234",
  "tree": {
    "version": "1.0.0",
    "rootNodes": [...]
  },
  "focused": {
    "version": "1.0.0",
    "focusList": [...]
  },
  "titles": {
    "issues/issue-1.md": "问题标题"
  }
}
```

### 获取单个问题内容

```http
GET /v1/kb/issue?path=issues/issue-1.md
```

响应示例：
```json
{
  "path": "issues/issue-1.md",
  "title": "问题标题",
  "content": "# 问题标题\n\n问题内容...",
  "last_modified": "2025-08-10T12:00:00Z"
}
```

## 项目结构

```
src/
├── app.js                 # 应用入口
├── controllers/           # 控制器层
│   └── kbController.js
├── services/             # 服务层
│   └── kbService.js
├── routes/               # 路由层
│   └── kb.js
└── middleware/           # 中间件
    └── errorHandler.js
```

## 数据同步逻辑

1. 首次请求时自动克隆 Git 仓库
2. 后续请求检查并拉取最新更新
3. 使用 Git commit hash 作为版本标识
4. 内存缓存解析后的数据结构
5. 支持 ETag 协商缓存

## 错误处理

所有 API 错误响应遵循统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

常见错误码：
- `MISSING_PARAMETER`: 缺少必需参数
- `ISSUE_NOT_FOUND`: 问题文件未找到
- `INTERNAL_ERROR`: 服务器内部错误

## 开发说明

### 添加新的 API 接口

1. 在 `src/routes/` 中定义路由
2. 在 `src/controllers/` 中实现控制器
3. 在 `src/services/` 中实现业务逻辑

### 缓存策略

- 结构数据使用版本化缓存
- 问题内容支持按需加载
- 自动处理缓存过期和失效

## 许可证

MIT License
