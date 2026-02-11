/**
 * Document Service
 * Business logic for document operations
 */

class DocumentService {
  constructor(db) {
    this.db = db;
  }

  async getAllByUserId(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(this._mapDbToModel));
        }
      );
    });
  }

  async getByIdAndUserId(id, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM documents WHERE id = ? AND user_id = ?',
        [id, userId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve(this._mapDbToModel(row));
        }
      );
    });
  }

  async create(documentData) {
    return new Promise((resolve, reject) => {
      const { userId, title, content, type, fileType, metadata, tags } = documentData;
      const metadataStr = metadata ? JSON.stringify(metadata) : null;
      const tagsStr = tags ? JSON.stringify(tags) : null;
      
      this.db.run(
        `INSERT INTO documents (user_id, title, content, type, file_type, metadata, tags) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, content, type || 'document', fileType || '.md', metadataStr, tagsStr],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, ...documentData });
        }
      );
    });
  }

  async updateByIdAndUserId(id, userId, updateData) {
    return new Promise((resolve, reject) => {
      const { title, content, type, fileType, metadata, tags } = updateData;
      const metadataStr = metadata ? JSON.stringify(metadata) : null;
      const tagsStr = tags ? JSON.stringify(tags) : null;
      
      this.db.run(
        `UPDATE documents 
         SET title = ?, content = ?, type = ?, file_type = ?, metadata = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [title, content, type, fileType, metadataStr, tagsStr, id, userId],
        function(err) {
          if (err) return reject(err);
          if (this.changes === 0) return resolve(null);
          resolve({ id, ...updateData });
        }
      );
    });
  }

  async deleteByIdAndUserId(id, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM documents WHERE id = ? AND user_id = ?',
        [id, userId],
        function(err) {
          if (err) return reject(err);
          resolve(this.changes > 0);
        }
      );
    });
  }

  _mapDbToModel(row) {
    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content,
      type: row.type,
      fileType: row.file_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = DocumentService;
