# Notes Service

Database Access Layer (DAL) and utilities for the Notes feature.

## Overview

This module provides:
- **Note DAL**: CRUD operations for notes
- **Attachment DAL**: CRUD operations for attachments and analysis
- **Tag Extractor**: Utilities for extracting and parsing hashtags from text

## Deployment

Notes uses the same Prisma SQLite database as the Knowledge Graph.

- Ensure Prisma client is generated and migrations are applied:
  - `npx prisma generate`
  - `npx prisma migrate deploy`
- Database file path is controlled by `prisma/schema.prisma` datasource (`file:../data/knowledge_graph.db`).
- If `/api/attachments/upload` returns `503 Notes storage is not initialized`, it means the runtime database is missing required tables or migrations were not applied.

## Requirements Validation

This implementation validates the following requirements:
- **1.2**: Tag recognition from text with "#" symbol
- **1.3**: Tag association with note content
- **1.4**: JSON serialization of text and tags
- **1.5**: Database storage of notes
- **2.1, 2.5, 2.6**: Image upload and analysis storage
- **3.1, 3.3**: Document upload and storage
- **4.1, 4.3**: Table upload and storage

## Modules

### Tag Extractor (`tagExtractor.js`)

Utilities for extracting and parsing hashtags from text.

#### Functions

- `extractTags(text)` - Extracts all hashtags from text
- `parseTextWithTags(text)` - Parses text and returns content with tags
- `isValidTag(tag)` - Validates if a string is a valid tag
- `normalizeTags(tags)` - Normalizes and validates an array of tags
- `highlightTags(text)` - Segments text for tag highlighting

#### Example

```javascript
const { extractTags, parseTextWithTags } = require('./services/notes');

// Extract tags from text
const tags = extractTags('这是一条便签 #工作 #重要');
// Returns: ['工作', '重要']

// Parse text with tags
const result = parseTextWithTags('Note #work #important');
// Returns: { content: 'Note #work #important', tags: ['work', 'important'] }
```

### Note DAL (`noteDAL.js`)

Database access layer for Note model operations.

#### Functions

- `createNote({ userId, content, tags })` - Creates a new note
- `getNoteById(noteId, userId?)` - Gets a note by ID
- `updateNote(noteId, data, userId?)` - Updates a note
- `deleteNote(noteId, userId?)` - Deletes a note
- `listNotes(options)` - Lists notes with pagination and filtering
- `getUserTags(userId)` - Gets all unique tags for a user
- `countNotesByUser(userId)` - Counts notes for a user
- `searchNotes(options)` - Searches notes by content or tags

#### Example

```javascript
const { createNote, listNotes, searchNotes } = require('./services/notes');

// Create a note
const note = await createNote({
  userId: 'user-123',
  content: '这是一条便签 #工作 #重要'
});

// List notes with pagination
const result = await listNotes({
  userId: 'user-123',
  page: 1,
  limit: 20,
  tags: ['工作']
});

// Search notes
const searchResult = await searchNotes({
  query: '便签',
  userId: 'user-123'
});
```

### Attachment DAL (`attachmentDAL.js`)

Database access layer for Attachment and AttachmentAnalysis models.

#### Functions

- `createAttachment(data)` - Creates a new attachment
- `getAttachmentById(attachmentId)` - Gets an attachment by ID
- `getAttachmentsByNoteId(noteId)` - Gets all attachments for a note
- `updateAttachment(attachmentId, data)` - Updates an attachment
- `deleteAttachment(attachmentId)` - Deletes an attachment
- `upsertAttachmentAnalysis(data)` - Creates or updates attachment analysis
- `getAttachmentAnalysis(attachmentId)` - Gets attachment analysis
- `deleteAttachmentAnalysis(attachmentId)` - Deletes attachment analysis
- `getAttachmentsByType(noteId, type)` - Gets attachments by type
- `countAttachmentsByNote(noteId)` - Counts attachments for a note
- `getAttachmentsWithoutAnalysis(limit?)` - Gets attachments pending analysis

#### Example

```javascript
const { createAttachment, upsertAttachmentAnalysis } = require('./services/notes');

// Create an attachment
const attachment = await createAttachment({
  noteId: 'note-123',
  type: 'IMAGE',
  storageKey: 'images/photo.jpg',
  url: 'https://s3.example.com/images/photo.jpg',
  size: 1024000,
  mimeType: 'image/jpeg'
});

// Add analysis to attachment
const analysis = await upsertAttachmentAnalysis({
  attachmentId: attachment.id,
  textContent: 'Extracted text from image',
  description: 'A photo of a sunset',
  tags: ['sunset', 'nature'],
  metadata: { width: 1920, height: 1080 }
});
```

## Data Models

### Note

```typescript
{
  id: string;
  userId: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  attachments: Attachment[];
}
```

### Attachment

```typescript
{
  id: string;
  noteId: string;
  type: 'IMAGE' | 'DOCUMENT' | 'TABLE';
  storageKey: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  analysis?: AttachmentAnalysis;
}
```

### AttachmentAnalysis

```typescript
{
  id: string;
  attachmentId: string;
  textContent?: string;
  description?: string;
  tags: string[];
  metadata: object;
  createdAt: Date;
}
```

## Tag Format

Tags are extracted from text using the `#` symbol:
- Valid: `#work`, `#工作`, `#project2024`, `#my_project`
- Invalid: `#`, `# space`, `#tag!`, `#tag with spaces`

Tag rules:
- Must contain at least one character
- Can contain letters (any language), numbers, and underscores
- Maximum length: 50 characters
- Case-sensitive
- Automatically deduplicated

## Testing

Run tests:

```bash
# Run all note service tests
npm test -- services/notes

# Run specific test files
npm test -- services/notes/tagExtractor.test.js
npm test -- services/notes/noteDAL.test.js
npm test -- services/notes/attachmentDAL.test.js
```

## Error Handling

All DAL functions throw errors for:
- Missing required parameters
- Invalid data types
- Database constraint violations
- Not found resources

Example error handling:

```javascript
try {
  const note = await createNote({
    userId: 'user-123',
    content: 'Test note'
  });
} catch (error) {
  if (error.message === 'userId and content are required') {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

- Tag extraction uses efficient regex matching
- Database queries include proper indexes (userId, tags, createdAt)
- Pagination is supported for list operations
- Batch operations should be used when possible

## Future Enhancements

- Full-text search with PostgreSQL or Elasticsearch
- Tag suggestions based on user history
- Attachment thumbnail generation
- Batch attachment processing
- Real-time collaboration features
