/**
 * 扩展摄影Schema的字段映射 - 第二版
 * 
 * 为所有45个摄影Schema添加完整的字段映射
 */

const fs = require('fs');
const path = require('path');

// 读取现有映射
const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

// 新增摄影Schema的字段映射
const newMappings = {
  // 镜头推荐 - 最重要的Schema
  'Lens-Recommendation': {
    'LensName': ['LensModel', '镜头', '产品', 'Lens', 'Product'],
    'FocalLength': ['FocalLength', '焦距', 'Focal Length', 'focal length'],
    'Aperture': ['Aperture', 'F值', 'F 值', '光圈', 'F-stop', 'f-stop'],
    'UseCase': ['UseCase', '用途', '使用场景', 'Use Case', 'Application']
  },
  
  // 相机设置
  'Camera-Settings': {
    'SettingName': ['SettingName', '设置名称', '参数名称', 'Setting', 'Parameter'],
    'Mode': ['Mode', 'ShootingMode', '模式', '拍摄模式', '相机模式'],
    'Parameters': ['Parameters', 'CameraSetting', '参数', '设置值']
  },
  
  // 光圈设置
  'Aperture-Setting': {
    'Value': ['Aperture', 'F值', 'F 值', '光圈', 'F-stop', 'f-stop'],
    'Effect': ['Effect', '效果', '作用'],
    'UseCase': ['UseCase', '用途', '使用场景']
  },
  
  // 快门速度设置
  'Shutter-Speed-Setting': {
    'Speed': ['ShutterSpeed', '快门速度', 'Shutter Speed', 'shutter speed'],
    'Effect': ['Effect', '效果', '作用'],
    'UseCase': ['UseCase', '用途', '使用场景']
  },
  
  // ISO设置
  'ISO-Setting': {
    'Value': ['ISO', '感光度', 'ISO Value'],
    'Effect': ['Effect', '效果', '作用'],
    'UseCase': ['UseCase', '用途', '使用场景']
  },
  
  // 摄影技巧
  'Photography-Technique': {
    'TechniqueName': ['TechniqueName', '技巧名称', '技术名称', 'Technique'],
    'Category': ['Category', '类别', '分类'],
    'Description': ['Description', '描述', '说明']
  },
  
  // 构图规则
  'Composition-Rule': {
    'RuleName': ['RuleName', '规则名称', '构图法则', 'Rule', 'Composition'],
    'Description': ['Description', '描述', '说明'],
    'Example': ['Example', '示例', '例子']
  },
  
  // 光线技巧
  'Lighting-Technique': {
    'LightingName': ['LightingName', '光线名称', '照明方式', 'Lighting'],
    'Type': ['Type', '类型', '种类'],
    'Effect': ['Effect', '效果', '作用']
  },
  
  // 曝光三角
  'Exposure-Triangle': {
    'Setting': ['Setting', 'Aperture', 'ShutterSpeed', 'ISO', '设置', '参数'],
    'Value': ['Value', '值', '数值'],
    'Relationship': ['Relationship', '关系', '相互作用']
  },
  
  // 对焦技巧
  'Focus-Technique': {
    'TechniqueName': ['TechniqueName', '技巧名称', 'Technique'],
    'Method': ['Method', '方法', '方式'],
    'Application': ['Application', '应用', '用途']
  },
  
  // 景深
  'Depth-of-Field': {
    'Setting': ['Setting', 'Aperture', '设置', '光圈'],
    'Effect': ['Effect', '效果', '景深效果'],
    'Control': ['Control', '控制方法', '调节']
  },
  
  // 运动模糊
  'Motion-Blur': {
    'Effect': ['Effect', 'ShutterSpeed', '效果', '快门速度'],
    'Technique': ['Technique', '技巧', '方法'],
    'Application': ['Application', '应用', '用途']
  },
  
  // 长曝光
  'Long-Exposure': {
    'Duration': ['Duration', 'ShutterSpeed', '时长', '曝光时间', '快门速度'],
    'Effect': ['Effect', '效果', '作用'],
    'Equipment': ['Equipment', '设备', '器材']
  },
  
  // HDR摄影
  'HDR-Photography': {
    'Technique': ['Technique', '技巧', '方法'],
    'Bracketing': ['Bracketing', '包围曝光', '曝光补偿'],
    'Processing': ['Processing', '后期处理', '处理方法']
  },
  
  // 全景拍摄
  'Panorama-Shooting': {
    'Method': ['Method', '方法', '拍摄方式'],
    'Equipment': ['Equipment', '设备', '器材'],
    'Stitching': ['Stitching', '拼接', '合成']
  },
  
  // 白平衡设置
  'White-Balance-Setting': {
    'Mode': ['Mode', 'CameraSetting', '模式', '白平衡'],
    'Temperature': ['Temperature', '色温', '温度'],
    'Effect': ['Effect', '效果', '作用']
  },
  
  // 对焦模式设置
  'Focus-Mode-Setting': {
    'Mode': ['Mode', 'CameraSetting', '模式', '对焦模式'],
    'Application': ['Application', '应用', '用途'],
    'Performance': ['Performance', '性能', '表现']
  },
  
  // 驱动模式设置
  'Drive-Mode-Setting': {
    'Mode': ['Mode', 'CameraSetting', '模式', '驱动模式'],
    'Speed': ['Speed', '速度', '连拍速度'],
    'UseCase': ['UseCase', '用途', '使用场景']
  },
  
  // 照片风格
  'Picture-Style': {
    'StyleName': ['StyleName', '风格名称', 'Style'],
    'Characteristics': ['Characteristics', '特点', '特征'],
    'Application': ['Application', '应用', '用途']
  },
  
  // 自定义功能
  'Custom-Function': {
    'FunctionName': ['FunctionName', '功能名称', 'Function'],
    'Setting': ['Setting', '设置', '配置'],
    'Purpose': ['Purpose', '目的', '用途']
  },
  
  // 定焦镜头
  'Prime-Lens': {
    'LensName': ['LensModel', 'LensName', '镜头', 'Lens'],
    'FocalLength': ['FocalLength', '焦距'],
    'MaxAperture': ['Aperture', 'MaxAperture', '最大光圈', 'F值']
  },
  
  // 变焦镜头
  'Zoom-Lens': {
    'LensName': ['LensModel', 'LensName', '镜头', 'Lens'],
    'FocalRange': ['FocalLength', 'FocalRange', '焦距范围', '焦距'],
    'MaxAperture': ['Aperture', 'MaxAperture', '最大光圈', 'F值']
  },
  
  // 广角镜头
  'Wide-Angle-Lens': {
    'LensName': ['LensModel', 'LensName', '镜头', 'Lens'],
    'FocalLength': ['FocalLength', '焦距'],
    'Application': ['UseCase', 'Application', '用途', '应用']
  },
  
  // 长焦镜头
  'Telephoto-Lens': {
    'LensName': ['LensModel', 'LensName', '镜头', 'Lens'],
    'FocalLength': ['FocalLength', '焦距'],
    'Application': ['UseCase', 'Application', '用途', '应用']
  },
  
  // 微距镜头
  'Macro-Lens': {
    'LensName': ['LensModel', 'LensName', '镜头', 'Lens'],
    'Magnification': ['Magnification', '放大倍率', '倍率'],
    'MinFocusDistance': ['MinFocusDistance', '最近对焦距离', '对焦距离']
  },
  
  // 滤镜使用
  'Filter-Usage': {
    'FilterType': ['FilterType', '滤镜类型', 'Filter'],
    'Effect': ['Effect', '效果', '作用'],
    'Application': ['Application', '应用', '用途']
  },
  
  // 三脚架选择
  'Tripod-Selection': {
    'TripodType': ['TripodType', '三脚架类型', 'Tripod'],
    'LoadCapacity': ['LoadCapacity', '承重', '负载'],
    'Application': ['Application', '应用', '用途']
  },
  
  // 闪光灯设备
  'Flash-Equipment': {
    'EquipmentName': ['EquipmentName', '设备名称', 'Equipment'],
    'Power': ['Power', '功率', '输出'],
    'Mode': ['Mode', '模式', '闪光模式']
  },
  
  // 人像摄影
  'Portrait-Photography': {
    'Subject': ['Subject', '主体', '拍摄对象'],
    'Technique': ['Technique', '技巧', '方法'],
    'Lighting': ['Lighting', '光线', '照明']
  },
  
  // 风景摄影
  'Landscape-Photography': {
    'Location': ['Location', '地点', '位置'],
    'Composition': ['Composition', '构图', '构图方式'],
    'Lighting': ['Lighting', '光线', '照明']
  },
  
  // 野生动物摄影
  'Wildlife-Photography': {
    'Subject': ['Subject', '主体', '拍摄对象'],
    'Equipment': ['Equipment', 'LensModel', '设备', '器材'],
    'Technique': ['Technique', '技巧', '方法']
  },
  
  // 微距摄影
  'Macro-Photography': {
    'Subject': ['Subject', '主体', '拍摄对象'],
    'Magnification': ['Magnification', '放大倍率', '倍率'],
    'Lighting': ['Lighting', '光线', '照明']
  },
  
  // 夜景摄影
  'Night-Photography': {
    'Scene': ['Scene', '场景', '拍摄场景'],
    'Exposure': ['Exposure', 'ShutterSpeed', '曝光', '快门速度'],
    'Equipment': ['Equipment', '设备', '器材']
  },
  
  // 运动摄影
  'Sports-Photography': {
    'Sport': ['Sport', '运动', '项目'],
    'ShutterSpeed': ['ShutterSpeed', '快门速度'],
    'Technique': ['Technique', '技巧', '方法']
  },
  
  // 活动摄影
  'Event-Photography': {
    'EventType': ['EventType', '活动类型', 'Event'],
    'Coverage': ['Coverage', '覆盖范围', '拍摄内容'],
    'Equipment': ['Equipment', '设备', '器材']
  },
  
  // 产品摄影
  'Product-Photography': {
    'ProductType': ['ProductType', '产品类型', 'Product'],
    'Lighting': ['Lighting', '光线', '照明'],
    'Background': ['Background', '背景', '背景设置']
  },
  
  // 美食摄影
  'Food-Photography': {
    'Dish': ['Dish', '菜品', '食物'],
    'Styling': ['Styling', '摆盘', '造型'],
    'Lighting': ['Lighting', '光线', '照明']
  },
  
  // 后期处理工作流
  'Post-Processing-Workflow': {
    'WorkflowName': ['WorkflowName', '工作流名称', 'Workflow'],
    'Steps': ['Steps', '步骤', '流程'],
    'Software': ['Software', '软件', '工具']
  },
  
  // 曝光调整
  'Exposure-Adjustment': {
    'AdjustmentType': ['AdjustmentType', '调整类型', 'Adjustment'],
    'Amount': ['Amount', '调整量', '数值'],
    'Effect': ['Effect', '效果', '作用']
  },
  
  // 对比度增强
  'Contrast-Enhancement': {
    'Method': ['Method', '方法', '方式'],
    'Amount': ['Amount', '调整量', '数值'],
    'Effect': ['Effect', '效果', '作用']
  },
  
  // 锐化技巧
  'Sharpening-Technique': {
    'Technique': ['Technique', '技巧', '方法'],
    'Amount': ['Amount', '调整量', '数值'],
    'Radius': ['Radius', '半径', '范围']
  },
  
  // 裁剪技巧
  'Cropping-Technique': {
    'Ratio': ['Ratio', '比例', '裁剪比例'],
    'Composition': ['Composition', '构图', '构图方式'],
    'Purpose': ['Purpose', '目的', '用途']
  },
  
  // 图层蒙版
  'Layer-Masking': {
    'MaskType': ['MaskType', '蒙版类型', 'Mask'],
    'Application': ['Application', '应用', '用途'],
    'Technique': ['Technique', '技巧', '方法']
  },
  
  // 预设应用
  'Preset-Application': {
    'PresetName': ['PresetName', '预设名称', 'Preset'],
    'Effect': ['Effect', '效果', '作用'],
    'Adjustment': ['Adjustment', '调整', '修改']
  },
  
  // 导出设置
  'Export-Settings': {
    'Format': ['Format', '格式', '文件格式'],
    'Quality': ['Quality', '质量', '品质'],
    'Resolution': ['Resolution', '分辨率', '尺寸']
  }
};

// 合并映射
Object.assign(mappings, newMappings);

// 保存更新后的映射
fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2), 'utf8');

console.log('✅ 摄影Schema字段映射已更新！');
console.log(`📊 新增 ${Object.keys(newMappings).length} 个Schema的映射`);
console.log(`📊 总计 ${Object.keys(mappings).length} 个Schema有字段映射`);
