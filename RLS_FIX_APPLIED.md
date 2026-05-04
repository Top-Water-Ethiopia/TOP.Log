# ✅ RLS Fix Ready to Apply

## Status
The RLS fix migration has been created but couldn't be pushed automatically due to migration conflicts. 

## Quick Solution (Recommended)

**The fastest way to apply the fix is via Supabase Dashboard:**

1. **Open SQL Editor**: 
   https://supabase.com/dashboard/project/ukhhrctscwlstwspuhbd/sql/new

2. **Copy the SQL** from `QUICK_FIX_ROLE_QUESTIONS_RLS.sql`

3. **Paste and Run** in the SQL Editor

4. **Verify**: You should see 5 policies created for `role_questions` table

## What This Fix Does

Updates RLS policies for `role_questions` to:
- ✅ Allow **Super Admin** role (`00000000-0000-0000-0000-000000000000`) to create, update, and delete questions
- ✅ Allow **Admin** role (`00000000-0000-0000-0000-000000000001`) to create, update, and delete questions  
- ✅ Require `is_active = true` on user profiles
- ✅ Keep existing user viewing permissions

## Files Created

- ✅ `supabase/migrations/20251120134639_apply_rls_fix_for_role_questions.sql` - Migration file
- ✅ `QUICK_FIX_ROLE_QUESTIONS_RLS.sql` - Standalone SQL file (ready to copy/paste)
- ✅ `scripts/quick-apply-rls-fix.sh` - Helper script to display SQL

## After Applying

Once the SQL is executed:
1. ✅ Refresh your browser
2. ✅ Try updating a question again
3. ✅ The update should now work without RLS errors

## Verification Query

After running the fix, you can verify with:

```sql
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'role_questions' 
ORDER BY policyname;
```

You should see 5 policies listed.

