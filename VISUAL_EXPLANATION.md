## Visual Explanation: Before vs After

### BEFORE (with CASCADE DELETE) ❌

```
You delete a blueprint from UI
         ↓
    Blueprint gets deleted from database
         ↓
    CASCADE DELETE triggers
         ↓
    Document analysis gets deleted too! 💥
         ↓
    Analysis is gone forever (expensive AI work wasted)
```

**Database Structure (BEFORE):**
```
┌─────────────┐
│  blueprints │
│             │
│  id: 123    │
└──────┬──────┘
       │
       │ ON DELETE CASCADE 💥
       │
       ↓
┌─────────────────────┐
│ document_analyses   │
│                     │
│ blueprint_id: 123   │ ← Gets DELETED when blueprint is deleted
│ raw_analysis: {...} │
└─────────────────────┘
```

---

### AFTER (with SET NULL) ✅

```
You delete a blueprint from UI
         ↓
    Blueprint gets deleted from database
         ↓
    SET NULL triggers
         ↓
    Document analysis STAYS in database ✅
    (only blueprint_id becomes NULL)
         ↓
    Analysis is preserved! Can be found by filename, class_id, or user_id
```

**Database Structure (AFTER):**
```
┌─────────────┐
│  blueprints │
│             │
│  id: 123    │ ← DELETED
└──────┬──────┘
       │
       │ ON DELETE SET NULL ✅
       │
       ↓
┌─────────────────────┐
│ document_analyses   │
│                     │
│ blueprint_id: NULL  │ ← Set to NULL (analysis preserved!)
│ raw_analysis: {...} │ ← Still contains all the AI-generated data
│ source_filename: .. │ ← Can still find by filename
│ class_id: 456       │ ← Can still find by class
│ user_id: 789        │ ← Can still find by user
└─────────────────────┘
```

---

## Real-World Example

### Scenario: You upload a syllabus for "Physics 101"

1. **Upload document**: `physics_101_syllabus.pdf` → saved in `class_documents`
2. **Create Blueprint A**: "Understanding Week 1 material"
   - Uses `physics_101_syllabus.pdf`
   - Analyze document → Creates `document_analysis` record (costs $0.01 AI call)
   - Links: `blueprint_id: A`, `source_filename: physics_101_syllabus.pdf`
3. **Delete Blueprint A**: 
   - **BEFORE**: Analysis deleted, wasted $0.01 💸
   - **AFTER**: Analysis preserved, `blueprint_id` → NULL ✅
4. **Create Blueprint B**: "Studying for midterm"
   - Uses SAME `physics_101_syllabus.pdf`
   - **BEFORE**: Had to analyze again (another $0.01) 💸
   - **AFTER**: Can reuse existing analysis by filename (FREE!) 🎉

---

## How to Find Preserved Analyses

Even with `blueprint_id = NULL`, you can still find analyses by:

### 1. By Filename
```sql
SELECT * FROM document_analyses 
WHERE source_filename = 'physics_101_syllabus.pdf'
  AND user_id = 'your-user-id';
```

### 2. By Class
```sql
SELECT * FROM document_analyses 
WHERE class_id = 'physics-101-class-id'
  AND user_id = 'your-user-id';
```

### 3. By User (all your analyses)
```sql
SELECT * FROM document_analyses 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

---

## What Gets Deleted vs Preserved

| Action | Blueprint | Document Analysis | Class Document | File in Storage |
|--------|-----------|-------------------|----------------|-----------------|
| Delete blueprint | ✅ Deleted | ✅ **PRESERVED** | ✅ Preserved | ✅ Preserved |
| Delete class document | ✅ Preserved | ✅ **PRESERVED** | ✅ Deleted | ✅ Deleted |
| Delete class | ✅ Deleted (cascade) | ✅ **PRESERVED** | ✅ Deleted (cascade) | ✅ Remains |
| Retry analysis | ✅ Preserved | ⚠️ Replaced (intentional) | ✅ Preserved | ✅ Preserved |

**Key Insight**: Document analyses are now **permanent** unless you explicitly delete them from Supabase dashboard or retry analysis for the same blueprint.

