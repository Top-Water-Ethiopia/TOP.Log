## Supabase Integration

TOP Log now includes optional Supabase integration for cloud storage and authentication.

### Backend & Data Storage
- **[Supabase](https://supabase.com/)** - Open source Firebase alternative
- **PostgreSQL Database** - Robust relational database for entries
- **Row-Level Security** - Data protection at the database level
- **User Authentication** - Secure email/password auth system

### Setting Up Supabase

To use the Supabase integration:

1. **Create a Supabase account and project** at [supabase.com](https://supabase.com)

2. **Copy environment variables**:
   - Create a `.env.local` file in the project root
   - Add your Supabase credentials (see `env.example` for format):
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Initialize database schema**:
   - Navigate to the SQL Editor in your Supabase dashboard
   - Copy and execute the SQL from `lib/supabase/schema.sql`

4. **Migrate your data** (optional):
   - After logging in, go to Settings > Data
   - Use the "Migrate from LocalStorage" option to transfer existing entries

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for detailed instructions.

### Features Enabled by Supabase

- **Multi-device Synchronization**: Access your entries from any device
- **User Accounts**: Secure login with email/password
- **Role-Based Access Control**: Customizable permission system
- **Data Backup**: Entries stored securely in the cloud
- **Team Collaboration**: Potential for shared access in future updates
