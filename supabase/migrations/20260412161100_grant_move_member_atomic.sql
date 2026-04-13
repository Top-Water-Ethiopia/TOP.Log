-- Migration: Grant execute permissions for update_membership_with_primary function
-- Created as separate migration to avoid prepared statement issues

GRANT EXECUTE ON FUNCTION update_membership_with_primary(UUID, UUID, JSONB, UUID, TEXT) TO authenticated;
