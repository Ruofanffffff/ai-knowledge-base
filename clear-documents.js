const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDocuments() {
  try {
    console.log('开始清空文档数据库...\n');

    // 1. 清空 Document 相关的所有数据
    console.log('1. 删除文档标签关联...');
    const deletedDocTags = await prisma.documentTag.d