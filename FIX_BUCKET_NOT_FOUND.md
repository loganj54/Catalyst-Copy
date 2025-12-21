# QUICK FIX: Bucket Not Found Error

## The Problem

You're getting `{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}` because the `class-documents` storage bucket doesn't exist in your Supabase project yet.

## The Solution (Choose One)

### ⚡ Option A: Create Bucket Manually (EASIEST - 2 minutes)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click **Storage** in the left sidebar
   - Click **"New bucket"** button

3. **Create the Bucket**
   - **Name**: `class-documents` (type this exactly)
   - **Public bucket**: ✅ Check this box (IMPORTANT!)
   - Click **"Create bucket"**

4. **Set Up Policies**
   - Go to **SQL Editor** in the left sidebar
   - Click **"New query"**
   - Copy and paste the contents of `create_class_documents_bucket.sql`
   - Click **"Run"** or press `Ctrl+Enter`
   - You should see success messages with ✅ symbols

5. **Test the Feature**
   - Go back to your app
   - Try viewing a document again
   - It should now open in a new tab! 🎉

---

### 🔧 Option B: Create Everything via SQL (ADVANCED)

1. **Go to Supabase Dashboard → SQL Editor**

2. **Run this query:**

```sql
-- Create the bucket manually first
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('class-documents', 'class-documents', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true;
```

3. **Then run the policy setup:**
   - Copy contents of `create_class_documents_bucket.sql`
   - Paste and run in SQL Editor

---

## Verification

After creating the bucket, verify it exists:

### In Supabase UI:
1. Go to **Storage**
2. You should see **class-documents** in the list
3. It should show **"Public"** badge

### Via SQL:
```sql
SELECT * FROM storage.buckets WHERE id = 'class-documents';
```

Should return one row with `public = true`

---

## Why This Happened

The bucket needs to be created before you can upload or view documents. The original `fix_document_viewing.sql` file attempted to create it, but Supabase sometimes requires buckets to be created through the UI first for proper initialization.

---

## After Fixing

Once the bucket exists:
- ✅ Document uploads will work
- ✅ Document viewing will work
- ✅ Document deletion will work
- ✅ All RLS policies will protect your data

---

## Still Having Issues?

### Error: "Bucket not found"
- Double-check the bucket name is exactly `class-documents` (with hyphen, not underscore)
- Verify the bucket shows as **Public** in Storage

### Error: "Access denied" or "Unauthorized"
- Make sure you ran the SQL policies from `create_class_documents_bucket.sql`
- Check that you're logged in to the app

### Documents won't open
- Check browser console (F12) for detailed error messages
- Verify the document was uploaded successfully (check Storage → class-documents)

---

## Quick Test

After setting up:

1. Upload a PDF to a class
2. Click the three dots (⋮) on the document
3. Click "View"
4. PDF should open in a new tab! ✨

If you still see "Bucket not found", the bucket wasn't created properly. Try **Option A** above (manual creation in UI).

