# Document Analysis Preservation Strategy

## Problem
When deleting blueprints from the UI, the associated document analyses were being deleted from the database due to CASCADE DELETE constraints. This is undesirable because:

1. Document analyses are expensive to generate (AI API costs)
2. The same document might be reused across multiple blueprints
3. Analyses contain valuable learning metadata that should be preserved
4. Users should only delete data explicitly via Supabase dashboard if needed

## Solution

### 1. Database Changes (SQL Migration)

**File**: `fix_document_analyses_cascade.sql`

Changes the foreign key constraint on `document_analyses.blueprint_id` from:
- `ON DELETE CASCADE` → deletes analysis when blueprint is deleted
- `ON DELETE SET NULL` → preserves analysis, just sets blueprint_id to NULL

This means:
- ✅ Document analyses are NEVER automatically deleted
- ✅ Analyses can be found by `source_filename`, `class_id`, or `user_id`
- ✅ Orphaned analyses (where blueprint was deleted) are preserved
- ✅ Same document analysis can be reused across multiple blueprints

### 2. Frontend Changes

**No changes needed** - the frontend never directly deletes document analyses. It only deletes:
- `class_documents` (from `class_documents` table) - OK to delete
- `blueprints` (from `blueprints` table) - OK to delete (won't cascade to analyses after SQL fix)

### 3. Edge Function Behavior

**File**: `supabase/functions/analyze-document/index.ts`

The `analyze-document` function has ONE intentional delete operation (lines 139-147):

```typescript
// Delete any existing analysis for this blueprint (to allow retry)
const { error: deleteError } = await supabase
  .from('document_analyses')
  .delete()
  .eq('blueprint_id', blueprint_id);
```

**This is OK because**:
- It only deletes when a user explicitly retries analysis for the same blueprint
- It's a "replace" operation - immediately followed by inserting new analysis
- User is intentionally regenerating the analysis

### 4. Document Reuse Strategy

When selecting an existing document in `BlueprintModal.jsx`:

```typescript
const handleSelectDocument = (doc) => {
  setSelectedDocument(doc);
  setFormData(prev => ({...prev, fileUpload: {
    name: doc.name,
    url: doc.file_url,
    isExisting: true  // This flag tells the system to reuse existing document
  }}));
};
```

The analyze-document function should check for existing analyses by **filename** before analyzing:

```typescript
// Check if we already have an analysis for this document
const { data: existingAnalysis } = await supabase
  .from('document_analyses')
  .select('*')
  .eq('source_filename', fileName)
  .eq('user_id', user_id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingAnalysis) {
  // Reuse existing analysis instead of analyzing again
  // Link it to this blueprint
  await supabase
    .from('document_analyses')
    .update({ blueprint_id: blueprint_id })
    .eq('id', existingAnalysis.id);
    
  return existingAnalysis;
}
```

## Migration Checklist

- [ ] Run `fix_document_analyses_cascade.sql` in Supabase SQL Editor
- [ ] Verify constraint change with verification queries in SQL file
- [ ] Test deleting a blueprint - confirm analysis is preserved
- [ ] Test creating new blueprint with same document - should reuse analysis
- [ ] Update `analyze-document` function to check for existing analyses by filename

## Testing

### Test 1: Delete Blueprint
1. Create a blueprint with a document
2. Run analysis (Step 1)
3. Delete the blueprint from UI
4. Check `document_analyses` table - analysis should still exist with `blueprint_id = NULL`

### Test 2: Reuse Document
1. Upload document to class (appears in class_documents)
2. Create Blueprint A using that document
3. Run analysis for Blueprint A
4. Create Blueprint B using the SAME document
5. Blueprint B should reuse the existing analysis (no new Claude API call)

### Test 3: Retry Analysis
1. Create blueprint with document
2. Run analysis
3. Click "Analyze Document" again (retry)
4. Old analysis should be deleted and replaced with new one (this is intentional)

## Future Enhancements

1. **Smart Analysis Reuse**: Detect when the same document is used in multiple blueprints and automatically link to existing analysis
2. **Analysis History**: Keep multiple versions of analysis for the same document (versioning)
3. **Bulk Delete Tool**: Admin interface to clean up truly orphaned analyses (where both blueprint AND class are deleted)
4. **Analysis Cache**: Show users a list of previously analyzed documents when creating new blueprints

