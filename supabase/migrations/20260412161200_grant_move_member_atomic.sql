-- Migration: Grant execute permissions for move_member_atomic function
-- Created as separate migration to avoid prepared statement issues

GRANT EXECUTE ON FUNCTION move_member_atomic(UUID, UUID, UUID, VARCHAR, UUID, TEXT) TO authenticated;
