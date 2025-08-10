const kbService = require('../services/kbService');

/**
 * 知识库控制器
 */
class KbController {
  /**
   * 获取知识库结构
   */
  async getStructure(req, res, next) {
    try {
      // 检查缓存控制头
      const ifNoneMatch = req.headers['if-none-match'];
      
      const result = await kbService.getKnowledgeBaseStructure();
      
      // 如果客户端提供的 ETag 与当前版本一致，返回 304
      if (ifNoneMatch && ifNoneMatch === result.version) {
        return res.status(304).end();
      }
      
      // 设置 ETag 响应头
      res.setHeader('ETag', result.version);
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5分钟缓存
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取单个问题内容
   */
  async getIssue(req, res, next) {
    try {
      const { path } = req.query;
      
      if (!path) {
        const error = new Error('缺少必需的参数: path');
        error.status = 400;
        error.code = 'MISSING_PARAMETER';
        throw error;
      }
      
      const result = await kbService.getIssueContent(path);
      
      if (!result) {
        const error = new Error('指定的问题文件未找到');
        error.status = 404;
        error.code = 'ISSUE_NOT_FOUND';
        throw error;
      }
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取仓库同步状态
   */
  async getSyncStatus(req, res, next) {
    try {
      const status = kbService.getSyncStatus();
      res.json({
        status: status.status,
        repoName: status.repoName,
        lastSync: status.endTime ? new Date(status.endTime).toISOString() : null,
        syncDuration: status.endTime && status.startTime ? 
          status.endTime - status.startTime : null,
        error: status.error || null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 手动触发仓库同步
   */
  async forceSync(req, res, next) {
    try {
      const result = await kbService.forceSyncRepository();
      res.json({
        success: result.success,
        message: result.message,
        version: result.version,
        updated: result.updated || result.cloned || false,
        repoPath: result.repoPath
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new KbController();
