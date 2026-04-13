-- Follow-up grants for functions defined in 20260413000009_fix_remaining_legacy_functions.sql

GRANT EXECUTE ON FUNCTION public.has_department_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_in_department(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_sub_team_members(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_missing_primary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_primary_existence() TO authenticated;

