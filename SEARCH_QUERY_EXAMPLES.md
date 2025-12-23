# Search Query Examples - Before & After

This document shows how the improved search system transforms complex academic topics into searchable YouTube queries.

## Physics Examples

### Example 1: Blackbody Radiation
**Original Topic:** "Planck's Distribution and Spectral Radiance Calculations"

**Before (Broken):**
- Query: "Planck's Distribution and Spectral Radiance Calculations tutorial"
- Result: ❌ Kindergarten fraction videos

**After (Fixed):**
- Query 1: "Planck's law blackbody radiation youtube tutorial"
- Query 2: "spectral radiance explained youtube"
- Query 3: "blackbody radiation example problems youtube"
- Result: ✅ Relevant physics videos

---

### Example 2: Fluid Dynamics
**Original Topic:** "Navier-Stokes Equation Turbulent Flow Analysis"

**Before (Broken):**
- Query: "Navier-Stokes Equation Turbulent Flow Analysis explained"
- Result: ❌ Too specific, no results or wrong videos

**After (Fixed):**
- Query 1: "Navier Stokes equation explained youtube"
- Query 2: "turbulent flow basics youtube tutorial"
- Query 3: "fluid dynamics Navier Stokes youtube"
- Result: ✅ Educational videos on Navier-Stokes equations

---

### Example 3: Heat Transfer
**Original Topic:** "Wien's Displacement Law and Stefan-Boltzmann Law Calculations"

**Before (Broken):**
- Query: "Wien's Displacement Law and Stefan-Boltzmann Law Calculations youtube"
- Result: ❌ Too long, no relevant results

**After (Fixed):**
- Query 1: "Wien's displacement law explained youtube"
- Query 2: "Stefan-Boltzmann law tutorial youtube"
- Query 3: "Wien's law example problems youtube"
- Result: ✅ Separate videos for each law

---

## Engineering Examples

### Example 4: Heat Exchangers
**Original Topic:** "Heat Exchanger Effectiveness-NTU Method Analysis and Applications"

**Before (Broken):**
- Query: "Heat Exchanger Effectiveness-NTU Method Analysis and Applications"
- Result: ❌ Too complex, poor results

**After (Fixed):**
- Query 1: "heat exchanger NTU method youtube tutorial"
- Query 2: "heat exchanger effectiveness explained youtube"
- Query 3: "NTU method example problems youtube"
- Result: ✅ Clear instructional videos

---

### Example 5: Structural Analysis
**Original Topic:** "Finite Element Analysis Stress Concentration Calculations"

**Before (Broken):**
- Query: "Finite Element Analysis Stress Concentration Calculations youtube"
- Result: ❌ Too specific, limited results

**After (Fixed):**
- Query 1: "FEA basics youtube tutorial"
- Query 2: "stress concentration explained youtube"
- Query 3: "finite element analysis example youtube"
- Result: ✅ Foundational and applied videos

---

### Example 6: Thermodynamics
**Original Topic:** "Thermodynamic Cycle Efficiency Optimization Methods"

**Before (Broken):**
- Query: "Thermodynamic Cycle Efficiency Optimization Methods youtube"
- Result: ❌ Academic jargon, poor matches

**After (Fixed):**
- Query 1: "thermodynamic cycles explained youtube"
- Query 2: "Carnot cycle efficiency youtube tutorial"
- Query 3: "thermodynamic cycle example problems youtube"
- Result: ✅ Comprehensive learning resources

---

## Mathematics Examples

### Example 7: Signal Processing
**Original Topic:** "Fourier Transform Signal Processing Applications and Numerical Methods"

**Before (Broken):**
- Query: "Fourier Transform Signal Processing Applications and Numerical Methods"
- Result: ❌ Too complex, scattered results

**After (Fixed):**
- Query 1: "Fourier transform explained youtube tutorial"
- Query 2: "signal processing basics youtube"
- Query 3: "Fourier transform example problems youtube"
- Result: ✅ Clear educational progression

---

### Example 8: Differential Equations
**Original Topic:** "Laplace Transform Differential Equation Solutions and Applications"

**Before (Broken):**
- Query: "Laplace Transform Differential Equation Solutions and Applications youtube"
- Result: ❌ Too wordy, inconsistent results

**After (Fixed):**
- Query 1: "Laplace transform explained youtube"
- Query 2: "Laplace transform differential equations youtube tutorial"
- Query 3: "Laplace transform example problems youtube"
- Result: ✅ Step-by-step learning path

---

## Key Patterns

### What Gets Removed:
- "calculations", "analysis", "applications", "methods"
- "optimization", "numerical", "computational"
- "and", "&", "using", "with", "for"
- Overly long compound phrases

### What Gets Added:
- "youtube" (to ensure video results)
- "explained", "tutorial", "basics"
- "example problems", "step by step"
- Subject context: "physics", "engineering"

### Common Replacements:
| Complex Term | Simplified Term |
|--------------|-----------------|
| "Planck's distribution" | "Planck's law" |
| "spectral radiance" | "blackbody radiation" |
| "spectral fractions" | "blackbody radiation" |
| "Navier-Stokes" | "Navier Stokes" |
| "finite element" | "FEA" |
| "computational fluid dynamics" | "CFD" |
| "effectiveness-NTU" | "NTU method" |

---

## Query Structure Guidelines

### Good Query Structure:
✅ `[Core Concept] [Learning Keyword] youtube`
- "Planck's law explained youtube"
- "heat transfer tutorial youtube"
- "stress analysis basics youtube"

### Bad Query Structure:
❌ `[Full Academic Title] youtube`
- "Planck's Distribution and Spectral Radiance Calculations youtube"
- "Advanced Thermodynamic Cycle Efficiency Optimization youtube"

---

## Testing Your Queries

**Mental Test:** "Would this appear in a YouTube video title?"

**Examples:**
- ❌ "Numerical Integration Methods for Spectral Fraction Calculations" (NO - too academic)
- ✅ "Planck's Law Explained" (YES - common video title)
- ✅ "Blackbody Radiation Tutorial" (YES - educational format)

**Length Test:** Is it under 6 words (excluding "youtube")?
- ❌ "Advanced Computational Methods for Turbulent Flow Analysis" (8 words - too long)
- ✅ "Turbulent Flow Basics" (3 words - perfect)

**Jargon Test:** Would a high school student understand these words?
- ❌ "Spectral radiance wavelength band integration" (too technical)
- ✅ "Blackbody radiation explained" (clear and searchable)

---

## For Developers

When adding new topics or modifying search logic, remember:

1. **Start simple** - Use common educational terms
2. **Break it down** - Separate compound topics
3. **Add context** - Include subject area and learning keywords
4. **Test mentally** - Would this be a YouTube video title?
5. **Keep it short** - 4-6 words max (excluding "youtube")

The goal is to match how **educators title their videos**, not how **academics title their papers**.

