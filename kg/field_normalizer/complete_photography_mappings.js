/**
 * 完善PhotographyEntity字段映射
 * 添加ShutterSpeed和LensModel等提取字段的变体
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔧 完善PhotographyEntity字段映射');
console.log('================================================================================\n');

async function completeMappings() {
  try {
    // 读取映射文件
    const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    
    console.log('✓ 已读取映射文件\n');
    
    // 检查PhotographyEntity是否存在
    if (!mappings.PhotographyEntity) {
      console.error('❌ 未找到PhotographyEntity配置');
      process.exit(1);
    }
    
    console.log('📝 当前PhotographyEntity配置:');
    console.log(`   - Camera: ${mappings.PhotographyEntity.Camera.common_variations.length} 个变体`);
    console.log(`   - Lens: ${mappings.PhotographyEntity.Lens.common_variations.length} 个变体`);
    console.log(`   - ISO: ${mappings.PhotographyEntity.ISO.common_variations.length} 个变体`);
    console.log(`   - Aperture: ${mappings.PhotographyEntity.Aperture.common_variations.length} 个变体`);
    console.log(`   - Shutter: ${mappings.PhotographyEntity.Shutter.common_variations.length} 个变体`);
    console.log(`   - FocalLength: ${mappings.PhotographyEntity.FocalLength.common_variations.length} 个变体\n`);
    
    // 1. 为Lens字段添加LensModel变体
    console.log('1. 为Lens字段添加LensModel变体...');
    const lensVariations = mappings.PhotographyEntity.Lens.common_variations;
    const lensModelVariants = [
      'LensModel',
      'lensmodel',
      'lens_model',
      'Lens Model',
      'lens model',
      '镜头型号',
      '镜头模型'
    ];
    
    let lensAdded = 0;
    lensModelVariants.forEach(variant => {
      if (!lensVariations.includes(variant)) {
        lensVariations.push(variant);
        lensAdded++;
      }
    });
    
    console.log(`   ✓ 添加了 ${lensAdded} 个LensModel相关变体`);
    console.log(`   ✓ Lens字段现在有 ${lensVariations.length} 个变体\n`);
    
    // 2. 检查Shutter字段是否已包含ShutterSpeed
    console.log('2. 检查Shutter字段的ShutterSpeed变体...');
    const shutterVariations = mappings.PhotographyEntity.Shutter.common_variations;
    const shutterSpeedVariants = [
      'ShutterSpeed',
      'shutterspeed',
      'shutter_speed',
      'Shutter Speed',
      'shutter speed'
    ];
    
    let shutterAdded = 0;
    shutterSpeedVariants.forEach(variant => {
      if (!shutterVariations.includes(variant)) {
        shutterVariations.push(variant);
        shutterAdded++;
      }
    });
    
    if (shutterAdded > 0) {
      console.log(`   ✓ 添加了 ${shutterAdded} 个ShutterSpeed相关变体`);
    } else {
      console.log(`   ✓ Shutter字段已包含所有ShutterSpeed变体`);
    }
    console.log(`   ✓ Shutter字段现在有 ${shutterVariations.length} 个变体\n`);
    
    // 3. 为Camera字段添加CameraModel变体
    console.log('3. 为Camera字段添加CameraModel变体...');
    const cameraVariations = mappings.PhotographyEntity.Camera.common_variations;
    const cameraModelVariants = [
      'CameraModel',
      'cameramodel',
      'camera_model',
      'Camera Model',
      'camera model',
      '相机型号',
      '相机模型'
    ];
    
    let cameraAdded = 0;
    cameraModelVariants.forEach(variant => {
      if (!cameraVariations.includes(variant)) {
        cameraVariations.push(variant);
        cameraAdded++;
      }
    });
    
    console.log(`   ✓ 添加了 ${cameraAdded} 个CameraModel相关变体`);
    console.log(`   ✓ Camera字段现在有 ${cameraVariations.length} 个变体\n`);
    
    // 4. 为FocalLength字段添加更多变体
    console.log('4. 为FocalLength字段添加更多变体...');
    const focalLengthVariations = mappings.PhotographyEntity.FocalLength.common_variations;
    const focalLengthVariants = [
      'FocalLength',
      'focallength',
      'focal_length',
      'Focal Length',
      'focal length',
      'FOCAL_LENGTH',
      'focalLength'
    ];
    
    let focalLengthAdded = 0;
    focalLengthVariants.forEach(variant => {
      if (!focalLengthVariations.includes(variant)) {
        focalLengthVariations.push(variant);
        focalLengthAdded++;
      }
    });
    
    console.log(`   ✓ 添加了 ${focalLengthAdded} 个FocalLength相关变体`);
    console.log(`   ✓ FocalLength字段现在有 ${focalLengthVariations.length} 个变体\n`);
    
    // 保存更新后的映射
    console.log('💾 保存更新后的映射...');
    fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2), 'utf-8');
    console.log('   ✓ 映射文件已更新\n');
    
    // 总结
    console.log('================================================================================');
    console.log('📊 更新总结');
    console.log('================================================================================\n');
    
    console.log('更新后的PhotographyEntity配置:');
    console.log(`   - Camera: ${mappings.PhotographyEntity.Camera.common_variations.length} 个变体 (+${cameraAdded})`);
    console.log(`   - Lens: ${mappings.PhotographyEntity.Lens.common_variations.length} 个变体 (+${lensAdded})`);
    console.log(`   - ISO: ${mappings.PhotographyEntity.ISO.common_variations.length} 个变体`);
    console.log(`   - Aperture: ${mappings.PhotographyEntity.Aperture.common_variations.length} 个变体`);
    console.log(`   - Shutter: ${mappings.PhotographyEntity.Shutter.common_variations.length} 个变体 (+${shutterAdded})`);
    console.log(`   - FocalLength: ${mappings.PhotographyEntity.FocalLength.common_variations.length} 个变体 (+${focalLengthAdded})\n`);
    
    const totalAdded = cameraAdded + lensAdded + shutterAdded + focalLengthAdded;
    console.log(`✅ 总共添加了 ${totalAdded} 个新变体\n`);
    
    console.log('✓ 完成\n');
    
  } catch (error) {
    console.error('\n❌ 失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

completeMappings();
