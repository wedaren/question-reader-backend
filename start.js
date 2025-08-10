#!/usr/bin/env node

/**
 * 启动脚本 - 用于测试和验证应用
 */

console.log('=== 问题阅读器后台服务 ===');
console.log('正在启动服务...');

// 检查关键文件
const fs = require('fs');
const path = require('path');

const checkFile = (filePath) => {
  const fullPath = path.resolve(filePath);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${filePath} ${exists ? '存在' : '缺失'}`);
  return exists;
};

console.log('\n检查项目文件:');
const requiredFiles = [
  'package.json',
  'src/app.js',
  'src/controllers/kbController.js',
  'src/services/kbService.js',
  'src/routes/kb.js',
  'src/middleware/errorHandler.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (!checkFile(file)) {
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\n✓ 所有必要文件都已创建!');
  console.log('\n下一步操作:');
  console.log('1. 联网后运行: npm install');
  console.log('2. 配置 .env 文件中的仓库地址');
  console.log('3. 启动开发服务器: npm run dev');
  console.log('4. 访问 http://localhost:3000/health 进行测试');
} else {
  console.log('\n✗ 部分文件缺失，请检查项目结构');
  process.exit(1);
}

console.log('\n=== 项目创建完成 ===');
