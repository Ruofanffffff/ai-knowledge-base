/**
 * ImageRecognitionService 单元测试
 */

// Mock Prisma - must be before require
const mockPrisma = {
  imageAnalysis: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { ImageRecognitionService } = require('./imageRecognitionService');

describe('ImageRecognitionService', () => {
  let service;
  let mockLlmClient;
  let mockMinioService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLlmClient = {
      call: jest.fn(),
    };

    mockMinioService = {
      getFile: jest.fn(),
    };

    service = new ImageRecognitionService(mockLlmClient, mockMinioService);
  });

  describe('buildPrompt', () => {
    it('should return an array containing image_url and text blocks', () => {
      const base64 = 'data:image/png;base64,abc123';
      const prompt = service.buildPrompt(base64);

      expect(Array.isArray(prompt)).toBe(true);
      expect(prompt).toHaveLength(2);
      expect(prompt[0].type).toBe('image_url');
      expect(prompt[0].image_url.url).toBe(base64);
      expect(prompt[1].type).toBe('text');
      expect(prompt[1].text).toContain('description');
      expect(prompt[1].text).toContain('elements');
      expect(prompt[1].text).toContain('theme');
    });
  });

  describe('parseAnalysisResult', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        description: '一张城市风景照',
        elements: ['高楼', '天空', '街道'],
        theme: '城市风光',
      });

      const result = service.parseAnalysisResult(response);

      expect(result.description).toBe('一张城市风景照');
      expect(result.elements).toEqual(['高楼', '天空', '街道']);
      expect(result.theme).toBe('城市风光');
    });

    it('should handle JSON wrapped in markdown code fences', () => {
      const response = '```json\n{"description":"测试","elements":["a"],"theme":"主题"}\n```';

      const result = service.parseAnalysisResult(response);

      expect(result.description).toBe('测试');
      expect(result.elements).toEqual(['a']);
      expect(result.theme).toBe('主题');
    });

    it('should return defaults for null/undefined input', () => {
      expect(service.parseAnalysisResult(null)).toEqual({
        description: '',
        elements: [],
        theme: '',
      });

      expect(service.parseAnalysisResult(undefined)).toEqual({
        description: '',
        elements: [],
        theme: '',
      });
    });

    it('should return defaults for non-string input', () => {
      expect(service.parseAnalysisResult(123)).toEqual({
        description: '',
        elements: [],
        theme: '',
      });
    });

    it('should use response as description when JSON parsing fails', () => {
      const response = '这是一张美丽的风景照片';
      const result = service.parseAnalysisResult(response);

      expect(result.description).toBe('这是一张美丽的风景照片');
      expect(result.elements).toEqual([]);
      expect(result.theme).toBe('');
    });

    it('should filter non-string elements from elements array', () => {
      const response = JSON.stringify({
        description: '测试',
        elements: ['valid', 123, null, '也有效'],
        theme: '主题',
      });

      const result = service.parseAnalysisResult(response);
      expect(result.elements).toEqual(['valid', '也有效']);
    });

    it('should handle missing fields with defaults', () => {
      const response = JSON.stringify({ description: '只有描述' });

      const result = service.parseAnalysisResult(response);

      expect(result.description).toBe('只有描述');
      expect(result.elements).toEqual([]);
      expect(result.theme).toBe('');
    });
  });

  describe('analyzeImage', () => {
    const createReadableStream = (data) => {
      return (async function* () {
        yield Buffer.from(data);
      })();
    };

    it('should analyze image and update database on success', async () => {
      const imageKey = 'test-image.png';
      const llmResponse = JSON.stringify({
        description: '测试图片',
        elements: ['元素1'],
        theme: '测试',
      });

      mockMinioService.getFile.mockResolvedValue({
        body: createReadableStream('fake-image-data'),
        contentType: 'image/png',
      });
      mockLlmClient.call.mockResolvedValue(llmResponse);
      mockPrisma.imageAnalysis.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.analyzeImage(imageKey);

      expect(result.description).toBe('测试图片');
      expect(result.elements).toEqual(['元素1']);
      expect(result.theme).toBe('测试');

      expect(mockMinioService.getFile).toHaveBeenCalledWith(imageKey, undefined);
      expect(mockLlmClient.call).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ model: 'qwen-vl-plus' })
      );
      expect(mockPrisma.imageAnalysis.updateMany).toHaveBeenCalledWith({
        where: { imageKey },
        data: expect.objectContaining({ status: 'completed' }),
      });
    });

    it('should create new record if no existing record found', async () => {
      const imageKey = 'new-image.png';

      mockMinioService.getFile.mockResolvedValue({
        body: createReadableStream('data'),
        contentType: 'image/jpeg',
      });
      mockLlmClient.call.mockResolvedValue('{"description":"新图","elements":[],"theme":""}');
      mockPrisma.imageAnalysis.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.imageAnalysis.create.mockResolvedValue({ id: 'new-id' });

      await service.analyzeImage(imageKey);

      expect(mockPrisma.imageAnalysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          imageKey,
          status: 'completed',
        }),
      });
    });

    it('should set status to failed when LLM call fails', async () => {
      const imageKey = 'fail-image.png';

      mockMinioService.getFile.mockResolvedValue({
        body: createReadableStream('data'),
        contentType: 'image/png',
      });
      mockLlmClient.call.mockRejectedValue(new Error('LLM timeout'));
      mockPrisma.imageAnalysis.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.analyzeImage(imageKey)).rejects.toThrow('LLM timeout');

      expect(mockPrisma.imageAnalysis.updateMany).toHaveBeenCalledWith({
        where: { imageKey },
        data: {
          status: 'failed',
          error: 'LLM timeout',
        },
      });
    });

    it('should set status to failed when MinIO getFile fails', async () => {
      const imageKey = 'missing.png';

      mockMinioService.getFile.mockRejectedValue(new Error('文件获取失败'));
      mockPrisma.imageAnalysis.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.analyzeImage(imageKey)).rejects.toThrow('文件获取失败');

      expect(mockPrisma.imageAnalysis.updateMany).toHaveBeenCalledWith({
        where: { imageKey },
        data: {
          status: 'failed',
          error: '文件获取失败',
        },
      });
    });
  });
});
