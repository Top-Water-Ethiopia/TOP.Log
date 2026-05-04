#!/bin/bash
# Quick script to apply RLS fix - opens SQL Editor with instructions

PROJECT_REF="ukhhrctscwlstwspuhbd"
SQL_FILE="QUICK_FIX_ROLE_QUESTIONS_RLS.sql"

echo "🔧 RLS Fix for role_questions table"
echo ""
echo "📋 Project: $PROJECT_REF"
echo "📝 SQL File: $SQL_FILE"
echo ""
echo "🔗 SQL Editor URL:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo ""
echo "💡 Instructions:"
echo "   1. Open the URL above in your browser"
echo "   2. Copy the SQL below:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$SQL_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   3. Paste into the SQL Editor"
echo "   4. Click 'Run' (or press Cmd/Ctrl + Enter)"
echo ""
echo "✅ After running, the RLS policies will be updated!"
echo ""

