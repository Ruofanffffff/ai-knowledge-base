#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Initializing database...');

try {
  // 创建必要的目录
  const dirs = ['prisma', 'src', 'src/ai', 'uploads', 'scripts'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // 检查是否已存在Prisma schema文件
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.error('Prisma schema file not found!');
    console.error('Please ensure prisma/schema.prisma exists.');
    process.exit(1);
  }

  // 初始化Prisma
  console.log('Initializing Prisma...');
  execSync('npx prisma init --datasource-provider sqlite', { stdio: 'inherit' });

  // 创建数据库
  console.log('Creating database...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // 生成Prisma客户端
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // 创建示例数据
  console.log('Creating sample data...');
  createSampleData();

  console.log('Database initialization completed successfully!');
  
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
}

function createSampleData() {
  try {
    // 创建示例标签
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 创建示例数据（异步执行）
    (async () => {
      try {
        // 创建示例标签
        const tags = await prisma.tag.createMany({
          data: [
            { name: '前端', color: '#1890ff', description: '前端开发相关内容' },
            { name: '后端', color: '#52c41a', description: '后端开发相关内容' },
            { name: 'AI', color: '#faad14', description: '人工智能相关内容' },
            { name: '数据库', color: '#f5222d', description: '数据库相关内容' },
            { name: '笔记', color: '#722ed1', description: '个人笔记' }
          ],
          skipDuplicates: true
        });
        console.log(`Created ${tags.count} sample tags`);

        // 创建示例文档
        const documents = await prisma.document.createMany({
          data: [
            {
              title: 'React学习笔记',
              content: 'React是一个用于构建用户界面的JavaScript库。它由Facebook开发，用于构建交互式的UI。',
              type: 'document',
              fileType: '.md',
              metadata: { source: 'manual', tags: ['前端', 'React'] },
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              title: 'SQLite数据库使用指南',
              content: 'SQLite是一个轻量级的关系型数据库，无需服务器即可运行。',
              type: 'document',
              fileType: '.md',
              metadata: { source: 'manual', tags: ['数据库', 'SQLite'] },
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              title: 'AI语义搜索原理',
              content: '语义搜索是基于自然语言理解的搜索技术，能够理解用户的意图并返回相关结果。',
              type: 'document',
              fileType: '.md',
              metadata: { source: 'manual', tags: ['AI', '搜索'] },
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          skipDuplicates: true
        });
        console.log(`Created ${documents.count} sample documents`);

        // 创建文档标签关联
        const allDocuments = await prisma.document.findMany();
        const allTags = await prisma.tag.findMany();
        
        for (const doc of allDocuments) {
          // 为每个文档随机分配1-2个标签
          const randomTags = allTags
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.floor(Math.random() * 2) + 1);
          
          for (const tag of randomTags) {
            await prisma.documentTag.create({
              data: {
                documentId: doc.id,
                tagId: tag.id
              }
            });
          }
        }

        console.log('Sample data created successfully!');
      } catch (error) {
        console.error('Error creating sample data:', error.message);
      } finally {
        await prisma.$disconnect();
      }
    })();
    
  } catch (error) {
    console.error('Error in createSampleData:', error.message);
  }
}