# Supabase Storage Setup Instructions

This document contains instructions for setting up the required storage buckets in Supabase.

## Required Storage Buckets

### 1. class-documents
This bucket stores documents uploaded to classes (syllabus, assignments, lecture notes, etc.).

**Setup:**
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `class-documents`
3. Set bucket to **public** (so users can view their uploaded documents)
4. Add the following policies:

**Storage Policies for class-documents:**

```sql
-- Policy for INSERT: Users can upload files to their own user folder
create policy "Users can upload class documents"
on storage.objects for insert
with check (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for SELECT: Users can view their own files
create policy "Users can view their own class documents"
on storage.objects for select
using (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for DELETE: Users can delete their own files
create policy "Users can delete their own class documents"
on storage.objects for delete
using (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

### 2. blueprint-documents
This bucket stores documents uploaded within blueprint modals.

**Setup:**
1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `blueprint-documents`
3. Set bucket to **public** (so users can view their uploaded documents)
4. Add the following policies:

**Storage Policies for blueprint-documents:**

```sql
-- Policy for INSERT: Users can upload files to their own user folder
create policy "Users can upload blueprint documents"
on storage.objects for insert
with check (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for SELECT: Users can view their own files
create policy "Users can view their own blueprint documents"
on storage.objects for select
using (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for DELETE: Users can delete their own files
create policy "Users can delete their own blueprint documents"
on storage.objects for delete
using (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

## File Organization Structure

Files are organized by user ID and (for class documents) class ID:

- **class-documents**: `{user_id}/{class_id}/{timestamp}.{extension}`
- **blueprint-documents**: `{user_id}/{timestamp}.{extension}`

## Supported File Types

- PDF (.pdf)
- Images (.png, .jpg, .jpeg)
- Text (.txt)
- Documents (.doc, .docx)

## File Size Limits

- Maximum file size: 10MB per file
- This limit is enforced in the frontend before upload

## Security Notes

- All files are scoped to the authenticated user via RLS policies
- Users can only access files they uploaded
- Files are stored with timestamp-based names to avoid conflicts
- Public buckets allow viewing via URL, but RLS policies prevent unauthorized access

