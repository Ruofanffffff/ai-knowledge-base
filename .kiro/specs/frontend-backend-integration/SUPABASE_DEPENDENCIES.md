# Supabase Dependencies Analysis

**Task**: 2.1 - Search and identify all Supabase imports in codebase  
**Date**: 2024-02-04  
**Status**: Complete

## Summary

This document lists all files in the codebase that contain Supabase dependencies and need to be modified or removed as part of the frontend-backend integration.

---

## 1. Core Frontend Files (Require Modification)

### 1.1 Main API File
**File**: `src/utils/api.ts`  
**Status**: ⚠️ CRITICAL - Main API integration file  
**Supabase Usage**:
- Imports `@supabase/supabase-js` package
- Creates Supabase client instance
- Uses Supabase authentication (`supabase.auth.getSession()`)
- Uses Supabase real-time subscriptions (`supabase.channel()`)
- Exports `supabase` client for use in other files

**Functions Using Supabase**:
- `getHeaders()` - Gets auth session from Supabase
- `uploadFile()` - Gets auth session from Supabase
- `subscribeToGraph()` - Uses Supabase real-time channels

**Action Required**: 
- Replace with new backend API integration
- Remove Supabase client initialization
- Replace authentication with JWT token from localStorage
- Remove real-time subscription (or implement polling)

---

### 1.2 Supabase Configuration File
**File**: `src/utils/supabase/info.tsx`  
**Status**: ⚠️ DELETE - Configuration file  
**Content**:
- Contains Supabase project ID: `ptossppxhftttevalfid`
- Contains public anon key (JWT token)
- Auto-generated file

**Action Required**: 
- Delete this file completely
- Remove the entire `src/utils/supabase/` directory

---

## 2. Supabase Edge Functions (Can Be Ignored)

These files are part of Supabase Edge Functions and are NOT part of the React frontend. They can be left as-is or removed if not needed.

### 2.1 Server Function
**File**: `src/supabase/functions/server/index.tsx`  
**Status**: ℹ️ EDGE FUNCTION - Not part of frontend  
**Supabase Usage**:
- Imports `jsr:@supabase/supabase-js@2`
- Creates Supabase admin client
- Uses Supabase Storage API
- Uses Supabase Auth API

**Action Required**: 
- Can be left as-is (not part of frontend)
- Or delete if edge functions are not being used

---

### 2.2 KV Store Function
**File**: `src/supabase/functions/server/kv_store.tsx`  
**Status**: ℹ️ EDGE FUNCTION - Not part of frontend  
**Supabase Usage**:
- Imports `jsr:@supabase/supabase-js@2.49.8`
- Creates Supabase client for database operations
- Uses Supabase database tables

**Action Required**: 
- Can be left as-is (not part of frontend)
- Or delete if edge functions are not being used

---

## 3. Package Dependencies

### 3.1 Root Package.json
**File**: `package.json`  
**Status**: ⚠️ REQUIRES UPDATE  
**Supabase Packages**:
```json
{
  "dependencies": {
    "@jsr/supabase__supabase-js": "^2.49.8",
    "@supabase/supabase-js": "*"
  }
}
```

**Action Required**: 
- Run `npm uninstall @supabase/supabase-js`
- Run `npm uninstall @jsr/supabase__supabase-js`
- Update package.json to remove these dependencies

---

### 3.2 Vite Configuration
**File**: `vite.config.ts`  
**Status**: ⚠️ REQUIRES UPDATE  
**Supabase References**:
```typescript
resolve: {
  alias: {
    '@jsr/supabase__supabase-js@2.49.8': '@jsr/supabase__supabase-js',
    '@jsr/supabase__supabase-js@2': '@jsr/supabase__supabase-js',
  }
}
```

**Action Required**: 
- Remove Supabase alias entries from vite.config.ts

---

## 4. Files That Import from api.ts

**Search Result**: ✅ No files found importing from `src/utils/api.ts`

**Verification Complete**: Searched for usage of all exported functions:
- ✅ `supabase` - Not used in any components
- ✅ `getGraphData()` - Only defined in api.ts, not called anywhere
- ✅ `saveGraphData()` - Only defined in api.ts, not called anywhere
- ✅ `getDocuments()` - Only defined in api.ts, not called anywhere (kg/document_processor uses different function)
- ✅ `saveDocument()` - Only defined in api.ts, not called anywhere
- ✅ `searchDocuments()` - Only defined in api.ts, not called anywhere
- ✅ `uploadFile()` - Only defined in api.ts, not called anywhere (src/pages/DocumentsList.tsx has interface but doesn't import)
- ✅ `getFiles()` - Only defined in api.ts, not called anywhere
- ✅ `subscribeToGraph()` - Only defined in api.ts, not called anywhere

**Excellent News**: The Supabase integration in `api.ts` is completely unused! This means:
- No components need to be updated
- We can safely delete or replace `api.ts` without breaking anything
- The frontend is not yet connected to any backend (Supabase or otherwise)

---

## 5. Environment Variables

**Search Result**: No `.env` files contain SUPABASE environment variables

**Note**: The Supabase configuration is hardcoded in `src/utils/supabase/info.tsx` rather than using environment variables.

---

## 6. Summary of Required Actions

### High Priority (Must Do)
1. ✅ **Identify all Supabase imports** (COMPLETED - this document)
2. ✅ **Uninstall Supabase packages** (COMPLETED - 2024-02-04):
   ```bash
   npm uninstall @supabase/supabase-js @jsr/supabase__supabase-js
   ```
   - Successfully removed `@supabase/supabase-js` from package.json
   - Successfully removed `@jsr/supabase__supabase-js` from package.json
   - Verified no Supabase packages remain in node_modules
3. ⏳ **Delete Supabase configuration**:
   ```bash
   rm -rf src/utils/supabase/
   ```
4. ⏳ **Replace `src/utils/api.ts`**:
   - Create new API service layer (as per design document)
   - Replace Supabase auth with JWT token management
   - Replace real-time subscriptions with polling
5. ⏳ **Update `vite.config.ts`**:
   - Remove Supabase alias entries

### Medium Priority (Should Do)
6. ⏳ **Search for usage of api.ts functions**:
   - Find all components using `getGraphData()`, `saveGraphData()`, etc.
   - Update them to use new API services
7. ⏳ **Verify no remaining references**:
   - Search codebase for any remaining "supabase" strings
   - Ensure all imports are removed

### Low Priority (Optional)
8. ⏳ **Clean up Supabase Edge Functions**:
   - Delete `src/supabase/functions/` directory if not needed
   - These are server-side functions, not part of the React frontend

---

## 7. Files Requiring Modification

### Critical Files (Must Modify)
1. `src/utils/api.ts` - Main API integration file
2. `package.json` - Remove Supabase dependencies
3. `vite.config.ts` - Remove Supabase aliases

### Files to Delete
1. `src/utils/supabase/info.tsx` - Supabase configuration
2. `src/utils/supabase/` - Entire directory

### Files to Ignore (Edge Functions)
1. `src/supabase/functions/server/index.tsx`
2. `src/supabase/functions/server/kv_store.tsx`

---

## 8. Next Steps

After completing this analysis, proceed to:
- **Task 2.2**: Uninstall Supabase packages
- **Task 2.3**: Remove Supabase configuration files
- **Task 3.x**: Begin implementing new API service layer

---

## 9. Risk Assessment

### ✅ Very Low Risk
- **No components are importing from `api.ts`** - Verified by comprehensive search
- **No functions from `api.ts` are being called** - All exports are unused
- Supabase usage is completely isolated to one file (`src/utils/api.ts`)
- Configuration is in a single file (`src/utils/supabase/info.tsx`)
- **The frontend is not yet connected to any backend** - This is a greenfield integration

### Potential Considerations
- Real-time subscription feature (`subscribeToGraph`) will need to be replaced with polling when implemented
- Authentication flow needs to be implemented from scratch (currently not in use)
- All API functions need to be implemented to connect to the Express backend

### Migration Complexity: **LOW**
Since no components are using the Supabase API, we can:
1. Delete the existing `api.ts` file without breaking anything
2. Implement the new API service layer from scratch
3. Connect components to the new API as we build them

---

**Analysis Complete**: All Supabase dependencies have been identified and documented.  
**Ready for**: Task 2.2 (Uninstall Supabase packages)
