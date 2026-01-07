# Functions Orchestration - Quick Reference Guide

## 📋 Overview

This document reflects the simplified architecture using monolithic legacy functions. The microservices architecture has been deprecated and removed.

---

## 🎯 Main Orchestrations (Legacy Monoliths)

### 1. **Search Resources**
   - **Function:** `search-resources-legacy`
   - **Purpose:** Finds educational videos/resources for a topic.
   - **Key Logic:**
     - Generates embedding for topic/query.
     - Checks cache (`search_similar_resources`).
     - Searches external sources (YouTube API, Claude Web Search).
     - Analyzes transcripts.
     - Stores resources and links to blueprint.

### 2. **Analyze Document**
   - **Function:** `analyze-document-legacy`
   - **Purpose:** Analyzes uploaded document and extracts learning objectives.
   - **Key Logic:**
     - Reads PDF/Text.
     - Calls Claude for deep analysis.
     - Stores analysis in `document_analyses`.

### 3. **Generate Structure**
   - **Function:** `generate-structure-legacy`
   - **Purpose:** Creates learning structure (units, sections, resources) for document.
   - **Key Logic:**
     - Takes document analysis.
     - Checks section-level cache for similar content.
     - Generates learning structure (units, sections).
     - Processes equations and figures.
     - Stores structure in `blueprint_structures`.

---

## 🔘 Standalone UI Functions

These functions are used directly by UI buttons and are NOT part of the orchestration pipelines.

### **Search Resources Database**
   - **Function:** `search-resources-database`
   - **Purpose:** Allows manual searching of the curated resource database from the UI.
   - **Key Logic:** Simple vector search against `curated_resources`.

### **Search Problem Walkthroughs**
   - **Function:** `search-problem-walkthroughs`
   - **Purpose:** Specialized search for finding step-by-step problem walkthroughs.

### **Search DB Cache**
   - **Function:** `search-db-cache`
   - **Purpose:** Low-level cache lookup utility.

### **Load Resources Database**
   - **Function:** `load-resources-database`
   - **Purpose:** Admin tool to bulk load videos into the database with full analysis.
   - **Key Logic:**
     - **Apify Actor**: Finds YouTube videos.
     - **SupaData**: Extracts transcripts.
     - **Grok (XAI)**: Analyzes transcripts.
     - **OpenAI**: Generates embeddings.
     - **Pinecone**: Stores vectors.

---

## 📝 Quick Command Reference

### Deploy Functions
```bash
# Deploy orchestration functions
supabase functions deploy search-resources-legacy
supabase functions deploy analyze-document-legacy
supabase functions deploy generate-structure-legacy

# Deploy UI standalone functions
supabase functions deploy search-resources-database
supabase functions deploy search-problem-walkthroughs
supabase functions deploy search-db-cache
supabase functions deploy load-resources-database
```

### Check Logs
```sql
-- View recent errors
SELECT * FROM function_errors 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## ✅ Status of Implementation

| Orchestration | Function Name | Status |
|---------------|---------------|--------|
| Search Resources | `search-resources-legacy` | ✅ Active |
| Analyze Document | `analyze-document-legacy` | ✅ Active |
| Generate Structure | `generate-structure-legacy` | ✅ Active |
| UI Search Button | `search-resources-database` | ✅ Restored |
| UI Walkthrough Button | `search-problem-walkthroughs` | ✅ Restored |
| Admin Load Button | `load-resources-database` | ✅ Restored |

**Microservices Architecture**: DEPRECATED and REMOVED (except for UI standalone functions).
