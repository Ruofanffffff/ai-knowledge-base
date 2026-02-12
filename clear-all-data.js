const fs = require('fs');
const path = require('path');

function clearAllData() {
  try {
    console.log('开始清空所有数据...\n');

    // 1. 清空 documents.json 文件
    console.log('1. 清空 documents.json 文件...');
    const documentsPath = path.join(__dirname, 'data', 'documents.json');
    if (fs.existsSync(documentsPath)) {
      const oldDocs = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
      fs.writeFileSync(documentsPath, '[]', 'utf8');
      console.log(`   - 删除了 ${oldDocs.length} 条文档记录`);
    } else {
      console.log('   - documents.json 不存在，跳过');
    }

    // 2. 清空 categories.json 文件
    console.log('\n2. 清空 categories.json 文件...');
    const categoriesPath = path.join(__dirname, 'data', 'categories.json');
    if (fs.existsSync(categoriesPath)) {
      const oldCats = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
      fs.writeFileSync(categoriesPath, '[]', 'utf8');
      console.log(`   - 删除了 ${oldCats.length} 条分类记录`);
    } else {
      console.log('   - categories.json 不存在，跳过');
    }

    console.log('\n✅ 所有数据已清空完成！');
    console.log('\n提示：请在浏览器中按 Ctrl+Shift+R (或 Cmd+Shift+R) 强制刷新页面');
  } catch (error) {
    console.error('❌ 清空数据时出错:', error);
    throw error;
  }
}

clearAllData();
