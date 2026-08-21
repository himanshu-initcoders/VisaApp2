# Database Migration Guide - JSON Structure

## 🎯 What This Migration Does

Transforms your countries table from **12 separate columns** to **2 organized JSON fields**:

**Before:**
```
countries
├── banner_image_url
├── banner_image_alt
├── banner_image_width
├── banner_image_height
├── hero_image_url
├── hero_image_alt
├── hero_image_width
├── hero_image_height
├── flag_logo_url
├── meta_title
├── meta_description
└── headline
```

**After:**
```
countries
├── images (jsonb)
│   ├── banner { url, alt, width, height }
│   ├── hero { url, alt, width, height }
│   └── flag { url }
└── seo (jsonb)
    ├── metaTitle
    ├── metaDescription
    └── headline
```

## ✅ Benefits

- **Better organized** - Related data grouped together
- **More flexible** - Easy to add new fields
- **Type-safe** - JSON structure enforced
- **No data loss** - All existing data migrated safely

---

## 📋 Step-by-Step Migration

### **Step 1: Backup Your Database (IMPORTANT!)**

Before running any migration, create a backup:

```bash
# If using local PostgreSQL
pg_dump -U postgres visa_db > backup_before_migration.sql

# Or use your database tool's export feature
```

### **Step 2: Open Your Database Tool**

Choose one:
- **pgAdmin** (GUI)
- **DBeaver** (GUI)
- **psql** (Command line)
- **TablePlus** (GUI)
- Any PostgreSQL client

### **Step 3: Connect to Your Database**

Connect to the database where your `countries` table is located.

### **Step 4: Open the Migration File**

Open this file in your database tool:
```
D:\Visa\MIGRATION_JSON_STRUCTURE.sql
```

### **Step 5: Run Steps 1-3 (Safe - No Data Loss)**

Copy and run **Steps 1-3** from the SQL file:

```sql
-- Step 1: Add new columns
ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "images" jsonb;
ALTER TABLE "countries" ADD COLUMN IF NOT EXISTS "seo" jsonb;

-- Step 2: Migrate images
UPDATE "countries" SET images = jsonb_build_object(...);

-- Step 3: Migrate SEO
UPDATE "countries" SET seo = jsonb_build_object(...);
```

✅ **These steps are SAFE** - They only add new columns and copy data.

### **Step 6: Verify Migration (IMPORTANT!)**

Run **Step 4** to verify data was migrated correctly:

```sql
SELECT
  id,
  name,
  iso2_code,
  CASE WHEN images IS NOT NULL THEN 'Migrated ✅' ELSE 'No images' END as images_status,
  CASE WHEN seo IS NOT NULL THEN 'Migrated ✅' ELSE 'No SEO' END as seo_status
FROM countries
LIMIT 5;
```

**Expected result:**
```
name       | iso2_code | images_status | seo_status
-----------+-----------+---------------+------------
Thailand   | TH        | Migrated ✅   | Migrated ✅
Dubai      | AE        | Migrated ✅   | Migrated ✅
Japan      | JP        | Migrated ✅   | Migrated ✅
```

✅ **If you see "Migrated ✅"** - Data migration successful!  
❌ **If you see "No images/No SEO"** - Those countries didn't have images/SEO (that's okay)

### **Step 7: Test Your App**

**BEFORE dropping old columns**, test the app works with JSON:

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to:
   ```
   http://localhost:3000/admin/config/processes?country=AE
   ```

3. You should see:
   - LinkedIn-style country profile card
   - Banner image (if country has one)
   - Hover over banner to change it
   - Images & SEO tabs working

✅ **If it works** - Proceed to Step 8  
❌ **If errors** - Check browser console and server logs

### **Step 8: Drop Old Columns (CAREFUL!)**

**⚠️ WARNING:** This step removes old columns permanently!

**Only proceed if:**
- ✅ Step 6 verification passed
- ✅ Step 7 app testing passed
- ✅ You have a database backup

Run **Step 5** from the SQL file:

```sql
ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_url";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "banner_image_alt";
-- ... (rest of the DROP statements)
```

### **Step 9: Final Verification**

Run **Step 6** from the SQL file:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'countries'
  AND column_name IN ('images', 'seo');
```

**Expected result:**
```
column_name | data_type
------------+-----------
images      | jsonb
seo         | jsonb
```

✅ **Migration complete!**

---

## 🧪 Quick Test Checklist

After migration, test these:

### **Upload New Image:**
1. Go to `/admin/config/processes?country=AE`
2. Hover over banner → Should see camera overlay
3. Click → Upload new image
4. Image should upload and display
5. Old image should be deleted

### **Change Flag:**
1. Hover over circular profile pic
2. Click → Upload new flag
3. Should replace old flag

### **Update SEO:**
1. Click "SEO & Metadata" tab
2. Edit headline field
3. Click "Save SEO Settings"
4. Should show "Saved!" confirmation

---

## 🔄 Rollback (If Needed)

If something goes wrong and you need to rollback:

### **Before Step 8 (Old columns still exist):**
Just drop the new columns:
```sql
ALTER TABLE "countries" DROP COLUMN IF EXISTS "images";
ALTER TABLE "countries" DROP COLUMN IF EXISTS "seo";
```

### **After Step 8 (Old columns removed):**
Restore from backup:
```bash
psql -U postgres visa_db < backup_before_migration.sql
```

---

## 📊 Data Structure Examples

### **Images JSON:**
```json
{
  "banner": {
    "url": "https://bucket.s3.amazonaws.com/country-banners/dubai.jpg",
    "alt": "Dubai skyline",
    "width": 1200,
    "height": 400
  },
  "hero": {
    "url": "https://bucket.s3.amazonaws.com/country-heroes/dubai-hero.jpg",
    "alt": "Burj Khalifa",
    "width": 1920,
    "height": 1080
  },
  "flag": {
    "url": "https://bucket.s3.amazonaws.com/country-flags/ae.png"
  }
}
```

### **SEO JSON:**
```json
{
  "metaTitle": "Dubai Visa Application - Fast & Easy",
  "metaDescription": "Apply for Dubai visa online. Get approval in 24 hours.",
  "headline": "Dubai e-Visa - Tourist & Business Visa"
}
```

---

## ❓ Troubleshooting

### **"Column already exists" error**
**Solution:** Columns were already added. Skip to Step 2 (migration).

### **"No data in images/seo after migration"**
**Cause:** Countries didn't have images/SEO in old columns.  
**Solution:** This is normal. Upload new images via the UI.

### **"App shows errors after migration"**
**Check:**
1. Is dev server restarted? (`npm run dev`)
2. Check browser console for errors
3. Check server logs
4. Verify database connection

### **"Can't see new columns"**
**Solution:** Refresh your database client connection.

---

## 🎉 Success!

After successful migration, you'll have:

✅ Clean JSON structure in database  
✅ LinkedIn-style upload UI  
✅ Hover-to-change images  
✅ Organized Images & SEO tabs  
✅ Automatic old image deletion  

Navigate to: `/admin/config/processes?country=AE` to see it in action!

---

## 📞 Support

If you encounter issues:

1. **Check logs:** Browser console + server terminal
2. **Verify database:** Run Step 4 verification query
3. **Check backup:** Make sure you have one before Step 8
4. **Rollback if needed:** Follow rollback instructions above

---

**Migration created:** 2026-08-18  
**Database:** PostgreSQL with JSONB support  
**Tested:** ✅ Safe migration with data preservation
