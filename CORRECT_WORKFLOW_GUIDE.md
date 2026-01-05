# ✅ Correct Workflow Guide

## 🎯 The Right Way to Generate Structure

### Step-by-Step Process

```
1. Analyze Document (Step 1)
   ↓
2. Generate Structure (Step 2)
   ↓
3. View Learning Path
```

---

## 📋 Detailed Instructions

### Step 1: Analyze Document ⚠️ **REQUIRED FIRST**

**What it does**: 
- Reads your PDF/document
- Extracts topics, sections, problems
- Identifies prerequisites
- Determines document type (homework, exam, textbook, etc.)

**How to do it**:
1. Open your blueprint
2. Click **"1. Analyze Document"** button
3. Wait ~10-20 seconds
4. Should see ✓ **"1. Analyzed ✓"**

**Status indicators**:
- 🔵 Blue button = Ready to analyze
- 🔄 Spinner = Analyzing...
- ✅ Green checkmark = Analysis complete

---

### Step 2: Generate Structure ✨ **ONLY AFTER STEP 1**

**What it does**:
- Creates learning structure from analysis
- Organizes into prerequisites and topics
- Generates search queries for each unit
- Finds equations and figures
- Caches for future reuse

**How to do it**:
1. **AFTER Step 1 is complete** (green checkmark)
2. Click **"2. Generate Structure"** button
3. Progress panel opens automatically
4. Watch 7 steps execute:
   - ✓ Fetch Analysis (0.2s)
   - ✓ Check Cache (0.5s)
   - ✓ Adapt/Generate (0.3-20s)
   - ✓ Process Equations (1.2s)
   - ✓ Source Figures (1.5s)
   - ✓ Store Structure (0.3s)
   - ✓ Cache Structure (0.2s)
5. See "✓ Generation Complete!"
6. Panel auto-closes after 3 seconds
7. Structure appears with tabs

**Status indicators**:
- 🟣 Purple button = Ready to generate (if Step 1 done)
- 🔄 Spinner = Generating...
- ✅ Green checkmark = Structure generated

---

## ⚠️ Common Mistakes

### ❌ Mistake #1: Skipping Step 1

**Error**: "No analysis found for this blueprint/document"

**Why it happens**: You clicked Step 2 before Step 1

**Fix**: 
1. Click "1. Analyze Document" first
2. Wait for green checkmark
3. Then click "2. Generate Structure"

---

### ❌ Mistake #2: Clicking Step 2 Too Fast

**Error**: "fetch-analysis failed"

**Why it happens**: Step 1 is still running

**Fix**: Wait for Step 1 to complete (green checkmark) before clicking Step 2

---

### ❌ Mistake #3: No Document Uploaded

**Error**: "No document found"

**Why it happens**: Blueprint has no associated document

**Fix**: 
1. Go back to class page
2. Create new blueprint
3. Upload a document
4. Then run Step 1 and Step 2

---

## 🎨 Visual Guide

### Initial State (No Analysis)
```
┌─────────────────────────────────────┐
│  Ready to Generate Your Learning    │
│  Path                                │
├─────────────────────────────────────┤
│  ℹ️  Start by analyzing your        │
│     document (Step 1), then         │
│     generate the structure (Step 2) │
├─────────────────────────────────────┤
│  [1. Analyze Document] 🔵           │
│  [2. Generate Structure] 🔒 (locked)│
└─────────────────────────────────────┘
```

### After Step 1 Complete
```
┌─────────────────────────────────────┐
│  Ready to Generate Your Learning    │
│  Path                                │
├─────────────────────────────────────┤
│  ✅ Document analyzed! Click step 2 │
│     to continue.                     │
├─────────────────────────────────────┤
│  [1. Analyzed ✓] ✅                 │
│  [2. Generate Structure] 🟣         │
└─────────────────────────────────────┘
```

### During Step 2
```
┌─────────────────────────────────────┐
│  🔥 Structure Generation   ⏱️ 5.2s  │
│  Step 3 of 7                        │
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░ 43%        │
├─────────────────────────────────────┤
│  ✓ 📊 Fetch Analysis        0.2s   │
│  ✓ ⚡ Check Cache           0.5s   │
│  🔄 ✨ Generate with AI     ...    │
│  ⏳ ✨ Process Equations            │
│  ⏳ 💾 Source Figures               │
│  ⏳ 💾 Store Structure              │
│  ⏳ 📦 Cache Structure              │
└─────────────────────────────────────┘
```

### After Completion
```
┌─────────────────────────────────────┐
│  Prerequisites │ Topic 1 │ Topic 2  │
├─────────────────────────────────────┤
│  📚 Calculus Basics                 │
│  📚 Linear Algebra                  │
│  📚 Differential Equations          │
└─────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### "No analysis found" Error

**Check**:
1. Did you run Step 1?
2. Did Step 1 complete successfully?
3. Is there a document attached to the blueprint?

**Fix**:
```
1. Check if document exists (should see file card)
2. Click "1. Analyze Document"
3. Wait for completion
4. Then click "2. Generate Structure"
```

---

### Progress Panel Shows Success But Structure Doesn't Appear

**Possible causes**:
1. Database timing issue
2. Browser cache
3. Structure format issue

**Fix**:
1. Wait 5 seconds
2. Refresh the page
3. Check browser console for errors
4. Check debug panel (bug icon) for structure data

---

### "Generation failed" After Progress Panel

**Check console for**:
- "No analysis found" → Run Step 1 first
- "fetch-analysis failed" → Analysis doesn't exist
- "store-structure failed" → Database error

**Fix based on error**:
- No analysis → Run Step 1
- Database error → Check Supabase logs
- Other error → Report to support with console logs

---

## 📊 Expected Timing

| Step | Time (Cache Hit) | Time (Cache Miss) |
|------|-----------------|-------------------|
| 1. Analyze Document | 10-20s | 10-20s |
| 2. Generate Structure | 2-5s | 10-20s |
| **Total** | **12-25s** | **20-40s** |

### What Affects Timing?

**Cache Hit** (Fast):
- Similar document analyzed before
- Structure adapted from cache
- Saves ~24,000 tokens
- 2-5 seconds total

**Cache Miss** (Slower):
- New/unique document
- AI generates from scratch
- Uses Claude Haiku 4.5
- 10-20 seconds total

---

## ✅ Success Checklist

After completing both steps, you should see:

- [ ] Step 1 shows green checkmark
- [ ] Step 2 shows green checkmark
- [ ] Progress panel showed all 7 steps completing
- [ ] Tabs appear (Prerequisites, Topic 1, etc.)
- [ ] Learning units are visible
- [ ] No "generation failed" message
- [ ] Can click on topics to expand
- [ ] Can search for resources

---

## 🎯 Quick Reference

### Correct Order
```
✅ 1. Upload document
✅ 2. Analyze Document (Step 1)
✅ 3. Generate Structure (Step 2)
✅ 4. View learning path
✅ 5. Search for resources
```

### Wrong Order
```
❌ 1. Upload document
❌ 2. Generate Structure (Step 2) ← ERROR!
```

---

## 💡 Pro Tips

1. **Always run Step 1 first** - No exceptions!
2. **Wait for green checkmarks** - Don't rush
3. **Watch the progress panel** - See what's happening
4. **Check console if errors** - Better debugging
5. **Use debug panel** - See raw data (bug icon)
6. **Refresh if needed** - Sometimes helps with display

---

## 🚀 Keyboard Shortcuts

- **Sparkle icon (✨)** - Reopen progress panel
- **Bug icon (🐛)** - Toggle debug panel
- **Refresh (F5)** - Reload blueprint data

---

**Remember**: Step 1 → Step 2 → Success! 🎉

