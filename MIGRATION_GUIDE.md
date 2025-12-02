# Migrating from LocalStorage to Supabase

This guide will help you migrate your TOP Log data from browser localStorage to Supabase cloud storage.

## Overview

TOP Log now supports two storage options:

1. **LocalStorage (Default)** - Data stored in your browser only
2. **Supabase (Cloud)** - Data stored in a PostgreSQL database with user authentication

The cloud storage option offers several advantages:
- Access your entries from any device or browser
- Secure user authentication
- Data backup and protection
- Team collaboration features (coming soon)
- Advanced search capabilities

## Step-by-Step Migration Process

### 1. Set up Supabase

Follow the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to:
- Create a Supabase account
- Set up a new project
- Configure your environment variables
- Initialize the database schema

### 2. Register and Log In

Once Supabase is configured:

1. Click the "Supabase" button in the top navigation
2. Navigate to the registration page
3. Create a new account with your email and password
4. Log in with your new credentials

### 3. Migrate Your Data

There are two ways to migrate your data:

#### Automatic Migration

1. After logging in, go to the Supabase Dashboard
2. Look for the "Data Migration" card
3. If local data is detected, click the "Migrate Data" button
4. Wait for the migration to complete

The system will automatically:
- Read all entries from localStorage
- Convert them to the Supabase format
- Upload them to your Supabase database
- Associate them with your user account

#### Manual Export/Import

If you prefer a manual approach:

1. From the LocalStorage version, use the Export function to download your entries as JSON
2. Switch to the Supabase version
3. Use the Import function to upload your JSON file

### 4. Verify Your Data

After migration:

1. Check that all your entries appear in the calendar
2. Verify that entry content is complete
3. Test creating a new entry to ensure it saves correctly

### 5. Switch to Cloud Storage Mode

Once your data is migrated:

1. Click the storage selector in the bottom right corner
2. Select "Cloud" mode
3. Click "Apply"

### Troubleshooting

If you encounter issues during migration:

- **Missing Entries**: Check for duplicate dates, as the system prevents duplicates
- **Error Messages**: Note any error messages displayed during migration
- **Reset Process**: You can retry the migration process if needed

### Data Privacy

Your data privacy is important to us:

- Your data is stored in your own Supabase project
- Row-Level Security ensures you can only access your own entries
- No one else can see your entries without explicit sharing

### Reverting to LocalStorage

You can switch back to LocalStorage at any time:

1. Click the storage selector in the bottom right corner
2. Select "Local" mode
3. Click "Apply"

Note that entries created in Supabase will not automatically appear in localStorage.

## Technical Details

### Data Format Changes

When migrating to Supabase, some field names are changed to match PostgreSQL conventions:

| LocalStorage Field   | Supabase Field       |
|----------------------|----------------------|
| `id`                 | `id`                 |
| `date`               | `date`               |
| `objectives`         | `objectives`         |
| `keyResults`         | `key_results`        |
| `challenges`         | `challenges`         |
| `developmentTasks`   | `development_tasks`  |
| `featuresCompleted`  | `features_completed` |
| `challengesAndBlockers` | `challenges_and_blockers` |
| `codeAndPriorities`  | `code_and_priorities` |
| `systemImprovements` | `system_improvements` |
| `projectUpdates`     | `project_updates`    |
| `createdAt`          | `created_at`         |
| `updatedAt`          | `updated_at`         |

These transformations happen automatically during migration.

### For Developers

If you're a developer working with both storage systems:

- Use `useCaptainLog()` for localStorage operations
- Use `useSupabaseLog()` for Supabase operations
- Review the `supabase-data.ts` file for API differences
