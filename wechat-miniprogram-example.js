// 微信小程序前端集成示例
// 文件: utils/api.js

/**
 * API 配置
 */
const API_CONFIG = {
  // 开发环境
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000
  },
  // 生产环境  
  production: {
    baseUrl: 'https://your-api-domain.com',
    timeout: 15000
  }
};

// 获取当前环境配置
const config = API_CONFIG[process.env.NODE_ENV] || API_CONFIG.development;

/**
 * API 请求封装
 */
class ApiService {
  constructor() {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
    this.cache = new Map();
  }

  /**
   * 通用请求方法
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      data = null,
      headers = {},
      useCache = false,
      cacheTime = 5 * 60 * 1000 // 5分钟缓存
    } = options;

    // 缓存检查
    const cacheKey = `${method}:${url}`;
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTime) {
        console.log('✅ 使用缓存数据:', url);
        return cached.data;
      }
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: this.baseUrl + url,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: this.timeout,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 缓存成功响应
            if (useCache) {
              this.cache.set(cacheKey, {
                data: res.data,
                timestamp: Date.now()
              });
            }
            resolve(res.data);
          } else {
            console.error('API 请求失败:', res);
            reject(new Error(`HTTP ${res.statusCode}: ${res.data?.message || '请求失败'}`));
          }
        },
        fail: (error) => {
          console.error('网络请求失败:', error);
          reject(new Error(`网络错误: ${error.errMsg}`));
        }
      });
    });
  }

  /**
   * 获取知识库结构
   */
  async getKnowledgeStructure() {
    try {
      const data = await this.request('/v1/kb/structure', {
        useCache: true,
        cacheTime: 5 * 60 * 1000 // 5分钟缓存
      });

      return {
        success: true,
        data: {
          version: data.version,
          tree: data.tree,
          focused: data.focused,
          titles: data.titles
        }
      };
    } catch (error) {
      console.error('获取知识库结构失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取问题详情
   */
  async getIssueDetail(filePath) {
    if (!filePath) {
      return {
        success: false,
        error: '文件路径不能为空'
      };
    }

    try {
      const data = await this.request(`/v1/kb/issue?path=${encodeURIComponent(filePath)}`, {
        useCache: true,
        cacheTime: 10 * 60 * 1000 // 10分钟缓存
      });

      return {
        success: true,
        data: {
          path: data.path,
          title: data.title,
          content: data.content,
          lastModified: data.last_modified
        }
      };
    } catch (error) {
      console.error('获取问题详情失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus() {
    try {
      const data = await this.request('/v1/kb/sync-status');
      return {
        success: true,
        data: {
          status: data.status,
          repoName: data.repoName,
          lastSync: data.lastSync,
          syncDuration: data.syncDuration,
          error: data.error
        }
      };
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 触发手动同步
   */
  async forceSync() {
    try {
      const data = await this.request('/v1/kb/force-sync', {
        method: 'POST'
      });

      // 清除相关缓存
      this.clearCache();

      return {
        success: true,
        data: {
          message: data.message,
          version: data.version,
          updated: data.updated
        }
      };
    } catch (error) {
      console.error('手动同步失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const data = await this.request('/health');
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 API 缓存已清除');
  }

  /**
   * 批量预加载
   */
  async preloadData() {
    console.log('🚀 开始预加载数据...');
    
    const tasks = [
      this.getKnowledgeStructure(),
      this.getSyncStatus()
    ];

    try {
      const results = await Promise.all(tasks);
      console.log('✅ 数据预加载完成');
      return results;
    } catch (error) {
      console.error('❌ 数据预加载失败:', error);
      throw error;
    }
  }
}

// 创建全局实例
const apiService = new ApiService();

/**
 * 页面使用示例
 * 文件: pages/index/index.js
 */

Page({
  data: {
    knowledgeTree: [],
    focusedIssues: [],
    syncStatus: {},
    loading: true,
    error: null
  },

  onLoad() {
    this.loadInitialData();
  },

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    wx.showLoading({
      title: '加载中...'
    });

    try {
      // 并行加载数据
      const [structureResult, syncResult] = await Promise.all([
        apiService.getKnowledgeStructure(),
        apiService.getSyncStatus()
      ]);

      if (structureResult.success) {
        this.setData({
          knowledgeTree: this.buildTreeNodes(structureResult.data.tree.rootNodes),
          focusedIssues: this.buildFocusedList(
            structureResult.data.focused.focusList,
            structureResult.data.titles
          ),
          titles: structureResult.data.titles
        });
      } else {
        this.showError('加载知识库失败: ' + structureResult.error);
      }

      if (syncResult.success) {
        this.setData({
          syncStatus: syncResult.data
        });
      }

    } catch (error) {
      this.showError('初始化失败: ' + error.message);
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  /**
   * 构建树形节点数据
   */
  buildTreeNodes(rootNodes) {
    return rootNodes.map(node => ({
      id: node.id,
      title: this.data.titles[node.filePath] || node.filePath,
      filePath: node.filePath,
      children: node.children || [],
      expanded: node.expanded || false
    }));
  },

  /**
   * 构建关注列表
   */
  buildFocusedList(focusList, titles) {
    return focusList.slice(0, 10).map(id => {
      // 从树节点中找到对应的文件路径
      const node = this.findNodeById(this.data.knowledgeTree, id);
      return {
        id,
        title: titles[node?.filePath] || '未知标题',
        filePath: node?.filePath
      };
    });
  },

  /**
   * 根据 ID 查找节点
   */
  findNodeById(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = this.findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * 点击问题项
   */
  async onIssueClick(e) {
    const { filepath: filePath } = e.currentTarget.dataset;
    
    if (!filePath) {
      this.showError('无效的文件路径');
      return;
    }

    wx.showLoading({
      title: '加载中...'
    });

    try {
      const result = await apiService.getIssueDetail(filePath);
      
      if (result.success) {
        // 跳转到详情页面
        wx.navigateTo({
          url: `/pages/issue-detail/index?title=${encodeURIComponent(result.data.title)}&path=${encodeURIComponent(filePath)}`
        });
      } else {
        this.showError('加载问题失败: ' + result.error);
      }
    } catch (error) {
      this.showError('加载问题失败: ' + error.message);
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    try {
      // 清除缓存
      apiService.clearCache();
      
      // 重新加载数据
      await this.loadInitialData();
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      this.showError('刷新失败: ' + error.message);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 手动同步
   */
  async onForceSync() {
    wx.showLoading({
      title: '同步中...'
    });

    try {
      const result = await apiService.forceSync();
      
      if (result.success) {
        wx.showToast({
          title: result.data.updated ? '发现更新' : '已是最新',
          icon: 'success'
        });
        
        // 如果有更新，重新加载数据
        if (result.data.updated) {
          await this.loadInitialData();
        }
      } else {
        this.showError('同步失败: ' + result.error);
      }
    } catch (error) {
      this.showError('同步失败: ' + error.message);
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 显示错误信息
   */
  showError(message) {
    this.setData({ error: message });
    wx.showToast({
      title: message.length > 10 ? '操作失败' : message,
      icon: 'none'
    });
  }
});

/**
 * 问题详情页面示例
 * 文件: pages/issue-detail/index.js
 */

Page({
  data: {
    title: '',
    content: '',
    filePath: '',
    lastModified: '',
    loading: true
  },

  onLoad(options) {
    const { title, path } = options;
    this.setData({
      title: decodeURIComponent(title || ''),
      filePath: decodeURIComponent(path || '')
    });
    
    this.loadIssueContent();
  },

  async loadIssueContent() {
    if (!this.data.filePath) {
      this.showError('无效的文件路径');
      return;
    }

    try {
      const result = await apiService.getIssueDetail(this.data.filePath);
      
      if (result.success) {
        this.setData({
          title: result.data.title,
          content: result.data.content,
          lastModified: this.formatDate(result.data.lastModified),
          loading: false
        });
      } else {
        this.showError('加载内容失败: ' + result.error);
      }
    } catch (error) {
      this.showError('加载内容失败: ' + error.message);
    }
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  },

  showError(message) {
    wx.showToast({
      title: message,
      icon: 'none'
    });
    this.setData({ loading: false });
  }
});

// 导出 API 服务供其他页面使用
export default apiService;
