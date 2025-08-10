/**
 * 诊断 foam-notes 仓库同步问题
 */
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');

async function diagnoseRepository() {
  console.log('=== foam-notes 仓库同步诊断 ===\n');
  
  const repoUrl = 'https://github.com/wedaren/foam-notes.git';
  const reposBasePath = './repos';
  const repoName = 'foam-notes';
  const repoPath = path.join(reposBasePath, repoName);
  
  try {
    // 1. 检查基础目录
    console.log('1. 检查基础目录...');
    console.log(`   基础路径: ${path.resolve(reposBasePath)}`);
    
    if (!await fs.pathExists(reposBasePath)) {
      console.log('   ✅ 创建基础目录');
      await fs.ensureDir(reposBasePath);
    } else {
      console.log('   ✅ 基础目录已存在');
    }
    
    // 2. 检查仓库目录状态
    console.log('\n2. 检查仓库目录状态...');
    console.log(`   仓库路径: ${path.resolve(repoPath)}`);
    
    if (await fs.pathExists(repoPath)) {
      console.log('   📁 仓库目录已存在');
      
      const gitDir = path.join(repoPath, '.git');
      if (await fs.pathExists(gitDir)) {
        console.log('   ✅ 发现 .git 目录，这是一个有效的 git 仓库');
        
        // 检查仓库状态
        const git = simpleGit(repoPath);
        try {
          const status = await git.status();
          console.log('   📊 仓库状态:');
          console.log(`      分支: ${status.current}`);
          console.log(`      修改文件: ${status.modified.length}`);
          console.log(`      未跟踪文件: ${status.not_added.length}`);
        } catch (statusError) {
          console.log(`   ⚠️ 无法获取仓库状态: ${statusError.message}`);
        }
      } else {
        console.log('   ❌ 缺少 .git 目录，不是有效的 git 仓库');
        console.log('   🧹 清理损坏的目录...');
        await fs.remove(repoPath);
      }
    } else {
      console.log('   📭 仓库目录不存在');
    }
    
    // 3. 测试网络连接
    console.log('\n3. 测试网络连接...');
    try {
      const git = simpleGit();
      console.log(`   🌐 测试连接: ${repoUrl}`);
      
      // 如果目录不存在，尝试克隆
      if (!await fs.pathExists(repoPath)) {
        console.log('   📥 开始克隆仓库...');
        await git.clone(repoUrl, repoPath);
        console.log('   ✅ 克隆成功！');
      } else {
        // 如果存在，尝试拉取更新
        console.log('   🔄 尝试更新仓库...');
        const repoGit = simpleGit(repoPath);
        await repoGit.fetch();
        await repoGit.pull();
        console.log('   ✅ 更新成功！');
      }
    } catch (networkError) {
      console.log(`   ❌ 网络操作失败: ${networkError.message}`);
      
      if (await fs.pathExists(repoPath)) {
        console.log('   🔄 但本地缓存可用，将使用离线模式');
      } else {
        console.log('   💥 无本地缓存，无法继续');
        throw networkError;
      }
    }
    
    // 4. 验证仓库内容
    console.log('\n4. 验证仓库内容...');
    if (await fs.pathExists(repoPath)) {
      const files = await fs.readdir(repoPath);
      console.log(`   📄 发现 ${files.length} 个文件/目录:`);
      files.slice(0, 10).forEach(file => {
        console.log(`      - ${file}`);
      });
      
      if (files.length > 10) {
        console.log(`      ... 还有 ${files.length - 10} 个文件`);
      }
      
      // 统计 Markdown 文件
      let markdownCount = 0;
      async function countMarkdownFiles(dirPath) {
        const items = await fs.readdir(dirPath);
        for (const item of items) {
          const fullPath = path.join(dirPath, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.')) {
            await countMarkdownFiles(fullPath);
          } else if (item.endsWith('.md')) {
            markdownCount++;
          }
        }
      }
      
      await countMarkdownFiles(repoPath);
      console.log(`   📝 总计发现 ${markdownCount} 个 Markdown 文件`);
    }
    
    console.log('\n=== 诊断完成 ===');
    console.log('✅ 仓库同步功能正常！');
    
  } catch (error) {
    console.error('\n❌ 诊断过程中发现问题:');
    console.error('错误类型:', error.name);
    console.error('错误信息:', error.message);
    
    if (error.stack) {
      console.error('错误栈:', error.stack);
    }
    
    console.log('\n🔧 建议解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 确认仓库地址是否正确');
    console.log('3. 检查本地磁盘空间');
    console.log('4. 尝试手动清理 repos 目录');
  }
}

// 运行诊断
diagnoseRepository().then(() => {
  console.log('\n🎉 诊断程序执行完成');
  process.exit(0);
}).catch(err => {
  console.error('诊断程序异常退出:', err);
  process.exit(1);
});
