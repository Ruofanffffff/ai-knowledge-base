const { PrismaClient } = require('@prisma/client');
const { CoverGenerationService } = require('../services/coverGenerationService');
const { JimengClient } = require('../services/jimengClient');
const { notesConfig } = require('../config/notes.config');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const kgPrisma = new PrismaClient();
const dbPath = path.join(__dirname, '..', 'data', 'users.db');
const db = new sqlite3.Database(dbPath);

const coverConfig = notesConfig.coverGeneration;
console.log('API Key configured:', !!coverConfig.apiKey);
console.log('Model:', coverConfig.model);
console.log('Base URL:', coverConfig.baseURL);

const jimengClient = new JimengClient({
  apiKey: coverConfig.apiKey,
  model: coverConfig.model,
  baseURL: coverConfig.baseURL,
  imageSize: coverConfig.imageSize,
  timeout: coverConfig.timeout,
  maxRetries: coverConfig.maxRetries,
});

const service = new CoverGenerationService({
  jimengClient,
  kgPrisma,
  db,
  pipelineTimeout: coverConfig.pipelineTimeout,
});

console.log('Starting cover generation for postId=1, documentId=78...');
service.generateCover(1, 78).then(() => {
  console.log('Done! Checking result...');
  db.get('SELECT cover_image FROM community_posts WHERE id = 1', (err, row) => {
    console.log('cover_image:', row ? row.cover_image : 'NOT FOUND');
    kgPrisma.$disconnect();
    db.close();
  });
}).catch(err => {
  console.error('Failed:', err.message);
  kgPrisma.$disconnect();
  db.close();
});
