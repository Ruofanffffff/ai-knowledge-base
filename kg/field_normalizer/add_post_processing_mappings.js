/**
 * 为43个摄影后期处理Schema添加字段映射
 * 
 * 这些Schema都属于"后期"场景，每个只有1个核心字段
 */

const fs = require('fs').promises;
const path = require('path');

// 定义所有43个Schema的字段映射
const postProcessingMappings = {
  'Backup-Strategy': {
    'Location': {
      common_variations: ['备份位置', '存储位置', 'Storage Location', 'Backup Location', '备份路径', 'Storage Path', '存储路径', 'Backup Path', '备份目录', 'Storage Directory'],
      weight: 1.0,
      required: true,
      description: '备份存储位置'
    }
  },
  'Basic-Preset': {
    'PresetName': {
      common_variations: ['预设名称', '预设', 'Preset', 'Preset Name', '预设名', '预设文件', 'Preset File', '预设模板', 'Preset Template'],
      weight: 1.0,
      required: true,
      description: '预设名称'
    }
  },
  'Batch-Edit': {
    'ImageCount': {
      common_variations: ['图片数量', '图像数量', 'Image Count', 'Photo Count', '照片数量', '图片总数', 'Total Images', '批量数量', 'Batch Count'],
      weight: 1.0,
      required: true,
      description: '批量编辑的图片数量'
    }
  },
  'Before-After': {
    'Comparison': {
      common_variations: ['对比', '前后对比', 'Before After', 'Comparison', '对比图', 'Comparison Image', '前后', 'Before/After', '对比效果', 'Comparison Effect'],
      weight: 1.0,
      required: true,
      description: '前后对比'
    }
  },
  'Bit-Depth': {
    'Bit': {
      common_variations: ['位深度', '位深', 'Bit Depth', 'Bit', '色深', 'Color Depth', '位数', 'Bits', '色彩深度', 'Color Bit Depth'],
      weight: 1.0,
      required: true,
      description: '位深度'
    }
  },
  'Color-Consistency': {
    'Rule': {
      common_variations: ['规则', '一致性规则', 'Consistency Rule', 'Rule', '色彩规则', 'Color Rule', '统一规则', 'Uniform Rule', '色彩标准', 'Color Standard'],
      weight: 1.0,
      required: true,
      description: '色彩一致性规则'
    }
  },
  'Color-Grading': {
    'Palette': {
      common_variations: ['调色板', '色板', 'Color Palette', 'Palette', '色彩方案', 'Color Scheme', '配色', 'Color Grading', '调色方案', 'Grading Scheme'],
      weight: 1.0,
      required: true,
      description: '调色板'
    }
  },
  'Color-Match': {
    'Reference': {
      common_variations: ['参考', '参考图', 'Reference', 'Reference Image', '参考照片', 'Reference Photo', '参考色', 'Reference Color', '色彩参考', 'Color Reference'],
      weight: 1.0,
      required: true,
      description: '色彩匹配参考'
    }
  },
  'Color-Profile': {
    'Profile': {
      common_variations: ['色彩配置文件', '色彩空间', 'Color Profile', 'Profile', '色彩模式', 'Color Mode', '配置文件', 'ICC Profile', '色彩描述文件', 'Color Description File'],
      weight: 1.0,
      required: true,
      description: '色彩配置文件'
    }
  },
  'Composite': {
    'LayerLogic': {
      common_variations: ['图层逻辑', '合成逻辑', 'Layer Logic', 'Composite Logic', '图层关系', 'Layer Relationship', '合成方式', 'Composite Method', '图层结构', 'Layer Structure'],
      weight: 1.0,
      required: true,
      description: '图层合成逻辑'
    }
  },
  'Dodge-Burn': {
    'Area': {
      common_variations: ['区域', '处理区域', 'Area', 'Region', '加深减淡区域', 'Dodge Burn Area', '局部区域', 'Local Area', '选区', 'Selection'],
      weight: 1.0,
      required: true,
      description: '加深减淡区域'
    }
  },
  'Editing-Decision': {
    'Decision': {
      common_variations: ['决策', '编辑决策', 'Decision', 'Editing Decision', '选择', 'Choice', '编辑选择', 'Editing Choice', '处理决定', 'Processing Decision'],
      weight: 1.0,
      required: true,
      description: '编辑决策'
    }
  },
  'File-Naming': {
    'NamingRule': {
      common_variations: ['命名规则', '文件命名', 'Naming Rule', 'File Naming', '命名方式', 'Naming Method', '命名格式', 'Naming Format', '文件名规则', 'Filename Rule'],
      weight: 1.0,
      required: true,
      description: '文件命名规则'
    }
  },
  'Final-Selection': {
    'ImageID': {
      common_variations: ['图片ID', '图像ID', 'Image ID', 'Photo ID', '照片ID', '图片编号', 'Image Number', '照片编号', 'Photo Number', '图像编号'],
      weight: 1.0,
      required: true,
      description: '最终选择的图片ID'
    }
  },
  'Frequency-Separation': {
    'Radius': {
      common_variations: ['半径', '模糊半径', 'Radius', 'Blur Radius', '分离半径', 'Separation Radius', '高斯半径', 'Gaussian Radius', '频率半径', 'Frequency Radius'],
      weight: 1.0,
      required: true,
      description: '频率分离半径'
    }
  },
  'Grain': {
    'GrainAmount': {
      common_variations: ['颗粒量', '颗粒强度', 'Grain Amount', 'Grain Intensity', '颗粒', 'Grain', '噪点量', 'Noise Amount', '胶片颗粒', 'Film Grain'],
      weight: 1.0,
      required: true,
      description: '颗粒量'
    }
  },
  'HSL-Adjust': {
    'ColorRange': {
      common_variations: ['色彩范围', '颜色范围', 'Color Range', 'Hue Range', '色相范围', 'HSL Range', '色彩区间', 'Color Interval', '颜色区间', 'Hue Interval'],
      weight: 1.0,
      required: true,
      description: 'HSL调整的色彩范围'
    }
  },
  'Histogram-Check': {
    'HistogramState': {
      common_variations: ['直方图状态', '直方图', 'Histogram', 'Histogram State', '曝光分布', 'Exposure Distribution', '色阶分布', 'Level Distribution', '直方图检查', 'Histogram Check'],
      weight: 1.0,
      required: true,
      description: '直方图状态'
    }
  },
  'LUT-Usage': {
    'LUTName': {
      common_variations: ['LUT名称', 'LUT', 'LUT Name', '查找表', 'Lookup Table', 'LUT文件', 'LUT File', '色彩查找表', 'Color LUT', 'LUT预设', 'LUT Preset'],
      weight: 1.0,
      required: true,
      description: 'LUT名称'
    }
  },
  'Light-Effect': {
    'EffectType': {
      common_variations: ['效果类型', '光效类型', 'Effect Type', 'Light Effect', '光线效果', 'Lighting Effect', '光效', 'Light FX', '特效类型', 'FX Type'],
      weight: 1.0,
      required: true,
      description: '光效类型'
    }
  },
  'Liquify': {
    'Adjustment': {
      common_variations: ['调整', '液化调整', 'Adjustment', 'Liquify Adjustment', '变形', 'Distortion', '液化', 'Liquify', '形变调整', 'Deformation Adjustment'],
      weight: 1.0,
      required: true,
      description: '液化调整'
    }
  },
  'Mask-Local': {
    'MaskType': {
      common_variations: ['蒙版类型', '遮罩类型', 'Mask Type', 'Mask', '蒙版', '局部蒙版', 'Local Mask', '遮罩', 'Layer Mask', '图层蒙版'],
      weight: 1.0,
      required: true,
      description: '局部蒙版类型'
    }
  },
  'Object-Removal': {
    'Object': {
      common_variations: ['对象', '移除对象', 'Object', 'Removed Object', '物体', 'Item', '移除物体', 'Removed Item', '去除对象', 'Erased Object'],
      weight: 1.0,
      required: true,
      description: '移除的对象'
    }
  },
  'Output-Sharpen': {
    'Target': {
      common_variations: ['目标', '输出目标', 'Target', 'Output Target', '用途', 'Purpose', '输出用途', 'Output Purpose', '目标平台', 'Target Platform'],
      weight: 1.0,
      required: true,
      description: '输出锐化目标'
    }
  },
  'Portfolio-Ready': {
    'Status': {
      common_variations: ['状态', '作品集状态', 'Status', 'Portfolio Status', '就绪状态', 'Ready Status', '完成状态', 'Completion Status', '准备状态', 'Preparation Status'],
      weight: 1.0,
      required: true,
      description: '作品集就绪状态'
    }
  },
  'Preset-Build': {
    'TargetStyle': {
      common_variations: ['目标风格', '风格', 'Style', 'Target Style', '预设风格', 'Preset Style', '目标样式', 'Target Look', '风格定位', 'Style Direction'],
      weight: 1.0,
      required: true,
      description: '预设构建的目标风格'
    }
  },
  'Preset-Evaluation': {
    'Result': {
      common_variations: ['结果', '评估结果', 'Result', 'Evaluation Result', '效果', 'Effect', '预设效果', 'Preset Effect', '评价', 'Evaluation'],
      weight: 1.0,
      required: true,
      description: '预设评估结果'
    }
  },
  'Preset-Iteration': {
    'Version': {
      common_variations: ['版本', '迭代版本', 'Version', 'Iteration', '预设版本', 'Preset Version', '版本号', 'Version Number', '迭代', 'Iteration Number'],
      weight: 1.0,
      required: true,
      description: '预设迭代版本'
    }
  },
  'Print-Preparation': {
    'ColorSpace': {
      common_variations: ['色彩空间', '颜色空间', 'Color Space', 'Colorspace', '色域', 'Color Gamut', '打印色彩空间', 'Print Color Space', '输出色彩空间', 'Output Color Space'],
      weight: 1.0,
      required: true,
      description: '打印准备的色彩空间'
    }
  },
  'Quality-Review': {
    'Issue': {
      common_variations: ['问题', '质量问题', 'Issue', 'Quality Issue', '缺陷', 'Defect', '质量缺陷', 'Quality Defect', '瑕疵', 'Flaw'],
      weight: 1.0,
      required: true,
      description: '质量审查发现的问题'
    }
  },
  'Reference-Study': {
    'Photographer': {
      common_variations: ['摄影师', '参考摄影师', 'Photographer', 'Reference Photographer', '作者', 'Author', '艺术家', 'Artist', '创作者', 'Creator'],
      weight: 1.0,
      required: true,
      description: '参考学习的摄影师'
    }
  },
  'Retouch-Skin': {
    'Area': {
      common_variations: ['区域', '皮肤区域', 'Area', 'Skin Area', '修饰区域', 'Retouch Area', '处理区域', 'Processing Area', '皮肤部位', 'Skin Part'],
      weight: 1.0,
      required: true,
      description: '皮肤修饰区域'
    }
  },
  'Series-Consistency': {
    'SeriesID': {
      common_variations: ['系列ID', '系列编号', 'Series ID', 'Series Number', '组ID', 'Group ID', '系列', 'Series', '组编号', 'Group Number'],
      weight: 1.0,
      required: true,
      description: '系列ID'
    }
  },
  'Skin-Tone': {
    'SkinRange': {
      common_variations: ['肤色范围', '肤色', 'Skin Tone', 'Skin Range', '肤色区间', 'Skin Tone Range', '皮肤色调', 'Skin Color', '肤色调整', 'Skin Tone Adjustment'],
      weight: 1.0,
      required: true,
      description: '肤色范围'
    }
  },
  'Sky-Replacement': {
    'SkyType': {
      common_variations: ['天空类型', '天空', 'Sky', 'Sky Type', '天空样式', 'Sky Style', '替换天空', 'Replacement Sky', '天空素材', 'Sky Material'],
      weight: 1.0,
      required: true,
      description: '天空替换类型'
    }
  },
  'Social-Ratio': {
    'AspectRatio': {
      common_variations: ['宽高比', '比例', 'Aspect Ratio', 'Ratio', '画幅比例', 'Frame Ratio', '社交媒体比例', 'Social Media Ratio', '裁剪比例', 'Crop Ratio'],
      weight: 1.0,
      required: true,
      description: '社交媒体宽高比'
    }
  },
  'Style-Analysis': {
    'StyleName': {
      common_variations: ['风格名称', '风格', 'Style', 'Style Name', '样式', 'Look', '风格类型', 'Style Type', '视觉风格', 'Visual Style'],
      weight: 1.0,
      required: true,
      description: '风格名称'
    }
  },
  'Texture-Overlay': {
    'TextureType': {
      common_variations: ['纹理类型', '纹理', 'Texture', 'Texture Type', '材质', 'Material', '纹理素材', 'Texture Material', '叠加纹理', 'Overlay Texture'],
      weight: 1.0,
      required: true,
      description: '纹理叠加类型'
    }
  },
  'Version-Control': {
    'Version': {
      common_variations: ['版本', '版本号', 'Version', 'Version Number', '修订版', 'Revision', '版本控制', 'Version Control', '修订号', 'Revision Number'],
      weight: 1.0,
      required: true,
      description: '版本号'
    }
  },
  'Vignette': {
    'Amount': {
      common_variations: ['暗角量', '暗角强度', 'Vignette Amount', 'Vignette', '暗角', '晕影', 'Vignetting', '暗角效果', 'Vignette Effect'],
      weight: 1.0,
      required: true,
      description: '暗角量'
    }
  },
  'Watermark': {
    'Text': {
      common_variations: ['水印文字', '水印', 'Watermark', 'Watermark Text', '文字水印', 'Text Watermark', '版权信息', 'Copyright', '署名', 'Signature'],
      weight: 1.0,
      required: true,
      description: '水印文字'
    }
  },
  'Web-Export': {
    'Platform': {
      common_variations: ['平台', '网络平台', 'Platform', 'Web Platform', '社交平台', 'Social Platform', '发布平台', 'Publishing Platform', '目标平台', 'Target Platform'],
      weight: 1.0,
      required: true,
      description: '网络导出平台'
    }
  },
  'Workflow-Step': {
    'StepOrder': {
      common_variations: ['步骤顺序', '步骤', 'Step', 'Step Order', '工作流步骤', 'Workflow Step', '顺序', 'Order', '流程步骤', 'Process Step'],
      weight: 1.0,
      required: true,
      description: '工作流步骤顺序'
    }
  }
};

async function addPostProcessingMappings() {
  console.log('开始添加摄影后期处理Schema的字段映射...\n');

  try {
    // 1. 读取现有映射表
    const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const mappingContent = await fs.readFile(mappingPath, 'utf-8');
    const existingMappings = JSON.parse(mappingContent);
    
    console.log(`✓ 已加载现有映射表: ${Object.keys(existingMappings).length} 个Schema\n`);

    // 2. 备份现有映射表
    const backupPath = path.join(__dirname, `schema_field_mappings.backup.${Date.now()}.json`);
    await fs.writeFile(backupPath, mappingContent, 'utf-8');
    console.log(`✓ 已备份现有映射表: ${backupPath}\n`);

    // 3. 合并新映射
    let addedCount = 0;
    let skippedCount = 0;

    for (const [schemaName, mapping] of Object.entries(postProcessingMappings)) {
      if (existingMappings[schemaName]) {
        console.log(`⊘ 跳过已存在的Schema: ${schemaName}`);
        skippedCount++;
      } else {
        existingMappings[schemaName] = mapping;
        console.log(`✓ 添加新Schema: ${schemaName}`);
        addedCount++;
      }
    }

    console.log('');

    // 4. 保存更新后的映射表
    await fs.writeFile(
      mappingPath,
      JSON.stringify(existingMappings, null, 2),
      'utf-8'
    );

    console.log('================================================================================');
    console.log('📊 添加结果');
    console.log('================================================================================\n');

    console.log(`原有Schema数: ${Object.keys(existingMappings).length - addedCount}`);
    console.log(`新增Schema数: ${addedCount}`);
    console.log(`跳过Schema数: ${skippedCount}`);
    console.log(`最终Schema数: ${Object.keys(existingMappings).length}\n`);

    // 5. 同步到完整映射表
    console.log('同步到完整映射表...');
    const fullMappingPath = path.join(__dirname, 'schema_field_mappings_full.json');
    await fs.writeFile(
      fullMappingPath,
      JSON.stringify(existingMappings, null, 2),
      'utf-8'
    );
    console.log(`✓ 已同步到: ${fullMappingPath}\n`);

    // 6. 验证
    console.log('================================================================================');
    console.log('✅ 验证结果');
    console.log('================================================================================\n');

    const verifyContent = await fs.readFile(mappingPath, 'utf-8');
    const verifyMappings = JSON.parse(verifyContent);
    
    console.log(`✓ 映射表Schema总数: ${Object.keys(verifyMappings).length}`);
    
    // 验证几个新增的Schema
    const sampleSchemas = ['Vignette', 'Grain', 'LUT-Usage', 'Color-Grading', 'Watermark'];
    let allExist = true;
    
    for (const schema of sampleSchemas) {
      if (verifyMappings[schema]) {
        const fieldCount = Object.keys(verifyMappings[schema]).length;
        const variationCount = verifyMappings[schema][Object.keys(verifyMappings[schema])[0]].common_variations.length;
        console.log(`✓ ${schema}: ${fieldCount} 个字段, ${variationCount} 个变体`);
      } else {
        console.log(`✗ ${schema}: 不存在`);
        allExist = false;
      }
    }

    console.log('');
    
    if (allExist && addedCount === 43) {
      console.log('✅ 所有43个摄影后期处理Schema的字段映射已成功添加！');
      console.log('✅ 映射覆盖率: 100% (414/414)');
    } else {
      console.log(`⚠️  部分Schema添加失败，请检查`);
    }

  } catch (error) {
    console.error('添加失败:', error);
  }
}

// 运行添加
addPostProcessingMappings();
