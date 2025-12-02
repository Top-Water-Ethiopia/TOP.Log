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

create trigger update_user_profiles_timestamp BEFORE
update on user_profiles for EACH row
execute FUNCTION update_timestamp ();

create table public.roles (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  department_id uuid null,
  constraint roles_pkey primary key (id),
  constraint roles_name_key unique (name),
  constraint roles_department_id_fkey foreign KEY (department_id) references departments (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_roles_department on public.roles using btree (department_id) TABLESPACE pg_default;

create trigger update_roles_timestamp BEFORE
update on roles for EACH row
execute FUNCTION update_timestamp ();


create table public.role_questions (
  id uuid not null default gen_random_uuid (),
  role_id uuid not null,
  question_key text not null,
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
  conditional_logic jsonb null,
  default_value text null,
  help_text text null,
  min_value numeric null,
  max_value numeric null,
  min_length integer null,
  max_length integer null,
  pattern text null,
  step numeric null,
  min_date date null,
  max_date date null,
  question_title text null,
  constraint role_questions_pkey primary key (id),
  constraint role_questions_role_id_question_key_key unique (role_id, question_key),
  constraint role_questions_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint role_questions_role_id_fkey foreign KEY (role_id) references roles (id) on delete CASCADE,
  constraint role_questions_updated_by_fkey foreign KEY (updated_by) references auth.users (id) on delete set null,
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
  )
) TABLESPACE pg_default;

create index IF not exists idx_role_questions_role_id on public.role_questions using btree (role_id) TABLESPACE pg_default;

create index IF not exists idx_role_questions_active on public.role_questions using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_role_questions_display_order on public.role_questions using btree (role_id, display_order) TABLESPACE pg_default;

create index IF not exists idx_role_questions_conditional on public.role_questions using gin (conditional_logic) TABLESPACE pg_default;

create trigger update_role_questions_timestamp BEFORE
update on role_questions for EACH row
execute FUNCTION update_timestamp ();



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

create table public.departments (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  code text null,
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

create index IF not exists idx_departments_active on public.departments using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger update_departments_timestamp BEFORE
update on departments for EACH row
execute FUNCTION update_timestamp ();


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

create table public.captain_log_entries (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  date date not null,
  version integer null default 1,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint captain_log_entries_pkey primary key (id),
  constraint captain_log_entries_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;

create index IF not exists idx_captain_log_user_date on public.captain_log_entries using btree (user_id, date) TABLESPACE pg_default;

create trigger update_captain_log_modtime BEFORE
update on captain_log_entries for EACH row
execute FUNCTION update_updated_at_column ();

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

