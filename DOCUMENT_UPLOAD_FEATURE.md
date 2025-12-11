# Document Upload Feature - Implementation Summary

## Overview
This document describes the implementation of the document upload functionality across the application, including Blueprint modals and Class pages.

## Features Implemented

### 1. Blueprint Modal Document Upload
**Location:** `src/components/BlueprintModal.jsx`

**Features:**
- File upload button with drag-and-drop UI
- Visual feedback showing uploaded file name, size, and type
- File validation (max 10MB)
- Support for PDF, images (PNG, JPG, JPEG), text files, and documents (DOC, DOCX)
- Files are uploaded to Supabase Storage bucket: `blueprint-documents`
- File metadata stored in blueprint content JSON
- Remove file button before submitting

**UI Changes:**
- Added file input with hidden element
- Upload area shows file icon and instructions when empty
- Displays uploaded file with preview card showing file details
- Trash icon to remove selected file

### 2. Class Documents Tab
**Location:** `src/pages/ClassDetails.jsx`

**Features:**
- Upload documents to specific classes
- View all uploaded documents in a grid layout
- Document cards show file name, size, and upload date/time
- Actions: View, Download, Delete documents
- Files are uploaded to Supabase Storage bucket: `class-documents`
- Document metadata stored in `class_documents` database table

**UI Changes:**
- Documents tab now displays uploaded documents in a responsive grid
- Each document card has a dropdown menu with actions
- Upload button available both when empty and when documents exist
- Loading state during upload
- Empty state with call-to-action when no documents

### 3. Blueprint Page Document Display
**Location:** `src/pages/Blueprint.jsx`

**Features:**
- Display uploaded documents from blueprint creation
- Show document name, size, and type
- View and download buttons for accessing documents
- Integrated into "Context Provided" section

## Database Changes

### New Table: `class_documents`
Created in: `create_class_documents_table.sql`

**Schema:**
```sql
- id (uuid, primary key)
- class_id (uuid, foreign key to classes)
- user_id (uuid, foreign key to users)
- name (text) - Original filename
- file_path (text) - Storage path
- file_url (text) - Public URL
- file_size (bigint) - Size in bytes
- file_type (text) - MIME type
- created_at (timestamp)
```

**Row Level Security:**
- Users can only view, create, update, and delete their own documents
- Cascading delete when parent class is deleted

## Storage Configuration

### Required Buckets
See `STORAGE_SETUP.md` for detailed setup instructions.

1. **blueprint-documents**
   - Public bucket
   - Stores documents uploaded via Blueprint modals
   - Path structure: `{user_id}/{timestamp}.{extension}`

2. **class-documents**
   - Public bucket
   - Stores documents uploaded to class pages
   - Path structure: `{user_id}/{class_id}/{timestamp}.{extension}`

### Storage Policies
Both buckets have RLS policies that:
- Allow users to upload files to their own user folder
- Allow users to view their own files only
- Allow users to delete their own files only

## File Organization

### Blueprint Documents
- Organized by user ID
- Filename format: `{user_id}/{timestamp}.{extension}`
- Metadata stored in `blueprints.content` JSON field

### Class Documents
- Organized by user ID and class ID
- Filename format: `{user_id}/{class_id}/{timestamp}.{extension}`
- Metadata stored in `class_documents` table

## Security Features

1. **File Size Validation**
   - Maximum 10MB per file
   - Validated on frontend before upload

2. **File Type Validation**
   - Accepted types: .pdf, .png, .jpg, .jpeg, .txt, .doc, .docx
   - Enforced via HTML input accept attribute

3. **Authentication Required**
   - All uploads require authenticated user
   - User ID embedded in file paths

4. **Row Level Security**
   - Database policies ensure users can only access their own documents
   - Storage policies match database security model

## Setup Instructions

### 1. Run Database Migration
Execute the SQL file to create the `class_documents` table:
```bash
# In Supabase SQL Editor, run:
create_class_documents_table.sql
```

### 2. Configure Storage Buckets
Follow instructions in `STORAGE_SETUP.md` to:
1. Create `blueprint-documents` bucket
2. Create `class-documents` bucket
3. Set both buckets to public
4. Add RLS policies for each bucket

### 3. Test the Feature
1. Navigate to a class page
2. Click "Upload Document" in the Documents tab
3. Select a file (ensure it's under 10MB)
4. Verify the document appears in the grid
5. Test View, Download, and Delete actions

For Blueprint modal:
1. Open Blueprint modal from any page
2. Click the upload area in the "Show me what you're looking at" section
3. Select a file
4. Verify file preview appears
5. Create the blueprint
6. Verify document appears on the blueprint page

## Technical Details

### Dependencies
- **lucide-react**: Icons for UI (Upload, FileText, Trash2, Download, etc.)
- **@supabase/supabase-js**: Storage and database operations

### Key Functions

#### BlueprintModal.jsx
- `handleFileUpload(e)` - Handles file selection with validation
- `removeFile()` - Clears selected file before submission
- File upload to storage happens during `handleSubmit()`

#### ClassDetails.jsx
- `handleDocumentUpload(e)` - Uploads file to storage and saves metadata to database
- `handleDeleteDocument(e, documentId, filePath)` - Deletes document from storage and database
- `fetchClassDetails()` - Fetches documents along with class data

#### Blueprint.jsx
- Displays uploaded document from `content.fileUpload` if present

## Error Handling

1. **File Size Exceeded**: Alert shown if file > 10MB
2. **Upload Failure**: Alert shown with error message, blueprint/class still created
3. **Delete Failure**: Alert shown, document list not updated
4. **Network Errors**: Logged to console, user-friendly alerts displayed

## Future Enhancements

Potential improvements for future iterations:
1. Add drag-and-drop functionality
2. Support for multiple file uploads
3. Preview for image files
4. File type icons based on extension
5. Search/filter documents
6. Batch delete documents
7. Document categories/tags
8. OCR for scanned documents
9. AI-powered document analysis
10. Document sharing between users

## Testing Checklist

- [ ] Upload document via Blueprint modal
- [ ] Upload document via Class Documents tab
- [ ] View uploaded document
- [ ] Download uploaded document
- [ ] Delete uploaded document
- [ ] Verify file size validation (try > 10MB)
- [ ] Verify file type validation
- [ ] Test with different file types (PDF, images, text)
- [ ] Verify documents persist after page refresh
- [ ] Test responsive design on mobile
- [ ] Verify RLS policies (user can only see their own documents)

## Troubleshooting

### Files not uploading
1. Check Supabase Storage buckets are created
2. Verify storage policies are applied correctly
3. Check browser console for errors
4. Verify user is authenticated

### Documents not displaying
1. Check `class_documents` table exists
2. Verify RLS policies on table
3. Check network tab for failed API calls
4. Verify file URLs are accessible

### Storage errors
1. Verify bucket names match code: `blueprint-documents` and `class-documents`
2. Check storage policies allow authenticated users
3. Verify file paths follow expected structure
4. Check Supabase storage quota limits

