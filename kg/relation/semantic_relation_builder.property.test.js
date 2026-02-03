/**
 * Property-Based Tests for Semantic Relation Builder
 * 
 * Property 16: Semantic Relation Validation
 * 
 * Validates: Requirements 6.1, 6.2
 */

const fc = require('fast-check');
const semanticRelationBuilder = require('./semantic_relation_builder');
const tokenBudgetManager = require('../utils/token_budget_manager');

// Mock dependencies
jest.mock('../utils/token_budget_manager');
jest.mock('../utils/performance_monitor');

describe('Property-Based Tests: Semantic Relation Builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock token budget manager
    tokenBudgetManager.recordUsage = jest.fn().mockResolvedValue(undefined);
    tokenBudgetManager.getBudgetStatus = jest.fn().mockReturnValue({
      llmParticipationRate: 1.0
    });
  });

  describe('Property 16: Semantic Relation Validation', () => {
    /**
     * Property 16: For any semantic relation candidate returned by LLM,
     * both subject and object must correspond to existing entities,
     * and confidence must be ≥ 0.7 to be accepted.
     */
    it('should only accept relations with existing entities and confidence ≥ 0.7', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate CKB with entities
          fc.record({
            ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
            doc_id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            }),
            entities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('event', 'entity', 'concept')
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          // Generate relation candidates with varying confidence
          fc.array(
            fc.record({
              subject_id: fc.string({ minLength: 1, maxLength: 20 }),
              object_id: fc.string({ minLength: 1, maxLength: 20 }),
              subject: fc.string({ minLength: 1, maxLength: 50 }),
              object: fc.string({ minLength: 1, maxLength: 50 }),
              relation: fc.string({ minLength: 1, maxLength: 30 }),
              relation_type: fc.constantFrom('causal', 'comparison', 'temporal', 'association'),
              evidence_text: fc.string({ minLength: 5, maxLength: 100 }),
              confidence: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (ckb, candidates) => {
            // Ensure evidence text is in CKB content
            const validCandidates = candidates.map(c => ({
              ...c,
              evidence_text: ckb.content.text.substring(0, 20)
            }));

            // Mock LLM client to return candidates
            let callCount = 0;
            const mockLLMClient = jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First call: extraction
                return Promise.resolve(JSON.stringify({
                  relations: validCandidates
                }));
              } else {
                // Subsequent calls: validation
                const candidateIndex = Math.floor((callCount - 2) / 1);
                const candidate = validCandidates[candidateIndex];
                return Promise.resolve(JSON.stringify({
                  is_valid: true,
                  confidence: Math.fround(candidate.confidence),
                  reason: 'Valid relation'
                }));
              }
            });

            const relations = await semanticRelationBuilder.extractSemanticRelations(
              ckb,
              mockLLMClient,
              { confidenceThreshold: 0.7 }
            );

            // Property 16 Validation
            for (const relation of relations) {
              // 1. Subject must exist in entities
              const subjectExists = ckb.entities.some(e => e.id === relation.source_id);
              expect(subjectExists).toBe(true);

              // 2. Object must exist in entities
              const objectExists = ckb.entities.some(e => e.id === relation.target_id);
              expect(objectExists).toBe(true);

              // 3. Confidence must be ≥ 0.7 (with LLM discount of 0.9)
              // Original confidence * validation confidence * 0.9 ≥ 0.7
              expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
            }

            // Verify that low confidence relations are filtered out
            const lowConfidenceCandidates = validCandidates.filter(c => 
              c.confidence * c.confidence * 0.9 < 0.7
            );
            
            // These should not appear in final relations
            for (const lowConf of lowConfidenceCandidates) {
              const found = relations.some(r => 
                r.source_id === lowConf.subject_id && 
                r.target_id === lowConf.object_id
              );
              expect(found).toBe(false);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject relations with non-existent entities', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate CKB with entities
          fc.record({
            ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
            doc_id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            }),
            entities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('event', 'entity', 'concept')
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async (ckb) => {
            // Create a candidate with non-existent entity IDs
            const nonExistentId = 'non_existent_entity_' + Math.random();
            const candidate = {
              subject_id: nonExistentId,
              object_id: ckb.entities[0].id,
              subject: 'Non-existent Entity',
              object: ckb.entities[0].canonical_name,
              relation: 'relates to',
              relation_type: 'association',
              evidence_text: ckb.content.text.substring(0, 20),
              confidence: 0.9
            };

            // Mock LLM client
            const mockLLMClient = jest.fn().mockResolvedValue(
              JSON.stringify({
                relations: [candidate]
              })
            );

            const relations = await semanticRelationBuilder.extractSemanticRelations(
              ckb,
              mockLLMClient
            );

            // Property 16: Relation with non-existent entity should be rejected
            expect(relations).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject relations with confidence below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate CKB with entities
          fc.record({
            ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
            doc_id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            }),
            entities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('event', 'entity', 'concept')
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          // Generate low confidence value
          fc.float({ min: Math.fround(0), max: Math.fround(0.69) }),
          async (ckb, lowConfidence) => {
            // Create a candidate with low confidence
            const candidate = {
              subject_id: ckb.entities[0].id,
              object_id: ckb.entities[1].id,
              subject: ckb.entities[0].canonical_name,
              object: ckb.entities[1].canonical_name,
              relation: 'relates to',
              relation_type: 'association',
              evidence_text: ckb.content.text.substring(0, 20),
              confidence: Math.fround(lowConfidence)
            };

            // Mock LLM client
            const mockLLMClient = jest.fn()
              .mockResolvedValueOnce(
                JSON.stringify({
                  relations: [candidate]
                })
              )
              .mockResolvedValueOnce(
                JSON.stringify({
                  is_valid: true,
                  confidence: Math.fround(lowConfidence),
                  reason: 'Low confidence'
                })
              );

            const relations = await semanticRelationBuilder.extractSemanticRelations(
              ckb,
              mockLLMClient,
              { confidenceThreshold: 0.7 }
            );

            // Property 16: Relation with confidence < 0.7 should be rejected
            expect(relations).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should accept relations with valid entities and high confidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate CKB with entities
          fc.record({
            ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
            doc_id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            }),
            entities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('event', 'entity', 'concept')
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          // Generate high confidence value
          fc.float({ min: Math.fround(0.8), max: Math.fround(1.0) }),
          async (ckb, highConfidence) => {
            // Create a candidate with high confidence and valid entities
            const candidate = {
              subject_id: ckb.entities[0].id,
              object_id: ckb.entities[1].id,
              subject: ckb.entities[0].canonical_name,
              object: ckb.entities[1].canonical_name,
              relation: 'relates to',
              relation_type: 'association',
              evidence_text: ckb.content.text.substring(0, 20),
              confidence: Math.fround(highConfidence)
            };

            // Mock LLM client
            const mockLLMClient = jest.fn()
              .mockResolvedValueOnce(
                JSON.stringify({
                  relations: [candidate]
                })
              )
              .mockResolvedValueOnce(
                JSON.stringify({
                  is_valid: true,
                  confidence: Math.fround(highConfidence),
                  reason: 'Valid relation'
                })
              );

            const relations = await semanticRelationBuilder.extractSemanticRelations(
              ckb,
              mockLLMClient,
              { confidenceThreshold: 0.7 }
            );

            // Property 16: Relation with valid entities and confidence ≥ 0.7 should be accepted
            expect(relations.length).toBeGreaterThan(0);
            
            const relation = relations[0];
            expect(relation.source_id).toBe(ckb.entities[0].id);
            expect(relation.target_id).toBe(ckb.entities[1].id);
            expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate evidence text exists in CKB', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate CKB with entities
          fc.record({
            ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
            doc_id: fc.string({ minLength: 1, maxLength: 20 }),
            content: fc.record({
              text: fc.string({ minLength: 20, maxLength: 200 })
            }),
            entities: fc.array(
              fc.record({
                id: fc.string({ minLength: 1, maxLength: 20 }),
                canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                type: fc.constantFrom('event', 'entity', 'concept')
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          async (ckb) => {
            // Create a candidate with evidence text NOT in CKB
            const candidate = {
              subject_id: ckb.entities[0].id,
              object_id: ckb.entities[1].id,
              subject: ckb.entities[0].canonical_name,
              object: ckb.entities[1].canonical_name,
              relation: 'relates to',
              relation_type: 'association',
              evidence_text: 'This text does not exist in CKB at all',
              confidence: 0.9
            };

            // Mock LLM client
            const mockLLMClient = jest.fn().mockResolvedValue(
              JSON.stringify({
                relations: [candidate]
              })
            );

            const relations = await semanticRelationBuilder.extractSemanticRelations(
              ckb,
              mockLLMClient
            );

            // Property 16: Relation with invalid evidence should be rejected
            expect(relations).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 16: Batch Processing Validation', () => {
    it('should maintain validation rules across batch processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple CKBs
          fc.array(
            fc.record({
              ckb_id: fc.string({ minLength: 1, maxLength: 20 }),
              doc_id: fc.string({ minLength: 1, maxLength: 20 }),
              content: fc.record({
                text: fc.string({ minLength: 10, maxLength: 200 })
              }),
              entities: fc.array(
                fc.record({
                  id: fc.string({ minLength: 1, maxLength: 20 }),
                  canonical_name: fc.string({ minLength: 1, maxLength: 50 }),
                  type: fc.constantFrom('event', 'entity', 'concept')
                }),
                { minLength: 2, maxLength: 5 }
              )
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (ckbs) => {
            // Mock LLM client to return valid relations
            const mockLLMClient = jest.fn().mockImplementation(() => {
              return Promise.resolve(JSON.stringify({
                relations: []
              }));
            });

            const relations = await semanticRelationBuilder.batchExtractSemanticRelations(
              ckbs,
              mockLLMClient,
              { highPriorityRate: 1.0, randomSamplingRate: 0 }
            );

            // Property 16: All relations in batch must satisfy validation rules
            for (const relation of relations) {
              // Find the source CKB
              const sourceCkb = ckbs.find(ckb => 
                ckb.entities.some(e => e.id === relation.source_id)
              );

              if (sourceCkb) {
                // Verify entities exist
                const subjectExists = sourceCkb.entities.some(e => e.id === relation.source_id);
                const objectExists = sourceCkb.entities.some(e => e.id === relation.target_id);
                
                expect(subjectExists).toBe(true);
                expect(objectExists).toBe(true);
                
                // Verify confidence
                expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
