# Section Caching: Before vs After

## The Problem (Before)

When generating a blueprint with 5 sections, only **1 row** was created:

```
cached_blueprint_structures table:
┌────────────┬────────────────┬──────────────────────────────────┐
│ id         │ section_id     │ cached_unit                      │
├────────────┼────────────────┼──────────────────────────────────┤
│ uuid-123   │ ???            │ {entire structure with all 5     │
│            │                │  sections combined}              │
└────────────┴────────────────┴──────────────────────────────────┘

❌ WRONG: Cannot cache/retrieve individual sections
❌ WRONG: No granular reuse
❌ WRONG: Missing individual problem/topic text
```

## The Solution (After)

Same blueprint now creates **5 rows** (one per section):

```
cached_blueprint_structures table:
┌────────────┬─────────────┬───────────┬────────────────────────┬─────────────────────────┬─────────────────┐
│ id         │ section_id  │ type      │ section_title          │ problem_statement_text  │ concepts_tested │
├────────────┼─────────────┼───────────┼────────────────────────┼─────────────────────────┼─────────────────┤
│ uuid-001   │ Problem 1   │ problem   │ Problem 1: Kinematics  │ "A car accelerates..."  │ [Newton, Force] │
│ uuid-002   │ Problem 2   │ problem   │ Problem 2: Energy      │ "Calculate the work..." │ [Energy, Work]  │
│ uuid-003   │ Problem 3   │ problem   │ Problem 3: Momentum    │ "Two objects collide..." │ [Momentum]     │
│ uuid-004   │ Topic 1     │ topic     │ Topic 1: Newton's Laws │ NULL                    │ [Newton, Force] │
│ uuid-005   │ Topic 2     │ topic     │ Topic 2: Conservation  │ NULL                    │ [Energy, Work]  │
└────────────┴─────────────┴───────────┴────────────────────────┴─────────────────────────┴─────────────────┘

✅ CORRECT: Each section is a separate row
✅ CORRECT: Can cache/retrieve individual sections
✅ CORRECT: Full problem/topic text stored
✅ CORRECT: Individual embeddings for similarity search
```

## Database Columns (Detailed)

### For Problems (section_type = 'problem')

```sql
section_id: "Problem 1"
section_type: "problem"
section_title: "Problem 1: Thermodynamics"

-- Problem-specific fields (POPULATED)
problem_statement_text: "A 2000 kg car accelerates from rest..."
problem_statement_embedding: [0.123, 0.456, ...] (1536 dimensions)

-- Topic-specific fields (NULL for problems)
topic_summary_text: NULL
topic_summary_embedding: NULL

-- Common fields
primary_embedding: [0.123, 0.456, ...] (same as problem_statement_embedding)
concepts_tested: ["Newton's Laws", "Kinematics", "Force"]
cached_unit: { unit_id: "...", topic: "...", search_queries: [...] }
embedding_source: "problem_statement"

-- Metadata
subject_area: "Physics"
specific_topic: "Mechanics"
document_type: "problem_set"
times_used: 0
quality_score: 1.0
```

### For Topics (section_type = 'topic')

```sql
section_id: "Topic 1"
section_type: "topic"
section_title: "Topic 1: Newton's Laws of Motion"

-- Problem-specific fields (NULL for topics)
problem_statement_text: NULL
problem_statement_embedding: NULL

-- Topic-specific fields (POPULATED)
topic_summary_text: "This section covers Newton's three laws..."
topic_summary_embedding: [0.789, 0.012, ...] (1536 dimensions)

-- Common fields
primary_embedding: [0.789, 0.012, ...] (same as topic_summary_embedding)
concepts_tested: ["Newton's First Law", "Inertia", "Force and Acceleration"]
cached_unit: { unit_id: "...", topic: "...", search_queries: [...] }
embedding_source: "topic_summary+concepts_tested"

-- Metadata
subject_area: "Physics"
specific_topic: "Classical Mechanics"
document_type: "lecture"
times_used: 0
quality_score: 1.0
```

## Cache Lookup Flow

### Before (Wrong)

```
User generates blueprint with Problem 1
  ↓
Check cache for entire structure
  ↓
No match found (too strict)
  ↓
Generate ALL sections from scratch
  ↓
Store as 1 conglomerate row
```

### After (Correct)

```
User generates blueprint with 5 sections
  ↓
For each section:
  ├─ Problem 1: Check cache
  │    ↓
  │    ✅ FOUND! (problem_statement matches 95%)
  │    ↓
  │    Retrieve cached_unit
  │
  ├─ Problem 2: Check cache
  │    ↓
  │    ❌ NOT FOUND
  │    ↓
  │    Generate with AI
  │    ↓
  │    Store as new row
  │
  ├─ Problem 3: Check cache
  │    ↓
  │    ✅ FOUND!
  │
  ├─ Topic 1: Check cache
  │    ↓
  │    ✅ FOUND! (topic_summary matches 96%)
  │
  └─ Topic 2: Check cache
       ↓
       ❌ NOT FOUND
       ↓
       Generate with AI
       ↓
       Store as new row
  ↓
Combine: 3 cached + 2 generated = Complete structure
  ↓
Result: 60% cache hit rate, 3000 tokens saved
```

## Example: Physics Homework

### Document Analysis Input

```json
{
  "sections": [
    {
      "section_id": "Problem 1",
      "section_type": "problem",
      "problem_statement": "A 2000 kg car accelerates from rest to 25 m/s...",
      "concepts_tested": ["Newton's Second Law", "Kinematics"]
    },
    {
      "section_id": "Problem 2",
      "section_type": "problem",
      "problem_statement": "Calculate the work done by a force of 50 N...",
      "concepts_tested": ["Work", "Energy"]
    },
    {
      "section_id": "Topic 1",
      "section_type": "topic",
      "topic_summary": "This section introduces Newton's Laws of Motion...",
      "concepts_tested": ["Newton's Laws", "Force", "Acceleration"]
    }
  ]
}
```

### Database Rows Created (After Generation)

```sql
-- Row 1: Problem 1
INSERT INTO cached_blueprint_structures (
  section_id,
  section_type,
  section_title,
  problem_statement_text,
  problem_statement_embedding,
  primary_embedding,
  concepts_tested,
  cached_unit,
  subject_area,
  document_type
) VALUES (
  'Problem 1',
  'problem',
  'Problem 1: Kinematics',
  'A 2000 kg car accelerates from rest to 25 m/s...',
  [0.123, 0.456, ...],  -- embedding of problem statement
  [0.123, 0.456, ...],  -- same as problem_statement_embedding
  ARRAY['Newton''s Second Law', 'Kinematics'],
  '{"unit_id": "...", "topic": "...", ...}'::jsonb,
  'Physics',
  'problem_set'
);

-- Row 2: Problem 2
INSERT INTO cached_blueprint_structures (
  section_id,
  section_type,
  section_title,
  problem_statement_text,
  problem_statement_embedding,
  primary_embedding,
  concepts_tested,
  cached_unit,
  subject_area,
  document_type
) VALUES (
  'Problem 2',
  'problem',
  'Problem 2: Work and Energy',
  'Calculate the work done by a force of 50 N...',
  [0.789, 0.012, ...],  -- embedding of problem statement
  [0.789, 0.012, ...],  -- same as problem_statement_embedding
  ARRAY['Work', 'Energy'],
  '{"unit_id": "...", "topic": "...", ...}'::jsonb,
  'Physics',
  'problem_set'
);

-- Row 3: Topic 1
INSERT INTO cached_blueprint_structures (
  section_id,
  section_type,
  section_title,
  topic_summary_text,
  topic_summary_embedding,
  primary_embedding,
  concepts_tested,
  cached_unit,
  subject_area,
  document_type
) VALUES (
  'Topic 1',
  'topic',
  'Topic 1: Newton''s Laws',
  'This section introduces Newton''s Laws of Motion...',
  [0.345, 0.678, ...],  -- embedding of summary + concepts
  [0.345, 0.678, ...],  -- same as topic_summary_embedding
  ARRAY['Newton''s Laws', 'Force', 'Acceleration'],
  '{"unit_id": "...", "topic": "...", ...}'::jsonb,
  'Physics',
  'lecture'
);
```

## Verification

### Count Rows Per Blueprint

```sql
SELECT 
  source_analysis_id,
  COUNT(*) as sections_cached,
  array_agg(section_id ORDER BY section_id) as sections
FROM cached_blueprint_structures
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY source_analysis_id;

-- Expected output:
-- source_analysis_id | sections_cached | sections
-- uuid-abc-123       | 3               | {Problem 1, Problem 2, Topic 1}
```

### View Individual Sections

```sql
SELECT 
  section_id,
  section_type,
  section_title,
  CASE 
    WHEN section_type = 'problem' THEN 
      substring(problem_statement_text, 1, 50) || '...'
    WHEN section_type = 'topic' THEN 
      substring(topic_summary_text, 1, 50) || '...'
  END as content_preview,
  array_length(concepts_tested, 1) as num_concepts,
  times_used
FROM cached_blueprint_structures
ORDER BY created_at DESC
LIMIT 10;

-- Expected output:
-- section_id | section_type | section_title           | content_preview                | num_concepts | times_used
-- Problem 1  | problem      | Problem 1: Kinematics   | A 2000 kg car accelerates...   | 2            | 0
-- Problem 2  | problem      | Problem 2: Work/Energy  | Calculate the work done...     | 2            | 0
-- Topic 1    | topic        | Topic 1: Newton's Laws  | This section introduces...     | 3            | 0
```

---

**Key Takeaway:** The refactor ensures that **each section gets its own row** with all relevant text and embeddings, enabling true granular caching and reuse! 🎯

