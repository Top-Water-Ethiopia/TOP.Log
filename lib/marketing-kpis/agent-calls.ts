export function buildDepartmentCoalesceOrFilter(departmentId: string) {
  // Some legacy rows may have department_id populated but subject_department_id NULL.
  // Treat COALESCE(subject_department_id, department_id) as the effective department scope.
  //
  // Supabase JS doesn't support COALESCE directly in filters, so we emulate:
  // subject_department_id = <dept>
  // OR (subject_department_id IS NULL AND department_id = <dept>)
  const id = String(departmentId).trim()
  return `subject_department_id.eq.${id},and(subject_department_id.is.null,department_id.eq.${id})`
}

export const MARKETING_AGENT_CONTACTS_ENTRY_KIND = "agent_contact"
