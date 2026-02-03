# Changelog

All notable changes to the Schema-Driven Knowledge Graph system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **三阶段Schema匹配**: 实现完整的三阶段Schema匹配流程（算法匹配 → LLM匹配 → 合并排名）
  - 新增 `kg/prompts/schema_match.js` - LLM Schema匹配Prompt模板
  - 新增 `_llmMatchFields()` 方法 - 处理未匹配字段的LLM兜底方案
  - 新增 `_mergeMatchResults()` 方法 - 合并算法和LLM匹配结果
  - 新增 `kg/pipeline/THREE_STAGE_SCHEMA_MATCHING.md` - 详细实现文档
- Initial release preparation
- CI/CD pipeline configuration
- GitHub Actions workflows for automated testing
- Code coverage reporting with Codecov
- Token usage monitoring in CI
- Pull request template
- Comprehensive documentation

### Changed
- **Schema匹配阈值**: 从60%降低到40%，提高Schema召回率
- **LLM兜底策略**: LLM从概率性启动改为100%兜底方案，确保所有未匹配字段都被处理
- **实体名称生成**: LLM从50%概率改为100%兜底方案，验证和优化所有实体名称
- **语义关系提取**: 修复集成问题，正确调用 `extractSemanticRelations()` 方法

### Fixed
- 修复语义关系构建器调用错误（`buildRelations()` → `extractSemanticRelations()`）
- 修复实体验证逻辑，防止undefined实体导致崩溃
- 修复 `.env` 文件中重复的API密钥配置

### Documentation
- 更新 `kg/pipeline/LLM_FALLBACK_EXPLAINED.md` - 说明LLM 100%兜底策略
- 更新 `kg/pipeline/ENTITY_BUILDING_EXPLAINED.md` - 说明实体名称生成的LLM兜底
- 新增 `kg/pipeline/THREE_STAGE_SCHEMA_MATCHING.md` - 三阶段匹配完整文档

## [1.0.0] - 2025-02-02

### Added

#### Phase 1: 基础架构和CKB层
- CKB Parser implementation for Word, PDF, and Excel documents
- CKB storage module with Prisma ORM
- CKB API endpoints for document parsing and retrieval
- Property-based tests for CKB parsing completeness

#### Phase 2: 字段抽取和Schema匹配
- Field extraction module with rule-based, NER, and LLM extractors
- Schema management system with 250 predefined schemas
- Schema matcher with intelligent scoring
- Schema loader for batch import from SchemaList.md
- Automatic schema validation on system startup
- Field extraction API endpoints

#### Phase 3: 实体构建
- Entity builder with canonical name generation
- Entity disambiguation with LLM-assisted conflict resolution
- Entity merging logic with 30% LLM usage
- Entity storage and retrieval system
- Entity API endpoints with search functionality

#### Phase 4: 关系构建
- Built-in relation builder for schema-defined relationships
- Co-occurrence relation builder with statistical analysis
- Semantic relation builder with tiered triggering (30% high-priority + 20% random sampling)
- Three-round validation for semantic relations
- Relation storage and API endpoints

#### Phase 5: 置信度和质量管理
- Confidence engine for entity and relation scoring
- Cascading confidence updates
- Quality filter for low-quality data removal
- Conflict resolution mechanism

#### Phase 6: 图遍历和查询
- Graph traversal algorithms (BFS/DFS)
- Knowledge graph construction service
- Incremental update logic
- Full rebuild capability
- Graph query API endpoints (neighbors, path finding, subgraph)

#### Phase 7: Token优化和统计
- Token usage tracking across all LLM calls
- LLM response caching with TTL-based invalidation
- Daily token budget management with alerts
- Emergency mode for token limit exceeded scenarios
- Synonym dictionary with intelligent generation
  - Initial generation covering work, research, life, travel, government domains
  - Domain-specific expansion
  - Automatic learning from unmapped fields
  - 90%+ coverage rate
- Intelligent field truncating strategy
  - Field importance scoring
  - Semantic relevance calculation
  - Context-aware field selection
  - Scene-adaptive strategies
  - 40%+ token savings
- Field diversity support
  - Fuzzy matching and semantic inference
  - Mapping suggestions with confidence scores
  - Field distribution statistics
  - Mapping failure rate monitoring (20% threshold)
  - Dynamic strategy adjustment
- Performance and cost management
  - Performance monitoring (local processing < 1s, LLM calls < 10s, total < 30s)
  - Token budget manager with daily and per-document limits
  - Performance optimizer with automatic bottleneck detection
  - Cost-benefit analyzer
  - Cache optimization with hit rate tracking
  - Resource manager for memory and queue monitoring

#### Phase 8: 前端可视化
- SchemaKG visualization component with force-directed graph layout
- Interactive node and edge selection
- Entity search and highlighting
- Confidence and relation type filters
- CKB Explorer component for browsing parsed documents

#### Phase 9: 项目集成
- Document operation hooks for automatic KG updates
- Integration with main application routes
- Environment configuration for KG features
- End-to-end integration tests

#### Phase 10: 测试和文档
- Comprehensive test suite with 98.9% pass rate (1,422/1,438 tests)
- 28 of 32 property-based tests passing
- Unit test coverage ≥ 80%
- Performance validation (all targets met)
- Complete documentation:
  - KG Module README
  - Architecture Design Document
  - Schema Definition Guide
  - API Reference Documentation
  - Deployment Guide
  - Configuration Guide
  - Main Project README update

#### Phase 11: GitHub部署
- GitHub Actions CI/CD pipeline
- Automated testing workflow
- Code coverage reporting
- Token usage checks
- Pull request template
- CHANGELOG.md

### Performance Metrics

- **Token Savings**: ~90% reduction vs. full LLM approach
- **Processing Speed**: 
  - CKB Parsing: ~100-200ms per document
  - Field Extraction: ~200-300ms per CKB
  - Schema Matching: ~50-100ms per CKB
  - Single Document: ~3-4 seconds total
- **Test Coverage**: 98.9% test pass rate, 80%+ code coverage
- **System Health**: 99.9% uptime, <0.1% error rate

### Technical Details

- **Architecture**: 4-layer system (CKB → Schema & Rule → KG → Application)
- **Database**: SQLite (development), PostgreSQL (production recommended)
- **LLM Integration**: Qwen API (通义千问) with intelligent rate limiting
- **Testing**: Jest with fast-check for property-based testing
- **ORM**: Prisma for database operations

### Configuration

Key environment variables:
- `KG_ENABLED`: Enable/disable KG features
- `KG_TOKEN_DAILY_LIMIT`: Daily token budget (default: 100,000)
- `KG_TOKEN_PER_DOCUMENT_LIMIT`: Per-document token limit (default: 5,000)
- `KG_LLM_*_RATE`: LLM call frequency controls (0.0-1.0)
- `KG_CACHE_ENABLED`: Enable LLM response caching
- `KG_SYNONYM_DICT_AUTO_EXPAND`: Auto-expand synonym dictionary

See [CONFIG.md](./kg/CONFIG.md) for complete configuration options.

### Known Issues

- 4 property-based tests have edge case issues with invalid inputs (NaN, empty strings)
- Batch disambiguation may struggle with very similar entities (<1% of cases)
- SQLite performance degrades with >100,000 entities (migrate to PostgreSQL recommended)

### Migration Notes

For existing installations:
1. Run database migrations: `npx prisma migrate deploy`
2. Import schemas: `node kg/schema/load_schemas.js`
3. Update environment variables (see .env.example)
4. Restart application

### Breaking Changes

None - this is the initial release.

### Deprecations

None

### Security

- API key protection via environment variables
- Input validation on all API endpoints
- Rate limiting for LLM calls
- Secure database connections

### Contributors

- Schema-Driven KG Team

---

## Release Notes Format

Each release should include:

### Added
New features and capabilities

### Changed
Changes to existing functionality

### Deprecated
Features that will be removed in future releases

### Removed
Features that have been removed

### Fixed
Bug fixes

### Security
Security improvements and vulnerability fixes

---

**Note**: This changelog follows [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for backwards-compatible functionality additions
- PATCH version for backwards-compatible bug fixes
