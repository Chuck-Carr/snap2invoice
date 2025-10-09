# Database Migration: Multiple Receipts per Invoice

This migration adds support for multiple receipts per invoice by adding an `invoice_id` column to the `receipts` table.

## What this migration does:

1. **Adds `invoice_id` column** to the `receipts` table with a foreign key reference to `invoices(id)`
2. **Creates an index** for better query performance
3. **Migrates existing data** by linking receipts to their corresponding invoices based on the existing `receipt_id` in the `invoices` table

## How to run the migration:

### Option 1: Automatic (using Node.js script)
```bash
node run-migration.js
```

### Option 2: Manual (recommended)
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `migration_add_invoice_id_to_receipts.sql`
4. Execute the SQL statements

## Migration SQL:
```sql
-- Add invoice_id column to receipts table
ALTER TABLE receipts 
ADD COLUMN invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts(invoice_id);

-- Migrate existing data
UPDATE receipts 
SET invoice_id = invoices.id 
FROM invoices 
WHERE receipts.id = invoices.receipt_id 
AND invoices.receipt_id IS NOT NULL;
```

## After running the migration:

1. **Test the application** to ensure everything works correctly
2. **Verify data integrity** - check that existing receipts are properly linked to invoices
3. **Optional cleanup** - After confirming everything works, you may want to remove the `receipt_id` column from the `invoices` table (keep it for now during testing)

## New functionality enabled:

- ✅ Multiple receipts can be linked to the same invoice
- ✅ Users can select multiple receipts and add them to an existing invoice
- ✅ Upload multiple receipts directly to an existing invoice
- ✅ Better receipt management with proper relationships

## Before/After Schema:

**Before:** One-to-one relationship
- `invoices.receipt_id` → `receipts.id` (one invoice links to one receipt)

**After:** One-to-many relationship  
- `receipts.invoice_id` → `invoices.id` (multiple receipts can link to one invoice)