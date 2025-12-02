# Supabase Integration for TOP Log

This guide explains how to set up and configure Supabase for TOP Log. Supabase is an open-source Firebase alternative providing PostgreSQL databases, authentication, instant APIs, and real-time subscriptions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setting Up a Supabase Project](#setting-up-a-supabase-project)
- [Environment Configuration](#environment-configuration)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [Data Migration](#data-migration)
- [Row-Level Security](#row-level-security)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following:

- Node.js v18+ installed
- Yarn package manager
- A Supabase account (free tier is sufficient for development)
- Basic understanding of PostgreSQL and SQL

## Setting Up a Supabase Project

1. **Create a Supabase account**:
   - Visit [supabase.com](https://supabase.com/) and sign up or log in.

2. **Create a new project**:
   - Click "New Project" in the dashboard.
   - Select an organization (create one if needed).
   - Name your project (e.g., "captain-log").
   - Set a secure database password.
   - Choose a region close to your users.
   - Click "Create Project".

3. **Wait for database provisioning**:
   - This typically takes 2-3 minutes.

## Environment Configuration

1. **Get your Supabase credentials**:
   - In your Supabase project dashboard, navigate to "Project Settings" > "API".
   - You'll need the "Project URL" and "Project API Keys".

2. **Create a .env.local file**:
   - In the root of your project, create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. **Update .gitignore**:
   - Make sure `.env.local` is in your `.gitignore` file to avoid committing secrets.

## Database Schema

Execute the SQL schema in `lib/supabase/schema.sql` to set up your database tables:

1. Go to your Supabase project dashboard.
2. Navigate to the "SQL Editor" section.
3. Copy the contents of `lib/supabase/schema.sql`.
4. Paste into the SQL Editor and run the script.

This will create the following tables:

- `captain_log_entries`: Stores the main log entries
- `custom_responses`: Stores responses to custom questions
- `audit_logs`: Tracks all system actions
- `roles`: Defines user roles
- `permissions`: Maps permissions to roles
- `user_profiles`: Extended user information

## Authentication

TOP Log uses Supabase Authentication for user management:

1. **Authentication Configuration**:
   - In your Supabase dashboard, go to "Authentication" > "Settings".
   - Confirm that "Email Auth" is enabled.
   - Set up password security requirements as needed.

2. **Integration with your app**:
   - The project uses the `@supabase/ssr` and `@supabase/supabase-js` libraries.
   - Authentication flow is implemented in `contexts/supabase-auth-context.tsx`.
   - Middleware at `middleware.ts` protects routes appropriately.

3. **URL Configuration**:
   - Under "Authentication" > "URL Configuration" in your Supabase dashboard:
   - Set the Site URL to your production domain or `http://localhost:3000` for development.
   - Add any additional redirect URLs if needed.

## Data Migration

The TOP Log includes utilities to migrate data from localStorage to Supabase:

1. **Migration Process**:
   - Log in to your Supabase-enabled account.
   - Access the migration utility through Settings > Data > Migrate from Local Storage.
   - The system will import all entries while preserving their creation dates.

2. **Data Integrity**:
   - The migration handles duplicate entries to prevent data duplication.
   - All entries will be associated with your Supabase user ID.
   - Custom field responses will be preserved.

## Row-Level Security

Supabase Row-Level Security (RLS) is configured to enforce data access policies:

1. **Policy Overview**:
   - Users can only access their own entries.
   - Administrators have broader access based on their role.
   - All data modifications are logged in the audit system.

2. **RBAC Integration**:
   - The RLS policies work with the RBAC system to provide granular permissions.
   - Different roles (admin, user) have different capabilities.
   - Policies are defined in the schema SQL file.

## Testing

To verify your Supabase integration:

1. **Connection Test**:
   - Use `lib/test-supabase.ts` to test your connection.
   - Execute `testSupabaseConnection()` to verify connectivity.

2. **Sample Data**:
   - Create sample data with `createSampleData(userId)`.
   - Clean up with `cleanupSampleData(userId)`.

3. **Authentication Testing**:
   - Register a new account and verify login functionality.
   - Test password reset and account management features.

## Troubleshooting

### Common Issues

**Connection Problems**:
- Verify your environment variables are correctly set.
- Check if your IP is allowed in Supabase settings.
- Test direct PostgreSQL connection if needed.

**Authentication Issues**:
- Check browser console for errors.
- Verify your redirect URLs in Supabase settings.
- Ensure cookies are properly handled in middleware.

**Data Access Errors**:
- Review the RLS policies for potential conflicts.
- Check user roles and permissions in the database.
- Verify that your tables have RLS enabled.

### Getting Help

- [Supabase Documentation](https://supabase.io/docs)
- [Supabase GitHub](https://github.com/supabase/supabase)
- [Community Forum](https://github.com/supabase/supabase/discussions)

---

This integration was developed as part of the TOP Log v2.0 release. For questions or issues, please contact the development team.
