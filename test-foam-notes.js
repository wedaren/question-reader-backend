/**
 * 测试 foam-notes 仓库集成
 */
const kbService = require('./src/services/kbService');

async function testFoamNotesIntegration() {
  console.log('=== 测试 foam-notes 仓库集成 ===\n');
  
  try {
    console.log('1. 获取知识库结构...');
    const structure = await kbService.getKnowledgeBaseStructure();
    
    console.log(`✅ 知识库版本: ${structure.version}`);
    console.log(`📁 根节点数量: ${structure.tree.rootNodes.length}`);
    console.log(`⭐ 关注列表: ${structure.focused.focusList.length} 项`);
    console.log(`📄 总文件数: ${Object.keys(structure.titles).length} 个\n`);
    
    // 显示前几个文件
    console.log('📋 部分文件列表:');
    const titleEntries = Object.entries(structure.titles).slice(0, 5);
    titleEntries.forEach(([path, title]) => {
      console.log(`   ${path} -> ${title}`);
    });
    
    if (Object.keys(structure.titles).length > 5) {
      console.log(`   ... 还有 ${Object.keys(structure.titles).length - 5} 个文件`);
    }
    console.log();
    
    // 测试获取单个文件
    console.log('2. 测试获取单个问题内容...');
    const firstFile = Object.keys(structure.titles)[0];
    if (firstFile) {
      console.log(`📖 尝试读取: ${firstFile}`);
      const content = await kbService.getIssueContent(firstFile);
      
      if (content) {
        console.log(`✅ 成功读取文件`);
        console.log(`   标题: ${content.title}`);
        console.log(`   内容长度: ${content.content.length} 字符`);
        console.log(`   修改时间: ${content.last_modified}`);
        console.log(`   内容预览: ${content.content.substring(0, 100)}...`);
      } else {
        console.log('❌ 文件读取失败');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细信息:', error);
  }
}

// 运行测试
testFoamNotesIntegration().then(() => {
  console.log('\n=== 测试完成 ===');
  process.exit(0);
}).catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
