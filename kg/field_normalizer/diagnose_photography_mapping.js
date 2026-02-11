/**
 * 诊断PhotographyEntity字段映射问题
 * 检查为什么提取的字段没有被映射到PhotographyEntity
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔍 诊断PhotographyEntity字段映射');
console.log('================================================================================\n');

async function diagnose() {
  try {
    // 读取映射文件
    const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    
    console.log('✓ 已读取映射文件\n');
    
    // 检查PhotographyEntity映射
    const photoMapping = mappings.PhotographyEntity;
    if (!photoMapping) {
      console.error('❌ 未找到PhotographyEntity映射');
      process.exit(1);
    }
    
    console.log('📝 PhotographyEntity字段映射:');
    console.log('');
    
    // 提取的字段
    const extractedFields = [
      'FocalLength',
      'Aperture',
      'ShutterSpeed',
      'LensModel'
    ];
    
    console.log('提取的字段:', extractedFields.join(', '));
    console.log('');
    
    // 检查每个提取字段是否能匹配到PhotographyEntity
    console.log('字段匹配分析:');
    console.log('');
    
    for (const fieldName of extractedFields) {
      console.log(`字段: ${fieldName}`);
      
      let matched = false;
      let matchedTo = null;
      let matchMethod = null;
      
      // 检查每个标准字段
      for (const [standardName, mapping] of Object.entries(photoMapping)) {
        const variations = mapping.common_variations || [];
        
        // 1. 精确匹配
        if (fieldName.toLowerCase() === standardName.toLowerCase()) {
          matched = true;
          matchedTo = standardName;
          matchMethod = 'exact';
          break;
        }
        
        // 2. 变体匹配
        for (const variation of variations) {
          if (fieldName.toLowerCase() === variation.toLowerCase()) {
            matched = true;
            matchedTo = standardName;
            matchMethod = 'variation';
            break;
          }
        }
        
        if (matched) break;
        
        // 3. 模糊匹配
        if (fieldName.toLowerCase().includes(standardName.toLowerCase()) || 
            standardName.toLowerCase().includes(fieldName.toLowerCase())) {
          matched = true;
          matchedTo = standardName;
          matchMethod = 'fuzzy';
          break;
        }
        
        // 4. 变体模糊匹配
        for (const variation of variations) {
          const varLower = variation.toLowerCase();
          if (fieldName.toLowerCase().includes(varLower) || 
              varLower.includes(fieldName.toLowerCase())) {
            matched = true;
            matchedTo = standardName;
            matchMethod = 'fuzzy_variation';
            break;
          }
        }
        
        if (matched) break;
      }
      
      if (matched) {
        console.log(`  ✓ 匹配到: ${matchedTo} (方法: ${matchMethod})`);
      } else {
        console.log(`  ❌ 未匹配`);
      }
      console.log('');
    }
    
    // 检查每个标准字段的变体
    console.log('================================================================================');
    console.log('标准字段变体详情:');
    console.log('================================================================================\n');
    
    for (const [standardName, mapping] of Object.entries(photoMapping)) {
      const variations = mapping.common_variations || [];
      console.log(`${standardName}:`);
      console.log(`  变体数: ${variations.length}`);
      console.log(`  权重: ${mapping.weight}`);
      console.log(`  必需: ${mapping.required}`);
      
      // 检查是否包含提取的字段名
      const matchedExtracted = extractedFields.filter(ef => 
        variations.some(v => v.toLowerCase() === ef.toLowerCase())
      );
      
      if (matchedExtracted.length > 0) {
        console.log(`  ✓ 匹配提取字段: ${matchedExtracted.join(', ')}`);
      }
      
      // 显示前10个变体
      console.log(`  前10个变体: ${variations.slice(0, 10).join(', ')}`);
      console.log('');
    }
    
    // 检查Aperture字段的变体是否包含FocalLength相关的词
    console.log('================================================================================');
    console.log('检查Aperture字段的变体:');
    console.log('================================================================================\n');
    
    const apertureVariations = photoMapping.Aperture.common_variations || [];
    console.log(`Aperture变体数: ${apertureVariations.length}`);
    console.log('');
    
    // 检查是否有包含"focal"或"length"的变体
    const suspiciousVariations = apertureVariations.filter(v => 
      v.toLowerCase().includes('focal') || 
      v.toLowerCase().includes('length') ||
      v.toLowerCase().includes('焦距')
    );
    
    if (suspiciousVariations.length > 0) {
      console.log(`⚠️  发现 ${suspiciousVariations.length} 个可疑变体（包含focal/length/焦距）:`);
      suspiciousVariations.forEach(v => console.log(`  - ${v}`));
    } else {
      console.log('✓ 没有发现可疑变体');
    }
    console.log('');
    
    // 检查FocalLength字段的变体
    console.log('================================================================================');
    console.log('检查FocalLength字段的变体:');
    console.log('================================================================================\n');
    
    const focalLengthVariations = photoMapping.FocalLength.common_variations || [];
    console.log(`FocalLength变体数: ${focalLengthVariations.length}`);
    console.log('所有变体:');
    focalLengthVariations.forEach(v => console.log(`  - ${v}`));
    console.log('');
    
    // 检查是否包含"FocalLength"
    const hasFocalLength = focalLengthVariations.some(v => 
      v.toLowerCase() === 'focallength'
    );
    
    if (hasFocalLength) {
      console.log('✓ 包含"FocalLength"变体');
    } else {
      console.log('⚠️  不包含"FocalLength"变体');
    }
    console.log('');
    
    console.log('✓ 诊断完成\n');
    
  } catch (error) {
    console.error('\n❌ 失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnose();
