#!/bin/bash
# Execute migration using psql
# This script requires the database password

set -e

PROJECT_REF="ukhhrctscwlstwspuhbd"
MIGRATION_FILE="supabase/migrations/20251117094000_fix_user_profiles_policies.sql"

echo "📦 Executing migration: $MIGRATION_FILE"
echo "🔗 Project: $PROJECT_REF"
echo ""

# Check if password is provided
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "❌ SUPABASE_DB_PASSWORD environment variable is required"
  echo ""
  echo "💡 To get your database password:"
  echo "   1. Go to Supabase Dashboard > Settings > Database"
  echo "   2. Copy the database password"
  echo "   3. Run: export SUPABASE_DB_PASSWORD='your-password'"
  echo "   4. Then run this script again"
  echo ""
  exit 1
fi

# Construct connection string
# Using the pooler connection (port 6543) for better compatibility
DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

echo "🔄 Connecting to database..."
echo ""

# Execute the migration
psql "$DB_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration executed successfully!"






