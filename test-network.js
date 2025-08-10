/**
 * 测试更新后的网络检测和错误处理
 */
const NetworkUtils = require('./src/utils/networkUtils');

async function testNetworkDetection() {
  console.log('=== 网络状态检测测试 ===\n');
  
  try {
    console.log('1. 检测基础网络连接...');
    const isOnline = await NetworkUtils.isOnline();
    console.log(`   网络状态: ${isOnline ? '在线' : '离线'}`);
    
    console.log('\n2. 检测 GitHub 连接...');
    const canReachGithub = await NetworkUtils.canReachHost('github.com');
    console.log(`   GitHub 可达: ${canReachGithub ? '是' : '否'}`);
    
    console.log('\n3. 获取完整网络状态...');
    const status = await NetworkUtils.getNetworkStatus();
    console.log('   详细状态:', JSON.stringify(status, null, 2));
    
    console.log('\n4. 预期行为:');
    if (status.status === 'offline') {
      console.log('   ✅ 离线模式 - 将使用示例数据或本地缓存');
    } else if (status.status === 'limited') {
      console.log('   ⚠️ 受限连接 - 将尝试本地缓存');
    } else {
      console.log('   🌐 完全在线 - 将同步远程仓库');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testNetworkDetection().then(() => {
  console.log('\n=== 测试完成 ===');
});
