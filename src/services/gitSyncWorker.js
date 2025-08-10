const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const NetworkUtils = require('../utils/networkUtils');

/**
 * Git 同步工作器
 * 负责在后台执行 Git 仓库同步操作，避免阻塞主线程
 */
class GitSyncWorker {
  constructor() {
    this.syncQueue = new Map(); // 同步队列，避免重复同步
    this.syncStatus = new Map(); // 同步状态跟踪
    this.syncResults = new Map(); // 同步结果缓存
    this.isShuttingDown = false;
    
    // 定期清理过期的同步状态
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStatus();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 异步同步仓库
   * @param {string} repoUrl - 仓库地址
   * @param {string} reposBasePath - 仓库基础目录
   * @param {boolean} force - 是否强制同步
   * @param {boolean} background - 是否后台同步（不等待结果）
   * @returns {Promise<object>} 同步结果
   */
  async syncRepository(repoUrl, reposBasePath, force = false, background = false) {
    const repoName = this.getRepoNameFromUrl(repoUrl);
    const syncKey = `${repoUrl}_${reposBasePath}`;
    
    // 检查是否已经在同步中
    if (this.syncQueue.has(syncKey) && !force) {
      console.log(`📋 仓库同步已在队列中: ${repoName}`);
      
      if (background) {
        return { 
          success: false, 
          message: '同步已在进行中', 
          background: true 
        };
      }
      
      return await this.syncQueue.get(syncKey);
    }

    // 设置同步任务
    const syncPromise = this.setupSyncTask(repoUrl, reposBasePath, syncKey, repoName);
    
    if (background) {
      // 后台模式：启动同步但不等待结果
      console.log(`🔄 启动后台同步: ${repoName}`);
      this.handleBackgroundSync(syncPromise, syncKey, repoName);
      
      return { 
        success: true, 
        message: '后台同步已启动', 
        background: true 
      };
    }
    
    // 前台模式：等待同步完成
    return await this.handleForegroundSync(syncPromise, syncKey, repoName);
  }

  /**
   * 设置同步任务
   * @private
   */
  setupSyncTask(repoUrl, reposBasePath, syncKey, repoName) {
    // 创建同步 Promise
    const syncPromise = this.performSync(repoUrl, reposBasePath);
    
    // 添加到队列和状态跟踪
    this.syncQueue.set(syncKey, syncPromise);
    this.syncStatus.set(syncKey, {
      status: 'syncing',
      startTime: Date.now(),
      repoName,
      repoUrl
    });
    
    return syncPromise;
  }

  /**
   * 处理后台同步
   * @private
   */
  handleBackgroundSync(syncPromise, syncKey, repoName) {
    syncPromise
      .then(result => {
        this.handleSyncSuccess(syncKey, repoName, result, true);
      })
      .catch(error => {
        this.handleSyncError(syncKey, repoName, error, true);
      })
      .finally(() => {
        this.cleanupSync(syncKey);
      });
  }

  /**
   * 处理前台同步
   * @private
   */
  async handleForegroundSync(syncPromise, syncKey, repoName) {
    try {
      const result = await syncPromise;
      this.handleSyncSuccess(syncKey, repoName, result, false);
      return result;
    } catch (error) {
      this.handleSyncError(syncKey, repoName, error, false);
      throw error;
    } finally {
      this.cleanupSync(syncKey);
    }
  }

  /**
   * 处理同步成功
   * @private
   */
  handleSyncSuccess(syncKey, repoName, result, isBackground) {
    const currentStatus = this.syncStatus.get(syncKey);
    const duration = Date.now() - currentStatus.startTime;
    
    // 更新状态
    this.syncStatus.set(syncKey, {
      ...currentStatus,
      status: 'completed',
      endTime: Date.now()
    });
    
    // 缓存结果
    this.syncResults.set(syncKey, result);
    
    // 记录日志
    const logPrefix = isBackground ? '后台' : '';
    console.log(`✅ ${logPrefix}同步完成: ${repoName} (耗时: ${duration}ms)`);
  }

  /**
   * 处理同步错误
   * @private
   */
  handleSyncError(syncKey, repoName, error, isBackground) {
    const currentStatus = this.syncStatus.get(syncKey);
    
    // 更新错误状态
    this.syncStatus.set(syncKey, {
      ...currentStatus,
      status: 'failed',
      endTime: Date.now(),
      error: error.message
    });
    
    // 记录错误日志
    const logPrefix = isBackground ? '后台' : '';
    console.error(`❌ ${logPrefix}同步失败: ${repoName}`, error);
  }

  /**
   * 清理同步资源
   * @private
   */
  cleanupSync(syncKey) {
    // 从队列中移除
    this.syncQueue.delete(syncKey);
    
    // 5分钟后清理结果缓存
    setTimeout(() => {
      this.syncResults.delete(syncKey);
    }, 5 * 60 * 1000);
  }

  /**
   * 执行实际的同步操作
   * @private
   */
  async performSync(repoUrl, reposBasePath) {
    const repoName = this.getRepoNameFromUrl(repoUrl);
    const repoPath = path.join(reposBasePath, repoName);
    
    console.log(`🔄 开始同步仓库: ${repoUrl}`);
    console.log(`📁 本地路径: ${repoPath}`);
    
    try {
      // 检查网络状态
      const networkStatus = await NetworkUtils.getNetworkStatus();
      console.log(`📡 网络状态: ${networkStatus.status}`);
      
      // 确保基础目录存在
      await fs.ensureDir(reposBasePath);
      
      if (await fs.pathExists(repoPath)) {
        return await this.updateExistingRepo(repoPath, repoName, networkStatus);
      } else {
        return await this.cloneNewRepo(repoUrl, repoPath, repoName, networkStatus);
      }
      
    } catch (error) {
      console.error(`❌ 仓库同步失败 (${repoUrl}):`, error.message);
      
      // 如果同步失败但本地仓库存在，返回本地版本信息
      if (await fs.pathExists(repoPath)) {
        console.warn('🔄 回退使用本地缓存版本');
        return {
          success: false,
          repoPath,
          version: await this.getCurrentVersion(repoPath),
          message: '网络同步失败，使用本地缓存',
          fallbackToLocal: true
        };
      }
      
      throw new Error(`无法同步知识库仓库: ${error.message}`);
    }
  }

  /**
   * 更新现有仓库
   * @private
   */
  async updateExistingRepo(repoPath, repoName, networkStatus) {
    const gitDir = path.join(repoPath, '.git');
    
    if (!await fs.pathExists(gitDir)) {
      console.warn('🔧 发现损坏的仓库目录，标记为需要重新克隆');
      await fs.remove(repoPath);
      throw new Error('Repository corrupted, needs re-clone');
    }
    
    console.log('📦 发现本地仓库，尝试更新...');
    const git = simpleGit(repoPath);
    
    // 如果网络离线，直接使用本地版本
    if (!networkStatus.online) {
      console.log('🔄 网络离线，使用本地版本');
      return {
        success: true,
        repoPath,
        version: await this.getCurrentVersion(repoPath),
        message: '网络离线，使用本地缓存',
        offline: true
      };
    }
    
    try {
      // 获取更新前的版本
      const beforeVersion = await this.getCurrentVersion(repoPath);
      
      // 检查远程更新
      await git.fetch();
      const status = await git.status();
      
      if (status.behind > 0) {
        console.log(`📥 发现 ${status.behind} 个新提交，正在拉取...`);
        await git.pull();
        
        const afterVersion = await this.getCurrentVersion(repoPath);
        console.log(`🆙 仓库已更新: ${beforeVersion} → ${afterVersion}`);
        
        return {
          success: true,
          repoPath,
          version: afterVersion,
          updated: true,
          previousVersion: beforeVersion,
          message: `已更新 ${status.behind} 个提交`
        };
      } else {
        console.log('✅ 仓库已是最新版本');
        return {
          success: true,
          repoPath,
          version: beforeVersion,
          updated: false,
          message: '仓库已是最新版本'
        };
      }
      
    } catch (pullError) {
      console.warn(`⚠️ 网络更新失败，使用本地版本: ${pullError.message}`);
      return {
        success: false,
        repoPath,
        version: await this.getCurrentVersion(repoPath),
        message: '网络更新失败，使用本地缓存',
        fallbackToLocal: true
      };
    }
  }

  /**
   * 克隆新仓库
   * @private
   */
  async cloneNewRepo(repoUrl, repoPath, repoName, networkStatus) {
    // 如果网络离线，无法克隆新仓库
    if (!networkStatus.online) {
      throw new Error('网络离线，无法克隆新仓库');
    }
    
    console.log('🆕 首次克隆仓库...');
    const git = simpleGit();
    
    // 使用超时和进度回调
    await git.clone(repoUrl, repoPath, {
      '--depth': 1, // 浅克隆，只获取最新版本
      '--single-branch': true // 只获取默认分支
    });
    
    const version = await this.getCurrentVersion(repoPath);
    console.log(`🎉 仓库克隆成功: ${repoName} (版本: ${version})`);
    
    return {
      success: true,
      repoPath,
      version,
      cloned: true,
      message: '仓库首次克隆成功'
    };
  }

  /**
   * 获取当前版本（Git commit hash）
   * @private
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
   * 从 URL 中提取仓库名称
   * @private
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
   * 获取仓库同步状态
   */
  getSyncStatus(repoUrl, reposBasePath) {
    const syncKey = `${repoUrl}_${reposBasePath}`;
    return this.syncStatus.get(syncKey) || { status: 'idle' };
  }

  /**
   * 获取所有同步状态
   */
  getAllSyncStatus() {
    const statuses = {};
    for (const [key, status] of this.syncStatus.entries()) {
      statuses[status.repoName || key] = status;
    }
    return statuses;
  }

  /**
   * 检查仓库是否在同步中
   */
  isSyncing(repoUrl, reposBasePath) {
    const syncKey = `${repoUrl}_${reposBasePath}`;
    return this.syncQueue.has(syncKey);
  }

  /**
   * 清理过期的同步状态
   * @private
   */
  cleanupExpiredStatus() {
    const now = Date.now();
    const expireTime = 10 * 60 * 1000; // 10分钟过期
    
    for (const [key, status] of this.syncStatus.entries()) {
      if (status.endTime && (now - status.endTime) > expireTime) {
        this.syncStatus.delete(key);
        this.syncResults.delete(key);
      }
    }
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    console.log('🛑 Git 同步工作器正在关闭...');
    this.isShuttingDown = true;
    
    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 等待所有同步任务完成
    const syncPromises = Array.from(this.syncQueue.values());
    if (syncPromises.length > 0) {
      console.log(`⏳ 等待 ${syncPromises.length} 个同步任务完成...`);
      try {
        await Promise.all(syncPromises);
      } catch (error) {
        console.warn('⚠️ 部分同步任务未能完成:', error);
      }
    }
    
    console.log('✅ Git 同步工作器已关闭');
  }
}

module.exports = GitSyncWorker;
