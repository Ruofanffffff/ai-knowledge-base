/**
 * Create domain-specific schemas for better entity and relation extraction
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const schemas = [
  // 项目Schema
  {
    name: 'Project-Entity',
    entityType: 'ProjectEntity',
    scene: '项目管理',
    coreFields: [
      { name: '项目名称', weight: 0.4, required: true, description: '项目名称' },
      { name: '时间', weight: 0.2, required: false, description: '项目时间' },
      { name: '地点', weight: 0.2, required: false, description: '项目地点' },
      { name: 'content', weight: 0.2, required: false, description: '项目描述' }
    ],
    anchorFields: ['项目', '工程', '建设', '施工'],
    threshold: 0.4,
    relations: [
      {
        type: 'located_in',
        relation_type_id: 'residence_live_in',
        target_field: '地点',
        field_aliases: ['地点', '位置', '地址', 'location'],
        direction: 'outgoing',
        description: '项目位于某地'
      },
      {
        type: 'participate',
        relation_type_id: 'work_participate',
        target_field: '执行单位',
        field_aliases: ['执行单位', '参与单位', '施工单位', '承建单位'],
        direction: 'incoming',
        description: '单位参与项目'
      },
      {
        type: 'lead',
        relation_type_id: 'work_lead',
        target_field: '负责单位',
        field_aliases: ['负责单位', '主管单位', '牵头单位', '领导单位'],
        direction: 'incoming',
        description: '单位负责项目'
      }
    ],
    description: '项目实体，包含项目名称、时间、地点等信息'
  },
  
  // 组织/公司Schema
  {
    name: 'Organization-Entity',
    entityType: 'OrganizationEntity',
    scene: '组织机构',
    coreFields: [
      { name: 'content', weight: 0.6, required: true, description: '组织名称' },
      { name: '地点', weight: 0.2, required: false, description: '组织所在地' },
      { name: '类型', weight: 0.2, required: false, description: '组织类型' }
    ],
    anchorFields: ['公司', '企业', '单位', '机构', '部门'],
    threshold: 0.3,
    relations: [
      {
        type: 'located_in',
        relation_type_id: 'residence_live_in',
        target_field: '地点',
        field_aliases: ['地点', '位置', '地址', '所在地', 'location'],
        direction: 'outgoing',
        description: '组织位于某地'
      },
      {
        type: 'cooperate',
        relation_type_id: 'work_cooperate',
        target_field: '合作单位',
        field_aliases: ['合作单位', '合作方', '合作伙伴', '协作单位'],
        direction: 'outgoing',
        description: '组织间合作关系'
      }
    ],
    description: '组织机构实体，包括公司、政府部门等'
  },
  
  // 地点Schema
  {
    name: 'Location-Entity',
    entityType: 'LocationEntity',
    scene: '地理位置',
    coreFields: [
      { name: 'content', weight: 0.7, required: true, description: '地点名称' },
      { name: '地点', weight: 0.3, required: false, description: '详细地址' }
    ],
    anchorFields: ['省', '市', '区', '县', '路', '街道', '地区'],
    threshold: 0.3,
    relations: [
      {
        type: 'contains',
        relation_type_id: 'travel_pass_through',
        target_field: '下级地点',
        field_aliases: ['下级地点', '包含地点', '子地点'],
        direction: 'outgoing',
        description: '地点包含关系'
      }
    ],
    description: '地理位置实体'
  },
  
  // 时间事件Schema
  {
    name: 'Time-Event-Entity',
    entityType: 'EventEntity',
    scene: '时间事件',
    coreFields: [
      { name: '时间', weight: 0.4, required: true, description: '事件时间' },
      { name: 'content', weight: 0.6, required: true, description: '事件描述' }
    ],
    anchorFields: ['年', '月', '日', '时间', '期间'],
    threshold: 0.4,
    relations: [
      {
        type: 'occurs_at',
        relation_type_id: 'travel_arrive',
        target_field: '地点',
        field_aliases: ['地点', '位置', '发生地', 'location'],
        direction: 'outgoing',
        description: '事件发生地点'
      }
    ],
    description: '时间相关的事件实体'
  },
  
  // 文档/方案Schema
  {
    name: 'Document-Entity',
    entityType: 'DocumentEntity',
    scene: '文档方案',
    coreFields: [
      { name: 'content', weight: 0.5, required: true, description: '文档名称或描述' },
      { name: '时间', weight: 0.2, required: false, description: '文档时间' },
      { name: 'title', weight: 0.3, required: false, description: '文档标题' }
    ],
    anchorFields: ['方案', '报告', '文档', '计划', '总结'],
    threshold: 0.3,
    relations: [
      {
        type: 'related_to',
        relation_type_id: 'work_participate',
        target_field: '项目名称',
        field_aliases: ['项目名称', '项目', '相关项目'],
        direction: 'outgoing',
        description: '文档关联的项目'
      },
      {
        type: 'formulate',
        relation_type_id: 'gov_formulate',
        target_field: '制定单位',
        field_aliases: ['制定单位', '编制单位', '发布单位', '起草单位'],
        direction: 'incoming',
        description: '单位制定文档'
      }
    ],
    description: '文档、方案、报告等实体'
  }
];

async function createSchemas() {
  try {
    let created = 0;
    let updated = 0;
    
    for (const schemaData of schemas) {
      const existing = await prisma.schema.findUnique({
        where: { name: schemaData.name }
      });
      
      const data = {
        id: existing?.id || uuidv4(),
        name: schemaData.name,
        entityType: schemaData.entityType,
        scene: schemaData.scene,
        coreFields: JSON.stringify(schemaData.coreFields),
        threshold: schemaData.threshold,
        relations: schemaData.relations ? JSON.stringify(schemaData.relations) : null,
        exampleDescription: null,
        description: schemaData.description,
        anchorFields: schemaData.anchorFields ? JSON.stringify(schemaData.anchorFields) : JSON.stringify([schemaData.coreFields[0].name]),
        anchorConfig: null,
        version: '1.0.0',
        active: true
      };
      
      if (existing) {
        await prisma.schema.update({
          where: { name: schemaData.name },
          data
        });
        updated++;
        console.log(`✓ Updated: ${schemaData.name}`);
      } else {
        await prisma.schema.create({ data });
        created++;
        console.log(`✓ Created: ${schemaData.name}`);
      }
    }
    
    const total = await prisma.schema.count({ where: { active: true } });
    console.log(`\nTotal active schemas: ${total}`);
    console.log(`Created: ${created}, Updated: ${updated}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSchemas();
