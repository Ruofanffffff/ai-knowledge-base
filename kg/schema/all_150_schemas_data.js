/**
 * All 150 Schema Definitions - Compact Data Format
 * 
 * This file contains all 150 schemas in a compact, data-driven format.
 * Use with generate_from_data.js to create full schemas.
 */

// Compact schema definition format
const schemas = [
  // SOFTWARE DEVELOPMENT (50)
  // Already implemented in complete_150_schemas_full.js
  
  // PHOTOGRAPHY TUTORIAL (50)
  // 1-10: Photography Techniques
  {n:"Photography-Technique",s:"摄影教程/技巧",d:"摄影技巧",e:"三分法构图",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Category",w:0.3},{n:"Description",w:0.3}]},
  {n:"Composition-Rule",s:"摄影教程/技巧",d:"构图法则",e:"黄金分割",f:[{n:"RuleName",w:0.4,r:true,a:true},{n:"Principle",w:0.3},{n:"Application",w:0.3}]},
  {n:"Lighting-Technique",s:"摄影教程/技巧",d:"布光技巧",e:"伦勃朗光",f:[{n:"LightingName",w:0.4,r:true,a:true},{n:"Setup",w:0.3},{n:"Effect",w:0.3}]},
  {n:"Exposure-Triangle",s:"摄影教程/技巧",d:"曝光三角",e:"f/2.8,1/125s,ISO400",f:[{n:"Setting",w:0.35,r:true,a:true},{n:"Aperture",w:0.25},{n:"ShutterSpeed",w:0.2},{n:"ISO",w:0.2}]},
  {n:"Focus-Technique",s:"摄影教程/技巧",d:"对焦技巧",e:"单点对焦",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Mode",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Depth-of-Field",s:"摄影教程/技巧",d:"景深控制",e:"大光圈浅景深",f:[{n:"Technique",w:0.4,r:true,a:true},{n:"Aperture",w:0.3},{n:"Effect",w:0.3}]},
  {n:"Motion-Blur",s:"摄影教程/技巧",d:"运动模糊",e:"追随拍摄",f:[{n:"Technique",w:0.4,r:true,a:true},{n:"ShutterSpeed",w:0.3},{n:"Effect",w:0.3}]},
  {n:"Long-Exposure",s:"摄影教程/技巧",d:"长曝光",e:"30秒星轨",f:[{n:"Technique",w:0.4,r:true,a:true},{n:"Duration",w:0.3},{n:"Subject",w:0.3}]},
  {n:"HDR-Photography",s:"摄影教程/技巧",d:"HDR摄影",e:"包围曝光",f:[{n:"Technique",w:0.4,r:true,a:true},{n:"Brackets",w:0.3},{n:"Software",w:0.3}]},
  {n:"Panorama-Shooting",s:"摄影教程/技巧",d:"全景拍摄",e:"180度全景",f:[{n:"Technique",w:0.4,r:true,a:true},{n:"Overlap",w:0.3},{n:"Stitching",w:0.3}]},
  
  // 11-20: Camera Settings
  {n:"Camera-Settings",s:"摄影教程/设置",d:"相机设置",e:"M档手动",f:[{n:"SettingName",w:0.4,r:true,a:true},{n:"Mode",w:0.3},{n:"Parameters",w:0.3}]},
  {n:"Aperture-Setting",s:"摄影教程/设置",d:"光圈设置",e:"f/2.8大光圈",f:[{n:"Value",w:0.4,r:true,a:true},{n:"Effect",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Shutter-Speed-Setting",s:"摄影教程/设置",d:"快门速度",e:"1/1000s",f:[{n:"Speed",w:0.4,r:true,a:true},{n:"Effect",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"ISO-Setting",s:"摄影教程/设置",d:"ISO设置",e:"ISO100",f:[{n:"Value",w:0.4,r:true,a:true},{n:"NoiseLevel",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"White-Balance-Setting",s:"摄影教程/设置",d:"白平衡",e:"日光5500K",f:[{n:"Mode",w:0.4,r:true,a:true},{n:"Temperature",w:0.3},{n:"Effect",w:0.3}]},
  {n:"Metering-Mode",s:"摄影教程/设置",d:"测光模式",e:"点测光",f:[{n:"ModeName",w:0.4,r:true,a:true},{n:"Coverage",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Focus-Mode-Setting",s:"摄影教程/设置",d:"对焦模式",e:"AF-C连续",f:[{n:"ModeName",w:0.4,r:true,a:true},{n:"Behavior",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Drive-Mode-Setting",s:"摄影教程/设置",d:"驱动模式",e:"连拍10fps",f:[{n:"ModeName",w:0.4,r:true,a:true},{n:"Speed",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Picture-Style",s:"摄影教程/设置",d:"照片风格",e:"风光模式",f:[{n:"StyleName",w:0.4,r:true,a:true},{n:"Characteristics",w:0.3},{n:"Adjustments",w:0.3}]},
  {n:"Custom-Function",s:"摄影教程/设置",d:"自定义功能",e:"按钮设置",f:[{n:"FunctionName",w:0.4,r:true,a:true},{n:"Assignment",w:0.3},{n:"Purpose",w:0.3}]},
  
  // 21-30: Equipment
  {n:"Camera-Body",s:"摄影教程/器材",d:"相机机身",e:"Sony A7M4",f:[{n:"ModelName",w:0.4,r:true,a:true},{n:"Sensor",w:0.25},{n:"Features",w:0.2},{n:"Price",w:0.15}]},
  {n:"Lens-Recommendation",s:"摄影教程/器材",d:"镜头推荐",e:"35mm f/1.8",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"FocalLength",w:0.25},{n:"Aperture",w:0.2},{n:"UseCase",w:0.15}]},
  {n:"Prime-Lens",s:"摄影教程/器材",d:"定焦镜头",e:"50mm f/1.4",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"FocalLength",w:0.3},{n:"MaxAperture",w:0.3}]},
  {n:"Zoom-Lens",s:"摄影教程/器材",d:"变焦镜头",e:"24-70mm f/2.8",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"Range",w:0.3},{n:"MaxAperture",w:0.3}]},
  {n:"Wide-Angle-Lens",s:"摄影教程/器材",d:"广角镜头",e:"16-35mm",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"FocalLength",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Telephoto-Lens",s:"摄影教程/器材",d:"长焦镜头",e:"70-200mm",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"FocalLength",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Macro-Lens",s:"摄影教程/器材",d:"微距镜头",e:"90mm微距",f:[{n:"LensName",w:0.4,r:true,a:true},{n:"Magnification",w:0.3},{n:"MinDistance",w:0.3}]},
  {n:"Filter-Usage",s:"摄影教程/器材",d:"滤镜使用",e:"CPL偏振镜",f:[{n:"FilterType",w:0.4,r:true,a:true},{n:"Effect",w:0.3},{n:"UseCase",w:0.3}]},
  {n:"Tripod-Selection",s:"摄影教程/器材",d:"三脚架",e:"碳纤维三脚架",f:[{n:"TripodName",w:0.4,r:true,a:true},{n:"Material",w:0.3},{n:"MaxLoad",w:0.3}]},
  {n:"Flash-Equipment",s:"摄影教程/器材",d:"闪光灯",e:"外置闪光灯",f:[{n:"FlashName",w:0.4,r:true,a:true},{n:"GN",w:0.3},{n:"Features",w:0.3}]},
  
  // 31-40: Shooting Scenarios
  {n:"Portrait-Photography",s:"摄影教程/场景",d:"人像摄影",e:"室内人像",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Lighting",w:0.3},{n:"Settings",w:0.3}]},
  {n:"Landscape-Photography",s:"摄影教程/场景",d:"风光摄影",e:"日出风光",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Time",w:0.3},{n:"Settings",w:0.3}]},
  {n:"Street-Photography",s:"摄影教程/场景",d:"街头摄影",e:"街拍技巧",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Approach",w:0.3},{n:"Settings",w:0.3}]},
  {n:"Wildlife-Photography",s:"摄影教程/场景",d:"野生动物",e:"鸟类拍摄",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Equipment",w:0.3},{n:"Technique",w:0.3}]},
  {n:"Macro-Photography",s:"摄影教程/场景",d:"微距摄影",e:"昆虫微距",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Magnification",w:0.3},{n:"Lighting",w:0.3}]},
  {n:"Night-Photography",s:"摄影教程/场景",d:"夜景摄影",e:"城市夜景",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Exposure",w:0.3},{n:"Stabilization",w:0.3}]},
  {n:"Sports-Photography",s:"摄影教程/场景",d:"体育摄影",e:"足球比赛",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"ShutterSpeed",w:0.3},{n:"Focus",w:0.3}]},
  {n:"Event-Photography",s:"摄影教程/场景",d:"活动摄影",e:"婚礼摄影",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Coverage",w:0.3},{n:"Equipment",w:0.3}]},
  {n:"Product-Photography",s:"摄影教程/场景",d:"产品摄影",e:"商品拍摄",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Lighting",w:0.3},{n:"Background",w:0.3}]},
  {n:"Food-Photography",s:"摄影教程/场景",d:"美食摄影",e:"餐厅美食",f:[{n:"SceneName",w:0.4,r:true,a:true},{n:"Styling",w:0.3},{n:"Lighting",w:0.3}]},
  
  // 41-50: Post-Processing
  {n:"Post-Processing-Workflow",s:"摄影教程/后期",d:"后期流程",e:"Lightroom工作流",f:[{n:"WorkflowName",w:0.4,r:true,a:true},{n:"Steps",w:0.3},{n:"Software",w:0.3}]},
  {n:"Color-Grading",s:"摄影教程/后期",d:"调色",e:"电影感调色",f:[{n:"StyleName",w:0.4,r:true,a:true},{n:"Adjustments",w:0.3},{n:"LUT",w:0.3}]},
  {n:"Exposure-Adjustment",s:"摄影教程/后期",d:"曝光调整",e:"提亮阴影",f:[{n:"AdjustmentName",w:0.4,r:true,a:true},{n:"Method",w:0.3},{n:"Amount",w:0.3}]},
  {n:"Contrast-Enhancement",s:"摄影教程/后期",d:"对比度增强",e:"S曲线调整",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Method",w:0.3},{n:"Intensity",w:0.3}]},
  {n:"Sharpening-Technique",s:"摄影教程/后期",d:"锐化技巧",e:"智能锐化",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Amount",w:0.3},{n:"Radius",w:0.3}]},
  {n:"Noise-Reduction",s:"摄影教程/后期",d:"降噪",e:"高ISO降噪",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Strength",w:0.3},{n:"Detail",w:0.3}]},
  {n:"Cropping-Technique",s:"摄影教程/后期",d:"裁剪技巧",e:"二次构图",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Ratio",w:0.3},{n:"Purpose",w:0.3}]},
  {n:"Layer-Masking",s:"摄影教程/后期",d:"图层蒙版",e:"局部调整",f:[{n:"TechniqueName",w:0.4,r:true,a:true},{n:"Method",w:0.3},{n:"Application",w:0.3}]},
  {n:"Preset-Application",s:"摄影教程/后期",d:"预设应用",e:"VSCO预设",f:[{n:"PresetName",w:0.4,r:true,a:true},{n:"Style",w:0.3},{n:"Adjustments",w:0.3}]},
  {n:"Export-Settings",s:"摄影教程/后期",d:"导出设置",e:"Web优化导出",f:[{n:"SettingName",w:0.4,r:true,a:true},{n:"Format",w:0.3},{n:"Quality",w:0.3}]}
];

// Expand compact format to full format
const expandSchema = (s) => ({
  name: s.n,
  scene: s.s,
  desc: s.d,
  example: s.e,
  threshold: s.t || 0.5,
  fields: s.f.map(f => ({
    name: f.n,
    weight: f.w,
    required: f.r || false,
    field_type: f.ft || 'text',
    description: f.d || f.n,
    anchor: f.a || false
  })),
  relations: s.rel || []
});

module.exports = {
  schemas: schemas.map(expandSchema),
  rawSchemas: schemas
};
