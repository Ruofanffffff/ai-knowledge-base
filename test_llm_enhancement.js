/**
 * Test LLM Enhancement Integration
 * 
 * 测试LLM批量增强功能的完整流程
 */

const kgService = require('./kg/services/kg_service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 创建模拟LLM客户端
class MockLLMClient {
  constructor() {
    this.callCount = 0;
    this.totalTokens = 0;
  }
  
  async chat(options) {
    this.callCount++;
    
    const messages = options.messages || [];
    const userMessage = messages.find(m => m.role === 'user');
    const prompt = userMessage?.content || '';
    
    // 估算token数量
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = 200; // 假设响应200 tokens
    this.totalTokens += promptTokens + responseTokens;
    
    console.log(`[Mock LLM] Call #${this.callCount}, Prompt tokens: ${promptTokens}`);
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 解析prompt中的CKB数量
    const ckbMatches = prompt.match(/CKB \d+:/g);
    const ckbCount = ckbMatches ? ckbMatches.length : 1;
    
    // 生成模拟响应
    const response = this._generateMockResponse(prompt, ckbCount);
    
    return {
      content: response
    };
  }
  
  _generateMockResponse(prompt, ckbCount) {
    const result = {};
    
    for (let i = 0; i < ckbCount; i++) {
      const fields = [];
      
      // 检查需要提取的字段
      if (prompt.includes('地点')) {
        fields.push({
          name: '地点',
          value: i % 3 === 0 ? '海南省海口市' : (i % 3 === 1 ? '上海市' : '北京市'),
          confidence: 0.9
        });
      }
      
      if (prompt.includes('执行单位')) {
        fields.push({
          name: '执行单位',
          value: i % 2 === 0 ? '上海商汤智能科技有限公司' : '华为技术有限公司',
          confidence: 0.95
        });
      }
      
      if (prompt.includes('负责单位')) {
        fields.push({
          name: '负责单位',
          value: i % 2 === 0 ? '海南省海口市美兰国际机场' : '深圳宝安国际机场',
          confidence: 0.85
        });
      }
      
      result[`ckb_${i}`] = fields;
    }
    
    return JSON.stringify(result);
  }
  
  getStats() {
    return {
      callCount: this.callCount,
      totalTokens: this.totalTokens,
      avgTokensPerCall: this.callCount > 0 ? Math.round(this.totalTokens / this.callCount) : 0
    };
  }
}

async function test() {
  try {
    console.log('='.repeat(80));
    console.log('测试LLM批量增强功能');
    console.log('='.repeat(80));
    console.log('');
    
    // 获取文档2
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const DB_PATH = path.join(__dirname, 'data/users.db');
    
    const document = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.get('SELECT * FROM documents WHERE id = ?', [2], (err, row) => {
          if (err) {
            db.close();
            reject(err);
          } else {
            db.close();
            resolve(row);
          }
        });
      });
    });
    
    if (!document) {
      console.log('Document 2 not found');
      return;
    }
    
    console.log(`文档: ${document.title}`);
    console.log(`文件类型: ${document.file_type}`);
    
    // 解析metadata
    const metadata = document.metadata ? JSON.parse(document.metadata) : {};
    const filePath = metadata.filePath || document.file_path;
    
    console.log(`文件路径: ${filePath}`);
    console.log('');
    
    // 创建模拟LLM客户端
    const mockLLMClient = new MockLLMClient();
    
    // 设置环境变量启用LLM
    process.env.ENABLE_LLM_FIELD_EXTRACTION = 'true';
    process.env.LLM_BATCH_SIZE = '20';
    process.env.LLM_MAX_CONCURRENT = '3';
    
    console.log('--- 配置 ---');
    console.log(`ENABLE_LLM_FIELD_EXTRACTION: ${process.env.ENABLE_LLM_FIELD_EXTRACTION}`);
    console.log(`LLM_BATCH_SIZE: ${process.env.LLM_BATCH_SIZE}`);
    console.log(`LLM_MAX_CONCURRENT: ${process.env.LLM_MAX_CONCURRENT}`);
    console.log('');
    
    console.log('--- 开始构建知识图谱（启用LLM增强）---');
    console.log('');
    
    const startTime = Date.now();
    
    // 构建KG（启用LLM）
    const result = await kgService.buildKnowledgeGraph(
      document.id,
      filePath,
      document.file_type,
      {
        llmClient: mockLLMClient,
        enableSemanticRelations: false,
        enableQualityFilter: true
      }
    );
    
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('='.repeat(80));
    console.log('测试结果');
    console.log('='.repeat(80));
    console.log('');
    
    // 基本统计
    console.log('--- 基本统计 ---');
    console.log(`CKB数量: ${result.ckbs_created}`);
    console.log(`实体数量: ${result.entities_created}`);
    console.log(`关系数量: ${JSON.stringify(result.relations_created)}`);
    console.log(`总关系数: ${result.relations_created.builtin + result.relations_created.cooccurrence + result.relations_created.semantic}`);
    console.log(`处理时间: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`错误数量: ${result.errors.length}`);
    console.log('');
    
    // LLM增强统计
    if (result.llm_enhancement) {
      console.log('--- LLM增强统计 ---');
      console.log(`处理的CKB数量: ${result.llm_enhancement.ckbs_processed}`);
      console.log(`提取的字段数量: ${result.llm_enhancement.fields_extracted}`);
      console.log(`LLM处理时间: ${result.llm_enhancement.duration_ms}ms`);
      console.log('');
    }
    
    // Mock LLM统计
    const llmStats = mockLLMClient.getStats();
    console.log('--- Mock LLM统计 ---');
    console.log(`LLM调用次数: ${llmStats.callCount}`);
    console.log(`总Token消耗: ${llmStats.totalTokens}`);
    console.log(`平均Token/调用: ${llmStats.avgTokensPerCall}`);
    console.log(`LLM调用占比: ${((llmStats.callCount / result.ckbs_created) * 100).toFixed(1)}%`);
    console.log('');
    
    // 性能分析
    console.log('--- 性能分析 ---');
    console.log(`平均处理时间/CKB: ${(duration / result.ckbs_created).toFixed(2)}ms`);
    console.log(`LLM处理占比: ${result.llm_enhancement ? ((result.llm_enhancement.duration_ms / duration) * 100).toFixed(1) : 0}%`);
    console.log('');
    
    // 对比阶段1
    console.log('--- 对比阶段1（无LLM）---');
    console.log(`关系数量: 27 → ${result.relations_created.builtin + result.relations_created.cooccurrence}`);
    console.log(`提升: +${((result.relations_created.builtin + result.relations_created.cooccurrence - 27) / 27 * 100).toFixed(1)}%`);
    console.log('');
    
    // 验收标准检查
    console.log('--- 验收标准检查 ---');
    const totalRelations = result.relations_created.builtin + result.relations_created.cooccurrence + result.relations_created.semantic;
    console.log(`✓ 关系数量 > 50: ${totalRelations > 50 ? '✅ 通过' : '❌ 未通过'} (实际: ${totalRelations})`);
    console.log(`✓ 处理时间 < 30s: ${duration < 30000 ? '✅ 通过' : '❌ 未通过'} (实际: ${(duration / 1000).toFixed(2)}s)`);
    console.log(`✓ LLM调用 < 10%: ${(llmStats.callCount / result.ckbs_created) < 0.1 ? '✅ 通过' : '❌ 未通过'} (实际: ${((llmStats.callCount / result.ckbs_created) * 100).toFixed(1)}%)`);
    console.log(`✓ Token消耗 < 5K: ${llmStats.totalTokens < 5000 ? '✅ 通过' : '❌ 未通过'} (实际: ${llmStats.totalTokens})`);
    console.log('');
    
    // 错误信息
    if (result.errors.length > 0) {
      console.log('--- 错误信息 ---');
      result.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.step}: ${err.error}`);
      });
      console.log('');
    }
    
    console.log('='.repeat(80));
    console.log('测试完成');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
