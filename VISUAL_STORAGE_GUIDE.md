## Visual Guide: Document Lifecycle & Duplicate Detection

### BEFORE (Documents Getting Deleted) ❌

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User uploads "syllabus.pdf" to Physics 101              │
│    → File stored in: class-documents/user123/physics101/   │
│    → Database record created in class_documents table       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User creates Blueprint A with syllabus.pdf              │
│    → Blueprint links to file URL                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User runs "Analyze Document" (Step 1)                   │
│    → AI analyzes the PDF                                    │
│    → Analysis saved to database                             │
│    → 💥 FILE DELETED FROM STORAGE! (Privacy-first)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. User deletes Blueprint A                                │
│    → Blueprint deleted                                      │
│    → File already gone! ❌                                  │
│    → Can't reuse for Blueprint B ❌                         │
└─────────────────────────────────────────────────────────────┘
```

---

### AFTER (Documents Preserved + Duplicate Detection) ✅

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User uploads "syllabus.pdf" to Physics 101              │
│    ✓ System checks: Does syllabus.pdf already exist?       │
│    ✓ NOT FOUND → Upload proceeds                           │
│    → File stored in: class-documents/user123/physics101/   │
│    → Database record created in class_documents table       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. User creates Blueprint A with syllabus.pdf              │
│    ✓ System checks: Does syllabus.pdf already exist?       │
│    ✓ FOUND → Reuses existing file! (No duplicate upload)   │
│    → Blueprint links to existing file URL                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User runs "Analyze Document" (Step 1)                   │
│    → AI analyzes the PDF                                    │
│    → Analysis saved to database                             │
│    ✅ FILE PRESERVED IN STORAGE!                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. User deletes Blueprint A                                │
│    → Blueprint deleted                                      │
│    ✅ File still exists in class documents!                 │
│    ✅ Can be reused for Blueprint B!                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. User creates Blueprint B with same syllabus.pdf         │
│    ✓ System checks: Does syllabus.pdf already exist?       │
│    ✓ FOUND → Reuses existing file! (Smart!)                │
│    ✅ No duplicate upload                                   │
│    ✅ Saves storage space                                   │
│    ✅ Faster (no upload needed)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Duplicate Detection Flow

### Scenario 1: First Upload (No Duplicate)
```
User uploads "notes.pdf" (500 KB)
         ↓
┌────────────────────────┐
│ Check for Duplicates   │
│ - Filename: notes.pdf  │
│ - Size: 500 KB         │
│ - Class: Physics 101   │
└────────────────────────┘
         ↓
    NOT FOUND ✅
         ↓
┌────────────────────────┐
│ Upload to Storage      │
│ Save to Database       │
│ ✅ Success!            │
└────────────────────────┘
```

### Scenario 2: Duplicate Found (Class Page Upload)
```
User tries to upload "notes.pdf" (500 KB) again
         ↓
┌────────────────────────┐
│ Check for Duplicates   │
│ - Filename: notes.pdf  │
│ - Size: 500 KB         │
│ - Class: Physics 101   │
└────────────────────────┘
         ↓
    FOUND! ⚠️
         ↓
┌────────────────────────────────────────┐
│ Show Confirmation Dialog               │
│                                        │
│ "⚠️ Document already exists:          │
│  notes.pdf (500 KB)                   │
│                                        │
│  Upload as new version?"               │
│                                        │
│  [Cancel]  [Upload Anyway]            │
└────────────────────────────────────────┘
         ↓                    ↓
    [Cancel]           [Upload Anyway]
         ↓                    ↓
    No upload            Upload with
    ✅ Success          new timestamp
                             ↓
                        ✅ Success
```

### Scenario 3: Duplicate Found (Blueprint Creation)
```
User creates blueprint with "notes.pdf" (500 KB)
         ↓
┌────────────────────────┐
│ Check for Duplicates   │
│ - Filename: notes.pdf  │
│ - Size: 500 KB         │
│ - Class: Physics 101   │
└────────────────────────┘
         ↓
    FOUND! ✅
         ↓
┌────────────────────────────────────────┐
│ Show Info Message                      │
│                                        │
│ "ℹ️ Document already exists!          │
│  Reusing existing file."               │
│                                        │
│  [OK]                                  │
└────────────────────────────────────────┘
         ↓
┌────────────────────────┐
│ Link to Existing File  │
│ No Upload Needed       │
│ ✅ Success!            │
└────────────────────────┘
```

---

## When Documents Get Deleted

```
╔════════════════════════════════════════════════════════════╗
║  ONLY TWO WAYS DOCUMENTS GET DELETED:                      ║
╚════════════════════════════════════════════════════════════╝

1. USER EXPLICITLY DELETES FROM CLASS PAGE
   
   Class Page → Documents Tab → [...] → Delete
                                          ↓
                          Confirmation Dialog
                                          ↓
                                     [Confirm]
                                          ↓
                          ┌───────────────────────┐
                          │ Delete from Storage   │
                          │ Delete from Database  │
                          │ ✅ Gone forever       │
                          └───────────────────────┘


2. ENTIRE CLASS IS DELETED
   
   Dashboard → Class Card → [...] → Remove Class
                                          ↓
                          Confirmation Dialog
                                          ↓
                                     [Confirm]
                                          ↓
                          ┌───────────────────────┐
                          │ Delete Class Record   │
                          │ CASCADE DELETE:       │
                          │  - All Blueprints     │
                          │  - All Class Docs     │
                          │  - Storage Files      │
                          │ ✅ Everything cleaned │
                          └───────────────────────┘


✅ THESE DO NOT DELETE DOCUMENTS:
   - Deleting a blueprint
   - Running "Analyze Document"
   - Creating multiple blueprints with same doc
```

---

## Database & Storage State

### Storage Structure
```
supabase-storage/
└── class-documents/
    └── user-abc-123/
        ├── physics-101/
        │   ├── 1701234567890.pdf  ← syllabus.pdf
        │   └── 1701234589123.pdf  ← notes.pdf
        └── math-201/
            └── 1701234601456.pdf  ← Same syllabus.pdf (allowed!)
```

### Database Records
```sql
-- class_documents table
┌────────────┬──────────────┬─────────────────┬──────────────────────────────────┐
│ id         │ class_id     │ name            │ file_path                        │
├────────────┼──────────────┼─────────────────┼──────────────────────────────────┤
│ doc-1      │ physics-101  │ syllabus.pdf    │ user-abc/physics-101/1701...pdf  │
│ doc-2      │ physics-101  │ notes.pdf       │ user-abc/physics-101/1701...pdf  │
│ doc-3      │ math-201     │ syllabus.pdf    │ user-abc/math-201/1701...pdf     │
└────────────┴──────────────┴─────────────────┴──────────────────────────────────┘
                                                  ↑
                         Duplicate filename OK (different classes)

-- blueprints table (multiple blueprints can reference same file_metadata.url)
┌────────────┬──────────────┬─────────────────┬──────────────────────────────────┐
│ id         │ class_id     │ title           │ file_metadata.url                │
├────────────┼──────────────┼─────────────────┼──────────────────────────────────┤
│ bp-1       │ physics-101  │ Blueprint A     │ https://.../1701...pdf           │
│ bp-2       │ physics-101  │ Blueprint B     │ https://.../1701...pdf (SAME!)   │
└────────────┴──────────────┴─────────────────┴──────────────────────────────────┘
                                                  ↑
                                Multiple blueprints sharing ONE file ✅
```

---

## Edge Cases Handled

### ✅ Same filename, different size
```
Upload "notes.pdf" (500 KB)  → Success
Upload "notes.pdf" (750 KB)  → Different size, treated as different file
                                → Upload proceeds
```

### ✅ Same filename, same size, different class
```
Physics 101: "syllabus.pdf" (234 KB)  → Success
Math 201:    "syllabus.pdf" (234 KB)  → Different class, allowed
                                       → Upload proceeds
```

### ✅ File modified and re-uploaded
```
Upload "notes.pdf" (500 KB)  → Success
Edit notes.pdf locally
Upload "notes.pdf" (520 KB)  → Different size
                              → Upload proceeds (new version)
```

### ✅ Blueprint with existing document
```
Document already in class → Reuses existing
Document not in class     → Uploads new copy
```

---

## Key Takeaways

1. **Documents are permanent** unless you explicitly delete them
2. **Duplicates are caught** within the same class
3. **Cross-class duplicates are OK** (same file can exist in multiple classes)
4. **Blueprints share documents** instead of creating duplicates
5. **Storage is optimized** by preventing unnecessary uploads
6. **User is always in control** - clear prompts when duplicates are found

