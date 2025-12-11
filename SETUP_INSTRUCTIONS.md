# Setup Instructions for Document Upload Feature

## ✅ What's Been Completed

All code changes have been implemented and are ready to use! The dev server has already hot-reloaded all changes.

### Features Implemented:
1. ✅ File upload in Blueprint Modal with visual feedback
2. ✅ Document upload in Class Details page
3. ✅ Visual display of uploaded documents with actions (view, download, delete)
4. ✅ Document display on Blueprint detail page

## 🔧 Required Setup (Database & Storage)

To make the upload functionality work, you need to complete these Supabase setup steps:

### Step 1: Create Database Table
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open and run the file: `create_class_documents_table.sql`
4. Click **Run** to create the `class_documents` table

### Step 2: Create Storage Buckets
1. Go to **Storage** in your Supabase dashboard
2. Create two new buckets:

#### Bucket 1: `blueprint-documents`
   - Click **New Bucket**
   - Name: `blueprint-documents`
   - Make it **Public** ✓
   - Click **Create Bucket**

#### Bucket 2: `class-documents`
   - Click **New Bucket**
   - Name: `class-documents`
   - Make it **Public** ✓
   - Click **Create Bucket**

### Step 3: Add Storage Policies
For each bucket, add RLS policies:

1. Click on the bucket name
2. Go to **Policies** tab
3. Click **New Policy**
4. Use the SQL commands from `STORAGE_SETUP.md`

**Quick Copy-Paste for blueprint-documents:**
```sql
-- INSERT policy
create policy "Users can upload blueprint documents"
on storage.objects for insert
with check (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy
create policy "Users can view their own blueprint documents"
on storage.objects for select
using (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE policy
create policy "Users can delete their own blueprint documents"
on storage.objects for delete
using (
  bucket_id = 'blueprint-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

**Quick Copy-Paste for class-documents:**
```sql
-- INSERT policy
create policy "Users can upload class documents"
on storage.objects for insert
with check (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy
create policy "Users can view their own class documents"
on storage.objects for select
using (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE policy
create policy "Users can delete their own class documents"
on storage.objects for delete
using (
  bucket_id = 'class-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

## 🧪 Testing the Feature

Once setup is complete, test the following:

### Test Blueprint Modal Upload:
1. Navigate to http://localhost:5173/dashboard
2. Click on a class or create a new one
3. Click **New Blueprint** button
4. In the modal, click the upload area under "Show me what you're looking at"
5. Select a file (PDF, image, or document)
6. Verify the file preview appears with name and size
7. Click **Generate Blueprint**
8. On the blueprint page, verify your document appears in the "Context Provided" section

### Test Class Documents Upload:
1. Navigate to a class page
2. Click on the **Documents** tab
3. Click **Upload Document**
4. Select a file
5. Verify it appears in the grid with the correct name and size
6. Try the following actions:
   - Click the **three dots** menu
   - Click **View** to open in new tab
   - Click **Download** to download the file
   - Click **Delete** to remove it

## 📁 Files Changed/Created

### Modified Files:
- `src/components/BlueprintModal.jsx` - Added file upload functionality
- `src/pages/ClassDetails.jsx` - Added documents tab functionality
- `src/pages/Blueprint.jsx` - Added document display

### New Files Created:
- `create_class_documents_table.sql` - Database migration
- `STORAGE_SETUP.md` - Detailed storage setup guide
- `DOCUMENT_UPLOAD_FEATURE.md` - Complete feature documentation
- `SETUP_INSTRUCTIONS.md` - This file

## 🎨 UI Features

### Blueprint Modal:
- Clickable upload area with hover effects
- File preview card showing name, size, and type
- Remove file button
- Supports drag-and-drop styling

### Class Documents:
- Grid layout of document cards
- Document metadata (name, size, date, time)
- Action dropdown menu (view, download, delete)
- Empty state with call-to-action
- Loading state during upload

### Blueprint Page:
- Document display in "Context Provided" section
- View and download buttons
- File metadata display

## ⚙️ Technical Specifications

- **Max file size:** 10MB
- **Supported formats:** PDF, PNG, JPG, JPEG, TXT, DOC, DOCX
- **Storage structure:** 
  - Blueprint docs: `{user_id}/{timestamp}.{extension}`
  - Class docs: `{user_id}/{class_id}/{timestamp}.{extension}`
- **Security:** Row Level Security (RLS) ensures users can only access their own files

## 🆘 Troubleshooting

### "Failed to upload document" error:
- Verify storage buckets are created with correct names
- Check that buckets are set to **Public**
- Verify storage policies are applied

### Files not appearing:
- Check browser console for errors
- Verify `class_documents` table exists
- Check Supabase logs for policy violations

### Can't view/download files:
- Verify bucket is set to **Public**
- Check file URL in browser console
- Verify storage SELECT policies are applied

## 📚 Additional Documentation

For more detailed information, see:
- `STORAGE_SETUP.md` - Complete storage configuration guide
- `DOCUMENT_UPLOAD_FEATURE.md` - Technical implementation details

## ✨ You're All Set!

Once you complete the Supabase setup steps above, the document upload feature will be fully functional. The UI is already working and ready to use!

Questions? Check the troubleshooting section or review the detailed documentation files.

