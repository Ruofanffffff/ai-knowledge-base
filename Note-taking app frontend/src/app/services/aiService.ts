import { api } from './api';

// Types matching backend responses
interface GenerateResponse {
  expandedText: string;
  imagePrompt: string;
  metadata: any;
}

interface ProofreadResponse {
  correctedText: string;
  changes: any[];
  metadata: any;
}

interface TableResponse {
  table: {
    headers: string[];
    rows: string[][];
  };
  tableType: string;
  summary: string;
  metadata: any;
}

interface MindMapResponse {
  mindmap: {
    central_topic: string;
    nodes: Array<{
      id: string;
      text: string;
      children?: Array<any>;
    }>;
  };
  metadata: any;
}

export const aiService = {
  // 智能生成 / 扩写
  async expandContent(text: string): Promise<{ text: string; imagePrompt: string }> {
    try {
      const response = await api.post<{ success: boolean; data: GenerateResponse }>('/ai/generate', {
        text,
        style: 'creative' // Default style
      });
      return {
        text: response.data.data.expandedText,
        imagePrompt: response.data.data.imagePrompt
      };
    } catch (error) {
      console.error('AI Expand failed', error);
      // Fallback to mock or throw
      throw error;
    }
  },

  // 智能校对
  async smartProofread(text: string): Promise<string> {
    try {
      const response = await api.post<{ success: boolean; data: ProofreadResponse }>('/ai/proofread', {
        text
      });
      return response.data.data.correctedText;
    } catch (error) {
      console.error('AI Proofread failed', error);
      throw error;
    }
  },

  // 生成表格
  async generateTable(text: string): Promise<{
    table_type: string;
    columns: string[];
    rows: string[][];
    summary: string;
  }> {
    try {
      const response = await api.post<{ success: boolean; data: TableResponse }>('/ai/generate-table', {
        text,
        maxColumns: 5
      });
      const { table, tableType, summary } = response.data.data;
      return {
        table_type: tableType || 'Table',
        columns: table.headers,
        rows: table.rows,
        summary: summary || ''
      };
    } catch (error) {
      console.error('AI Table failed', error);
      throw error;
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
    try {
      const response = await api.post<{ success: boolean; data: MindMapResponse }>('/ai/generate-mindmap', {
        text,
        maxBranches: 4,
        maxDepth: 3
      });
      return response.data.data.mindmap;
    } catch (error) {
      console.error('AI Mindmap failed', error);
      throw error;
    }
  },

  // 图片分析 (Mock for now as backend endpoint is not confirmed)
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
