# Function: generate-blueprint-name

## Metadata
- **Version**: 1.0.0
- **Last Updated**: 2026-01-05
- **Updated By**: manual
- **Production Status**: DEVELOPMENT

## Purpose
Generate AI-powered name for blueprint based on document analysis.

## Responsibility
Generates names using Claude. ONLY generates names - does NOT analyze documents or store results.

## Input Contract

### TypeScript Interface
```typescript
interface GenerateBlueprintNameInput {
  analysis: AnalysisResult;
  current_title: string;
}
```

### Example Input
```json
{
  "analysis": {
    "subject_area": "thermodynamics",
    "specific_topic": "heat transfer"
  },
  "current_title": "Untitled Blueprint"
}
```

## Output Contract

### TypeScript Interface
```typescript
interface GenerateBlueprintNameOutput {
  blueprint_name: string;
  suggested_class: string | null;
  confidence: number;
  reasoning: string;
}
```

### Example Output
```json
{
  "blueprint_name": "Heat Transfer Problem Set",
  "suggested_class": "ME 301 - Thermodynamics",
  "confidence": 0.9,
  "reasoning": "Based on content analysis..."
}
```

## Dependencies
- Anthropic API (Claude)
- `PROMPTS.blueprintNaming` from _shared/prompts.ts

## Testing Examples
**Test Case**: Valid analysis → Generates descriptive name

## Known Issues & Fixes
(Populated by self-healing agent)

## Change History
- **2026-01-05**: Initial implementation - manual

