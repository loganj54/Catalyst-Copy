# Blueprint Structure Caching Implementation Plan

## Overview
Cache generated blueprint structures using vector embeddings to dramatically reduce token usage by reusing structures for similar documents.

## Database Schema

### New Table: `cached_blueprint_structures`

```sql
CREATE TABLE cached_blueprint_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Embeddings for semantic matching
  subject_embedding VECTOR(1536),
  topics_embedding VECTOR(1536),
  characteristics_embedding VECTOR(1536),
  
  -- Metadata (searchable, no copyright issues)
  subject_area TEXT NOT NULL,
  specific_topic TEXT,
  topics JSONB,  -- Array of topic strings
  course_level TEXT,  -- 'introductory', 'intermediate', 'advanced'
  document_type TEXT,  -- 'problem_set', 'lecture', 'hybrid'
  num_sections INTEGER,
  num_problems INTEGER,
  has_equations BOOLEAN,
  
  -- The cached structure (our generated content, NOT copyrighted)
  structure JSONB NOT NULL,
  
  -- Quality metrics
  times_used INTEGER DEFAULT 0,
  quality_score FLOAT DEFAULT 0.5,
  user_satisfaction FLOAT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  
  -- Optional: track which analysis it came from (not the document)
  source_analysis_id UUID REFERENCES document_analyses(id)
);

-- Indexes for vector similarity search
CREATE INDEX ON cached_blueprint_structures 
  USING ivfflat (subject_embedding vector_cosine_ops);

CREATE INDEX ON cached_blueprint_structures 
  USING ivfflat (topics_embedding vector_cosine_ops);

CREATE INDEX ON cached_blueprint_structures 
  USING ivfflat (characteristics_embedding vector_cosine_ops);

-- Indexes for filtering
CREATE INDEX ON cached_blueprint_structures(subject_area);
CREATE INDEX ON cached_blueprint_structures(document_type);
CREATE INDEX ON cached_blueprint_structures(course_level);
```

### Vector Similarity Search Function

```sql
CREATE OR REPLACE FUNCTION search_similar_blueprint_structures(
  query_subject_embedding VECTOR(1536),
  query_topics_embedding VECTOR(1536),
  query_characteristics_embedding VECTOR(1536),
  p_subject_area TEXT,
  p_document_type TEXT,
  similarity_threshold FLOAT DEFAULT 0.90,
  max_results INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  structure JSONB,
  subject_area TEXT,
  topics JSONB,
  similarity FLOAT,
  times_used INTEGER,
  quality_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cbs.id,
    cbs.structure,
    cbs.subject_area,
    cbs.topics,
    (
      (1 - (cbs.subject_embedding <=> query_subject_embedding)) * 0.4 +
      (1 - (cbs.topics_embedding <=> query_topics_embedding)) * 0.4 +
      (1 - (cbs.characteristics_embedding <=> query_characteristics_embedding)) * 0.2
    ) AS similarity,
    cbs.times_used,
    cbs.quality_score
  FROM cached_blueprint_structures cbs
  WHERE 
    cbs.subject_area = p_subject_area
    AND cbs.document_type = p_document_type
    AND (
      (1 - (cbs.subject_embedding <=> query_subject_embedding)) * 0.4 +
      (1 - (cbs.topics_embedding <=> query_topics_embedding)) * 0.4 +
      (1 - (cbs.characteristics_embedding <=> query_characteristics_embedding)) * 0.2
    ) >= similarity_threshold
  ORDER BY 
    similarity DESC,
    quality_score DESC,
    times_used DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Flow

### Phase 1: Document Analysis (Unchanged)
```
User uploads document → Analyze with Claude → Extract metadata
```

### Phase 2: Structure Cache Check (NEW)
```typescript
// In generate-structure function

// 1. Create embeddings from analysis metadata
const subjectEmbedding = await generateEmbedding(analysis.subject_area);
const topicsEmbedding = await generateEmbedding(
  analysis.sections.map(s => s.concepts_tested).flat().join(', ')
);
const characteristicsText = `
  ${analysis.document_type} 
  ${analysis.course_level}
  ${analysis.sections.length} sections
  ${analysis.key_equations.length} equations
`;
const charEmbedding = await generateEmbedding(characteristicsText);

// 2. Search for similar cached structures
const cachedStructures = await supabase.rpc('search_similar_blueprint_structures', {
  query_subject_embedding: formatVector(subjectEmbedding),
  query_topics_embedding: formatVector(topicsEmbedding),
  query_characteristics_embedding: formatVector(charEmbedding),
  p_subject_area: analysis.subject_area,
  p_document_type: analysis.document_type,
  similarity_threshold: 0.92,  // Very high threshold
  max_results: 1
});

// 3. If cache hit, adapt and return
if (cachedStructures.length > 0 && cachedStructures[0].similarity >= 0.92) {
  console.log(`[CACHE HIT] Found similar structure (${cachedStructures[0].similarity})`);
  
  const adaptedStructure = adaptStructureToNewDocument(
    cachedStructures[0].structure,
    analysis
  );
  
  // Update usage stats
  await supabase
    .from('cached_blueprint_structures')
    .update({ 
      times_used: cachedStructures[0].times_used + 1,
      last_used_at: new Date().toISOString()
    })
    .eq('id', cachedStructures[0].id);
  
  // Store in blueprint_structures with cache flag
  await storeBlueprintStructure(blueprint_id, adaptedStructure, {
    from_cache: true,
    cache_source_id: cachedStructures[0].id,
    cache_similarity: cachedStructures[0].similarity
  });
  
  return { success: true, structure: adaptedStructure, from_cache: true };
}

// 4. If cache miss, generate new structure (existing flow)
```

### Phase 3: Structure Adaptation (NEW)
```typescript
function adaptStructureToNewDocument(
  cachedStructure: any,
  newAnalysis: any
): any {
  // Clone the cached structure
  const adapted = JSON.parse(JSON.stringify(cachedStructure));
  
  // Update summary to match new document
  adapted.summary.title = `Learning Path: ${newAnalysis.specific_topic}`;
  adapted.summary.description = `Master ${newAnalysis.specific_topic}`;
  
  // Map old sections to new sections (by matching concepts)
  adapted.content_sections = adapted.content_sections.map((cachedSection, idx) => {
    const newSection = newAnalysis.sections[idx];
    if (newSection) {
      return {
        ...cachedSection,
        section_id: newSection.section_id,
        title: newSection.section_type === 'problem' 
          ? `Problem ${idx + 1}: ${newSection.concepts_tested[0]}`
          : `Topic ${idx + 1}: ${newSection.key_concepts[0]}`,
        description: newSection.topic_summary || newSection.problem_statement?.substring(0, 100),
      };
    }
    return cachedSection;
  });
  
  return adapted;
}
```

### Phase 4: Cache New Structures (NEW)
```typescript
// After generating a new structure successfully

async function cacheNewStructure(
  structure: any,
  analysis: any,
  analysisId: string
) {
  // Generate embeddings
  const subjectEmb = await generateEmbedding(analysis.subject_area);
  const topicsEmb = await generateEmbedding(
    analysis.sections.map(s => s.concepts_tested || s.key_concepts).flat().join(', ')
  );
  const charEmb = await generateEmbedding(`
    ${analysis.document_type} ${analysis.course_level}
    ${analysis.sections.length} sections
  `);
  
  // Store in cache
  await supabase.from('cached_blueprint_structures').insert({
    subject_embedding: formatVector(subjectEmb),
    topics_embedding: formatVector(topicsEmb),
    characteristics_embedding: formatVector(charEmb),
    subject_area: analysis.subject_area,
    specific_topic: analysis.specific_topic,
    topics: analysis.sections.map(s => s.concepts_tested || s.key_concepts).flat(),
    course_level: analysis.course_level,
    document_type: analysis.document_type,
    num_sections: analysis.sections.length,
    num_problems: analysis.sections.filter(s => s.section_type === 'problem').length,
    has_equations: (analysis.key_equations?.length || 0) > 0,
    structure: structure,
    quality_score: 0.5,  // Default, will improve over time
    source_analysis_id: analysisId,
  });
}
```

## Token Savings Calculation

### Scenario: 1000 Users

**Assumptions:**
- Average: 50% of documents are "common" (Calculus homework, Physics problem sets, etc.)
- Cache hit rate after 100 users: ~30%
- Cache hit rate after 500 users: ~60%
- Cache hit rate after 1000 users: ~75%

**Token Usage:**

| Scenario | Tokens per Blueprint | Total for 1000 Users |
|----------|---------------------|----------------------|
| **No Cache (Current)** | 32,400 | 32,400,000 |
| **With Cache (100 users)** | 32,400 * 0.7 + 5,000 * 0.3 = 24,180 | 24,180,000 |
| **With Cache (500 users)** | 32,400 * 0.4 + 5,000 * 0.6 = 15,960 | 15,960,000 |
| **With Cache (1000 users)** | 32,400 * 0.25 + 5,000 * 0.75 = 11,850 | 11,850,000 |

**Savings at 1000 users: 63% reduction! 🎉**

(Cache hit costs ~5,000 tokens: embedding generation + adaptation + storage)

## Quality Tracking

Track cache quality to improve recommendations:

```typescript
// After user completes a blueprint
async function recordBlueprintQuality(
  blueprintId: string,
  cacheSourceId: string | null,
  engagement: {
    sectionsCompleted: number,
    totalSections: number,
    resourcesViewed: number,
    timeSpent: number
  }
) {
  if (!cacheSourceId) return;
  
  const qualityScore = calculateQualityScore(engagement);
  
  await supabase.rpc('update_cache_quality', {
    cache_id: cacheSourceId,
    new_quality_score: qualityScore
  });
}
```

## Rollout Plan

### Phase 1: Build Infrastructure (Week 1)
- ✅ Create `cached_blueprint_structures` table
- ✅ Add vector similarity search function
- ✅ Add embedding generation for analysis metadata

### Phase 2: Implement Cache Check (Week 2)
- ✅ Modify `generate-structure` to check cache first
- ✅ Implement structure adaptation logic
- ✅ Add cache hit tracking

### Phase 3: Implement Cache Storage (Week 2)
- ✅ Cache newly generated structures
- ✅ Add quality tracking
- ✅ Monitor cache hit rates

### Phase 4: Optimization (Week 3-4)
- ✅ Tune similarity thresholds
- ✅ Improve adaptation algorithm
- ✅ Add cache warming for common topics

## Legal & Privacy Compliance

### ✅ Copyright Safe
- We store OUR generated content (learning structures)
- We store public metadata (subject, topics)
- We do NOT store copyrighted problem text

### ✅ Privacy Safe
- No personal information stored
- No document text stored
- Only anonymized metadata and our generated structures

### ✅ Terms of Service
Add clause: "Catalyst may cache learning structures for performance optimization"

## Monitoring Dashboard

Track key metrics:

```typescript
interface CacheMetrics {
  total_cached_structures: number;
  cache_hit_rate: number;
  average_similarity_score: number;
  token_savings: number;
  top_cached_subjects: string[];
  cache_quality_distribution: { [key: string]: number };
}
```

## Expected Benefits

### 1. Token Savings
- **Immediate**: 0% (no cache yet)
- **After 100 users**: ~30% savings
- **After 500 users**: ~60% savings
- **After 1000 users**: ~75% savings

### 2. Speed Improvement
- Cache hit: **~2 seconds** (just adaptation)
- Cache miss: **~15-20 seconds** (full generation)
- **7-10x faster** when cache hits!

### 3. Consistency
- Similar documents get similar structures
- Proven structures get reused
- Quality improves over time

### 4. Cost Reduction
- At 1000 users: Save **~$200/month** in API costs
- At 10,000 users: Save **~$3,000/month**

## Success Criteria

After deploying to production:
- ✅ Cache hit rate reaches 30% within first 100 users
- ✅ No copyright violations
- ✅ User satisfaction remains high (>=4.5/5)
- ✅ Average quality score of cached structures >= 0.7
- ✅ Token usage per blueprint drops by 20%+ within 3 months

---

**This is a game-changer for scalability!** 🚀

