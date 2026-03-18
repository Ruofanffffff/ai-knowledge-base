import axios from 'axios';
import { api } from './api';

type ApiErrorDetails = {
  title: string;
  subtitle?: string;
  status?: number;
  errorId?: string;
  errorCode?: string;
};

function toSummaryApiError(err: unknown): ApiErrorDetails {
  if (!axios.isAxiosError(err)) {
    const message = err instanceof Error ? err.message : String(err || '');
    return {
      title: 'AI 总结失败',
      subtitle: message ? `未知错误｜${message}` : '未知错误',
    };
  }

  const status = err.response?.status;
  const data: any = err.response?.data;
  const errorId = data?.errorId;
  const errorCode = data?.errorCode;
  const backendMessage = data?.error || data?.message;
  const infoParts = [
    typeof status === 'number' ? `HTTP ${status}` : null,
    errorCode ? String(errorCode) : null,
    errorId ? `错误ID: ${String(errorId)}` : null,
  ].filter(Boolean);
  const info = infoParts.join('｜');

  if (status === 404 || status === 501) {
    return {
      title: '后端未升级/接口不存在',
      subtitle: [info, '请确认后端已升级到支持 AI 总结的版本后重试，或切换到正确环境'].filter(Boolean).join('｜'),
      status,
      errorId,
      errorCode,
    };
  }

  return {
    title: 'AI 总结失败',
    subtitle: [info, backendMessage ? String(backendMessage) : null].filter(Boolean).join('｜') || info || '请求失败，请稍后重试',
    status,
    errorId,
    errorCode,
  };
}

export const aiService = {
  // 智能生成 / 扩写
  async expandContent(text: string): Promise<{ text: string; imagePrompt: string }> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      text: `${text}\n\n这个想法让我想起了许多相关的概念。从更深层次来看,它体现了一种独特的思维方式,将感性与理性完美结合。这种方法不仅能够帮助我们更好地理解当前的情况,还能为未来的发展提供新的视角。通过这样的思考过程,我们可以发现更多隐藏的可能性,并将其转化为具体的行动方案。`,
      imagePrompt: `A serene and inspiring scene that captures the essence of "${text}". Natural lighting, minimalist composition, with soft colors and a dreamy atmosphere. Photography style, high quality, aesthetic.`
    };
  },

  // 智能校对
  async smartProofread(text: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple mock correction
    const corrected = text
      .replace(/。。/g, '。')
      .replace(/,,/g, ',')
      .replace(/  +/g, ' ')
      .trim();
    
    return corrected || text;
  },

  // 生成表格
  async generateTable(text: string): Promise<{
    table_type: string;
    columns: string[];
    rows: string[][];
    summary: string;
  }> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock table generation
    return {
      table_type: "信息对比表",
      columns: ["项目", "描述", "优先级"],
      rows: [
        ["核心功能", "基础文本编辑和保存", "高"],
        ["进阶功能", "AI 智能分析与生成", "中"],
        ["扩展功能", "多媒体支持与协作", "低"]
      ],
      summary: "基于文本内容生成的功能优先级表"
    };
  },

  async summarizeText(text: string): Promise<any> {
    try {
      const response = await api.post('/ai/summary/text', { text });
      const payload = response.data;
      if (payload?.structured) return payload.structured;
      if (payload?.summary) {
        try {
          return JSON.parse(payload.summary);
        } catch {
          return { overview: String(payload.summary || '') };
        }
      }
      return { overview: '' };
    } catch (err) {
      const details = toSummaryApiError(err);
      const e = new Error(details.title);
      (e as any).title = details.title;
      (e as any).subtitle = details.subtitle;
      (e as any).status = details.status;
      (e as any).errorId = details.errorId;
      (e as any).errorCode = details.errorCode;
      throw e;
    }
  },

  // 生成脑图
  async generateMindmap(text: string): Promise<{
    central_topic: string;
    nodes: Array<{
      id: string;
      text: string;
      children?: Array<{ id: string; text: string }>;
    }>;
  }> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      central_topic: "核心概念",
      nodes: [
        {
          id: "A",
          text: "基础功能",
          children: [
            { id: "A1", text: "文本输入" },
            { id: "A2", text: "图片上传" },
            { id: "A3", text: "数据保存" }
          ]
        },
        {
          id: "B",
          text: "智能功能",
          children: [
            { id: "B1", text: "内容生成" },
            { id: "B2", text: "智能校对" },
            { id: "B3", text: "结构化输出" }
          ]
        },
        {
          id: "C",
          text: "用户体验",
          children: [
            { id: "C1", text: "界面设计" },
            { id: "C2", text: "交互流程" }
          ]
        }
      ]
    };
  },

  // 图片分析
  async analyzeImage(imageFile: File): Promise<{
    image_type: string;
    confidence: number;
    has_text: boolean;
    ocr_text: string;
    structured_content: any;
  }> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock image analysis based on file name
    const fileName = imageFile.name.toLowerCase();
    
    if (fileName.includes('text') || fileName.includes('doc')) {
      return {
        image_type: "text_document",
        confidence: 0.95,
        has_text: true,
        ocr_text: "这是从图片中识别出的文字内容。包含了多个段落和要点,展示了文档的主要信息。",
        structured_content: {
          language: "zh",
          content_blocks: [
            { block_type: "title", text: "文档标题" },
            { block_type: "paragraph", text: "这是文档的主要内容段落" }
          ]
        }
      };
    } else if (fileName.includes('landscape') || fileName.includes('nature')) {
      return {
        image_type: "landscape",
        confidence: 0.92,
        has_text: false,
        ocr_text: "",
        structured_content: {
          scene_type: "natural_landscape",
          elements: ["山脉", "天空", "云层"],
          lighting: "黄金时段",
          color_analysis: {
            dominant_colors: ["橙色", "蓝色", "金黄色"],
            color_tone: "warm"
          }
        }
      };
    } else if (fileName.includes('portrait') || fileName.includes('person')) {
      return {
        image_type: "portrait",
        confidence: 0.90,
        has_text: false,
        ocr_text: "",
        structured_content: {
          person_count: 1,
          visible_attributes: {
            face_visible: true,
            pose: "frontal",
            expression: "neutral"
          },
          context: {
            indoor_outdoor: "indoor",
            background: "plain"
          }
        }
      };
    } else {
      return {
        image_type: "mixed",
        confidence: 0.85,
        has_text: false,
        ocr_text: "",
        structured_content: {
          primary_visual_type: "general",
          elements: ["多种元素组合"],
          description: "这是一张包含多种视觉元素的图片"
        }
      };
    }
  }
};
