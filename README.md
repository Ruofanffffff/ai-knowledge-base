# AI Knowledge Base - Frontend

A modern React-based frontend application for the AI Knowledge Base system, featuring document management, knowledge graph visualization, and AI-powered search capabilities.

## Features

- **Authentication System**: Secure JWT-based authentication with login/register functionality
- **Document Management**: Full CRUD operations for documents with auto-refresh
- **Knowledge Graph Visualization**: Interactive D3.js-based graph visualization with multiple views
  - Basic graph view
  - Schema-driven knowledge graph
  - CKB (Contextual Knowledge Block) explorer
- **AI-Powered Search**: Semantic search with AI-generated answers
- **File Upload**: Support for multiple file types with progress tracking
- **Error Handling**: Comprehensive error modal system with user-friendly messages
- **Auto-Refresh**: Configurable auto-refresh for documents and graph data

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Ant Design** for UI components
- **D3.js** for graph visualization
- **Axios** for HTTP requests
- **Vitest** for testing
- **React Router** for navigation

## Prerequisites

- Node.js 16+ and npm
- Backend server running on port 3000 (see backend setup)

## Environment Variables

Create a `.env.local` file in the `client` directory with the following variables:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# Auto-Refresh Configuration
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=30000

# Debug Mode
VITE_DEBUG_MODE=true
```

For production, create a `.env.production` file:

```env
VITE_API_BASE_URL=https://your-production-api.com/api
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=60000
VITE_DEBUG_MODE=false
```

## Installation

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests once (CI mode):

```bash
npm run test:run
```

## Code Quality

Run linter:

```bash
npm run lint
```

Run type checker:

```bash
npx tsc --noEmit
```

## Project Structure

```
client/
├── src/
│   ├── api/              # API service layer
│   │   ├── client.ts     # Axios HTTP client
│   │   ├── auth.ts       # Authentication API
│   │   ├── documents.ts  # Documents API
│   │   ├── graph.ts      # Knowledge graph API
│   │   ├── ai.ts         # AI search API
│   │   ├── upload.ts     # File upload API
│   │   └── types.ts      # TypeScript type definitions
│   ├── components/       # Reusable components
│   │   ├── ErrorModal/   # Error modal component
│   │   ├── ProtectedRoute.tsx
│   │   └── LoadingSpinner.tsx
│   ├── contexts/         # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ErrorContext.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useAutoRefresh.ts
│   │   ├── useDocuments.ts
│   │   └── useGraph.ts
│   ├── pages/            # Page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DocumentsList.tsx
│   │   ├── Editor.tsx
│   │   ├── Graph.tsx
│   │   ├── Chat.tsx
│   │   ├── KnowledgeGraph.tsx
│   │   └── KnowledgeGraph/
│   │       ├── SchemaKG.tsx
│   │       └── CKBExplorer.tsx
│   ├── utils/            # Utility functions
│   │   ├── storage.ts    # localStorage utilities
│   │   └── transformers.ts # Data transformation
│   ├── config/           # Configuration
│   │   └── constants.ts  # App constants
│   └── test/             # Test setup
│       └── setup.ts
├── .env.local            # Local environment variables
├── .env.production       # Production environment variables
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## API Integration

The frontend integrates with the backend API using the following endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get single document
- `POST /api/documents` - Create document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document

### Knowledge Graph
- `GET /api/knowledge-graph` - Get graph data
- `GET /api/knowledge-graph/entities` - Get entities
- `GET /api/knowledge-graph/relations` - Get relations
- `POST /api/knowledge-graph/build` - Build graph from document
- `GET /api/knowledge-graph/ckb` - Get CKBs

### AI Search
- `POST /api/ai/search` - Semantic search
- `POST /api/ai/summarize/:id` - Summarize document
- `POST /api/ai/tags` - Generate tags

### File Upload
- `POST /api/upload` - Upload file

## Authentication Flow

1. User logs in with credentials
2. Backend returns JWT token
3. Token is stored in localStorage
4. Token is included in all API requests via Authorization header
5. On 401 error, user is redirected to login page

## Data Transformation

The frontend transforms backend data formats to frontend-friendly formats:

- **Backend Entity** → **Frontend GraphNode**
  - `canonical_name` → `label`
  - `source_id`/`target_id` → `source`/`target`

- **Backend Relation** → **Frontend GraphLink**
  - Preserves all fields with proper naming

## Auto-Refresh

Auto-refresh is configurable per feature:

- **Documents**: 30 seconds (configurable via `VITE_AUTO_REFRESH_INTERVAL`)
- **Knowledge Graph**: 60 seconds
- Can be paused/resumed programmatically

## Error Handling

All API errors are handled through a centralized error modal system:

- **401 Unauthorized**: Redirects to login
- **403 Forbidden**: Shows access denied message
- **404 Not Found**: Shows resource not found message
- **500+ Server Error**: Shows server error message
- **Network Error**: Shows connection error message

## Testing Strategy

The project uses a comprehensive testing approach:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test API integration and data flow
3. **Property-Based Tests**: Test properties that should hold for all inputs using fast-check

Test coverage includes:
- API services (auth, documents, graph, ai, upload)
- Utility functions (storage, transformers)
- React components (ErrorModal, ProtectedRoute)
- Custom hooks (useDocuments, useGraph)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Run type checker: `npx tsc --noEmit`
6. Submit a pull request

## Troubleshooting

### Backend Connection Issues

If you see "Network Error" messages:
1. Verify backend server is running on port 3000
2. Check CORS configuration on backend
3. Verify `VITE_API_BASE_URL` in `.env.local`

### Authentication Issues

If login fails:
1. Check backend authentication endpoints
2. Verify JWT token is being stored in localStorage
3. Check browser console for errors

### Build Issues

If build fails:
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Check TypeScript errors: `npx tsc --noEmit`

## License

MIT

## Related Documentation

- [Backend API Documentation](../kg/API.md)
- [Knowledge Graph Architecture](../kg/ARCHITECTURE.md)
- [Deployment Guide](../kg/DEPLOYMENT.md)
