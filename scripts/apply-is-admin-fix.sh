#!/bin/bash
# Apply is_admin() fix using psql
# This script will prompt for database password

set -e

cd "$(dirname "$0")/.."

# Load env
export $(grep -v '^#' .env.local | xargs)

PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's|https://||' | cut -d'.' -f1)
DB_HOST="${PROJECT_REF}.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
DB_PORT="5432"

echo "🔧 Applying is_admin() fix..."
echo "   Project: $PROJECT_REF"
echo "   Host: $DB_HOST"
echo ""
echo "⚠️  You'll need to enter your database password"
echo "   (Find it in: Supabase Dashboard > Project Settings > Database > Connection string)"
echo ""

# Apply the fix
psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  -f supabase/migrations/20231116000013_fix_is_admin_final.sql

echo ""
echo "✅ Fix applied! Now test with: SELECT is_admin();"






