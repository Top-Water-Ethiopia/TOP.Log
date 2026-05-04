-- Align Department Lead and Supervisor permissions with RLS expectations
-- The RLS policy for captain_log_entries checks for 'read_any' action on 'entries' resource
-- while 'department-lead' and 'supervisor' roles were using 'read_department'.

DO $$
BEGIN
    -- Grant read_any to department-lead for entries
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'department-lead') THEN
        INSERT INTO role_permissions (role_id, resource, action, effect)
        SELECT id, 'entries', 'read_any', 'allow'
        FROM roles WHERE name = 'department-lead'
        ON CONFLICT (role_id, resource, action) DO NOTHING;
    END IF;

    -- Grant read_any to supervisor for entries
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'supervisor') THEN
        INSERT INTO role_permissions (role_id, resource, action, effect)
        SELECT id, 'entries', 'read_any', 'allow'
        FROM roles WHERE name = 'supervisor'
        ON CONFLICT (role_id, resource, action) DO NOTHING;
    END IF;
END $$;
