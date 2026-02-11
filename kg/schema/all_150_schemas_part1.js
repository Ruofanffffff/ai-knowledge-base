/**
 * Complete 150 Schema Definitions - Part 1: Software Development (11-50)
 */

const { createSchema } = require('./all_150_schemas_complete');

// Software Development Schemas (11-50)
const softwareSchemasPart2 = [
  // 11-20: Development Process
  createSchema({
    name: 'User-Story',
    entityType: 'UserStoryEntity',
    scene: '软件开发/流程',
    description: '用户故事 - 记录用户需求和验收标准',
    example: '作为用户，我希望能够重置密码，以便恢复账户访问',
    fields: [
      { name: 'Title', weight: 0.35, required: true, field_type: 'text', description: '故事标题', anchor: true },
      { name: 'AsA', weight: 0.2, required: false, field_type: 'text', description: '用户角色' },
      { name: 'IWant', weight: 0.2, required: false, field_type: 'text', description: '期望功能' },
      { name: 'SoThat', weight: 0.15, required: false, field_type: 'text', description: '业务价值' },
      { name: 'AcceptanceCriteria', weight: 0.1, required: false, field_type: 'list', description: '验收标准' }
    ]
  }),

  createSchema({
    name: 'Sprint',
    entityType: 'SprintEntity',
    scene: '软件开发/流程',
    description: '敏捷冲刺 - 记录Sprint的目标、时间和任务',
    example: 'Sprint 23: 2024-02-01至2024-02-14，目标：完成用户认证模块',
    threshold: 0.6,
    fields: [
      { name: 'SprintNumber', weight: 0.3, required: true, field_type: 'number', description: 'Sprint编号', anchor: true },
      { name: 'StartDate', weight: 0.2, required: true, field_type: 'date', description: '开始日期', anchor: true },
      { name: 'EndDate', weight: 0.2, required: false, field_type: 'date', description: '结束日期' },
      { name: 'Goal', weight: 0.2, required: false, field_type: 'text', description: 'Sprint目标' },
      { name: 'Tasks', weight: 0.1, required: false, field_type: 'list', description: '任务列表' }
    ]
  }),

  createSchema({
    name: 'Code-Review',
    entityType: 'CodeReviewEntity',
    scene: '软件开发/流程',
    description: '代码审查 - 记录代码审查的结果和建议',
    example: 'PR #456审查：发现3个问题，建议重构error handling',
    fields: [
      { name: 'ReviewID', weight: 0.3, required: true, field_type: 'text', description: '审查ID', anchor: true },
      { name: 'Reviewer', weight: 0.2, required: false, field_type: 'text', description: '审查人' },
      { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '审查状态' },
      { name: 'Issues', weight: 0.15, required: false, field_type: 'list', description: '发现的问题' },
      { name: 'Suggestions', weight: 0.15, required: false, field_type: 'list', description: '改进建议' }
    ]
  }),

  createSchema({
    name: 'Git-Commit',
    entityType: 'GitCommitEntity',
    scene: '软件开发/版本控制',
    description: 'Git提交 - 记录代码提交的信息',
    example: 'commit abc123: feat: add user authentication module',
    threshold: 0.6,
    fields: [
      { name: 'CommitHash', weight: 0.35, required: true, field_type: 'text', description: '提交哈希', anchor: true },
      { name: 'Message', weight: 0.25, required: true, field_type: 'text', description: '提交信息' },
      { name: 'Author', weight: 0.2, required: false, field_type: 'text', description: '作者' },
      { name: 'Date', weight: 0.1, required: false, field_type: 'date', description: '提交日期' },
      { name: 'Files', weight: 0.1, required: false, field_type: 'list', description: '修改的文件' }
    ]
  }),

  createSchema({
    name: 'Pull-Request',
    entityType: 'PullRequestEntity',
    scene: '软件开发/版本控制',
    description: '拉取请求 - 记录PR的信息和审查状态',
    example: 'PR #789: Add payment integration - 待审查',
    threshold: 0.6,
    fields: [
      { name: 'PRNumber', weight: 0.3, required: true, field_type: 'number', description: 'PR编号', anchor: true },
      { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: 'PR标题', anchor: true },
      { name: 'Author', weight: 0.15, required: false, field_type: 'text', description: '作者' },
      { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: 'PR状态' },
      { name: 'Reviewers', weight: 0.15, required: false, field_type: 'list', description: '审查人' }
    ]
  }),
