-- Migration to sync global role permissions for Admin, Super-Admin, and System-Admin
-- Based on DATABASE_DEFAULT_ROLES in lib/rbac/database-defaults.ts

BEGIN;

-- Helper function to insert permission if missing
CREATE OR REPLACE FUNCTION public.sync_role_permission(p_role_id UUID, p_resource TEXT, p_action TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    VALUES (p_role_id, p_resource, p_action, 'allow')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 1. SUPER-ADMIN (00000000-0000-0000-0000-000000000000)
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'export');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'entries', 'import');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'users', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'users', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'users', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'users', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'users', 'manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'members.read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'departments', 'members.manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'analytics', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'analytics', 'read.own');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'analytics', 'advanced');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'analytics', 'team');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'admin', 'system');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'admin', 'audit');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'admin', 'backup');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'admin', 'restore');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'admin', 'settings');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'department_questions', 'answer');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'department_questions', 'read');

-- 2. ADMIN (00000000-0000-0000-0000-000000000001)
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'export');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'entries', 'import');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'users', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'users', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'users', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'users', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'users', 'manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'members.read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'departments', 'members.manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'analytics', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'analytics', 'read.own');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'analytics', 'advanced');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'analytics', 'team');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'admin', 'system');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'admin', 'audit');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'admin', 'backup');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'admin', 'restore');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'admin', 'settings');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'department_questions', 'answer');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'department_questions', 'read');

-- 3. SYSTEM-ADMIN (00000000-0000-0000-0000-000000000010)
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'export');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'entries', 'import');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'users', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'users', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'users', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'users', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'users', 'manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'create');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'update');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'delete');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'members.read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'departments', 'members.manage');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'analytics', 'read');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'analytics', 'read.own');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'analytics', 'advanced');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'analytics', 'team');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'admin', 'system');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'admin', 'audit');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'admin', 'backup');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'admin', 'restore');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'admin', 'settings');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'department_questions', 'answer');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'department_questions', 'read');

DROP FUNCTION sync_role_permission(UUID, TEXT, TEXT);

COMMIT;
