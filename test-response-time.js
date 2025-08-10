#!/usr/bin/env node

const http = require('http');

function testApiResponse(port) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/v1/kb/structure',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        try {
          const json = JSON.parse(data);
          const nodeCount = json.tree && json.tree.rootNodes ? json.tree.rootNodes.length : 0;
          
          resolve({
            responseTime,
            nodeCount,
            statusCode: res.statusCode
          });
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      reject(new Error('请求超时'));
    });

    req.end();
  });
}

async function runTest() {
  const port = process.env.PORT || 3777;
  
  console.log('🚀 启动非阻塞响应测试...');
  console.log(`📍 测试端口: ${port}`);
  
  try {
    // 等待服务启动
    console.log('⏳ 等待服务就绪...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试 1: 第一次请求
    console.log('\n📊 测试 1: 第一次请求');
    const result1 = await testApiResponse(port);
    console.log(`✅ 响应时间: ${result1.responseTime}ms`);
    console.log(`📄 状态码: ${result1.statusCode}`);
    console.log(`📊 节点数量: ${result1.nodeCount}`);
    
    // 测试 2: 第二次请求（应该使用缓存）
    console.log('\n📊 测试 2: 第二次请求（缓存）');
    const result2 = await testApiResponse(port);
    console.log(`✅ 响应时间: ${result2.responseTime}ms`);
    console.log(`📄 状态码: ${result2.statusCode}`);
    console.log(`📊 节点数量: ${result2.nodeCount}`);
    
    // 测试 3: 并发请求
    console.log('\n📊 测试 3: 并发请求');
    const concurrentPromises = Array.from({length: 3}, () => testApiResponse(port));
    const concurrentResults = await Promise.all(concurrentPromises);
    
    concurrentResults.forEach((result, index) => {
      console.log(`✅ 并发请求 ${index + 1}: ${result.responseTime}ms`);
    });
    
    const avgResponseTime = concurrentResults.reduce((sum, r) => sum + r.responseTime, 0) / concurrentResults.length;
    console.log(`📊 平均并发响应时间: ${avgResponseTime.toFixed(2)}ms`);
    
    // 总结
    console.log('\n🎯 测试总结:');
    console.log(`- 首次响应: ${result1.responseTime}ms`);
    console.log(`- 缓存响应: ${result2.responseTime}ms`);
    console.log(`- 并发平均: ${avgResponseTime.toFixed(2)}ms`);
    
    if (result1.responseTime < 1000 && result2.responseTime < 100) {
      console.log('🎉 非阻塞响应测试通过！');
    } else {
      console.log('⚠️ 响应时间可能还需要优化');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

runTest();
