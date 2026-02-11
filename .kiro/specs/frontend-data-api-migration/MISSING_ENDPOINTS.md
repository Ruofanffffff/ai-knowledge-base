# Missing API Endpoints

## Overview

This document tracks API endpoints that are required by the frontend but are not yet implemented in the backend, or need adapter endpoints to match the frontend's expectations.

## Status: Identified Missing Endpoints

### 1. Graph Endpoints

**Frontend Expectation:**
- `GET /api/graph/nodes` - Get graph nodes
- `GET /api/graph/links` - Get graph links

**Backend Reality:**
- `GET /api/knowledge-graph` - Returns entities and relations

**Solution Options:**

#### Option A: Create Adapter Endpoints (Recommended)
Add adapter endpoints in `server.js` that transform the knowledge graph data:

```javascript
// Adapter endpoint for graph nodes
app.get('/api/graph/nodes', authMiddleware, async (req, res) => {
  try {
    // Get entities from knowledge graph
    const kgData = await getKnowledgeGraphData();
    
    // Transform entities to nodes format
    const nodes = kgData.entities.map(entity => ({
      id: entity.id,
      label: entity.name,
      type: entity.type,
      properties: entity.properties || {},
      x: entity.x,
      y: entity.y,
      color: entity.color
    }));
    
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adapter endpoint for graph links
app.get('/api/graph/links', authMiddleware, async (req, res) => {
  try {
    // Get relations from knowledge graph
    const kgData = await getKnowledgeGraphData();
    
    // Transform relations to links format
    const links = kgData.relations.map(relation => ({
      source: relation.source,
      target: relation.target,
      type: relation.type,
      relation: relation.subtype || relation.type,
      weight: relation.confidence || 1.0
    }));
    
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Option B: Update Frontend API Service
Modify `client/src/services/api.ts` to use `/api/knowledge-graph` and transform the data:

```typescript
async getGraphNodes(): Promise<ApiResponse<GraphNode[]>> {
  try {
    const response = await this.axiosInstance.get('/api/knowledge-graph');
    const kgData = response.data;
    
    // Transform entities to nodes
    const nodes = kgData.entities?.map(entity => ({
      id: entity.id,
      label: entity.name,
      type: entity.type,
      properties: entity.properties || {}
    })) || [];
    
    return { data: nodes };
  } catch (error) {
    return { data: [], error: this.handleError(error) };
  }
}
```

**Recommendation:** Option A (adapter endpoints) is preferred because:
- Keeps transformation logic on the backend
- Maintains clean separation of concerns
- Makes the API more intuitive for frontend developers
- Easier to test and maintain

### 2. Chat Endpoints

**Frontend Expectation:**
- `GET /api/chat/history` - Get chat history
- `GET /api/chat/sessions` - Get chat sessions
- `POST /api/chat/message` - Send chat message

**Backend Reality:**
- No chat-specific endpoints exist
- Chat functionality is embedded in the Dashboard/Chat component

**Solution Options:**

#### Option A: Implement Chat API Endpoints
Create a new route file `routes/chatRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');

// Get chat sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    // Fetch chat sessions from database
    const sessions = await getChatSessions(userId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chat history
router.get('/history/:sessionId?', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    // Fetch chat history from database
    const messages = await getChatHistory(userId, sessionId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send chat message
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { message, sessionId } = req.body;
    // Process message and get AI response
    const response = await processChat Message(userId, message, sessionId);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

Then mount in `server.js`:
```javascript
const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);
```

#### Option B: Use Existing AI Search Endpoint
Modify the frontend to use `/api/ai/search` for chat functionality:

```typescript
async sendChatMessage(message: string, sessionId?: string): Promise<ApiResponse<ChatMessage>> {
  try {
    const response = await this.axiosInstance.post('/api/ai/search', {
      query: message,
      sessionId
    });
    
    // Transform AI search response to chat message format
    const chatMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: response.data.answer,
      timestamp: new Date().toISOString()
    };
    
    return { data: chatMessage };
  } catch (error) {
    return { data: null, error: this.handleError(error) };
  }
}
```

**Recommendation:** Option B (use existing AI search) is preferred for MVP because:
- Leverages existing functionality
- Faster to implement
- Chat sessions can be added later as an enhancement
- The AI search endpoint already provides the core chat functionality

## Implementation Priority

1. **High Priority:** Graph adapter endpoints (Option A)
   - Required for Graph page to function
   - Relatively simple to implement
   - Clear transformation logic

2. **Medium Priority:** Chat endpoint adaptation (Option B)
   - Chat page can use AI search endpoint
   - Sessions can be managed client-side initially
   - Full chat API can be added in future iteration

3. **Low Priority:** Full chat API implementation
   - Can be deferred to future sprint
   - Current workaround is sufficient for MVP

## Next Steps

1. Create graph adapter endpoints in `server.js`
2. Test endpoints with frontend
3. Update API documentation
4. Consider chat endpoint implementation for future iteration

## Related Files

- `server.js` - Main server file where adapters should be added
- `routes/knowledgeGraphRoutes.js` - Knowledge graph routes
- `client/src/services/api.ts` - Frontend API service
- `client/src/pages/Graph.tsx` - Graph page component
- `client/src/pages/Chat.tsx` - Chat page component
