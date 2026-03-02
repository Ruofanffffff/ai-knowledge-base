import { Info } from 'lucide-react';
import { Card } from './ui/card';

export function FeatureShowcase() {
  const features = [
    {
      title: '智能生成',
      description: '选中文本后，AI 会为你扩写内容并生成配图提示',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: '智能校对',
      description: '自动检测并修正文本中的错别字和语法问题',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: '生成表格',
      description: '将非结构化文本智能转换为清晰的表格形式',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: '生成脑图',
      description: '自动提取文本核心概念，生成思维导图',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: '图片分析',
      description: '上传图片自动识别文字和分析图片内容',
      color: 'from-purple-500 to-pink-500'
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
        <Info className="w-4 h-4" />
        <span>支持的 AI 功能：</span>
      </div>
      {features.map((feature, index) => (
        <Card key={index} className="p-3 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${feature.color} flex-shrink-0`} />
            <div>
              <h4 className="font-medium text-gray-900 text-sm mb-1">{feature.title}</h4>
              <p className="text-xs text-gray-600">{feature.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
