# Function: adapt-cached-structure

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Adapt cached learning structure to match new document analysis.

## Responsibility
This function adapts structures. It ONLY adapts - it does NOT check cache, generate new structures, or store. Delegates to shared helper.

## Input Contract

### TypeScript Interface
```typescript
interface AdaptCachedStructureInput {
  cached_structure: LearningStructure;
  new_analysis: AnalysisResult;
}
```

### Example Input
```json
{
  "cached_structure": {
    "summary": {...},
    "prerequisites_section": {...},
    "content_sections": [...]
  },
  "new_analysis": {
    "document_type": "problem_set",
    "subject_area": "thermodynamics",
    "specific_topic": "heat transfer"
  }
}
```

### Input Validation Rules
- `cached_structure`: Must be valid LearningStructure
- `new_analysis`: Must be valid AnalysisResult

## Output Contract

### TypeScript Interface
```typescript
interface AdaptCachedStructureOutput {
  adapted_structure: LearningStructure;
  metadata?: {
    adaptation_time_ms: number;
    changes_made: string[];
  };
}
```

### Example Output (Success)
```json
{
  "adapted_structure": {
    "summary": {...},
    "prerequisites_section": {...},
    "content_sections": [...]
  },
  "metadata": {
    "adaptation_time_ms": 1500,
    "changes_made": ["Updated topics", "Adjusted prerequisites"]
  }
}
```

## Behavior Specification

### Normal Flow
1. Validate inputs
2. Call `adaptCachedStructure()` from _shared/structure-cache.ts
3. Return adapted structure with metadata

### Edge Cases
- **No Changes Needed**: Returns structure as-is
- **Major Differences**: Adapts significantly

### Performance Requirements
- **Timeout**: 5 seconds
- **Memory**: Max 50MB

## Dependencies

### External APIs
- Anthropic API (Claude) for adaptation logic

### Database Tables
- None (pure transformation)

### Internal Functions
- `adaptCachedStructure()` from `_shared/structure-cache.ts`

### Environment Variables
- `ANTHROPIC_API_KEY`: Required for AI adaptation

## Error Handling

### Error Codes
- `INVALID_INPUT`: Missing required fields
- `API_ERROR`: Claude API failed

### Error Recovery Strategies
- **API_ERROR**: Return original structure as fallback

### Fallback Behavior
- Return cached structure unchanged if adaptation fails

## Testing Examples

### Test Case 1: Successful Adaptation
**Input:** Cached structure + new analysis
**Expected Output:** Adapted structure with changes

### Test Case 2: Similar Analysis
**Input:** Very similar analysis to cached
**Expected Output:** Minimal changes

## Known Issues & Fixes

(This section will be populated by the self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

