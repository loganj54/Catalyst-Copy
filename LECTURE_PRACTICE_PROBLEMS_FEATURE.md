# Lecture Section-Based Practice Problem Generation

## Overview

The practice problem generation system now supports **lecture blueprints** in addition to homework blueprints. You can select specific lecture sections (like "Numerical Methods Overview" or "Why Numerical Methods") and generate practice problems based on the core ideas taught in those sections.

## How It Works

### For Lecture Blueprints

1. **Navigate to Practice Problems Tab**
   - Go to your lecture blueprint
   - Click "Generate Practice Problems" in the sidebar

2. **Select Lecture Sections**
   - You'll see a list of all lecture sections from your blueprint
   - Each section shows:
     - Section title (e.g., "Numerical Methods Overview")
     - Brief description ("Why this matters")
   - Select one or more sections you want to base practice problems on

3. **Generate Problems**
   - Click "Generate Practice Problem"
   - The system will:
     - Extract **core ideas** from the selected sections
     - Extract **key concepts** and **learning objectives**
     - Find **equations** mentioned in the content
     - Generate a completely original problem that tests those ideas

### What Gets Extracted from Lecture Sections

When you select lecture sections, the system extracts:

1. **Key Concepts** - The main ideas taught in the section
2. **Learning Objectives** - What students should understand
3. **Section Title** - The overarching topic
4. **Equations** - Mathematical formulas from the content (both inline `$...$` and block `$$...$$`)
5. **Content Analysis** - Parses the `content_text` for additional context

### Example Flow

**Scenario:** You have a lecture on "Numerical Methods" with sections:
- "Why Numerical Methods" 
- "Numerical Methods Overview"
- "Error Analysis"

**Steps:**
1. Select "Why Numerical Methods" and "Numerical Methods Overview"
2. Click "Generate Practice Problem"
3. System extracts ideas like:
   - "Approximation techniques for solving equations"
   - "Iterative methods vs. analytical solutions"
   - "When to use numerical methods"
4. Generates an original problem like:
   - "A civil engineer needs to find the root of a transcendental equation that cannot be solved analytically. Compare two numerical methods for this scenario..."

## Key Differences from Homework Problems

| Homework Blueprints | Lecture Blueprints |
|---------------------|-------------------|
| Shows problems with problem statements | Shows lecture sections with topics |
| Extracts ideas from `concepts_tested` | Extracts ideas from `key_concepts` and `learning_objectives` |
| Can remix existing problems | Always uses idea-based generation (no problems to remix) |
| Problem-focused | Concept-focused |

## Technical Details

### Updated Components

1. **`PracticeProblemsChat.jsx`**
   - Now detects if structure has `lecture_sections`
   - Extracts lecture sections as selectable items
   - Parses lecture content for ideas and equations
   - Always uses `idea_based` generation mode for lectures

2. **`LectureBlueprintSkeleton.jsx`**
   - Passes full `lectureStructure` to PracticeProblemsChat
   - Includes callback for storing generated problems

3. **`verify-practice-problem` Edge Function**
   - Supports `generation_mode: 'idea_based'`
   - Accepts `core_ideas` and `equations` arrays
   - Uses `ideaBasedPracticeProblemGeneration` prompt

### Data Flow

```
Lecture Section Selection
    ↓
Extract Core Ideas
    ├─ key_concepts
    ├─ learning_objectives  
    ├─ section title
    └─ equations from content_text
    ↓
Generate Practice Problem (idea_based mode)
    ├─ Create original problem scenario
    ├─ Test the extracted concepts
    └─ Verify with multiple AI models
    ↓
Display Generated Problem
```

## Benefits

1. **No Existing Problems Needed** - Generate practice problems even when you only have lecture notes
2. **Concept-Focused** - Problems test understanding of ideas, not just calculation
3. **Varied Formats** - Can generate word problems, conceptual questions, comparisons, etc.
4. **Multiple Sections** - Combine ideas from multiple lecture sections for comprehensive practice
5. **Original Problems** - Not just remixes with different numbers

## Usage Tips

- **Select related sections** - Choosing sections that build on each other creates more cohesive problems
- **Start with 1-2 sections** - Don't overwhelm the generator with too many concepts at once
- **Review the ideas** - Check console logs to see what core ideas were extracted
- **Regenerate for variety** - Each generation creates a unique problem with different format/scenario

## Future Enhancements

Potential improvements:
- Store generated problems in lecture blueprint state
- Add difficulty level selection
- Filter sections by topic area
- Show preview of extracted ideas before generation
- Batch generate multiple problems at once
