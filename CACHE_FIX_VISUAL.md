# Cache Cross-Contamination Fix - Visual Explanation

## The Problem (Before Fix)

```
DATABASE: cached_blueprint_structures
┌─────────────┬──────────────────────┬──────────────────────────┐
│ section_id  │ subject_area         │ cached_unit              │
├─────────────┼──────────────────────┼──────────────────────────┤
│ Problem 3   │ Mechanical Eng       │ {Heat Exchangers data}   │  ← From HW 9
│ Problem 3   │ Mechanical Eng       │ {Radiation data}         │  ← From HW 10
└─────────────┴──────────────────────┴──────────────────────────┘

QUERY: "Give me Problem 3"
❌ Returns FIRST match = Heat Exchangers (wrong!)
```

### What Happened:
1. User creates blueprint on **HW 10 (Radiation)**
2. Cache query looks for `section_id = "Problem 3"`
3. Database returns **both** Problem 3 entries
4. Code uses `.find()` which picks the **first one** = HW 9's data ❌
5. User gets Heat Exchanger content instead of Radiation content!

---

## The Solution (After Fix)

```
DATABASE: cached_blueprint_structures
┌─────────────┬────────────────────┬──────────────────────────┐
│ section_id  │ source_blueprint_id│ cached_unit              │
├─────────────┼────────────────────┼──────────────────────────┤
│ Problem 3   │ abc-111-hw9        │ {Heat Exchangers data}   │  ← HW 9
│ Problem 3   │ xyz-222-hw10       │ {Radiation data}         │  ← HW 10
└─────────────┴────────────────────┴──────────────────────────┘

QUERY: "Give me Problem 3 from blueprint xyz-222-hw10"
✅ Returns EXACT match = Radiation (correct!)
```

### How It Works Now:
1. User creates blueprint on **HW 10 (Radiation)** with ID `xyz-222-hw10`
2. Cache query looks for `source_blueprint_id = "xyz-222-hw10" AND section_id = "Problem 3"`
3. Database returns **only** the HW 10 entry
4. User gets the correct Radiation content! ✅

---

## Key Changes

### 1. Store Blueprint ID When Caching

**File:** `generate-structure-legacy/index.ts`

```typescript
// OLD (Missing blueprint_id):
const cacheEntry = {
  section_id: "Problem 3",
  subject_area: "Mechanical Engineering",
  cached_unit: { /* data */ }
};

// NEW (Includes blueprint_id):
const cacheEntry = {
  section_id: "Problem 3",
  source_blueprint_id: blueprint_id,  // ← ADDED THIS
  subject_area: "Mechanical Engineering",
  cached_unit: { /* data */ }
};
```

### 2. Query by Blueprint ID + Section ID

**File:** `_shared/section-embeddings.ts`

```typescript
// OLD (Query by section_id only):
.select('*')
.in('section_id', ['Problem 3'])
// Returns ALL "Problem 3" entries ❌

// NEW (Query by blueprint_id + section_id):
.select('*')
.or('and(source_blueprint_id.eq.xyz-222,section_id.eq.Problem 3)')
// Returns ONLY the specific blueprint's entry ✅
```

### 3. Match Exactly

```typescript
// OLD (First match):
const data = cachedSections.find(s => s.section_id === "Problem 3");
// Could return wrong homework's data ❌

// NEW (Exact match):
const data = cachedSections.find(s => 
  s.section_id === "Problem 3" &&
  s.source_blueprint_id === "xyz-222-hw10"
);
// Always returns correct homework's data ✅
```

---

## Why Blueprint ID is Better

| Approach | Reliability | Simplicity | Future-Proof |
|----------|-------------|------------|--------------|
| **Text matching** (subject_area) | ⚠️ Medium | ❌ Complex | ❌ Fragile |
| **Blueprint ID** (UUID) | ✅ Perfect | ✅ Simple | ✅ Robust |

### Text Matching Problems:
- "Mechanical Engineering" vs "Mech Eng" = different strings
- "Heat Transfer" vs "Heat Exchangers" = close but not exact
- Requires multi-tier fallback logic
- Hard to debug when it fails

### Blueprint ID Benefits:
- UUID = guaranteed unique
- No text variations
- One exact match
- Easy to debug (see exact blueprint in logs)

---

## Testing

### Before Fix:
```
[section-embeddings] Looking for section "Problem 3"
[section-embeddings] Available: ["Problem 3", "Problem 3"]  ← TWO MATCHES!
[section-embeddings] ✅ Retrieved: Heat Exchangers           ← WRONG ONE
```

### After Fix:
```
[section-embeddings] Looking for section "Problem 3" from blueprint "xyz-222-hw10"
[section-embeddings] ✅ Matched from blueprint "xyz-222-hw10": Radiation  ← CORRECT!
```

---

## Summary

**Problem:** Cache returned wrong homework's data because section names overlap  
**Root Cause:** Query matched by `section_id` alone, without blueprint context  
**Solution:** Use `(source_blueprint_id, section_id)` as unique key  
**Result:** Each homework's cache is isolated and never mixed up ✅

