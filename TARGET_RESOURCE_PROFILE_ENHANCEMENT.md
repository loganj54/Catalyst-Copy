# Target Resource Profile Enhancement

## Overview
Enhanced the target resource profile generation to differentiate between introduction/concept videos and problem-solving walkthrough videos, providing much more detailed and precise search context for problem-solving videos.

## Changes Made

### Modified File
- `supabase/functions/_shared/prompts.ts`

### What Changed

#### 1. **Introduction/Concept Videos (topic/prerequisite units)**
- **Kept exactly as before** - no changes to this flow
- Generates concise 2-3 sentence descriptions
- Focuses on explaining concepts, definitions, and basic examples
- Example: "A video explaining Newton's Second Law clearly, defining force, mass, and acceleration. The video should cover the relationship F=ma with real-world examples and demonstrate how to apply it to simple problems."

#### 2. **Problem-Solving Videos (walkthrough units)**
- **MAJOR ENHANCEMENT**: Now includes the COMPLETE problem statement
- Format: `"A video solving this problem: [FULL PROBLEM STATEMENT] + [Solution approach description]"`
- Includes ALL details from the original problem:
  - All given values with units
  - Unknown variables
  - Conditions and constraints
  - Assumptions
  - Full context
- Then adds solution approach details:
  - Specific equations to use
  - Key concepts to explain
  - Solving steps

#### Example of Enhanced Walkthrough Profile

**Before (generic):**
```
"A step-by-step solution for car acceleration problems using Newton's Second Law"
```

**After (specific with full problem):**
```
"A video solving this problem: A 2000 kg car accelerates from rest to 25 m/s in 8 seconds on a level road. The coefficient of friction is 0.15. Calculate the force applied by the engine and the distance traveled during acceleration. The video should show step-by-step calculations using Newton's Second Law and kinematic equations, explaining the relationship between force, friction, and acceleration, and demonstrating how to solve for both the applied force and distance."
```

## Benefits

### 1. **Dramatically Improved Search Precision**
- The embedding now contains the actual problem details
- Semantic search can match videos solving similar/identical problems
- Much higher relevance scores for problem-specific videos

### 2. **Better Resource Matching**
- Can find videos that solve problems with similar:
  - Numerical values and scales
  - Physical scenarios
  - Solving approaches
  - Complexity levels

### 3. **Context-Rich Embeddings**
- The embedding vector now captures:
  - Problem type and domain
  - Specific numerical context
  - Required solving techniques
  - Conceptual relationships

### 4. **Maintains Introduction Video Quality**
- No changes to concept/prerequisite video profiles
- They remain concise and focused on understanding
- Perfect for learning foundational concepts

## Technical Implementation

### Prompt Instructions Added

1. **System Prompt Enhancement** (lines 229-248):
   - Clear distinction between unit types
   - Explicit format requirements
   - Concrete examples for both types

2. **User Prompt Enhancement** (lines 321-323):
   - Mandatory field requirement
   - Specific instructions to copy problem_statement from input
   - Guidance on what to include from input fields

3. **Output Format Specification** (line 305):
   - Updated to reflect different lengths for different unit types
   - Clarified that walkthrough units include full problem statement

### Data Flow

```
Document Analysis (problem_statement field)
    ↓
Generate Structure (AI extracts and includes in target_resource_profile)
    ↓
Target Resource Embedding (embedding includes full problem)
    ↓
Search Resources (semantic search with problem-specific context)
    ↓
Highly Relevant Problem Walkthrough Videos
```

## Usage

No code changes required - the AI will automatically:
1. Detect unit_type for each learning unit
2. For "walkthrough" units, extract the problem_statement from the input
3. Include the full problem statement in the target_resource_profile
4. Generate the embedding with all this rich context

## Testing Recommendations

1. **Test with a problem set document**
   - Upload a homework assignment with specific problems
   - Verify walkthrough units include full problem statements
   - Check that search results are highly specific

2. **Test with lecture notes**
   - Upload lecture/concept material
   - Verify topic units remain concise (2-3 sentences)
   - Check that introduction videos are still well-matched

3. **Compare search quality**
   - Before: Generic problem type searches
   - After: Specific problem context searches
   - Measure relevance improvement

## Deployment

To deploy this enhancement:

```bash
# Deploy the updated prompts (shared module used by generate-structure)
cd supabase/functions
deno cache _shared/prompts.ts

# The generate-structure function will automatically use the updated prompts
# No separate deployment needed - it imports from _shared/prompts.ts
```

## Notes

- The change is backward compatible - existing blueprints are unaffected
- New blueprints will automatically benefit from enhanced profiles
- The embedding generation function (`generateTargetResourceEmbeddings`) already handles variable-length text
- Token usage may increase slightly for walkthrough units due to longer profiles, but the precision gain is worth it

## Future Enhancements

Potential improvements to consider:
1. Add problem difficulty indicators to the profile
2. Include common mistake warnings from the analysis
3. Add prerequisite concept tags for better filtering
4. Include figure/diagram requirements in the profile

