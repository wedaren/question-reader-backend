/**
 * 直接测试 foam-notes 数据解析
 */
const fs = require('fs-extra');
const path = require('path');

async function testFoamNotesStructure() {
  try {
    console.log('=== foam-notes 结构解析测试 ===\n');
    
    const repoPath = './repos/foam-notes';
    const issueManagerPath = path.join(repoPath, '.issueManager');
    
    console.log('1. 检查目录结构...');
    const repoExists = await fs.pathExists(repoPath);
    const issueManagerExists = await fs.pathExists(issueManagerPath);
    
    console.log(`   仓库目录: ${repoExists ? '✅存在' : '❌不存在'}`);
    console.log(`   .issueManager: ${issueManagerExists ? '✅存在' : '❌不存在'}`);
    
    if (!repoExists) {
      console.log('\n❌ 仓库目录不存在，无法继续测试');
      return;
    }
    
    console.log('\n2. 解析结构文件...');
    
    let tree, focused;
    if (issueManagerExists) {
      console.log('   📁 使用 .issueManager 结构');
      
      // 读取 tree.json
      const treePath = path.join(issueManagerPath, 'tree.json');
      if (await fs.pathExists(treePath)) {
        const treeContent = await fs.readFile(treePath, 'utf8');
        tree = JSON.parse(treeContent);
        console.log(`   ✅ tree.json: ${tree.rootNodes ? tree.rootNodes.length : 0} 个根节点`);
      } else {
        console.log('   ❌ tree.json 不存在');
      }
      
      // 读取 focused.json
      const focusedPath = path.join(issueManagerPath, 'focused.json');
      if (await fs.pathExists(focusedPath)) {
        const focusedContent = await fs.readFile(focusedPath, 'utf8');
        focused = JSON.parse(focusedContent);
        console.log(`   ✅ focused.json: ${focused.focusList ? focused.focusList.length : 0} 项关注`);
      } else {
        console.log('   ❌ focused.json 不存在');
      }
    }
    
    console.log('\n3. 统计 Markdown 文件...');
    let markdownCount = 0;
    const titles = {};
    
    async function scanMarkdownFiles(dirPath, basePath = repoPath) {
      const items = await fs.readdir(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.')) {
          await scanMarkdownFiles(fullPath, basePath);
        } else if (item.endsWith('.md')) {
          markdownCount++;
          const relativePath = path.relative(basePath, fullPath);
          
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            if (titleMatch) {
              titles[relativePath] = titleMatch[1].trim();
            } else {
              titles[relativePath] = path.basename(item, '.md');
            }
          } catch (err) {
            titles[relativePath] = path.basename(item, '.md');
          }
        }
      }
    }
    
    await scanMarkdownFiles(repoPath);
    console.log(`   📄 发现 ${markdownCount} 个 Markdown 文件`);
    
    console.log('\n4. 结果预览...');
    console.log('   前10个文件标题:');
    const titleEntries = Object.entries(titles).slice(0, 10);
    titleEntries.forEach(([filePath, title]) => {
      console.log(`     ${filePath} -> ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`);
    });
    
    console.log('\n✅ foam-notes 结构解析测试完成！');
    console.log(`📊 统计结果:`);
    console.log(`   - 树结构根节点: ${tree ? tree.rootNodes.length : 0}`);
    console.log(`   - 关注列表项目: ${focused ? focused.focusList.length : 0}`);
    console.log(`   - Markdown 文件: ${markdownCount}`);
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

testFoamNotesStructure();
