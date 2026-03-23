/**
 * Community Routes
 * 
 * 社区知识分享相关 API 路由
 * 实现文档发布到社区的功能
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../services/authService');
const { initDatabase } = require('../database/initUserDB');
const { CoverGenerationService } = require('../services/coverGenerationService');
const { JimengClient } = require('../services/jimengClient');
const { notesConfig } = require('../config/notes.config');
const fragmentCollector = require('../services/fragmentCollector');

let db;
let coverGenerationService = null;

/**
 * 从 TipTap/ProseMirror JSON content 中提取纯文本
 */
function extractTextFromContent(content) {
  if (!content) return '';
  try {
    const doc = typeof content === 'string' ? JSON.parse(content) : content;
    if (!doc || !doc.content) return typeof content === 'string' ? content.substring(0, 200) : '';
    
    function walkNodes(nodes) {
      let text = '';
      for (const node of nodes) {
        if (node.text) {
          text += node.text;
        }
        if (node.content) {
          text += walkNodes(node.content);
        }
        if (node.type === 'paragraph' || node.type === 'heading') {
          text += ' ';
        }
      }
      return text;
    }
    
    return walkNodes(doc.content).trim().substring(0, 200);
  } catch {
    // 如果不是 JSON，直接截取
    return typeof content === 'string' ? content.substring(0, 200) : '';
  }
}

/**
 * 从 TipTap/ProseMirror JSON content 中提取所有图片 URL
 * 支持 imageBlock 节点（attrs.src）
 */
function extractImagesFromContent(content) {
  if (!content) return [];
  try {
    const doc = typeof content === 'string' ? JSON.parse(content) : content;
    if (!doc || !doc.content) return [];
    
    const images = [];
    function walkNodes(nodes) {
      for (const node of nodes) {
        if (node.type === 'imageBlock' && node.attrs && node.attrs.src) {
          images.push(node.attrs.src);
        }
        if (node.content) {
          walkNodes(node.content);
        }
      }
    }
    walkNodes(doc.content);
    return images;
  } catch {
    return [];
  }
}

let kgPrisma;

function initCommunityRoutes(externalDb, prismaClient) {
  db = externalDb || initDatabase();
  kgPrisma = prismaClient;

  // 初始化封面生成服务（仅当 VOLCENGINE_API_KEY 存在时）
  const coverConfig = notesConfig.coverGeneration;
  if (coverConfig.apiKey) {
    const jimengClient = new JimengClient({
      apiKey: coverConfig.apiKey,
      model: coverConfig.model,
      baseURL: coverConfig.baseURL,
      imageSize: coverConfig.imageSize,
      timeout: coverConfig.timeout,
      maxRetries: coverConfig.maxRetries,
    });
    coverGenerationService = new CoverGenerationService({
      jimengClient,
      kgPrisma: prismaClient,
      db,
      pipelineTimeout: coverConfig.pipelineTimeout,
    });
    console.log('[CoverGen] 封面生成服务已初始化');
  } else {
    console.warn('[CoverGen] VOLCENGINE_API_KEY 未配置，封面生成服务未启用');
  }

  return router;
}

/**
 * POST /api/community/publish
 * 发布内容到社区
 * 
 * Body: { items: { id: number, type: 'document'|'note' }[], isPublic: boolean }
 * 兼容旧版: { documentIds: number[], isPublic: boolean }
 * Response: { success: true, data: { published: [...], skipped: [...] } }
 */
router.post('/publish', authMiddleware, requirePermission('community:publish'), (req, res) => {
  try {
    const { documentIds, items, isPublic = false } = req.body;
    const userId = req.userId;

    let publishItems = [];
    if (items && Array.isArray(items)) {
      publishItems = items;
    } else if (documentIds && Array.isArray(documentIds)) {
      publishItems = documentIds.map(id => ({ id, type: 'document' }));
    }

    if (!publishItems || publishItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要发布的内容ID'
      });
    }

    const published = [];
    const skipped = [];
    let processed = 0;

    publishItems.forEach((item) => {
      const numericId = parseInt(item.id, 10);
      const sourceType = item.type === 'note' ? 'note' : 'document';
      
      if (isNaN(numericId)) {
        skipped.push({ id: item.id, reason: '无效的内容ID' });
        processed++;
        if (processed === publishItems.length) {
          return res.json({ success: true, data: { published, skipped } });
        }
        return;
      }

      const table = sourceType === 'note' ? 'notes' : 'documents';
      
      db.get(
        `SELECT id, title, content, tags FROM ${table} WHERE id = ?`,
        [numericId],
        (err, doc) => {
          if (err) {
            console.error('查询内容失败:', err);
            skipped.push({ id: item.id, reason: '查询失败' });
            processed++;
            if (processed === publishItems.length) return res.json({ success: true, data: { published, skipped } });
            return;
          }

          if (!doc) {
            skipped.push({ id: item.id, reason: '内容不存在' });
            processed++;
            if (processed === publishItems.length) return res.json({ success: true, data: { published, skipped } });
            return;
          }

          db.get(
            'SELECT id FROM community_posts WHERE source_type = ? AND source_id = ?',
            [sourceType, numericId],
            (err, existing) => {
              if (err) {
                console.error('查询社区帖子失败:', err);
                skipped.push({ id: item.id, reason: '查询帖子失败' });
                processed++;
                if (processed === publishItems.length) return res.json({ success: true, data: { published, skipped } });
                return;
              }

              if (existing) {
                skipped.push({ id: item.id, reason: '已发布' });
                processed++;
                if (processed === publishItems.length) return res.json({ success: true, data: { published, skipped } });
                return;
              }

              const summary = extractTextFromContent(doc.content);
              const contentImages = extractImagesFromContent(doc.content);
              const coverImage = contentImages.length > 0
                ? contentImages[Math.floor(Math.random() * contentImages.length)]
                : null;

              // legacy document_id support
              const documentIdVal = sourceType === 'document' ? numericId : null;

              db.run(
                `INSERT INTO community_posts (user_id, document_id, source_type, source_id, title, summary, cover_image, tags, likes, view_count, status, is_public)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'published', ?)`,
                [userId, documentIdVal, sourceType, numericId, doc.title, summary, coverImage, doc.tags, isPublic ? 1 : 0],
                function (err) {
                  if (err) {
                    console.error('插入社区帖子失败:', err);
                    skipped.push({ id: item.id, reason: '插入失败' });
                    processed++;
                    if (processed === publishItems.length) return res.json({ success: true, data: { published, skipped } });
                    return;
                  }

                  const postId = this.lastID;

                  if (!coverImage && coverGenerationService && sourceType === 'document') {
                    coverGenerationService.generateCover(postId, numericId)
                      .catch(err => console.error('[CoverGen] 封面生成失败:', err.message));
                  }

                  setImmediate(() => {
                    const fragmentContent = [doc.title, summary].filter(Boolean).join(' ');
                    fragmentCollector.collect({
                      userId,
                      fragmentType: 'community_publish',
                      content: fragmentContent,
                      sourceId: String(postId),
                      sourceMeta: { title: doc.title, summary, sourceId: numericId, sourceType }
                    }).catch(err => console.error('[FragmentCollector] community_publish collection error:', err));
                  });

                  published.push({
                    id: postId,
                    sourceId: numericId,
                    sourceType,
                    title: doc.title
                  });
                  processed++;
                  if (processed === publishItems.length) {
                    return res.json({ success: true, data: { published, skipped } });
                  }
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('发布内容到社区失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/community/posts
 * 获取社区帖子列表（分页、排序、过滤、搜索）
 * 
 * Query: page, limit, sort (latest|hottest), filter (mine), search
 * Response: { success: true, data: { posts, total, page, limit } }
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
router.get('/posts', authMiddleware, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const sort = req.query.sort === 'hottest' ? 'hottest' : 'latest';
    const filter = req.query.filter;
    const search = req.query.search;
    const userId = req.userId;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = ["cp.status = 'published'"];
    const params = [];

    if (filter === 'mine') {
      conditions.push('cp.user_id = ?');
      params.push(userId);
    } else if (filter === 'following') {
      conditions.push('cp.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = ?)');
      params.push(userId);
    }

    if (filter === 'liked') {
      conditions.push('cl.id IS NOT NULL');
    }

    if (search) {
      conditions.push('(cp.title LIKE ? OR cp.summary LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const orderBy = sort === 'hottest' ? 'cp.likes DESC' : 'cp.created_at DESC';

    let countSql;
    let countParams;
    
    if (filter === 'liked') {
      countSql = `
        SELECT COUNT(*) as total 
        FROM community_posts cp
        LEFT JOIN community_likes cl ON cl.post_id = cp.id AND cl.user_id = ?
        WHERE cp.status = 'published' AND cl.id IS NOT NULL
      `;
      countParams = [userId];
    } else {
      countSql = `SELECT COUNT(*) as total FROM community_posts cp ${whereClause}`;
      countParams = params;
    }

    db.get(countSql, countParams, (err, countRow) => {
      if (err) {
        console.error('查询帖子总数失败:', err);
        return res.status(500).json({
          success: false,
          error: '服务器内部错误'
        });
      }

      const total = countRow ? countRow.total : 0;

      // Query posts with JOIN
      const querySql = `
        SELECT cp.*,
               u.username AS authorName,
               u.avatar AS authorAvatar,
               CASE WHEN cl.id IS NOT NULL THEN 1 ELSE 0 END AS isLiked,
               CASE WHEN cb.id IS NOT NULL THEN 1 ELSE 0 END AS isBookmarked,
               (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS commentCount
        FROM community_posts cp
        LEFT JOIN users u ON cp.user_id = u.id
        LEFT JOIN community_likes cl ON cl.post_id = cp.id AND cl.user_id = ?
        LEFT JOIN community_bookmarks cb ON cb.post_id = cp.id AND cb.user_id = ?
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

      const queryParams = [userId, userId, ...params, limit, offset];

      db.all(querySql, queryParams, (err, rows) => {
        if (err) {
          console.error('查询帖子列表失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        const posts = (rows || []).map(row => ({
          id: row.id,
          userId: row.user_id,
          documentId: row.document_id, // legacy
          sourceType: row.source_type,
          sourceId: row.source_id,
          title: row.title,
          summary: row.summary,
          coverImage: row.cover_image,
          tags: row.tags,
          likes: row.likes,
          viewCount: row.view_count,
          status: row.status,
          isPublic: row.is_public === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          authorName: row.authorName,
          authorAvatar: row.authorAvatar,
          isLiked: row.isLiked === 1,
          isBookmarked: row.isBookmarked === 1,
          commentCount: row.commentCount || 0
        }));

        res.json({
          success: true,
          data: { posts, total, page, limit }
        });
      });
    });
  } catch (error) {
    console.error('获取社区帖子列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/community/posts/:id/like
 * 切换点赞状态（toggle）
 * 
 * Response: { success: true, data: { liked: boolean, likes: number } }
 * 
 * Validates: Requirements 4.1, 4.2, 4.3
 */
router.post('/posts/:id/like', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    // 先检查帖子是否存在（含标题、摘要和作者信息，用于碎片采集）
    db.get(
      `SELECT cp.id, cp.likes, cp.title, cp.summary, cp.user_id,
              u.username AS authorName
       FROM community_posts cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ?`,
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        // 查询是否已点赞
        db.get(
          'SELECT id FROM community_likes WHERE user_id = ? AND post_id = ?',
          [userId, postId],
          (err, existingLike) => {
            if (err) {
              console.error('查询点赞记录失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }

            if (existingLike) {
              // 已点赞 → 取消点赞
              db.run(
                'DELETE FROM community_likes WHERE user_id = ? AND post_id = ?',
                [userId, postId],
                (err) => {
                  if (err) {
                    console.error('删除点赞记录失败:', err);
                    return res.status(500).json({
                      success: false,
                      error: '服务器内部错误'
                    });
                  }

                  db.run(
                    'UPDATE community_posts SET likes = likes - 1 WHERE id = ?',
                    [postId],
                    (err) => {
                      if (err) {
                        console.error('更新点赞数失败:', err);
                        return res.status(500).json({
                          success: false,
                          error: '服务器内部错误'
                        });
                      }

                      // 查询更新后的 likes 数
                      db.get(
                        'SELECT likes FROM community_posts WHERE id = ?',
                        [postId],
                        (err, updated) => {
                          if (err) {
                            console.error('查询更新后点赞数失败:', err);
                            return res.status(500).json({
                              success: false,
                              error: '服务器内部错误'
                            });
                          }

                          res.json({
                            success: true,
                            data: { liked: false, likes: updated.likes }
                          });
                        }
                      );
                    }
                  );
                }
              );
            } else {
              // 未点赞 → 点赞
              db.run(
                'INSERT INTO community_likes (user_id, post_id) VALUES (?, ?)',
                [userId, postId],
                (err) => {
                  if (err) {
                    console.error('插入点赞记录失败:', err);
                    return res.status(500).json({
                      success: false,
                      error: '服务器内部错误'
                    });
                  }

                  db.run(
                    'UPDATE community_posts SET likes = likes + 1 WHERE id = ?',
                    [postId],
                    (err) => {
                      if (err) {
                        console.error('更新点赞数失败:', err);
                        return res.status(500).json({
                          success: false,
                          error: '服务器内部错误'
                        });
                      }

                      // 查询更新后的 likes 数
                      db.get(
                        'SELECT likes FROM community_posts WHERE id = ?',
                        [postId],
                        (err, updated) => {
                          if (err) {
                            console.error('查询更新后点赞数失败:', err);
                            return res.status(500).json({
                              success: false,
                              error: '服务器内部错误'
                            });
                          }

                          // 异步采集 community_like 碎片（不阻塞主请求）
                          process.nextTick(() => {
                            const postTitle = post.title || '';
                            const postSummary = post.summary || '';
                            const postAuthor = post.authorName || '';
                            fragmentCollector.collect({
                              userId,
                              fragmentType: 'community_like',
                              content: `点赞: ${postTitle} - ${postSummary}`,
                              sourceId: String(postId),
                              sourceMeta: { postTitle, postAuthor }
                            }).catch(err => console.error('[FragmentCollector] community_like collection error:', err));
                          });

                          res.json({
                            success: true,
                            data: { liked: true, likes: updated.likes }
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('切换点赞状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/community/posts/:id/bookmark
 * 切换收藏状态（toggle）
 *
 * Response: { success: true, data: { bookmarked: boolean } }
 *
 * Validates: Requirements 2.2, 2.3, 2.4
 */
router.post('/posts/:id/bookmark', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    // 先检查帖子是否存在（含标题、摘要和作者信息，用于碎片采集）
    db.get(
      `SELECT cp.id, cp.title, cp.summary, cp.user_id,
              u.username AS authorName
       FROM community_posts cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.id = ?`,
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        // 查询是否已收藏
        db.get(
          'SELECT id FROM community_bookmarks WHERE user_id = ? AND post_id = ?',
          [userId, postId],
          (err, existingBookmark) => {
            if (err) {
              console.error('查询收藏记录失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }

            if (existingBookmark) {
              // 已收藏 → 取消收藏
              db.run(
                'DELETE FROM community_bookmarks WHERE user_id = ? AND post_id = ?',
                [userId, postId],
                (err) => {
                  if (err) {
                    console.error('删除收藏记录失败:', err);
                    return res.status(500).json({
                      success: false,
                      error: '服务器内部错误'
                    });
                  }

                  res.json({
                    success: true,
                    data: { bookmarked: false }
                  });
                }
              );
            } else {
              // 未收藏 → 收藏
              db.run(
                'INSERT INTO community_bookmarks (user_id, post_id) VALUES (?, ?)',
                [userId, postId],
                (err) => {
                  if (err) {
                    console.error('插入收藏记录失败:', err);
                    return res.status(500).json({
                      success: false,
                      error: '服务器内部错误'
                    });
                  }

                  // 异步采集 community_favorite 碎片（不阻塞主请求）
                  process.nextTick(() => {
                    const postTitle = post.title || '';
                    const postSummary = post.summary || '';
                    const postAuthor = post.authorName || '';
                    fragmentCollector.collect({
                      userId,
                      fragmentType: 'community_favorite',
                      content: `收藏: ${postTitle} - ${postSummary}`,
                      sourceId: String(postId),
                      sourceMeta: { postTitle, postAuthor }
                    }).catch(err => console.error('[FragmentCollector] community_favorite collection error:', err));
                  });

                  res.json({
                    success: true,
                    data: { bookmarked: true }
                  });
                }
              );
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/community/posts/:id/comments
 * 发表评论
 *
 * Body: { content: string }
 * Response: { success: true, data: { id, postId, userId, content, createdAt, authorName, authorAvatar } }
 *
 * Validates: Requirements 3.2, 3.3, 3.4
 */
router.post('/posts/:id/comments', authMiddleware, requirePermission('community:comment'), (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    const content = (req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({
        success: false,
        error: '评论内容不能为空'
      });
    }

    // 验证帖子存在（同时获取标题用于碎片采集）
    db.get(
      'SELECT id, title FROM community_posts WHERE id = ?',
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        // 插入评论记录
        db.run(
          'INSERT INTO community_comments (user_id, post_id, content) VALUES (?, ?, ?)',
          [userId, postId, content],
          function (err) {
            if (err) {
              console.error('插入评论记录失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }

            const commentId = this.lastID;

            // JOIN users 查询新评论含作者信息
            db.get(
              `SELECT cc.id, cc.post_id, cc.user_id, cc.content, cc.created_at,
                      u.username AS authorName, u.avatar AS authorAvatar
               FROM community_comments cc
               LEFT JOIN users u ON cc.user_id = u.id
               WHERE cc.id = ?`,
              [commentId],
              (err, comment) => {
                if (err) {
                  console.error('查询新评论失败:', err);
                  return res.status(500).json({
                    success: false,
                    error: '服务器内部错误'
                  });
                }

                res.json({
                  success: true,
                  data: {
                    id: comment.id,
                    postId: comment.post_id,
                    userId: comment.user_id,
                    content: comment.content,
                    createdAt: comment.created_at,
                    authorName: comment.authorName,
                    authorAvatar: comment.authorAvatar
                  }
                });

                // 异步采集 community_comment 碎片（不阻塞主请求）
                process.nextTick(() => {
                  const postTitle = post.title || '';
                  const commentContent = content;
                  fragmentCollector.collect({
                    userId,
                    fragmentType: 'community_comment',
                    content: commentContent,
                    sourceId: String(commentId),
                    sourceMeta: { postId: String(postId), postTitle, commentContent }
                  }).catch(err => console.error('[FragmentCollector] community_comment collection error:', err));
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('发表评论失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/community/posts/:id/comments
 * 获取帖子评论列表（按创建时间倒序）
 *
 * Response: { success: true, data: { comments: [...], total: number } }
 *
 * Validates: Requirements 3.5
 */
router.get('/posts/:id/comments', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    // 验证帖子存在
    db.get(
      'SELECT id FROM community_posts WHERE id = ?',
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        // 查询评论列表 JOIN users 获取作者信息，按 created_at DESC 排序
        db.all(
          `SELECT cc.id, cc.post_id, cc.user_id, cc.content, cc.created_at,
                  u.username AS authorName, u.avatar AS authorAvatar
           FROM community_comments cc
           LEFT JOIN users u ON cc.user_id = u.id
           WHERE cc.post_id = ?
           ORDER BY cc.created_at DESC`,
          [postId],
          (err, rows) => {
            if (err) {
              console.error('查询评论列表失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }

            const comments = (rows || []).map(row => ({
              id: row.id,
              postId: row.post_id,
              userId: row.user_id,
              content: row.content,
              createdAt: row.created_at,
              authorName: row.authorName,
              authorAvatar: row.authorAvatar
            }));

            res.json({
              success: true,
              data: {
                comments,
                total: comments.length
              }
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * GET /api/community/posts/:id
 * 获取社区帖子详情（含文档索引）
 */
router.get('/posts/:id', authMiddleware, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(postId)) {
      return res.status(400).json({ success: false, error: '无效的帖子ID' });
    }

    db.get(
      `SELECT cp.*,
              u.username AS authorName,
              u.avatar AS authorAvatar,
              CASE WHEN cl.id IS NOT NULL THEN 1 ELSE 0 END AS isLiked,
              CASE WHEN cb.id IS NOT NULL THEN 1 ELSE 0 END AS isBookmarked,
              (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS commentCount
       FROM community_posts cp
       LEFT JOIN users u ON cp.user_id = u.id
       LEFT JOIN community_likes cl ON cl.post_id = cp.id AND cl.user_id = ?
       LEFT JOIN community_bookmarks cb ON cb.post_id = cp.id AND cb.user_id = ?
       WHERE cp.id = ?`,
      [userId, userId, postId],
      async (err, row) => {
        if (err) {
          console.error('查询帖子详情失败:', err);
          return res.status(500).json({ success: false, error: '服务器内部错误' });
        }

        if (!row) {
          return res.status(404).json({ success: false, error: '帖子不存在' });
        }

        const post = {
          id: row.id,
          userId: row.user_id,
          documentId: row.document_id, // legacy
          sourceType: row.source_type,
          sourceId: row.source_id,
          title: row.title,
          summary: row.summary,
          tags: row.tags,
          coverImage: row.cover_image || null,
          likes: row.likes,
          viewCount: row.view_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          authorName: row.authorName,
          authorAvatar: row.authorAvatar,
          isLiked: row.isLiked === 1,
          isBookmarked: row.isBookmarked === 1,
          isPublic: row.is_public === 1,
          commentCount: row.commentCount || 0,
        };

        // 查询关联内容的 content 字段，提取内容图片
        let contentImages = [];
        const canViewContent = row.source_id && (row.user_id === userId || row.is_public === 1);
        
        if (canViewContent) {
          const table = row.source_type === 'note' ? 'notes' : 'documents';
          try {
            const doc = await new Promise((resolve, reject) => {
              db.get(
                `SELECT content FROM ${table} WHERE id = ?`,
                [row.source_id],
                (err, doc) => {
                  if (err) reject(err);
                  else resolve(doc);
                }
              );
            });
            if (doc && doc.content) {
              contentImages = extractImagesFromContent(doc.content);
            }
          } catch (e) {
            console.error('查询内容失败:', e);
          }
        }

        // 查询文档索引（从 Prisma/KG 数据库）
        let indexData = null;
        if (kgPrisma && row.source_type === 'document' && row.source_id) {
          try {
            const docIndex = await kgPrisma.documentIndex.findFirst({
              where: { docId: String(row.source_id) },
              orderBy: { version: 'desc' },
            });
            if (docIndex) {
              let metadata = {};
              try { metadata = docIndex.metadata ? JSON.parse(docIndex.metadata) : {}; } catch {}
              indexData = {
                indexedText: docIndex.indexedText,
                version: docIndex.version,
                metadata,
              };
            }
          } catch (e) {
            console.error('查询文档索引失败:', e);
          }
        }

        res.json({
          success: true,
          data: { ...post, contentImages, indexData },
        });
      }
    );
  } catch (error) {
    console.error('获取帖子详情失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * PUT /api/community/posts/:id
 * 更新帖子
 * 
 * Body: { title?: string, summary?: string }
 * Response: { success: true, data: { id, title, summary, updated_at } }
 */
router.put('/posts/:id', authMiddleware, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;
    const { title, summary } = req.body;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    if (!title && !summary) {
      return res.status(400).json({
        success: false,
        error: '请提供要更新的内容'
      });
    }

    db.get(
      'SELECT id, user_id FROM community_posts WHERE id = ?',
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        if (post.user_id !== userId) {
          return res.status(403).json({
            success: false,
            error: '无权修改此帖子'
          });
        }

        const updates = [];
        const params = [];
        if (title) {
          updates.push('title = ?');
          params.push(title);
        }
        if (summary !== undefined) {
          updates.push('summary = ?');
          params.push(summary);
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(postId);

        db.run(
          `UPDATE community_posts SET ${updates.join(', ')} WHERE id = ?`,
          params,
          (err) => {
            if (err) {
              console.error('更新帖子失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }
            res.json({
              success: true,
              data: {
                id: postId,
                title: title || undefined,
                summary: summary || undefined,
                updated_at: new Date().toISOString()
              }
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('更新帖子失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * DELETE /api/community/posts/:id
 * 取消发布（删除帖子）
 * 
 * Response: { success: true }
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
router.delete('/posts/:id', authMiddleware, requirePermission('community:delete'), (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;

    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: '无效的帖子ID'
      });
    }

    // 查询帖子是否存在
    db.get(
      'SELECT id, user_id FROM community_posts WHERE id = ?',
      [postId],
      (err, post) => {
        if (err) {
          console.error('查询帖子失败:', err);
          return res.status(500).json({
            success: false,
            error: '服务器内部错误'
          });
        }

        if (!post) {
          return res.status(404).json({
            success: false,
            error: '帖子不存在'
          });
        }

        // 检查是否为帖子所有者
        if (post.user_id !== userId) {
          return res.status(403).json({
            success: false,
            error: '无权删除此帖子'
          });
        }

        // 先删除关联的点赞记录
        db.run(
          'DELETE FROM community_likes WHERE post_id = ?',
          [postId],
          (err) => {
            if (err) {
              console.error('删除点赞记录失败:', err);
              return res.status(500).json({
                success: false,
                error: '服务器内部错误'
              });
            }

            // 删除关联的收藏记录
            db.run(
              'DELETE FROM community_bookmarks WHERE post_id = ?',
              [postId],
              (err) => {
                if (err) {
                  console.error('删除收藏记录失败:', err);
                  return res.status(500).json({
                    success: false,
                    error: '服务器内部错误'
                  });
                }

                // 删除关联的评论记录
                db.run(
                  'DELETE FROM community_comments WHERE post_id = ?',
                  [postId],
                  (err) => {
                    if (err) {
                      console.error('删除评论记录失败:', err);
                      return res.status(500).json({
                        success: false,
                        error: '服务器内部错误'
                      });
                    }

                    // 最后删除帖子
                    db.run(
                      'DELETE FROM community_posts WHERE id = ?',
                      [postId],
                      (err) => {
                        if (err) {
                          console.error('删除帖子失败:', err);
                          return res.status(500).json({
                            success: false,
                            error: '服务器内部错误'
                          });
                        }

                        res.json({ success: true });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('删除帖子失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * POST /api/community/posts/batch-delete
 * 批量删除帖子
 * 
 * Body: { postIds: number[] }
 * Response: { success: true, data: { deleted: number[], failed: { id: number, reason: string }[] } }
 */
router.post('/posts/batch-delete', authMiddleware, requirePermission('community:delete'), (req, res) => {
  try {
    const { postIds } = req.body;
    const userId = req.userId;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要删除的帖子ID列表'
      });
    }

    const deleted = [];
    const failed = [];
    let processed = 0;

    postIds.forEach((postId) => {
      const numericId = parseInt(postId);
      if (isNaN(numericId)) {
        failed.push({ id: postId, reason: '无效的帖子ID' });
        processed++;
        if (processed === postIds.length) {
          return res.json({ success: true, data: { deleted, failed } });
        }
        return;
      }

      db.get(
        'SELECT id, user_id FROM community_posts WHERE id = ?',
        [numericId],
        (err, post) => {
          if (err) {
            failed.push({ id: numericId, reason: '查询失败' });
            processed++;
            if (processed === postIds.length) {
              return res.json({ success: true, data: { deleted, failed } });
            }
            return;
          }

          if (!post) {
            failed.push({ id: numericId, reason: '帖子不存在' });
            processed++;
            if (processed === postIds.length) {
              return res.json({ success: true, data: { deleted, failed } });
            }
            return;
          }

          if (post.user_id !== userId) {
            failed.push({ id: numericId, reason: '无权删除' });
            processed++;
            if (processed === postIds.length) {
              return res.json({ success: true, data: { deleted, failed } });
            }
            return;
          }

          db.run('DELETE FROM community_likes WHERE post_id = ?', [numericId], (err) => {
            if (err) {
              failed.push({ id: numericId, reason: '删除点赞记录失败' });
              processed++;
              if (processed === postIds.length) {
                return res.json({ success: true, data: { deleted, failed } });
              }
              return;
            }

            db.run('DELETE FROM community_bookmarks WHERE post_id = ?', [numericId], (err) => {
              if (err) {
                failed.push({ id: numericId, reason: '删除收藏记录失败' });
                processed++;
                if (processed === postIds.length) {
                  return res.json({ success: true, data: { deleted, failed } });
                }
                return;
              }

              db.run('DELETE FROM community_comments WHERE post_id = ?', [numericId], (err) => {
                if (err) {
                  failed.push({ id: numericId, reason: '删除评论记录失败' });
                  processed++;
                  if (processed === postIds.length) {
                    return res.json({ success: true, data: { deleted, failed } });
                  }
                  return;
                }

                db.run('DELETE FROM community_posts WHERE id = ?', [numericId], (err) => {
                  if (err) {
                    failed.push({ id: numericId, reason: '删除帖子失败' });
                  } else {
                    deleted.push(numericId);
                  }
                  processed++;
                  if (processed === postIds.length) {
                    return res.json({ success: true, data: { deleted, failed } });
                  }
                });
              });
            });
          });
        }
      );
    });
  } catch (error) {
    console.error('批量删除帖子失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = { router, initCommunityRoutes };
