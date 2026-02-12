/**
 * Unit Tests for KG Consistency Checker
 * 
 * Tests the knowledge graph consistency checking and description generation functionality
 * 
 * Requirements: 7.1, 7.3
 * - 7.1: Generate natural language description of knowledge graph
 * - 7.3: Include main entities, key relations, and graph structure summary
 */

const { KGConsistencyChecker, createKGConsistencyChecker } = require('../kg_consistency_checker');

describe('KGConsistencyChecker', () => {
  let checker;
  
  beforeEach(() => {
    checker = new KGConsistencyChecker({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2,
      consistencyThreshold: 0.8
    });
  });
  
  describe('generateGraphDescription', () => {
    test('should generate brief description for simple graph', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '水文局' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' },
          { id: 'r2', sourceId: '3', targetId: '2', type: 'manages' }
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'brief');
      
      expect(description).toContain('3 个实体');
      expect(description).toContain('2 个关系');
      expect(description).toContain('Location');
    });
    
    test('should generate detailed description for simple graph', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' }
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      expect(description).toContain('# 知识图谱描述');
      expect(description).toContain('## 总体统计');
      expect(description).toContain('实体数量：2');
      expect(description).toContain('关系数量：1');
      expect(description).toContain('## 实体类型分布');
      expect(description).toContain('## 主要实体');
      expect(description).toContain('海口市');
      expect(description).toContain('美兰区');
    });
    
    test('should handle empty graph', () => {
      const graph = {
        entities: [],
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'brief');
      
      expect(description).toContain('没有实体');
    });
    
    test('should handle null graph', () => {
      const description = checker.generateGraphDescription(null, 'brief');
      
      expect(description).toBe('空图谱');
    });
    
    test('should handle graph with many entities', () => {
      const entities = [];
      for (let i = 0; i < 15; i++) {
        entities.push({
          id: `e${i}`,
          type: 'Location',
          canonicalName: `实体${i}`
        });
      }
      
      const graph = {
        entities,
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      expect(description).toContain('实体数量：15');
      expect(description).toContain('还有 5 个实体');
    });
  });
  
  describe('checkConsistency', () => {
    test('should skip check when graph is invalid', async () => {
      const result = await checker.checkConsistency(
        null,
        '1. 测试索引',
        null
      );
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.isConsistent).toBe(true);
      expect(result.reason).toContain('Invalid graph structure');
    });
    
    test('should skip check when indexed text is missing', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const result = await checker.checkConsistency(
        graph,
        null,
        null
      );
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.isConsistent).toBe(true);
      expect(result.reason).toContain('No indexed text available');
    });
    
    test('should skip check when LLM client is missing', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const result = await checker.checkConsistency(
        graph,
        '1. 海口市位于海南省',
        null
      );
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.isConsistent).toBe(true);
      expect(result.reason).toContain('No LLM client');
    });
    
    test('should check consistency with mock LLM client', async () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' }
        ]
      };
      
      const indexedText = '1. 美兰区位于海口市。\n2. 海口市是海南省的省会。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.9,
            items: [
              {
                kg_statement: '美兰区位于海口市',
                status: '一致',
                reason: '索引文本第1条明确支持',
                supporting_indices: [1]
              }
            ],
            issues: []
          })
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(0.9);
      expect(result.isConsistent).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('一致');
      expect(result.issues).toHaveLength(0);
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
    
    test('should handle LLM errors gracefully', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const mockLLMClient = {
        chat: jest.fn().mockRejectedValue(new Error('LLM service unavailable'))
      };
      
      const result = await checker.checkConsistency(
        graph,
        '1. 海口市位于海南省',
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.isConsistent).toBe(true);
      expect(result.error).toContain('LLM service unavailable');
    });
    
    test('should identify inconsistencies', async () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '北京市' }
        ],
        relations: []
      };
      
      const indexedText = '1. 海口市位于海南省。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.3,
            items: [
              {
                kg_statement: '北京市',
                status: '不一致',
                reason: '索引文本中未提及北京市',
                supporting_indices: []
              }
            ],
            issues: [
              {
                type: '实体错误',
                description: '图谱中的实体"北京市"在索引文本中未找到支持',
                kg_statement: '北京市'
              }
            ]
          })
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(0.3);
      expect(result.isConsistent).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('实体错误');
    });
  });
  
  describe('generateConsistencyReport', () => {
    test('should generate report for consistent graph', () => {
      const consistencyResult = {
        consistencyScore: 0.95,
        isConsistent: true,
        items: [
          {
            kgStatement: '海口市位于海南省',
            status: '一致',
            reason: '索引文本明确支持',
            supportingIndices: [1]
          }
        ],
        issues: []
      };
      
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const report = checker.generateConsistencyReport(consistencyResult, graph);
      
      expect(report).toContain('# 知识图谱一致性报告');
      expect(report).toContain('95.0%');
      expect(report).toContain('✓ 一致');
      expect(report).toContain('未发现一致性问题');
      expect(report).toContain('实体数量：1');
    });
    
    test('should generate report with issues', () => {
      const consistencyResult = {
        consistencyScore: 0.6,
        isConsistent: false,
        items: [
          {
            kgStatement: '北京市',
            status: '不一致',
            reason: '索引文本中未提及',
            supportingIndices: []
          }
        ],
        issues: [
          {
            type: '实体错误',
            description: '实体在索引中未找到',
            kgStatement: '北京市'
          }
        ]
      };
      
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '北京市' }],
        relations: []
      };
      
      const report = checker.generateConsistencyReport(consistencyResult, graph);
      
      expect(report).toContain('60.0%');
      expect(report).toContain('✗ 不一致');
      expect(report).toContain('发现的问题 (1)');
      expect(report).toContain('实体错误');
      expect(report).toContain('不一致的项目');
    });
  });
  
  describe('saveGraphDescription', () => {
    test('should save graph description to database', async () => {
      const mockPrisma = {
        graphDescription: {
          create: jest.fn().mockResolvedValue({
            id: 'desc-1',
            docId: 'doc-1',
            descriptionType: 'brief',
            description: '测试描述',
            metadata: '{}',
            createdAt: new Date()
          })
        }
      };
      
      const result = await checker.saveGraphDescription(
        'doc-1',
        '测试描述',
        'brief',
        { entityCount: 5 },
        mockPrisma
      );
      
      expect(result).toBeDefined();
      expect(result.docId).toBe('doc-1');
      expect(result.descriptionType).toBe('brief');
      expect(mockPrisma.graphDescription.create).toHaveBeenCalled();
    });
    
    test('should handle missing Prisma client', async () => {
      const result = await checker.saveGraphDescription(
        'doc-1',
        '测试描述',
        'brief',
        {},
        null
      );
      
      expect(result).toBeNull();
    });
  });
  
  describe('getGraphDescription', () => {
    test('should retrieve graph description from database', async () => {
      const mockPrisma = {
        graphDescription: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'desc-1',
            docId: 'doc-1',
            descriptionType: 'brief',
            description: '测试描述',
            metadata: '{}',
            createdAt: new Date()
          })
        }
      };
      
      const result = await checker.getGraphDescription(
        'doc-1',
        'brief',
        mockPrisma
      );
      
      expect(result).toBeDefined();
      expect(result.docId).toBe('doc-1');
      expect(mockPrisma.graphDescription.findFirst).toHaveBeenCalledWith({
        where: {
          docId: 'doc-1',
          descriptionType: 'brief'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    });
    
    test('should handle missing Prisma client', async () => {
      const result = await checker.getGraphDescription(
        'doc-1',
        'brief',
        null
      );
      
      expect(result).toBeNull();
    });
  });
  
  describe('createKGConsistencyChecker', () => {
    test('should create checker instance with default options', () => {
      const checker = createKGConsistencyChecker();
      
      expect(checker).toBeInstanceOf(KGConsistencyChecker);
      expect(checker.temperature).toBe(0.1);
    });
    
    test('should create checker instance with custom options', () => {
      const checker = createKGConsistencyChecker({
        temperature: 0.2,
        timeout: 10000,
        consistencyThreshold: 0.9
      });
      
      expect(checker).toBeInstanceOf(KGConsistencyChecker);
      expect(checker.temperature).toBe(0.2);
      expect(checker.timeout).toBe(10000);
      expect(checker.consistencyThreshold).toBe(0.9);
    });
  });
  
  // Additional tests for Requirements 7.1 and 7.3
  describe('Consistency Assessment (Requirement 7.1)', () => {
    test('should assess consistency with partial matches', async () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '水文局' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' },
          { id: 'r2', sourceId: '3', targetId: '2', type: 'manages' }
        ]
      };
      
      const indexedText = '1. 美兰区位于海口市。\n2. 水文局负责管理监测点。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.75,
            items: [
              {
                kg_statement: '美兰区位于海口市',
                status: '一致',
                reason: '索引文本第1条明确支持',
                supporting_indices: [1]
              },
              {
                kg_statement: '水文局管理美兰区',
                status: '部分一致',
                reason: '索引文本提到水文局管理监测点，但未明确说明管理美兰区',
                supporting_indices: [2]
              }
            ],
            issues: [
              {
                type: '关系偏差',
                description: '水文局与美兰区的关系不够明确',
                kg_statement: '水文局管理美兰区'
              }
            ]
          })
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(0.75);
      expect(result.isConsistent).toBe(false); // Below 0.8 threshold
      expect(result.items).toHaveLength(2);
      expect(result.items[0].status).toBe('一致');
      expect(result.items[1].status).toBe('部分一致');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('关系偏差');
    });
    
    test('should handle consistency check with field missing issues', async () => {
      const graph = {
        entities: [
          { id: '1', type: 'MonitoringPoint', canonicalName: 'ALI-C-001', attributes: { depth: 45.2 } }
        ],
        relations: []
      };
      
      const indexedText = '1. 监测点ALI-C-001的水位为45.2米，温度为25度。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.7,
            items: [
              {
                kg_statement: '监测点ALI-C-001水位45.2米',
                status: '部分一致',
                reason: '索引文本支持水位信息，但图谱缺少温度字段',
                supporting_indices: [1]
              }
            ],
            issues: [
              {
                type: '字段缺失',
                description: '图谱中缺少温度字段，索引文本中提到温度为25度',
                kg_statement: '监测点ALI-C-001'
              }
            ]
          })
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(0.7);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('字段缺失');
    });
    
    test('should correctly determine consistency based on threshold', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const indexedText = '1. 海口市位于海南省。';
      
      // Test with score exactly at threshold
      const mockLLMClient1 = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.8,
            items: [],
            issues: []
          })
        })
      };
      
      const result1 = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient1
      );
      
      expect(result1.consistencyScore).toBe(0.8);
      expect(result1.isConsistent).toBe(true); // At threshold
      
      // Test with score just below threshold
      const mockLLMClient2 = {
        chat: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            consistency_score: 0.79,
            items: [],
            issues: []
          })
        })
      };
      
      const result2 = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient2
      );
      
      expect(result2.consistencyScore).toBe(0.79);
      expect(result2.isConsistent).toBe(false); // Below threshold
    });
    
    test('should handle malformed LLM response gracefully', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const indexedText = '1. 海口市位于海南省。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: 'This is not valid JSON'
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(1.0);
      expect(result.isConsistent).toBe(true);
      expect(result.parseError).toBeDefined();
    });
    
    test('should handle LLM response with markdown code blocks', async () => {
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '海口市' }],
        relations: []
      };
      
      const indexedText = '1. 海口市位于海南省。';
      
      const mockLLMClient = {
        chat: jest.fn().mockResolvedValue({
          content: '```json\n{"consistency_score": 0.95, "items": [], "issues": []}\n```'
        })
      };
      
      const result = await checker.checkConsistency(
        graph,
        indexedText,
        mockLLMClient
      );
      
      expect(result.consistencyScore).toBe(0.95);
      expect(result.isConsistent).toBe(true);
    });
  });
  
  describe('Graph Description Generation (Requirement 7.3)', () => {
    test('should include main entities in description', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '海南省水文局' },
          { id: '4', type: 'MonitoringPoint', canonicalName: 'ALI-C-001' }
        ],
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      // Should include main entities section
      expect(description).toContain('## 主要实体');
      expect(description).toContain('海口市');
      expect(description).toContain('美兰区');
      expect(description).toContain('海南省水文局');
      expect(description).toContain('ALI-C-001');
    });
    
    test('should include key relations in description', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' },
          { id: 'r2', sourceId: '2', targetId: '1', type: 'part_of' }
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      // Should include relations section
      expect(description).toContain('## 主要关系');
      expect(description).toContain('美兰区');
      expect(description).toContain('海口市');
      expect(description).toContain('located_in');
      expect(description).toContain('part_of');
    });
    
    test('should include graph structure summary', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '水文局' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' },
          { id: 'r2', sourceId: '3', targetId: '2', type: 'manages' }
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      // Should include structure summary
      expect(description).toContain('## 总体统计');
      expect(description).toContain('实体数量：3');
      expect(description).toContain('关系数量：2');
      expect(description).toContain('## 实体类型分布');
      expect(description).toContain('Location: 2个');
      expect(description).toContain('Organization: 1个');
      expect(description).toContain('## 关系类型分布');
      expect(description).toContain('located_in: 1个');
      expect(description).toContain('manages: 1个');
    });
    
    test('should handle graphs with multiple entity types', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '水文局' },
          { id: '4', type: 'Person', canonicalName: '张三' },
          { id: '5', type: 'MonitoringPoint', canonicalName: 'ALI-C-001' }
        ],
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'brief');
      
      // Should show top 3 entity types
      expect(description).toContain('主要实体类型');
      expect(description).toContain('Location(2)');
    });
    
    test('should handle graphs with multiple relation types', () => {
      const graph = {
        entities: [
          { id: '1', canonicalName: 'A' },
          { id: '2', canonicalName: 'B' }
        ],
        relations: [
          { id: 'r1', sourceId: '1', targetId: '2', type: 'located_in' },
          { id: 'r2', sourceId: '1', targetId: '2', type: 'part_of' },
          { id: 'r3', sourceId: '1', targetId: '2', type: 'manages' },
          { id: 'r4', sourceId: '1', targetId: '2', type: 'owns' }
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'brief');
      
      // Should show top 3 relation types
      expect(description).toContain('主要关系类型');
      expect(description).toContain('(1)');
    });
    
    test('should truncate large entity lists in detailed description', () => {
      const entities = [];
      for (let i = 0; i < 20; i++) {
        entities.push({
          id: `e${i}`,
          type: 'Location',
          canonicalName: `实体${i}`
        });
      }
      
      const graph = {
        entities,
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      // Should show first 10 and indicate more
      expect(description).toContain('实体0');
      expect(description).toContain('实体9');
      expect(description).toContain('还有 10 个实体');
    });
    
    test('should truncate large relation lists in detailed description', () => {
      const entities = [
        { id: '1', canonicalName: 'A' },
        { id: '2', canonicalName: 'B' }
      ];
      
      const relations = [];
      for (let i = 0; i < 15; i++) {
        relations.push({
          id: `r${i}`,
          sourceId: '1',
          targetId: '2',
          type: `relation_${i}`
        });
      }
      
      const graph = {
        entities,
        relations
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      // Should show first 10 and indicate more
      expect(description).toContain('还有 5 个关系');
    });
    
    test('should handle entities without canonical names', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', name: '海口市' },
          { id: '2', type: 'Location' } // No name at all
        ],
        relations: []
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      expect(description).toContain('海口市');
      expect(description).toContain('unknown');
    });
    
    test('should handle relations with missing entity references', () => {
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' }
        ],
        relations: [
          { id: 'r1', sourceId: '1', targetId: '999', type: 'located_in' } // Target doesn't exist
        ]
      };
      
      const description = checker.generateGraphDescription(graph, 'detailed');
      
      expect(description).toContain('海口市');
      expect(description).toContain('unknown');
      expect(description).toContain('located_in');
    });
  });
  
  describe('Consistency Report Generation', () => {
    test('should generate comprehensive report with all sections', () => {
      const consistencyResult = {
        consistencyScore: 0.85,
        isConsistent: true,
        items: [
          {
            kgStatement: '海口市位于海南省',
            status: '一致',
            reason: '索引文本明确支持',
            supportingIndices: [1]
          },
          {
            kgStatement: '美兰区位于海口市',
            status: '一致',
            reason: '索引文本明确支持',
            supportingIndices: [2]
          },
          {
            kgStatement: '水文局管理监测点',
            status: '部分一致',
            reason: '索引文本部分支持',
            supportingIndices: [3]
          }
        ],
        issues: [
          {
            type: '关系偏差',
            description: '管理关系不够明确',
            kgStatement: '水文局管理监测点'
          }
        ]
      };
      
      const graph = {
        entities: [
          { id: '1', type: 'Location', canonicalName: '海口市' },
          { id: '2', type: 'Location', canonicalName: '美兰区' },
          { id: '3', type: 'Organization', canonicalName: '水文局' }
        ],
        relations: [
          { id: 'r1', sourceId: '2', targetId: '1', type: 'located_in' }
        ]
      };
      
      const report = checker.generateConsistencyReport(consistencyResult, graph);
      
      expect(report).toContain('# 知识图谱一致性报告');
      expect(report).toContain('## 总体评分');
      expect(report).toContain('85.0%');
      expect(report).toContain('## 图谱统计');
      expect(report).toContain('实体数量：3');
      expect(report).toContain('关系数量：1');
      expect(report).toContain('## 发现的问题 (1)');
      expect(report).toContain('## 详细评估 (3 项)');
      expect(report).toContain('一致：2 项');
      expect(report).toContain('部分一致：1 项');
      expect(report).toContain('不一致：0 项');
    });
    
    test('should show inconsistent items in report', () => {
      const consistencyResult = {
        consistencyScore: 0.5,
        isConsistent: false,
        items: [
          {
            kgStatement: '北京市位于河北省',
            status: '不一致',
            reason: '索引文本中未提及此关系',
            supportingIndices: []
          }
        ],
        issues: [
          {
            type: '关系错误',
            description: '北京市不位于河北省',
            kgStatement: '北京市位于河北省'
          }
        ]
      };
      
      const graph = {
        entities: [{ id: '1', type: 'Location', canonicalName: '北京市' }],
        relations: []
      };
      
      const report = checker.generateConsistencyReport(consistencyResult, graph);
      
      expect(report).toContain('### 不一致的项目');
      expect(report).toContain('北京市位于河北省');
      expect(report).toContain('状态：不一致');
      expect(report).toContain('原因：索引文本中未提及此关系');
    });
  });
});
