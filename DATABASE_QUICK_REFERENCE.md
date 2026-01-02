# Database Quick Reference Card

## 🎯 Quick Actions

### I want to see what's in my database
```bash
# In Supabase SQL Editor, run:
\i inspect_database.sql
```

### I see red "unrestricted" warnings
```bash
# In Supabase SQL Editor, run:
\i fix_rls_warnings.sql
```

### I want to simplify my database
```bash
# In Supabase SQL Editor, run:
\i cleanup_optional_tables.sql
# ⚠️ This will remove performance optimizations
```

---

## 📊 Table Count by Category

| Category | Table Count | Can Delete? |
|----------|-------------|-------------|
| Core (users, classes, blueprints, docs) | 4 | ❌ Never |
| Document Processing | 2 | ❌ Never |
| Learning Content | 3 | ❌ Never |
| Resource Libraries | 6 | ❌ Never |
| Performance Caching | 2 | ✅ Optional |
| **TOTAL** | **17** | **15 Essential** |

---

## 🔍 Where Is My Data?

### "Where are my uploaded PDFs?"
- **Metadata**: `class_documents` table
- **Files**: `storage.buckets` → `class-documents` bucket
- **AI Analysis**: `document_analyses` table

### "Where are my blueprints?"
- **Blueprint metadata**: `blueprints` table
- **Learning structure**: `blueprint_structures` table
- **User responses**: `topic_responses` table

### "Where are the videos/resources?"
- **Resource cache**: `curated_resources` table
- **Links to blueprints**: `blueprint_topic_resources` table

### "Where are the equations?"
- **Equation library**: `curated_equations` table
- **Links to units**: `blueprint_unit_equations` table

### "Where are the diagrams?"
- **Figure library**: `curated_figures` table
- **Image files**: `storage.buckets` → `figures-library` bucket
- **Links to units**: `blueprint_unit_figures` table

---

## 🚨 Common Issues & Fixes

### Issue: "Too many tables, confused"
**Solution**: Read `DATABASE_STRUCTURE_DIAGRAM.md`

### Issue: "Red 'unrestricted' warning on table X"
**Solution**: Run `fix_rls_warnings.sql`

### Issue: "Empty tables taking up space"
**Status**: Empty tables use ~8KB each (negligible)  
**Action**: Leave them - they'll fill up as you use the app

### Issue: "Want to start fresh"
**Solution**: 
```sql
-- ⚠️ DANGER: This deletes ALL your data!
TRUNCATE users CASCADE;
-- This will cascade-delete everything due to foreign keys
```

### Issue: "Performance is slow"
**Check**:
1. Do you have data in cache tables? (`SELECT COUNT(*) FROM cached_blueprint_structures`)
2. Are indexes created? (Run `inspect_database.sql` → see "indexes_size")
3. Is pgvector extension enabled? (`SELECT * FROM pg_extension WHERE extname = 'vector'`)

---

## 📈 Expected Data Growth

For a single active user over 1 semester:

| Table | Initial | After 1 Month | After 1 Semester |
|-------|---------|---------------|------------------|
| `classes` | 0 | 3-5 | 5-7 |
| `blueprints` | 0 | 10-15 | 30-50 |
| `class_documents` | 0 | 10-20 | 40-80 |
| `curated_resources` | 0 | 50-100 | 200-500 |
| `curated_equations` | 0 | 20-40 | 100-200 |
| `curated_figures` | 0 | 10-20 | 50-100 |

**Database size**: ~1MB → ~5MB → ~20MB  
**Storage size**: ~100MB → ~500MB → ~2GB (depends on PDF sizes)

---

## 🔒 Security Checklist

Run this query to verify security:

```sql
-- Should return 0 rows (all tables have RLS)
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
```

### Expected RLS Setup:

✅ **User Data** (can only see own data):
- `users` - View all, modify own
- `classes` - Own only
- `blueprints` - Own only
- `class_documents` - Own only
- `document_analyses` - Own only
- `blueprint_structures` - Own only
- `topic_responses` - Own only

✅ **Global Caches** (everyone reads, backend writes):
- `curated_resources` - Public read
- `curated_equations` - Public read
- `curated_figures` - Public read
- `cached_blueprint_structures` - Public read
- `cached_section_structures` - Public read

✅ **Junction Tables** (check parent ownership):
- `blueprint_topic_resources` - Check blueprint owner
- `blueprint_unit_equations` - Check blueprint owner
- `blueprint_unit_figures` - Check blueprint owner

---

## 💰 Cost Optimization

### Current Setup (with caching):
- Blueprint generation: ~15k-25k tokens
- **Cache hit**: ~0 tokens (FREE!)
- Cache hit rate: Typically 30-60% after initial usage

### Without Caching:
- Every blueprint: ~25k-40k tokens
- No reuse, every generation costs full price

### Cost Example:
- With caching: $0.50 per 100 blueprints
- Without caching: $1.50 per 100 blueprints
- **Savings**: ~$1 per 100 blueprints

---

## 🧪 Testing Your Database

### 1. Check if everything is connected:
```sql
-- Should show your user → classes → blueprints chain
SELECT 
    u.email,
    c.name as class_name,
    b.task_type as blueprint_type,
    COUNT(tr.id) as topic_responses
FROM users u
LEFT JOIN classes c ON c.user_id = u.id
LEFT JOIN blueprints b ON b.user_id = u.id
LEFT JOIN topic_responses tr ON tr.blueprint_id = b.id
WHERE u.id = auth.uid()
GROUP BY u.email, c.name, b.task_type;
```

### 2. Check if caching is working:
```sql
-- Should show increasing "times_used" over time
SELECT 
    subject_area,
    COUNT(*) as cached_structures,
    SUM(times_used) as total_reuses,
    AVG(quality_score) as avg_quality
FROM cached_blueprint_structures
GROUP BY subject_area;
```

### 3. Check if resources are being cached:
```sql
-- Should grow as you use the app
SELECT 
    platform,
    COUNT(*) as resource_count,
    SUM(times_served) as times_shown
FROM curated_resources
GROUP BY platform
ORDER BY times_shown DESC;
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `DATABASE_AUDIT_GUIDE.md` | Complete overview and cleanup guide |
| `DATABASE_STRUCTURE_DIAGRAM.md` | Visual table relationships |
| `inspect_database.sql` | See what's in your database |
| `fix_rls_warnings.sql` | Fix security warnings |
| `cleanup_optional_tables.sql` | Remove optional cache tables |
| `DATABASE_QUICK_REFERENCE.md` | This file! |

---

## 🆘 Getting Help

### If you're stuck:

1. **Run diagnostics**: `inspect_database.sql`
2. **Check structure**: Read `DATABASE_STRUCTURE_DIAGRAM.md`
3. **Search codebase**: Look for table name in `src/` folder
4. **Check migrations**: Look in `supabase/migrations/` folder

### Common grep searches:

```bash
# Find where a table is used
grep -r "from('table_name')" src/

# Find all database queries
grep -r "supabase.from" src/

# Find table references in migrations
grep -r "CREATE TABLE table_name" supabase/migrations/
```

---

## ✅ Health Check Checklist

- [ ] All tables have RLS enabled (0 rows from security query)
- [ ] Each user can only see their own data (test with 2 accounts)
- [ ] Storage buckets exist (`class-documents`, `figures-library`)
- [ ] Vector extension enabled (`SELECT * FROM pg_extension WHERE extname = 'vector'`)
- [ ] No orphaned records (run verification in `inspect_database.sql`)
- [ ] Indexes exist on foreign keys (speeds up queries)
- [ ] Caches are filling up over time (check `times_used` columns)

---

## 🎓 Learning Resources

Want to understand more?

1. **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security
2. **Foreign Keys**: https://www.postgresql.org/docs/current/tutorial-fk.html
3. **Vector Search (pgvector)**: https://github.com/pgvector/pgvector
4. **Database Design**: https://supabase.com/docs/guides/database/overview

---

*Last Updated: Based on your current database schema*

