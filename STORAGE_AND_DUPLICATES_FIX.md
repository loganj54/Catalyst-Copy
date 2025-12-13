# 🔧 Storage & Duplicate Detection Fix

## What Was Fixed

### Problem 1: Documents Getting Deleted When Blueprints Are Deleted ❌
The `analyze-document` edge function was automatically deleting files from storage after analyzing them as a "privacy-first" feature. This meant:
- When you deleted blueprints, the associated documents were gone forever
- Documents couldn't be reused across multiple blueprints
- Users lost their uploaded files unexpectedly

### Problem 2: No Duplicate Detection ❌
The system didn't check for duplicate documents, so:
- Same file could be uploaded multiple times to the same class
- Wasted storage space
- Created confusion with duplicate files

## The Solution ✅

### 1. Files Are Now Preserved in Storage
**Changed in**: `supabase/functions/analyze-document/index.ts`

- ✅ Files are **NEVER** deleted from storage after analysis
- ✅ Documents persist even when blueprints are deleted
- ✅ Files can be reused across multiple blueprints
- ✅ Only deleted when:
  - User explicitly deletes the document from the class page
  - The entire class is deleted (cascade delete from database)

### 2. Duplicate Detection Added
**Changed in**: 
- `src/pages/ClassDetails.jsx` (class document uploads)
- `src/components/BlueprintModal.jsx` (blueprint creation with documents)

**How it works:**
- Checks for duplicates by **filename AND file size** within the same class
- Different classes can have the same document (duplicates allowed across classes)
- When duplicate found:
  - **In ClassDetails**: Asks user if they want to upload anyway
  - **In BlueprintModal**: Automatically reuses the existing document
  
**User Experience:**

#### Scenario A: Uploading to Class Page
```
User uploads "syllabus.pdf" to Physics 101
  ↓
System checks: Is there a "syllabus.pdf" with same size in Physics 101?
  ↓
  ├─ NOT FOUND → Upload proceeds normally ✅
  └─ FOUND → Shows prompt:
      "⚠️ A document with the same name and size already exists in this class:
      
      'syllabus.pdf' (234.5 KB)
      
      Do you want to upload it anyway as a new version?"
      
      [Cancel] [Upload Anyway]
```

#### Scenario B: Creating Blueprint with Document
```
User creates blueprint and uploads "syllabus.pdf"
  ↓
System checks: Is there a "syllabus.pdf" with same size in this class?
  ↓
  ├─ NOT FOUND → Upload proceeds normally ✅
  └─ FOUND → Shows message and reuses existing:
      "ℹ️ This document already exists in the class!
      
      'syllabus.pdf'
      
      We'll reuse the existing file instead of uploading a duplicate."
      
      Blueprint created with link to existing document ✅
```

## Files Modified

### Backend (Edge Function)
1. **`supabase/functions/analyze-document/index.ts`**
   - Removed file deletion logic (lines 416-460)
   - Updated return message to reflect file preservation
   - Added comments explaining the new behavior

### Frontend (React Components)
2. **`src/pages/ClassDetails.jsx`**
   - Added duplicate check before uploading (checks filename + size)
   - Shows confirmation dialog if duplicate found
   - User can choose to upload anyway or cancel

3. **`src/components/BlueprintModal.jsx`**
   - Added duplicate check before uploading (checks filename + size)
   - Automatically reuses existing document if found
   - Shows informative message to user

4. **`src/pages/Blueprint.jsx`**
   - Updated UI to remove "file deleted" messaging
   - Updated debug panel to reflect files are preserved
   - Removed green "deleted" status indicators

## Testing Checklist

### Test 1: File Preservation ✅
1. Create a blueprint with a document
2. Run analysis (Step 1)
3. Delete the blueprint from UI
4. Go to the class page → Documents tab
5. **Expected**: Document should still be there

### Test 2: Duplicate Detection in Class Page ✅
1. Go to a class page → Documents tab
2. Upload "test.pdf" (100 KB)
3. Try to upload the same "test.pdf" (100 KB) again
4. **Expected**: See confirmation dialog asking if you want to upload anyway
5. Click Cancel → File not uploaded
6. Try again and click "Upload Anyway" → Second copy uploaded

### Test 3: Duplicate Detection in Blueprint Creation ✅
1. Upload "syllabus.pdf" to Physics 101 class
2. Create Blueprint A using "syllabus.pdf"
3. Create Blueprint B and try to upload the same "syllabus.pdf"
4. **Expected**: See message that document exists, blueprint uses existing file
5. Check storage → Only ONE copy of syllabus.pdf exists

### Test 4: Cross-Class Duplicates Allowed ✅
1. Upload "syllabus.pdf" to Physics 101
2. Upload same "syllabus.pdf" to Math 201
3. **Expected**: Both uploads succeed (different classes = different buckets conceptually)

### Test 5: Document Deletion Still Works ✅
1. Go to class page → Documents tab
2. Click "..." menu on a document
3. Click "Delete"
4. **Expected**: Document deleted from both database AND storage

## Technical Details

### Duplicate Detection Logic

```javascript
// Check by filename AND size within the same class
const { data: existingDocs } = await supabase
  .from('class_documents')
  .select('*')
  .eq('class_id', classId)        // Same class
  .eq('user_id', userId)           // Same user
  .eq('name', fileName)            // Same filename
  .eq('file_size', fileSize);      // Same size

if (existingDocs && existingDocs.length > 0) {
  // Duplicate found!
}
```

### Why Filename + Size?
- **Filename alone**: Too aggressive (prevents legitimate updates)
- **Size alone**: Not specific enough (many files could be same size)
- **Filename + Size**: Good balance - catches true duplicates while allowing intentional updates
- **Content hash**: More accurate but expensive and not implemented yet

### Storage Path Structure
```
class-documents/
  └── {user_id}/
      └── {class_id}/
          └── {timestamp}.{ext}
```

Files are organized by user and class, with timestamps preventing name collisions.

## Migration Notes

### No Database Changes Needed ✅
This is purely a code change - no SQL migrations required!

### No Action Required
All changes are in the codebase. Just:
1. Deploy the updated edge function
2. Deploy the frontend changes
3. Test with the checklist above

## Future Enhancements

### Smart Duplicate Detection
- Add content-based hashing (SHA-256) for more accurate duplicate detection
- Show preview of existing document when duplicate found
- Option to "replace" existing document instead of creating duplicate

### Document Versioning
- Keep multiple versions of the same document
- Track document history (v1, v2, v3...)
- Ability to restore previous versions

### Storage Optimization
- Deduplicate identical files across classes (single storage, multiple references)
- Compress large files automatically
- Archive old documents to cheaper storage tier

## Summary

✅ **Files are now preserved** - Never deleted when blueprints are deleted  
✅ **Duplicate detection added** - Prevents accidental duplicate uploads in same class  
✅ **Cross-class duplicates allowed** - Same file can exist in multiple classes  
✅ **User-friendly prompts** - Clear messaging when duplicates are detected  
✅ **No breaking changes** - All existing functionality preserved  

**Your documents are now safe and the system is smarter! 🎉**

