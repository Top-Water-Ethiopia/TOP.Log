-- =============================================
-- DATABASE SCHEMA DOCUMENTATION
-- =============================================
-- 
-- ROLES & PERMISSIONS SYSTEM:
--   roles                    - System-wide roles (system_admin, admin, user)
--   permissions              - Role-based permissions (resource.action)
--   permission_definitions   - Catalog of available permission types
--
-- DEPARTMENT STRUCTURE:
--   departments              - Department/team definitions
--   department_access_levels - Membership access levels (Lead, Manager, Contributor, Viewer)
--   department_roles         - Profession roles within department (Engineer, Designer, etc.)
--
-- USER ASSIGNMENTS:
--   user_profiles            - System role + basic user info
--   user_department_access_levels - What access level a user has in a department
--   user_department_professions     - What profession/role a user has (links to roles table)
--   user_department_roles    - DEPRECATED: Old membership table, being migrated
--
-- PROFESSION ROLES:
--   roles (department_id set) - Department-specific profession definitions
--   department_roles            - Alternative profession definitions per department
--   role_questions              - Questions assigned to professions or departments
--
-- CAPTAIN LOG:
--   captain_log_entries      - Daily log entries per user/department
--   custom_responses         - Question responses for log entries
--   access_requests          - Department join requests
--
-- =============================================

create table public.access_requests (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  requester_email text null,
  requested_role text null,
  department_id uuid null,
  message text null,
  status text not null default 'pending'::text,
  resolved_by uuid null,
  resolved_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint access_requests_pkey primary key (id),
  constraint access_requests_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null,
  constraint access_requests_resolved_by_fkey foreign KEY (resolved_by) references auth.users (id) on delete set null,
  constraint access_requests_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint access_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text,
          'resolved'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_access_requests_status on public.access_requests using btree (status) TABLESPACE pg_default;

create index IF not exists idx_access_requests_created_at on public.access_requests using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_access_requests_user_id on public.access_requests using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_access_requests_department_id on public.access_requests using btree (department_id) TABLESPACE pg_default;

create index IF not exists idx_access_requests_status_created_at on public.access_requests using btree (status, created_at) TABLESPACE pg_default;

create trigger update_access_requests_timestamp BEFORE
update on access_requests for EACH row
execute FUNCTION update_timestamp ();

create table public.audit_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  timestamp timestamp with time zone not null default now(),
  operation text not null,
  entity_id text not null,
  changes jsonb null,
  metadata jsonb null,
  user_id uuid null,
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null
) TABLESPACE pg_default;

create table public.captain_log_entries (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  date date not null,
  version integer null default 1,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  department_id uuid null,
  constraint captain_log_entries_pkey primary key (id),
  constraint captain_log_entries_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_captain_log_user_date on public.captain_log_entries using btree (user_id, date) TABLESPACE pg_default;

create unique INDEX IF not exists captain_log_entries_user_department_date_key on public.captain_log_entries using btree (user_id, department_id, date) TABLESPACE pg_default;

create trigger update_captain_log_modtime BEFORE
update on captain_log_entries for EACH row
execute FUNCTION update_updated_at_column ();

create view public.current_user_role as
select
  user_id,
  role_id,
  is_active
from
  user_profiles
where
  user_id = auth.uid ();

  create table public.custom_responses (
  id uuid not null default gen_random_uuid (),
  entry_id uuid not null,
  question_id text not null,
  question_key text not null,
  question_label text not null,
  question_type text not null,
  question_category text null default 'standard'::text,
  value jsonb null,
  timestamp timestamp with time zone null default now(),
  constraint custom_responses_pkey primary key (id),
  constraint custom_responses_entry_id_fkey foreign KEY (entry_id) references captain_log_entries (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_custom_responses_entry on public.custom_responses using btree (entry_id) TABLESPACE pg_default;


create table public.custom_responses (
  id uuid not null default gen_random_uuid (),
  entry_id uuid not null,
  question_id text not null,
  question_key text not null,
  question_label text not null,
  question_type text not null,
  question_category text null default 'standard'::text,
  value jsonb null,
  timestamp timestamp with time zone null default now(),
  constraint custom_responses_pkey primary key (id),
  constraint custom_responses_entry_id_fkey foreign KEY (entry_id) references captain_log_entries (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_custom_responses_entry on public.custom_responses using btree (entry_id) TABLESPACE pg_default;

create table public.department_access_level_permissions (
  id uuid not null default extensions.uuid_generate_v4 (),
  access_level_id uuid not null,
  resource text not null,
  action text not null,
  effect text not null default 'allow'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint department_access_level_permissions_pkey primary key (id),
  constraint department_access_level_permissions_unique unique (access_level_id, resource, action),
  constraint department_access_level_permissions_access_level_id_fkey foreign KEY (access_level_id) references department_access_levels (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_department_access_level_permissions_access_level on public.department_access_level_permissions using btree (access_level_id) TABLESPACE pg_default;

create trigger update_department_access_level_permissions_timestamp BEFORE
update on department_access_level_permissions for EACH row
execute FUNCTION update_timestamp ();

-- Department membership access levels
-- Defines what a user CAN DO in a department (permissions)
-- Examples: department_lead, department_manager, contributor, viewer
create table public.department_access_levels (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  display_name text not null,
  description text null,
  level integer not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint department_access_levels_pkey primary key (id),
  constraint department_access_levels_name_unique unique (name)
) TABLESPACE pg_default;

create index IF not exists idx_department_access_levels_name on public.department_access_levels using btree (name) TABLESPACE pg_default;

create trigger update_department_access_levels_timestamp BEFORE
update on department_access_levels for EACH row
execute FUNCTION update_timestamp ();

-- Profession roles within a department
-- Defines what ROLE a user has in a department (their job/profession)
-- Examples: Engineer, Designer, Manager, Developer, etc.
-- These are department-specific profession definitions
create table public.department_roles (
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  description text null,
  constraint department_roles_pkey primary key (key)
) TABLESPACE pg_default;

create unique INDEX IF not exists department_roles_single_default on public.department_roles using btree (is_default) TABLESPACE pg_default
where
  (is_default = true);

  create table public.departments (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  metadata jsonb null default '{}'::jsonb,
  constraint departments_pkey primary key (id),
  constraint departments_name_key unique (name),
  constraint departments_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint departments_updated_by_fkey foreign KEY (updated_by) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists idx_departments_name on public.departments using btree (name) TABLESPACE pg_default;

create index IF not exists idx_departments_is_active on public.departments using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_departments_created_by on public.departments using btree (created_by) TABLESPACE pg_default;

create index IF not exists idx_departments_active on public.departments using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger update_departments_timestamp BEFORE
update on departments for EACH row
execute FUNCTION update_timestamp ();

create table public.permission_definitions (
  id uuid not null default extensions.uuid_generate_v4 (),
  resource text not null,
  action text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint permission_definitions_pkey primary key (id),
  constraint permission_definitions_resource_action_key unique (resource, action)
) TABLESPACE pg_default;

create table public.permissions (
  id uuid not null default extensions.uuid_generate_v4 (),
  role_id uuid not null,
  resource text not null,
  action text not null,
  conditions jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint permissions_pkey primary key (id),
  constraint permissions_role_id_resource_action_key unique (role_id, resource, action),
  constraint permissions_role_id_fkey foreign KEY (role_id) references roles (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_permissions_timestamp BEFORE
update on permissions for EACH row
execute FUNCTION update_timestamp ();

create table public.role_questions (
  id uuid not null default gen_random_uuid (),
  role_id uuid null,
  question_label text not null,
  question_type text not null,
  question_description text null,
  placeholder text null,
  options jsonb null,
  is_required boolean not null default false,
  display_order integer not null default 0,
  validation_rules jsonb null,
  is_active boolean not null default true,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  metadata jsonb null default '{}'::jsonb,
  min_value numeric null,
  max_value numeric null,
  min_length integer null,
  max_length integer null,
  pattern text null,
  step numeric null,
  min_date date null,
  max_date date null,
  department_id uuid null,
  department_role text null,
  constraint role_questions_pkey primary key (id),
  constraint role_questions_department_id_fkey foreign KEY (department_id) references departments (id) on delete CASCADE,
  constraint role_questions_updated_by_fkey foreign KEY (updated_by) references auth.users (id) on delete set null,
  constraint role_questions_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint role_questions_role_id_fkey foreign KEY (role_id) references roles (id) on delete CASCADE,
  constraint role_questions_question_type_check check (
    (
      question_type = any (
        array[
          'text'::text,
          'textarea'::text,
          'select'::text,
          'multiselect'::text,
          'checkbox'::text,
          'number'::text,
          'date'::text,
          'email'::text,
          'url'::text,
          'phone'::text,
          'time'::text,
          'datetime'::text,
          'rating'::text,
          'radio'::text,
          'file'::text
        ]
      )
    )
  ),
  constraint role_questions_scope_check check (
    (
      (department_id is null) <> (department_role is null)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_role_questions_department_id on public.role_questions using btree (department_id) TABLESPACE pg_default
where
  (department_id is not null);

create index IF not exists idx_role_questions_department_display_order on public.role_questions using btree (department_id, display_order) TABLESPACE pg_default
where
  (department_id is not null);

create index IF not exists idx_role_questions_role_id on public.role_questions using btree (role_id) TABLESPACE pg_default;

create index IF not exists idx_role_questions_active on public.role_questions using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_role_questions_display_order on public.role_questions using btree (role_id, display_order) TABLESPACE pg_default;

create index IF not exists idx_role_questions_department_role on public.role_questions using btree (department_role) TABLESPACE pg_default
where
  (department_role is not null);

create index IF not exists idx_role_questions_department_role_display_order on public.role_questions using btree (department_role, display_order) TABLESPACE pg_default
where
  (department_role is not null);

create trigger update_role_questions_timestamp BEFORE
update on role_questions for EACH row
execute FUNCTION update_timestamp ();

-- Profession/Role definitions
-- When department_id IS NULL: system-wide roles (system_admin, admin, user)
-- When department_id IS SET: department-specific professions (Engineer, Designer, etc.)
create table public.roles (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  department_id uuid null,
  level integer not null default 1,
  constraint roles_pkey primary key (id),
  constraint roles_name_unique unique (name),
  constraint roles_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_roles_department on public.roles using btree (department_id) TABLESPACE pg_default;

create index IF not exists idx_roles_level on public.roles using btree (level) TABLESPACE pg_default;

create trigger update_roles_timestamp BEFORE
update on roles for EACH row
execute FUNCTION update_timestamp ();

create table public.user_department_access_levels (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  department_id uuid not null,
  access_level_id uuid not null,
  assigned_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_department_access_levels_pkey primary key (id),
  constraint user_department_access_levels_user_dept_unique unique (user_id, department_id),
  constraint user_department_access_levels_access_level_id_fkey foreign KEY (access_level_id) references department_access_levels (id) on delete CASCADE,
  constraint user_department_access_levels_department_id_fkey foreign KEY (department_id) references departments (id) on delete CASCADE,
  constraint user_department_access_levels_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_department_access_levels_user on public.user_department_access_levels using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_department_access_levels_department on public.user_department_access_levels using btree (department_id) TABLESPACE pg_default;

create index IF not exists idx_user_department_access_levels_access_level on public.user_department_access_levels using btree (access_level_id) TABLESPACE pg_default;

create trigger update_user_department_access_levels_timestamp BEFORE
update on user_department_access_levels for EACH row
execute FUNCTION update_timestamp ();


-- Links users to their profession within a department
-- role_id references roles.id (the profession like Engineer, Designer)
create table public.user_department_professions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  department_id uuid not null,
  role_id uuid not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint user_department_professions_pkey primary key (id),
  constraint user_department_professions_user_id_department_id_key unique (user_id, department_id),
  constraint user_department_professions_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint user_department_professions_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint user_department_professions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_department_professions_role_id_fkey foreign KEY (role_id) references roles (id) on delete RESTRICT,
  constraint user_department_professions_department_id_fkey foreign KEY (department_id) references departments (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists user_department_professions_one_active_profession_per_user on public.user_department_professions using btree (user_id) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_user_department_professions_user on public.user_department_professions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_department_professions_department on public.user_department_professions using btree (department_id) TABLESPACE pg_default;

create index IF not exists idx_user_department_professions_role on public.user_department_professions using btree (role_id) TABLESPACE pg_default;

create trigger trg_profession_matches_active_department BEFORE INSERT
or
update on user_department_professions for EACH row
execute FUNCTION enforce_profession_matches_active_department ();

-- DEPRECATED: Old membership table, replaced by user_department_access_levels
-- Kept for backwards compatibility - new code should use access_levels
create table public.user_department_roles (
  id uuid not null default COALESCE(
    extensions.uuid_generate_v4 (),
    gen_random_uuid ()
  ),
  user_id uuid not null,
  department_id uuid not null,
  role text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint user_department_roles_pkey primary key (id),
  constraint user_department_roles_user_id_department_id_key unique (user_id, department_id),
  constraint user_department_roles_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint user_department_roles_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint user_department_roles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_department_roles_role_fkey foreign KEY (role) references department_roles (key) on update CASCADE on delete RESTRICT,
  constraint user_department_roles_department_id_fkey foreign KEY (department_id) references departments (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_department_roles_user on public.user_department_roles using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_department_roles_department on public.user_department_roles using btree (department_id) TABLESPACE pg_default;

create unique INDEX IF not exists user_department_roles_one_active_membership_per_user on public.user_department_roles using btree (user_id) TABLESPACE pg_default
where
  (is_active = true);

create table public.user_profiles (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  name text not null,
  role_id uuid not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  metadata jsonb null,
  last_login timestamp with time zone null,
  department_id uuid null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_user_id_key unique (user_id),
  constraint user_profiles_department_id_fkey foreign KEY (department_id) references departments (id),
  constraint user_profiles_role_id_fkey foreign KEY (role_id) references roles (id) on delete RESTRICT,
  constraint user_profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_department_id on public.user_profiles using btree (department_id) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_user_profiles_role_dept on public.user_profiles using btree (role_id, department_id) TABLESPACE pg_default
where
  (is_active = true);

create trigger update_user_profiles_timestamp BEFORE
update on user_profiles for EACH row
execute FUNCTION update_timestamp ();