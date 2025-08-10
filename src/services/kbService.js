const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const matter = require('gray-matter');
const NetworkUtils = require('../utils/networkUtils');
const GitSyncWorker = require('./gitSyncWorker');

/**
 * 知识库服务类
 * 负责处理 Git 仓库同步、文件解析等核心逻辑
 */
class KbService {
  constructor() {
    this.reposBasePath = process.env.REPOS_BASE_PATH || './repos';
    this.defaultRepoUrl = process.env.DEFAULT_REPO_URL;
    this.cache = new Map(); // 简单的内存缓存
    this.cacheExpiry = new Map();
    this.cacheTTL = parseInt(process.env.CACHE_TTL) || 3600; // 默认1小时
    
    // 初始化 Git 同步工作器
    this.gitSyncWorker = new GitSyncWorker();
    
    // 确保仓库目录存在
    this.ensureReposDirectory();
    
    // 注册优雅关闭处理
    this.setupGracefulShutdown();
  }

  /**
   * 确保仓库基础目录存在
   */
  async ensureReposDirectory() {
    try {
      await fs.ensureDir(this.reposBasePath);
    } catch (error) {
      console.error('创建仓库目录失败:', error);
    }
  }

  /**
   * 获取知识库结构
   */
  async getKnowledgeBaseStructure() {
    try {
      // 首先检查网络状态
      const networkStatus = await NetworkUtils.getNetworkStatus();
      console.log(`📡 网络状态: ${networkStatus.status} (在线: ${networkStatus.online}, GitHub: ${networkStatus.github})`);
      
      // 检查是否配置了有效的仓库地址
      if (!this.defaultRepoUrl || this.defaultRepoUrl === 'https://github.com/user/knowledge-base.git') {
        console.warn('未配置有效的 Git 仓库地址，返回示例数据');
        return this.getDefaultStructure();
      }

      // 检查是否有本地缓存的仓库
      const repoName = this.getRepoNameFromUrl(this.defaultRepoUrl);
      const repoPath = path.join(this.reposBasePath, repoName);
      const hasLocalRepo = await fs.pathExists(repoPath);
      
      console.log(`📁 本地仓库状态: ${hasLocalRepo ? '存在' : '不存在'} (${repoPath})`);
      
      // 如果网络离线但有本地仓库，直接使用本地版本
      if (!networkStatus.online && hasLocalRepo) {
        console.log('🔄 网络离线，使用本地缓存版本');
        const version = await this.getCurrentVersion(repoPath);
        const cacheKey = `structure_${version}`;
        if (this.isValidCache(cacheKey)) {
          console.log('✅ 使用内存缓存数据');
          return this.cache.get(cacheKey);
        }
        return await this.loadStructureFromLocal(repoPath, version);
      }
      
      // 如果网络离线且无本地仓库，使用示例数据
      if (!networkStatus.online && !hasLocalRepo) {
        console.warn('🚫 网络离线且无本地缓存，使用示例数据');
        return this.getDefaultStructure();
      }

      // 网络在线时，采用非阻塞策略：
      // 1. 如果有本地仓库，立即返回本地数据
      // 2. 同时在后台启动异步同步（不等待结果）
      
      if (hasLocalRepo) {
        console.log('⚡ 使用本地数据快速响应，后台异步更新');
        
        // 立即获取本地版本和数据
        const version = await this.getCurrentVersion(repoPath);
        const cacheKey = `structure_${version}`;
        
        // 检查内存缓存
        if (this.isValidCache(cacheKey)) {
          console.log('✅ 使用内存缓存数据');
          
          // 后台异步更新（不等待结果）
          this.backgroundSync();
          
          return this.cache.get(cacheKey);
        }
        
        // 加载本地数据
        const localResult = await this.loadStructureFromLocal(repoPath, version);
        
        // 后台异步更新（不等待结果）
        this.backgroundSync();
        
        return localResult;
      }
      
      // 如果没有本地仓库，需要同步后才能响应
      try {
        console.log('📥 首次同步仓库...');
        const syncResult = await this.gitSyncWorker.syncRepository(
          this.defaultRepoUrl,
          this.reposBasePath,
          true // 首次同步，必须等待完成
        );
        
        const syncedRepoPath = syncResult.repoPath;
        const version = syncResult.version;
        
        return await this.loadStructureFromLocal(syncedRepoPath, version);
        
      } catch (syncError) {
        console.warn('🔄 首次同步失败，使用示例数据:', syncError.message);
        return this.getDefaultStructure();
      }
      
    } catch (error) {
      console.error('获取知识库结构失败:', error);
      console.warn('🔄 回退到默认示例数据');
      return this.getDefaultStructure();
    }
  }

  /**
   * 获取单个问题内容
   */
  async getIssueContent(filePath) {
    try {
      // 检查是否配置了有效的仓库地址
      if (!this.defaultRepoUrl || this.defaultRepoUrl === 'https://github.com/user/knowledge-base.git') {
        return this.getDefaultIssueContent(filePath);
      }

      // 获取仓库路径，优先使用本地已有的仓库
      const repoName = this.getRepoNameFromUrl(this.defaultRepoUrl);
      const repoPath = path.join(this.reposBasePath, repoName);
      
      // 检查本地仓库是否存在
      if (!await fs.pathExists(repoPath)) {
        console.log('📁 本地仓库不存在，尝试同步...');
        try {
          const syncResult = await this.gitSyncWorker.syncRepository(
            this.defaultRepoUrl,
            this.reposBasePath,
            true // 强制同步，因为需要立即获取内容
          );
          // 使用同步结果中的路径
          const fullPath = path.join(syncResult.repoPath, filePath);
          return await this.readIssueFromPath(fullPath, filePath);
        } catch (syncError) {
          console.error('同步仓库失败:', syncError);
          throw new Error(`无法获取问题内容，仓库同步失败: ${syncError.message}`);
        }
      } else {
        // 本地仓库存在，直接读取（同时在后台尝试异步更新）
        const fullPath = path.join(repoPath, filePath);
        
        // 后台异步更新仓库（不等待结果）
        this.backgroundSync();
        
        return await this.readIssueFromPath(fullPath, filePath);
      }
      
      // 检查文件是否存在
      if (!await fs.pathExists(fullPath)) {
        console.warn(`文件不存在: ${filePath}`);
        return null;
      }
      
      // 检查是否为 Markdown 文件
      if (!fullPath.endsWith('.md')) {
        throw new Error('只支持 Markdown 文件格式');
      }
      
      // 读取文件内容
      const content = await fs.readFile(fullPath, 'utf8');
      const stats = await fs.stat(fullPath);
      
      // 解析 Front Matter 和内容
      const parsed = matter(content);
      const title = this.extractTitle(content) || parsed.data.title || path.basename(filePath, '.md');
      
      console.log(`成功读取文件: ${filePath}, 标题: ${title}`);
      
      return {
        path: filePath,
        title,
        content: content,
        last_modified: stats.mtime.toISOString()
      };
    } catch (error) {
      console.error(`获取问题内容失败 (${filePath}):`, error);
      
      // 如果是未配置仓库的情况，返回示例数据
      if (!this.defaultRepoUrl || this.defaultRepoUrl === 'https://github.com/user/knowledge-base.git') {
        return this.getDefaultIssueContent(filePath);
      }
      
      throw error;
    }
  }

  /**
   * 从指定路径读取问题文件内容
   * @private
   */
  async readIssueFromPath(fullPath, filePath) {
    // 检查文件是否存在
    if (!await fs.pathExists(fullPath)) {
      console.warn(`文件不存在: ${filePath}`);
      return null;
    }
    
    // 检查是否为 Markdown 文件
    if (!fullPath.endsWith('.md')) {
      throw new Error('只支持 Markdown 文件格式');
    }
    
    // 读取文件内容
    const content = await fs.readFile(fullPath, 'utf8');
    const stats = await fs.stat(fullPath);
    
    // 解析 Front Matter 和内容
    const parsed = matter(content);
    const title = this.extractTitle(content) || parsed.data.title || path.basename(filePath, '.md');
    
    console.log(`成功读取文件: ${filePath}, 标题: ${title}`);
    
    return {
      path: filePath,
      title,
      content: content,
      last_modified: stats.mtime.toISOString()
    };
  }

  /**
   * 设置优雅关闭处理
   * @private
   */
  setupGracefulShutdown() {
    const shutdownHandler = async (signal) => {
      console.log(`\n收到 ${signal} 信号，正在优雅关闭...`);
      try {
        await this.gitSyncWorker.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('关闭过程中发生错误:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
  }

  /**
   * 后台异步同步（不等待结果）
   * @private
   */
  backgroundSync() {
    if (!this.defaultRepoUrl) {
      return;
    }
    
    console.log('🔄 启动后台异步同步...');
    
    // 启动后台同步，立即返回，不等待结果
    this.gitSyncWorker.syncRepository(
      this.defaultRepoUrl,
      this.reposBasePath,
      false, // 非强制同步
      true   // 后台模式 - 关键！
    ).then(result => {
      if (result.background) {
        console.log(`⚡ ${result.message}`);
      }
    }).catch(error => {
      console.warn('⚠️ 后台同步启动失败:', error.message);
    });
    
    // 设置一个定时器来检查同步结果并清理缓存
    setTimeout(() => {
      this.checkBackgroundSyncResult();
    }, 2000); // 2秒后检查一次结果
  }

  /**
   * 检查后台同步结果并清理缓存
   * @private  
   */
  checkBackgroundSyncResult() {
    const status = this.gitSyncWorker.getSyncStatus(this.defaultRepoUrl, this.reposBasePath);
    
    if (status.status === 'completed' && status.endTime > (Date.now() - 5000)) {
      console.log('🔄 检测到后台同步完成，清理缓存');
      this.clearVersionCache();
    } else if (status.status === 'failed') {
      console.warn('⚠️ 后台同步失败:', status.error);
    } else if (status.status === 'syncing') {
      console.log('🔄 后台同步仍在进行中...');
    }
  }

  /**
   * 清除版本相关的缓存
   * @private
   */
  clearVersionCache() {
    // 清除所有以 'structure_' 开头的缓存
    for (const key of this.cache.keys()) {
      if (key.startsWith('structure_')) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
    console.log('🧹 已清理版本缓存');
  }

  /**
   * 获取仓库同步状态
   */
  getSyncStatus() {
    if (!this.defaultRepoUrl) {
      return { status: 'not_configured' };
    }
    
    return this.gitSyncWorker.getSyncStatus(this.defaultRepoUrl, this.reposBasePath);
  }

  /**
   * 获取所有仓库的同步状态
   */
  getAllSyncStatus() {
    return this.gitSyncWorker.getAllSyncStatus();
  }

  /**
   * 手动触发仓库同步
   */
  async forceSyncRepository() {
    if (!this.defaultRepoUrl) {
      throw new Error('未配置仓库地址');
    }
    
    console.log('🔄 手动触发仓库同步...');
    return await this.gitSyncWorker.syncRepository(
      this.defaultRepoUrl,
      this.reposBasePath,
      true // 强制同步
    );
  }

  /**
   * 从本地仓库加载结构数据
   */
  async loadStructureFromLocal(repoPath, version) {
    console.log(`📚 从本地加载知识库结构: ${repoPath}`);
    
    // 检查 .issueManager 目录（foam-notes 特定结构）
    const issueManagerPath = path.join(repoPath, '.issueManager');
    let tree, focused;
    
    if (await fs.pathExists(issueManagerPath)) {
      console.log('📁 发现 .issueManager 目录，使用 foam-notes 结构');
      tree = await this.readJsonFile(path.join(issueManagerPath, 'tree.json'));
      focused = await this.readJsonFile(path.join(issueManagerPath, 'focused.json'));
    } else {
      // 备选：检查根目录的结构文件
      console.log('📁 使用根目录结构文件');
      tree = await this.readJsonFile(path.join(repoPath, 'tree.json'));
      focused = await this.readJsonFile(path.join(repoPath, 'focused.json'));
    }
    
    const titles = await this.extractAllTitles(repoPath);
    
    const result = {
      version,
      tree: tree || { version: "1.0.0", rootNodes: [] },
      focused: focused || { version: "1.0.0", focusList: [] },
      titles
    };
    
    console.log(`✅ 本地知识库加载成功`);
    console.log(`   版本: ${version}`);
    console.log(`   树节点: ${result.tree.rootNodes ? result.tree.rootNodes.length : 0} 个`);
    console.log(`   关注列表: ${result.focused.focusList ? result.focused.focusList.length : 0} 项`);
    console.log(`   文件数量: ${Object.keys(titles).length} 个`);
    
    // 缓存结果
    const cacheKey = `structure_${version}`;
    this.setCache(cacheKey, result);
    
    return result;
  }

  /**
   * 获取当前版本（Git commit hash）
   */
  async getCurrentVersion(repoPath) {
    try {
      const git = simpleGit(repoPath);
      const log = await git.log(['-1']);
      return log.latest.hash.substring(0, 8); // 使用短哈希
    } catch (error) {
      console.warn('无法获取 Git 版本信息:', error);
      return 'unknown';
    }
  }

  /**
   * 读取 JSON 文件
   */
  async readJsonFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return null;
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`读取 JSON 文件失败 (${filePath}):`, error);
      return null;
    }
  }

  /**
   * 提取所有 Markdown 文件的标题
   */
  async extractAllTitles(repoPath) {
    const titles = {};
    
    try {
      await this.walkDirectory(repoPath, async (filePath, relativePath) => {
        if (filePath.endsWith('.md')) {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const title = this.extractTitle(content);
            if (title) {
              titles[relativePath] = title;
            }
          } catch (error) {
            console.warn(`无法读取文件标题: ${relativePath}`, error);
          }
        }
      });
    } catch (error) {
      console.warn('提取标题时出错:', error);
    }
    
    return titles;
  }

  /**
   * 递归遍历目录
   */
  async walkDirectory(dirPath, callback, basePath = dirPath) {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(basePath, fullPath);
      
      // 跳过 .git 目录和其他隐藏文件
      if (item.startsWith('.')) {
        continue;
      }
      
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await this.walkDirectory(fullPath, callback, basePath);
      } else {
        await callback(fullPath, relativePath);
      }
    }
  }

  /**
   * 从 Markdown 内容中提取标题
   */
  extractTitle(content) {
    // 优先从 Front Matter 中获取
    const parsed = matter(content);
    if (parsed.data.title) {
      return parsed.data.title;
    }
    
    // 从第一个 H1 标签中提取
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    
    return null;
  }

  /**
   * 从 URL 中提取仓库名称
   */
  getRepoNameFromUrl(url) {
    const match = url.match(/\/([^\/]+)\.git$/);
    if (match) {
      return match[1];
    }
    
    // 如果没有 .git 后缀
    const parts = url.split('/');
    return parts[parts.length - 1] || 'default-repo';
  }

  /**
   * 检查缓存是否有效
   */
  isValidCache(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 设置缓存
   */
  setCache(key, value) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL * 1000);
  }

  /**
   * 获取默认示例数据结构（用于演示和测试）
   */
  getDefaultStructure() {
    return {
      version: "demo-v1.0.0",
      tree: {
        version: "1.0.0",
        rootNodes: [
          {
            id: "programming",
            title: "编程基础",
            children: [
              {
                id: "what-is-programming",
                title: "什么是编程？",
                path: "issues/what-is-programming.md"
              },
              {
                id: "how-to-learn",
                title: "如何学习编程？",
                path: "issues/how-to-learn.md"
              }
            ]
          },
          {
            id: "web-development",
            title: "Web 开发",
            children: [
              {
                id: "html-basics",
                title: "HTML 基础",
                path: "issues/html-basics.md"
              },
              {
                id: "css-basics",
                title: "CSS 基础",
                path: "issues/css-basics.md"
              }
            ]
          }
        ]
      },
      focused: {
        version: "1.0.0",
        focusList: [
          { id: "what-is-programming", priority: 1 },
          { id: "how-to-learn", priority: 2 },
          { id: "html-basics", priority: 3 }
        ]
      },
      titles: {
        "issues/what-is-programming.md": "什么是编程？",
        "issues/how-to-learn.md": "如何学习编程？",
        "issues/html-basics.md": "HTML 基础",
        "issues/css-basics.md": "CSS 基础",
        "docs/introduction.md": "项目介绍"
      }
    };
  }

  /**
   * 获取默认问题内容（用于演示和测试）
   */
  getDefaultIssueContent(filePath) {
    const sampleContents = {
      "issues/what-is-programming.md": {
        title: "什么是编程？",
        content: `# 什么是编程？

编程是一种通过编写代码来解决问题和创建软件应用的技术活动。

## 核心概念

### 1. 算法
算法是解决问题的步骤和逻辑。

### 2. 数据结构
数据结构是组织和存储数据的方式。

### 3. 编程语言
编程语言是人与计算机沟通的工具。

## 学习建议

1. 从基础语法开始
2. 多做练习项目  
3. 学习算法和数据结构
4. 参与开源项目

---

*这是示例数据，请配置真实的 Git 仓库地址获取实际内容。*`
      },
      "issues/how-to-learn.md": {
        title: "如何学习编程？",
        content: `# 如何学习编程？

学习编程需要系统的方法和持续的练习。

## 学习路径

### 第一阶段：基础入门
- 选择一门编程语言（推荐 Python 或 JavaScript）
- 学习基本语法和概念
- 完成简单的练习题

### 第二阶段：项目实践
- 做小项目巩固知识
- 学习使用开发工具
- 了解软件开发流程

### 第三阶段：深入学习
- 学习数据结构和算法
- 了解软件设计模式
- 参与开源项目

## 学习资源

- 在线编程平台
- 技术文档和教程
- 编程社区和论坛
- 开源项目

---

*这是示例数据，请配置真实的 Git 仓库地址获取实际内容。*`
      },
      "issues/html-basics.md": {
        title: "HTML 基础",
        content: `# HTML 基础

HTML（HyperText Markup Language）是构建网页的标准标记语言。

## 基本结构

\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>页面标题</title>
</head>
<body>
    <h1>这是标题</h1>
    <p>这是段落</p>
</body>
</html>
\`\`\`

## 常用标签

- \`<h1>\` 到 \`<h6>\`：标题标签
- \`<p>\`：段落标签
- \`<a>\`：链接标签
- \`<img>\`：图片标签
- \`<div>\`：容器标签

---

*这是示例数据，请配置真实的 Git 仓库地址获取实际内容。*`
      }
    };

    const defaultContent = sampleContents[filePath];
    if (!defaultContent) {
      return null;
    }

    return {
      path: filePath,
      title: defaultContent.title,
      content: defaultContent.content,
      last_modified: new Date().toISOString()
    };
  }
}

module.exports = new KbService();
