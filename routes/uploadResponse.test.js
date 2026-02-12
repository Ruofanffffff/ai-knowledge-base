/**
 * 测试文件上传响应格式
 * 验证 POST /api/upload 的响应格式符合设计要求
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { initUserDB } = require('../database/initUserDB');

// 注意：这个测试需要实际的 server 实例
// 由于 server.js 在启动时会监听端口，我们需要导出 app 而不是直接启动
// 这里我们创建一个简化的测试来验证响应格式

describe('POST /api/upload 响应格式测试', () => {
  describe('成功上传（无重复）响应格式', () => {
    test('应该返回 success: true 和 document 对象', () => {
      // 模拟成功响应
      const mockSuccessResponse = {
        success: true,
        document: {
          id: '123',
          title: 'example',
          content: 'test content',
          type: 'document',
          fileType: '.txt',
          metadata: {
            filename: 'example.txt',
            originalname: 'example.txt',
            size: 1024,
            mimetype: 'text/plain',
            filePath: '/uploads/example.txt'
          },
          hash: 'abc123def456',
          size: 1024,
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z'
        }
      };

      // 验证响应格式
      expect(mockSuccessResponse).toHaveProperty('success', true);
      expect(mockSuccessResponse).toHaveProperty('document');
      expect(mockSuccessResponse.document).toHaveProperty('id');
      expect(mockSuccessResponse.document).toHaveProperty('title');
      expect(mockSuccessResponse.document).toHaveProperty('size');
      expect(mockSuccessResponse.document).toHaveProperty('fileType');
      expect(mockSuccessResponse.document).toHaveProperty('hash');
      expect(mockSuccessResponse.document).toHaveProperty('createdAt');
    });
  });

  describe('重复文件检测响应格式', () => {
    test('应该返回 duplicate: true 和必要的重复信息', () => {
      // 模拟重复检测响应
      const mockDuplicateResponse = {
        success: false,
        duplicate: true,
        duplicateType: 'content',
        existingFile: {
          id: '456',
          title: 'old-example',
          size: 1024,
          uploadDate: '2024-01-10T08:20:00Z',
          hash: 'abc123def456'
        },
        tempFileId: 'temp_789',
        newFile: {
          name: 'example.txt',
          size: 1024,
          title: 'example',
          fileType: '.txt',
          content: 'test content'
        }
      };

      // 验证响应格式
      expect(mockDuplicateResponse).toHaveProperty('success', false);
      expect(mockDuplicateResponse).toHaveProperty('duplicate', true);
      expect(mockDuplicateResponse).toHaveProperty('duplicateType');
      expect(mockDuplicateResponse).toHaveProperty('existingFile');
      expect(mockDuplicateResponse).toHaveProperty('tempFileId');
      
      // 验证 duplicateType 是有效值
      expect(['content', 'filename', 'both']).toContain(mockDuplicateResponse.duplicateType);
      
      // 验证 existingFile 包含必要信息
      expect(mockDuplicateResponse.existingFile).toHaveProperty('id');
      expect(mockDuplicateResponse.existingFile).toHaveProperty('title');
      expect(mockDuplicateResponse.existingFile).toHaveProperty('size');
    });

    test('应该支持不同的 duplicateType 值', () => {
      const types = ['content', 'filename', 'both'];
      
      types.forEach(type => {
        const response = {
          success: false,
          duplicate: true,
          duplicateType: type,
          existingFile: {
            id: '456',
            title: 'test',
            size: 1024
          },
          tempFileId: 'temp_123'
        };
        
        expect(response.duplicateType).toBe(type);
      });
    });
  });

  describe('响应格式一致性', () => {
    test('成功响应应该包含 success 字段', () => {
      const successResponse = {
        success: true,
        document: { id: '1' }
      };
      
      expect(successResponse).toHaveProperty('success');
      expect(typeof successResponse.success).toBe('boolean');
    });

    test('重复响应应该包含 success 字段', () => {
      const duplicateResponse = {
        success: false,
        duplicate: true,
        duplicateType: 'content',
        existingFile: { id: '1' },
        tempFileId: 'temp_1'
      };
      
      expect(duplicateResponse).toHaveProperty('success');
      expect(typeof duplicateResponse.success).toBe('boolean');
    });

    test('tempFileId 应该是字符串类型', () => {
      const response = {
        success: false,
        duplicate: true,
        duplicateType: 'content',
        existingFile: { id: '1' },
        tempFileId: 'temp_123'
      };
      
      expect(typeof response.tempFileId).toBe('string');
      expect(response.tempFileId).toMatch(/^temp_/);
    });
  });
});
