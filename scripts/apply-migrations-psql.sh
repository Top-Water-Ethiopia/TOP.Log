#!/bin/bash
# Script to apply migrations using psql
# Usage: ./scripts/apply-migrations-psql.sh

set -e

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

# Extract project ref from URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's|https://||' | cut -d'.' -f1)
DB_PASSWORD=$(supabase projects api-keys --project-ref $PROJECT_REF 2>/dev/null | grep "service_role" | awk '{print $NF}' || echo "")

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Could not get database password"
  echo "💡 You can find it in: Supabase Dashboard > Project Settings > Database > Connection string"
  exit 1
fi

# Construct connection string
DB_HOST="${PROJECT_REF}.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
DB_PORT="5432"

echo "🔌 Connecting to database..."
echo "   Host: $DB_HOST"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Apply first migration
echo "📄 Applying: 20231116000000_create_departments_table.sql"
psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  -f supabase/migrations/20231116000000_create_departments_table.sql

# Apply second migration
echo ""
echo "📄 Applying: 20231116000001_fix_departments_rls_policies.sql"
psql "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  -f supabase/migrations/20231116000001_fix_departments_rls_policies.sql

echo ""
echo "✅ Migrations applied successfully!"







