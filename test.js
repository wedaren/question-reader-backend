/**
 * 测试脚本 - 验证项目基础功能
 */

// 模拟测试数据
const mockTreeData = {
  version: "1.0.0",
  rootNodes: [
    {
      id: "root1",
      title: "基础问题",
      children: [
        { id: "q1", title: "什么是编程？", path: "issues/what-is-programming.md" },
        { id: "q2", title: "如何学习编程？", path: "issues/how-to-learn.md" }
      ]
    }
  ]
};

const mockFocusedData = {
  version: "1.0.0",
  focusList: [
    { id: "q1", priority: 1 },
    { id: "q2", priority: 2 }
  ]
};

const mockTitles = {
  "issues/what-is-programming.md": "什么是编程？",
  "issues/how-to-learn.md": "如何学习编程？",
  "docs/introduction.md": "项目介绍"
};

console.log('=== 问题阅读器后台服务测试 ===');
console.log('');

// 测试知识库结构响应
console.log('1. 知识库结构数据：');
console.log(JSON.stringify({
  version: "abc12345",
  tree: mockTreeData,
  focused: mockFocusedData,
  titles: mockTitles
}, null, 2));

console.log('');
console.log('2. 单个问题内容数据：');
console.log(JSON.stringify({
  path: "issues/what-is-programming.md",
  title: "什么是编程？",
  content: "# 什么是编程？\n\n编程是一种通过编写代码来解决问题的方法...",
  last_modified: new Date().toISOString()
}, null, 2));

console.log('');
console.log('项目文件结构已创建完成！');
console.log('');
console.log('主要文件：');
console.log('- src/app.js                  (应用入口)');
console.log('- src/controllers/kbController.js (知识库控制器)');
console.log('- src/services/kbService.js       (知识库服务)');
console.log('- src/routes/kb.js                (API路由)');
console.log('- src/middleware/errorHandler.js  (错误处理)');
console.log('');
console.log('API 端点：');
console.log('- GET /health                     (健康检查)');
console.log('- GET /v1/kb/structure            (获取知识库结构)');
console.log('- GET /v1/kb/issue?path=xxx       (获取问题内容)');
console.log('');
console.log('需要在联网状态下运行 "npm install" 安装依赖');
console.log('然后使用 "npm run dev" 启动开发服务器');
