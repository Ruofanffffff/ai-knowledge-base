const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data/users.db');
const DATA_FILE = path.join(__dirname, 'data/documents.json');

function migrateDocumentsToAdmin() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      process.exit(1);
    }
    console.log('Connected to the SQLite database.');
  });

  // 首先获取 admin 用户的 ID
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, adminRow) => {
    if (err) {
      console.error('Error fetching admin user:', err.message);
      db.close();
      process.exit(1);
    }

    if (!adminRow) {
      console.error('Admin user not found. Please ensure the admin user exists.');
      db.close();
      process.exit(1);
    }

    const adminUserId = adminRow.id;
    console.log('Found admin user with ID:', adminUserId);

    // 读取现有文档
    let documents = [];
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        documents = JSON.parse(data);
        console.log(`Loaded ${documents.length} documents from ${DATA_FILE}`);
      } else {
        console.log('No existing documents file found.');
        db.close();
        return;
      }
    } catch (error) {
      console.error('Error reading documents file:', error.message);
      db.close();
      process.exit(1);
    }

    if (documents.length === 0) {
      console.log('No documents to migrate.');
      db.close();
      return;
    }

    // 开始迁移文档
    let migratedCount = 0;
    let skippedCount = 0;

    db.serialize(() => {
      // 检查是否已经迁移过文档
      db.get('SELECT COUNT(*) as count FROM documents WHERE user_id = ?', [adminUserId], (err, row) => {
        if (err) {
          console.error('Error checking existing documents:', err.message);
          db.close();
          process.exit(1);
        }

        if (row.count > 0) {
          console.log(`Admin user already has ${row.count} documents in the database.`);
          console.log('Skipping migration to avoid duplicates.');
          db.close();
          return;
        }

        // 开始迁移
        console.log('Starting document migration...');

        documents.forEach((doc) => {
          const stmt = db.prepare(`
            INSERT INTO documents (
              user_id, title, content, type, file_type, 
              metadata, tags, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : null;
          const tagsJson = doc.tags ? JSON.stringify(doc.tags) : null;

          stmt.run(
            adminUserId,
            doc.title,
            doc.content || '',
            doc.type || 'document',
            doc.fileType || '.md',
            metadataJson,
            tagsJson,
            doc.createdAt || new Date().toISOString(),
            doc.updatedAt || new Date().toISOString(),
            function(err) {
              if (err) {
                console.error(`Error migrating document "${doc.title}":`, err.message);
                skippedCount++;
              } else {
                migratedCount++;
                console.log(`Migrated document: ${doc.title} (ID: ${this.lastID})`);
              }

              // 检查是否所有文档都已处理
              if (migratedCount + skippedCount === documents.length) {
                console.log('\n=== Migration Summary ===');
                console.log(`Total documents: ${documents.length}`);
                console.log(`Successfully migrated: ${migratedCount}`);
                console.log(`Skipped: ${skippedCount}`);
                
                // 备份原始文件
                const backupFile = DATA_FILE + '.backup';
                try {
                  fs.copyFileSync(DATA_FILE, backupFile);
                  console.log(`\nOriginal documents file backed up to: ${backupFile}`);
                } catch (backupErr) {
                  console.error('Warning: Failed to create backup:', backupErr.message);
                }

                db.close((err) => {
                  if (err) {
                    console.error('Error closing database:', err.message);
                  } else {
                    console.log('\nMigration completed successfully!');
                    console.log('You can now delete or rename the original documents.json file if desired.');
                  }
                });
              }
            }
          );

          stmt.finalize();
        });
      });
    });
  });
}

// 执行迁移
migrateDocumentsToAdmin();
