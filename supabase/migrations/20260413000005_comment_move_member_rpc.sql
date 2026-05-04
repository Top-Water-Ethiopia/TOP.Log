COMMENT ON FUNCTION move_member_atomic(UUID, UUID, UUID, membership_type_enum, UUID, BOOLEAN, UUID, TEXT) IS
'Atomically moves a member from one department to another.
Preserves primary status. Deactivates source and any conflicting target membership.
Logs audit event.';
