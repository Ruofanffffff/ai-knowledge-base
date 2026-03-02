# IM Backend Integration Plan

## Current Status
The "Messages" feature in V1.1 is currently implemented using **Local Storage** (`src/app/services/messageStore.ts`). This means messages are only saved on the device and do not sync across devices or with the server.

## Requirement
To enable real-time messaging and synchronization, the backend needs to support IM capabilities.

## Proposed API Endpoints

### 1. Conversation Management
- `GET /api/conversations`: List all conversations for the current user.
- `POST /api/conversations`: Start a new conversation.
- `GET /api/conversations/:id`: Get details of a specific conversation.

### 2. Message Handling
- `GET /api/conversations/:id/messages`: Get message history (pagination support needed).
- `POST /api/conversations/:id/messages`: Send a new message.
    - Payload: `{ text: string, type: 'text'|'image'|'note', ... }`
- `DELETE /api/messages/:id`: Delete a message.

### 3. Real-time Updates (Socket.io / WebSocket)
To support instant reception of messages:
- **Connect**: Client connects to WebSocket server with JWT.
- **Event: `message`**: Server pushes new message to recipient.
- **Event: `read`**: Mark messages as read.

## Frontend Changes Needed
1.  **Replace `messageStore.ts`**: Create a `ChatService` that calls the above APIs.
2.  **Socket Integration**: Add `socket.io-client` to the frontend.
3.  **UI Updates**: Update `Messages.tsx` and `Chat.tsx` (if exists) to use the new service and handle loading states.

## Backend Changes Needed
1.  **Database Schema**: Add `conversations` and `messages` tables.
2.  **API Routes**: Implement the endpoints listed above.
3.  **WebSocket Server**: Set up a Socket.io server alongside Express.
