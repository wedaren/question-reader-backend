const express = require('express');
const router = express.Router();
const kbController = require('../controllers/kbController');

/**
 * 获取知识库结构
 * GET /v1/kb/structure
 */
router.get('/structure', kbController.getStructure);

/**
 * 获取单个问题内容
 * GET /v1/kb/issue?path=issues/issue-1.md
 */
router.get('/issue', kbController.getIssue);

/**
 * 获取仓库同步状态
 * GET /v1/kb/sync-status
 */
router.get('/sync-status', kbController.getSyncStatus);

/**
 * 手动触发仓库同步
 * POST /v1/kb/force-sync
 */
router.post('/force-sync', kbController.forceSync);

module.exports = router;
