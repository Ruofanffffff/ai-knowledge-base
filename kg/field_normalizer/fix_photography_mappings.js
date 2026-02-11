/**
 * 修复摄影Schema的字段映射问题
 * 
 * 问题:
 * 1. PhotographyEntity.Lens包含"焦距",导致FocalLength被错误映射到Lens
 * 2. PhotographyEntity缺少FocalLength字段
 * 3. 需要添加FocalLength字段并从Lens中移除"焦距"
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔧 修复摄影Schema字段映射');
console.log('================================================================================\n');

async function fixMappings() {
  try {
    // 读取映射配置
    const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    
    // 备份
    const backupPath = `${mappingPath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(mappings, null, 2));
    console.log(`✓ 已备份到: ${backupPath}\n`);
    
    let modified = false;
    
    // 1. 修复PhotographyEntity
    if (mappings['PhotographyEntity']) {
      console.log('1. 修复PhotographyEntity:');
      
      // 从Lens中移除"焦距"和"镜头焦段"
      if (mappings['PhotographyEntity'].Lens) {
        const oldLensVars = mappings['PhotographyEntity'].Lens.common_variations;
        const newLensVars = oldLensVars.filter(v => 
          v !== '焦距' && v !== '镜头焦段'
        );
        
        if (oldLensVars.length !== newLensVars.length) {
          mappings['PhotographyEntity'].Lens.common_variations = newLensVars;
          console.log(`   ✓ 从Lens中移除了 ${oldLensVars.length - newLensVars.length} 个变体`);
          console.log(`     移除: 焦距, 镜头焦段`);
          modified = true;
        }
      }
      
      // 添加FocalLength字段
      if (!mappings['PhotographyEntity'].FocalLength) {
        mappings['PhotographyEntity'].FocalLength = {
          common_variations: [
            'FocalLength',
            'focallength',
            'focal_length',
            '焦距',
            '镜头焦距',
            '焦段',
            '镜头焦段',
            '等效焦距',
            'focal length',
            'Focal Length',
            '焦距是多少',
            '焦距多少',
            '多少焦距',
            '35mm',
            '50mm',
            '85mm',
            '24mm',
            '70mm',
            '200mm',
            '24-70',
            '70-200',
            '16-35',
            '18-55'
          ],
          weight: 0.15,
          required: false,
          description: 'FocalLength字段 - 镜头焦距',
          data_type: 'text',
          domain: 'photography'
        };
        console.log(`   ✓ 添加了FocalLength字段 (${mappings['PhotographyEntity'].FocalLength.common_variations.length} 个变体)`);
        modified = true;
      }
      
      // 更新锚点字段权重
      if (mappings['PhotographyEntity'].Aperture) {
        mappings['PhotographyEntity'].Aperture.weight = 0.2;
        mappings['PhotographyEntity'].Aperture.required = true;
        console.log(`   ✓ 更新Aperture权重: 0.1 → 0.2, required: false → true`);
        modified = true;
      }
      
      if (mappings['PhotographyEntity'].Shutter) {
        mappings['PhotographyEntity'].Shutter.weight = 0.15;
        mappings['PhotographyEntity'].Shutter.required = true;
        console.log(`   ✓ 更新Shutter权重: 0.1 → 0.15, required: false → true`);
        modified = true;
      }
      
      if (mappings['PhotographyEntity'].ISO) {
        mappings['PhotographyEntity'].ISO.weight = 0.15;
        mappings['PhotographyEntity'].ISO.required = true;
        console.log(`   ✓ 更新ISO权重: 0.1 → 0.15, required: false → true`);
        modified = true;
      }
      
      console.log('');
    }
    
    // 2. 修复Aperture-Usage
    if (mappings['Aperture-Usage']) {
      console.log('2. 修复Aperture-Usage:');
      
      // 确保Aperture字段不包含FocalLength相关的变体
      if (mappings['Aperture-Usage'].Aperture) {
        const oldVars = mappings['Aperture-Usage'].Aperture.common_variations;
        const newVars = oldVars.filter(v => 
          !v.toLowerCase().includes('focal') && 
          !v.includes('焦距') &&
          !v.includes('焦段')
        );
        
        if (oldVars.length !== newVars.length) {
          mappings['Aperture-Usage'].Aperture.common_variations = newVars;
          console.log(`   ✓ 从Aperture中移除了 ${oldVars.length - newVars.length} 个变体`);
          modified = true;
        } else {
          console.log(`   ✓ Aperture字段正常,无需修改`);
        }
      }
      
      console.log('');
    }
    
    // 3. 确保其他摄影Schema有FocalLength字段
    const photographySchemas = [
      'Shooting-Info',
      'Lens-Recommendation',
      'Prime-Lens',
      'Wide-Angle-Lens',
      'Telephoto-Lens'
    ];
    
    console.log('3. 检查其他摄影Schema的FocalLength字段:');
    photographySchemas.forEach(schemaName => {
      if (mappings[schemaName] && !mappings[schemaName].FocalLength) {
        mappings[schemaName].FocalLength = {
          common_variations: [
            'FocalLength',
            'focallength',
            'focal_length',
            '焦距',
            '镜头焦距',
            '焦段',
            '镜头焦段',
            '等效焦距',
            'focal length',
            'Focal Length',
            '焦距是多少',
            '焦距多少',
            '多少焦距'
          ],
          weight: 0.3,
          required: false,
          description: 'FocalLength字段 - 镜头焦距',
          data_type: 'text',
          domain: 'photography'
        };
        console.log(`   ✓ 为${schemaName}添加了FocalLength字段`);
        modified = true;
      }
    });
    console.log('');
    
    // 保存修改
    if (modified) {
      fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
      console.log('✓ 已保存修改\n');
      
      // 统计
      console.log('================================================================================');
      console.log('📊 修复统计');
      console.log('================================================================================\n');
      
      console.log('PhotographyEntity字段:');
      const pe = mappings['PhotographyEntity'];
      Object.keys(pe).forEach(field => {
        console.log(`  - ${field}: ${pe[field].common_variations.length} 个变体, 权重: ${pe[field].weight}, 必需: ${pe[field].required}`);
      });
      
      console.log('\n✓ 修复完成\n');
    } else {
      console.log('⚠️  没有需要修改的内容\n');
    }
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixMappings();
