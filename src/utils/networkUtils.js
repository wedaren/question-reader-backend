/**
 * 网络连接检测工具
 */
const dns = require('dns');
const { promisify } = require('util');

const lookup = promisify(dns.lookup);

class NetworkUtils {
  /**
   * 检查网络连接状态
   */
  static async isOnline() {
    try {
      await lookup('github.com');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查特定域名的连接
   */
  static async canReachHost(hostname) {
    try {
      await lookup(hostname);
      return true;
    } catch (error) {
      console.warn(`无法连接到 ${hostname}: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取网络状态描述
   */
  static async getNetworkStatus() {
    const isOnline = await this.isOnline();
    const canReachGithub = await this.canReachHost('github.com');
    
    return {
      online: isOnline,
      github: canReachGithub,
      status: isOnline ? (canReachGithub ? 'connected' : 'limited') : 'offline'
    };
  }
}

module.exports = NetworkUtils;
