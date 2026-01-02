# Database Structure Diagram

## Table Relationship Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AUTH SYSTEM                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │  auth.users (managed by Supabase)                │       │
│  └───────────────────┬──────────────────────────────┘       │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       │ (one-to-one)
                       ▼
              ┌─────────────────┐
              │     users       │ ◄──────────────┐
              │  (profiles)     │                │
              └────────┬────────┘                │
                       │                         │
                       │ (one-to-many)           │
                       ▼                         │
              ┌─────────────────┐                │
              │    classes      │                │
              │  (Calculus I)   │                │
              └────────┬────────┘                │
                       │                         │
         ┌─────────────┼─────────────┐           │
         │             │             │           │
         │ (one-to-    │             │           │
         │  many)      │             │           │
         ▼             ▼             ▼           │
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  blueprints  │  │   class_     │  │                  │
│ (Learning    │  │  documents   │  │                  │
│   Plans)     │  │  (PDFs)      │  │                  │
└──────┬───────┘  └──────┬───────┘  │                  │
       │                 │           │                  │
       │                 │           │                  │
       │                 │           │                  │
       │        ┌────────┘           │                  │
       │        │                    │                  │
       │        │ (one-to-one)       │                  │
       │        ▼                    │                  │
       │  ┌──────────────────┐      │                  │
       │  │  document_       │      │                  │
       │  │  analyses        │      │                  │
       │  │  (AI Analysis)   │      │                  │
       │  └────────┬─────────┘      │                  │
       │           │                │                  │
       │           │ (one-to-one)   │                  │
       │           ▼                │                  │
       │  ┌──────────────────┐     │                  │
       │  │  blueprint_      │     │                  │
       │  │  structures      │     │                  │
       │  │ (Learning Path)  │     │                  │
       │  └──────────────────┘     │                  │
       │                           │                  │
       │ (one-to-many)             │                  │
       │                           │                  │
       ▼                           │                  │
┌─────────────────┐                │                  │
│ topic_responses │                │                  │
│ (Comfortable /  │                │                  │
│  Needs Help)    │                │                  │
└─────────┬───────┘                │                  │
          │                        │                  │
          │ (when user clicks      │                  │
          │  "needs help")         │                  │
          │                        │                  │
          ▼                        │                  │
┌──────────────────────────┐       │                  │
│ blueprint_topic_         │       │                  │
│     resources            │       │                  │
│  (Junction Table)        │       │                  │
└─────────┬────────────────┘       │                  │
          │                        │                  │
          │ (many-to-many)         │                  │
          │                        │                  │
          ▼                        │                  │
┌──────────────────────────┐       │                  │
│   curated_resources      │       │                  │
│  (YouTube Videos,        │       │                  │
│   Khan Academy, etc.)    │◄──────┘                  │
│   📹 GLOBAL CACHE        │                          │
└──────────────────────────┘                          │
                                                      │
┌─────────────────────────────────────────────────────┘
│
│  EQUATIONS & FIGURES SYSTEM (Similar Pattern)
│
├──► ┌──────────────────────────┐
│    │ blueprint_unit_equations │
│    │    (Junction Table)      │
│    └─────────┬────────────────┘
│              │
│              ▼
│    ┌──────────────────────────┐
│    │   curated_equations      │
│    │   (LaTeX Library)        │
│    │   📐 GLOBAL CACHE        │
│    └──────────────────────────┘
│
└──► ┌──────────────────────────┐
     │ blueprint_unit_figures   │
     │    (Junction Table)      │
     └─────────┬────────────────┘
               │
               ▼
     ┌──────────────────────────┐
     │   curated_figures        │
     │   (Diagrams, Charts)     │
     │   📊 GLOBAL CACHE        │
     └──────────────────────────┘
```

---

## User Data Flow

```
1. USER CREATES CLASS
   users → classes

2. USER UPLOADS DOCUMENT TO CLASS
   classes → class_documents

3. AI ANALYZES DOCUMENT (Backend)
   class_documents → document_analyses

4. AI GENERATES LEARNING STRUCTURE (Backend)
   document_analyses → blueprint_structures

5. USER CREATES BLUEPRINT FROM STRUCTURE
   blueprint_structures → blueprints

6. USER MARKS TOPICS AS "NEEDS HELP"
   blueprints → topic_responses

7. BACKEND FETCHES RESOURCES FOR THOSE TOPICS
   topic_responses → blueprint_topic_resources → curated_resources

8. USER SEES VIDEOS/RESOURCES IN UI
   Blueprint.jsx displays resources from curated_resources
```

---

## Table Categories by Purpose

### 🧑 User Management (1 table)
- `users` - User profiles

### 📚 Course Organization (1 table)
- `classes` - User's classes (e.g., "Physics 101")

### 📄 Document Management (2 tables)
- `class_documents` - Uploaded PDFs/documents
- `document_analyses` - AI analysis of documents

### 🎯 Learning Plans (3 tables)
- `blueprints` - User-facing learning plans
- `blueprint_structures` - Generated learning structures
- `topic_responses` - User comfort level tracking

### 📹 Educational Resources (3 tables)
- `curated_resources` - Videos/articles cache (GLOBAL)
- `blueprint_topic_resources` - Links resources to blueprints
  
### 📐 Equations (2 tables)
- `curated_equations` - LaTeX equations library (GLOBAL)
- `blueprint_unit_equations` - Links equations to learning units

### 📊 Figures/Diagrams (2 tables)
- `curated_figures` - Diagrams/charts library (GLOBAL)
- `blueprint_unit_figures` - Links figures to learning units

### ⚡ Performance Caching (2 tables - OPTIONAL)
- `cached_blueprint_structures` - Document structure cache
- `cached_section_structures` - Problem-level structure cache

---

## Color Legend

- **GLOBAL CACHE** 🌍 = Shared across all users (public data)
  - `curated_resources`
  - `curated_equations`
  - `curated_figures`
  - `cached_blueprint_structures`
  - `cached_section_structures`

- **USER DATA** 👤 = Private to each user
  - `users`
  - `classes`
  - `blueprints`
  - `class_documents`
  - `document_analyses`
  - `blueprint_structures`
  - `topic_responses`

- **JUNCTION TABLES** 🔗 = Connect two other tables (many-to-many)
  - `blueprint_topic_resources`
  - `blueprint_unit_equations`
  - `blueprint_unit_figures`

---

## Key Insights

1. **One document → One analysis** 
   - `document_analyses` has a UNIQUE constraint on `document_id`
   - Prevents re-analyzing the same document multiple times

2. **Resources are reused globally**
   - Once a YouTube video is found for "Fourier Transform", it's cached
   - Next user who needs "Fourier Transform" gets the same video (no API call)
   - Same for equations and figures

3. **Blueprints are lightweight**
   - Main data is in `blueprint_structures` (the learning path)
   - `blueprints` table just links users to their plans

4. **Performance caching is separate**
   - `cached_*` tables are optimization only
   - Removing them doesn't break functionality
   - Just makes generation slower and more expensive

5. **Security via Row Level Security (RLS)**
   - User data tables: Users can only see their own data
   - Global cache tables: Everyone can read, only backend can write
   - Junction tables: Users see their own links only

---

## Storage Buckets

Your database also uses Supabase Storage:

```
storage.buckets
│
├─ class-documents/
│  └─ {user_id}/
│     └─ {class_id}/
│        └─ {document_id}/
│           └─ file.pdf
│
└─ figures-library/
   └─ {figure_id}.png
```

---

## Quick Size Estimates

For a typical user with 5 classes:

| Table | Estimated Rows | Size | Notes |
|-------|---------------|------|-------|
| `users` | 1 | <1KB | Just your profile |
| `classes` | 5 | <5KB | One per class |
| `blueprints` | 10-20 | ~20KB | 2-4 per class |
| `class_documents` | 10-20 | ~20KB | Metadata only (files in storage) |
| `document_analyses` | 10-20 | ~100KB | Contains AI analysis |
| `blueprint_structures` | 10-20 | ~200KB | Contains full learning paths |
| `topic_responses` | 100-200 | ~20KB | Many topics per blueprint |
| `curated_resources` | 500+ | ~500KB | Grows over time (SHARED) |
| `curated_equations` | 100+ | ~100KB | Grows over time (SHARED) |
| `curated_figures` | 50+ | ~50KB | Metadata only (images in storage) |

**Total database size for one user: ~1MB**  
**Storage size (PDFs): 50-500MB depending on documents**

The global caches (`curated_*`) grow over time but benefit all users!

