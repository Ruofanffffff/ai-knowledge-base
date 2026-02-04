# Manual Testing Guide

This guide provides step-by-step instructions for manually testing the frontend-backend integration.

## Prerequisites

1. **Backend Server Running**
   ```bash
   # From project root
   npm run server
   # Server should be running on http://localhost:3000
   ```

2. **Frontend Development Server Running**
   ```bash
   # From project root
   npm run client
   # Or from client directory
   cd client && npm run dev
   # Frontend should be running on http://localhost:5173
   ```

3. **Test User Account**
   - Create a test user account if you don't have one
   - Or use existing credentials

---

## Test Suite

### 1. Authentication Flow Testing

#### 1.1 Login with Valid Credentials
- [ ] Navigate to `/login`
- [ ] Enter valid username and password
- [ ] Click "Login" button
- [ ] **Expected**: Redirect to dashboard, user info displayed
- [ ] **Verify**: Token stored in localStorage (`auth_token` key)

#### 1.2 Login with Invalid Credentials
- [ ] Navigate to `/login`
- [ ] Enter invalid username or password
- [ ] Click "Login" button
- [ ] **Expected**: Error modal displays with appropriate message
- [ ] **Verify**: No redirect, no token stored

#### 1.3 Session Persistence
- [ ] Log in successfully
- [ ] Refresh the page (F5)
- [ ] **Expected**: User remains logged in, no redirect to login
- [ ] **Verify**: User data persists across refresh

#### 1.4 Logout Functionality
- [ ] While logged in, click "Logout" button
- [ ] **Expected**: Redirect to login page
- [ ] **Verify**: Token removed from localStorage
- [ ] **Verify**: Cannot access protected routes without logging in again

---

### 2. Document Management Testing

#### 2.1 View Document List
- [ ] Navigate to documents page
- [ ] **Expected**: List of documents displays
- [ ] **Verify**: Document titles, dates, and metadata visible
- [ ] **Verify**: Loading spinner shows while fetching

#### 2.2 Create New Document
- [ ] Click "New Document" or "Create" button
- [ ] Fill in document title and content
- [ ] Add tags (optional)
- [ ] Click "Save" or "Create"
- [ ] **Expected**: Document created successfully
- [ ] **Verify**: New document appears in list
- [ ] **Verify**: Success message or notification

#### 2.3 Edit Existing Document
- [ ] Click on a document to edit
- [ ] Modify title or content
- [ ] Click "Save" or "Update"
- [ ] **Expected**: Document updated successfully
- [ ] **Verify**: Changes reflected in document list
- [ ] **Verify**: Updated timestamp changes

#### 2.4 Delete Document
- [ ] Click delete button on a document
- [ ] Confirm deletion in dialog
- [ ] **Expected**: Document removed from list
- [ ] **Verify**: Document no longer appears
- [ ] **Verify**: Confirmation message displayed

#### 2.5 Auto-Refresh (30 seconds)
- [ ] Open documents page
- [ ] Wait 30 seconds without interaction
- [ ] **Expected**: Document list refreshes automatically
- [ ] **Verify**: No page reload, smooth update
- [ ] **Optional**: Add manual refresh button test

---

### 3. Knowledge Graph Testing

#### 3.1 Graph Visualization Renders
- [ ] Navigate to knowledge graph page
- [ ] **Expected**: Graph visualization displays
- [ ] **Verify**: Nodes and links are visible
- [ ] **Verify**: Loading spinner shows while fetching

#### 3.2 Zoom Functionality
- [ ] Use mouse wheel to zoom in/out
- [ ] **Expected**: Graph scales smoothly
- [ ] **Verify**: Nodes remain visible and clickable

#### 3.3 Pan Functionality
- [ ] Click and drag on empty space
- [ ] **Expected**: Graph pans in drag direction
- [ ] **Verify**: Smooth panning motion

#### 3.4 Node Selection
- [ ] Click on a node
- [ ] **Expected**: Node highlights or shows details
- [ ] **Verify**: Node information panel appears
- [ ] **Verify**: Related nodes/edges highlighted

#### 3.5 Auto-Refresh (60 seconds)
- [ ] Open knowledge graph page
- [ ] Wait 60 seconds without interaction
- [ ] **Expected**: Graph data refreshes automatically
- [ ] **Verify**: Graph updates without full reload
- [ ] **Optional**: Test pause/resume controls

---

### 4. AI Search Testing

#### 4.1 Search with Valid Query
- [ ] Navigate to chat/search page
- [ ] Enter a search query (e.g., "machine learning")
- [ ] Click "Search" or press Enter
- [ ] **Expected**: Search results display
- [ ] **Verify**: Relevant documents shown
- [ ] **Verify**: Answer/summary provided

#### 4.2 Search with No Results
- [ ] Enter a query with no matches (e.g., "xyzabc123")
- [ ] Click "Search"
- [ ] **Expected**: "No results found" message
- [ ] **Verify**: No error modal, graceful handling

#### 4.3 Loading States
- [ ] Enter a search query
- [ ] **Expected**: Loading spinner or indicator shows
- [ ] **Verify**: Search button disabled during search
- [ ] **Verify**: Results appear after loading completes

#### 4.4 Error Handling
- [ ] Stop backend server
- [ ] Try to search
- [ ] **Expected**: Error modal displays network error
- [ ] **Verify**: User-friendly error message
- [ ] **Verify**: Can retry after restarting server

---

### 5. File Upload Testing

#### 5.1 Upload Valid File
- [ ] Click "Upload" button
- [ ] Select a valid file (.pdf, .docx, .txt, .md)
- [ ] **Expected**: Upload progress bar displays
- [ ] **Verify**: Progress updates from 0% to 100%
- [ ] **Verify**: Document appears in list after upload

#### 5.2 File Type Validation
- [ ] Try to upload invalid file type (.exe, .zip)
- [ ] **Expected**: Error message before upload starts
- [ ] **Verify**: File rejected with clear message
- [ ] **Verify**: No API call made for invalid file

#### 5.3 Upload Progress Display
- [ ] Upload a larger file (>1MB)
- [ ] **Expected**: Progress bar shows incremental progress
- [ ] **Verify**: Percentage updates smoothly
- [ ] **Verify**: Can cancel upload (if implemented)

#### 5.4 Document List Refresh After Upload
- [ ] Upload a file successfully
- [ ] **Expected**: Document list refreshes automatically
- [ ] **Verify**: New document appears without manual refresh

---

### 6. Error Handling Testing

#### 6.1 API Error Modal
- [ ] Stop backend server
- [ ] Try any API operation (view documents, search, etc.)
- [ ] **Expected**: Error modal displays
- [ ] **Verify**: Modal shows error icon
- [ ] **Verify**: Error title and message are clear
- [ ] **Verify**: Can close modal with button or ESC key

#### 6.2 Network Error Modal
- [ ] Disconnect from internet (or block localhost:3000)
- [ ] Try any API operation
- [ ] **Expected**: Network error modal displays
- [ ] **Verify**: Message indicates connection issue
- [ ] **Verify**: Suggests checking internet connection

#### 6.3 Auto-Dismiss for Info Messages
- [ ] Trigger an info-level message (if available)
- [ ] **Expected**: Modal auto-dismisses after 5 seconds
- [ ] **Verify**: Can manually close before 5 seconds

#### 6.4 Technical Details Collapsible
- [ ] Trigger an error with technical details
- [ ] **Expected**: "Technical Details" section is collapsible
- [ ] **Verify**: Can expand/collapse details
- [ ] **Verify**: Details show error stack or API response

#### 6.5 Keyboard Accessibility
- [ ] Open error modal
- [ ] Press ESC key
- [ ] **Expected**: Modal closes
- [ ] Press TAB key
- [ ] **Expected**: Focus moves to close button
- [ ] Press ENTER
- [ ] **Expected**: Modal closes

---

## Test Results Template

Copy this template to record your test results:

```
## Test Results - [Date]

### 1. Authentication Flow
- [ ] 1.1 Login with valid credentials: PASS / FAIL
- [ ] 1.2 Login with invalid credentials: PASS / FAIL
- [ ] 1.3 Session persistence: PASS / FAIL
- [ ] 1.4 Logout functionality: PASS / FAIL

### 2. Document Management
- [ ] 2.1 View document list: PASS / FAIL
- [ ] 2.2 Create new document: PASS / FAIL
- [ ] 2.3 Edit existing document: PASS / FAIL
- [ ] 2.4 Delete document: PASS / FAIL
- [ ] 2.5 Auto-refresh: PASS / FAIL

### 3. Knowledge Graph
- [ ] 3.1 Graph visualization: PASS / FAIL
- [ ] 3.2 Zoom functionality: PASS / FAIL
- [ ] 3.3 Pan functionality: PASS / FAIL
- [ ] 3.4 Node selection: PASS / FAIL
- [ ] 3.5 Auto-refresh: PASS / FAIL

### 4. AI Search
- [ ] 4.1 Search with valid query: PASS / FAIL
- [ ] 4.2 Search with no results: PASS / FAIL
- [ ] 4.3 Loading states: PASS / FAIL
- [ ] 4.4 Error handling: PASS / FAIL

### 5. File Upload
- [ ] 5.1 Upload valid file: PASS / FAIL
- [ ] 5.2 File type validation: PASS / FAIL
- [ ] 5.3 Upload progress: PASS / FAIL
- [ ] 5.4 List refresh after upload: PASS / FAIL

### 6. Error Handling
- [ ] 6.1 API error modal: PASS / FAIL
- [ ] 6.2 Network error modal: PASS / FAIL
- [ ] 6.3 Auto-dismiss info: PASS / FAIL
- [ ] 6.4 Technical details: PASS / FAIL
- [ ] 6.5 Keyboard accessibility: PASS / FAIL

### Issues Found
[List any issues or bugs discovered during testing]

### Notes
[Any additional observations or comments]
```

---

## Troubleshooting

### Backend Not Responding
- Verify backend is running: `curl http://localhost:3000/api/health`
- Check backend logs for errors
- Verify CORS is configured correctly

### Frontend Not Loading
- Check browser console for errors
- Verify environment variables in `.env.local`
- Clear browser cache and localStorage

### Authentication Issues
- Check token in localStorage (DevTools → Application → Local Storage)
- Verify token format (should be JWT)
- Check backend authentication middleware

### Graph Not Rendering
- Check browser console for D3.js errors
- Verify graph data structure matches expected format
- Check if data transformation is working correctly

---

## Next Steps After Testing

1. Document all test results
2. Create issues for any bugs found
3. Prioritize and fix critical issues
4. Re-test after fixes
5. Proceed to production build testing
