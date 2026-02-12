/**
 * 检查数据库中的文档
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocuments() {
  try {
    console.log('\n========== 数据库文档检查 ==========\n');
    
    // 查询所有文档
    const documents = await prisma.document.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`数据库中共有 ${documents.length} 个文档\n`);
    
    if (documents.length === 0) {
      console.log('❌ 数据库中没有任何文档！');
      return;
    }
    
    // 显示每个文档的详细信息
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. 文档ID: ${doc.id}`);
      console.log(`   标题: ${doc.title}`);
      console.log(`   类型: ${doc.type}`);
      console.log(`   文件类型: ${doc.fileType || 'N/A'}`);
      console.log(`   创建时间: ${doc.createdAt}`);
      console.log(`   更新时间: ${doc.updatedAt}`);
      console.log(`   内容长度: ${doc.content ? doc.content.length : 0} 字符`);
      console.log('');
    });
    
    // 检查前端显示的文档
    console.log('\n========== 前端显示的文档 ==========\n');
    console.log('根据截图，前端显示了以下文档:');
    console.log('1. 天花板维修流量通道说明');
    console.log('2. 基层机构编制和岗位设置的规范性说明一体化方案（初稿）');
    console.log('3. 20210624年度市级行政单位机构编制动态调整流程方案');
    console.log('4. test.file');
    
    console.log('\n正在检查这些文档是否在数据库中...\n');
    
    const frontendTitles = [
      '天花板维修流量通道说明',
      '基层机构编制和岗位设置的规范性说明一体化方案（初稿）',
      '20210624年度市级行政单位机构编制动态调整流程方案',
      'test.file'
    ];
    
    frontendTitles.forEach(title => {
      const found = documents.find(doc => 
        doc.title.includes(title) || title.includes(doc.title)
      );
      
      if (found) {
        console.log(`✅ "${title}" - 在数据库中找到 (ID: ${found.id})`);
      } else {
        console.log(`❌ "${title}" - 在数据库中未找到`);
      }
    });
    
    // 检查可能的缓存问题
    console.log('\n========== 可能的原因分析 ==========\n');
    
    if (documents.length === 0) {
      console.log('❌ 数据库为空，但前端显示了文档');
      console.log('   可能原因:');
      console.log('   1. 前端使用了缓存数据（localStorage/sessionStorage）');
      console.log('   2. 前端API调用了错误的数据源');
      console.log('   3. 前端显示的是模拟数据');
    } else {
      const matchCount = frontendTitles.filter(title => 
        documents.some(doc => doc.title.includes(title) || title.includes(doc.title))
      ).length;
      
      if (matchCount < frontendTitles.length) {
        console.log(`⚠️  只有 ${matchCount}/${frontendTitles.length} 个文档在数据库中`);
        console.log('   可能原因:');
        console.log('   1. 前端缓存了已删除的文档');
        console.log('   2. 前端和后端使用了不同的数据库');
        console.log('   3. 前端显示的数据未同步');
      } else {
        console.log('✅ 所有前端显示的文档都在数据库中');
      }
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDocuments();
