# Marketing Sales Promoter Agent Call Reporting

## Summary
Implement agent-call reporting for the Marketing department's `sales-promoter` profession by extending the current question engine, not by creating a separate workflow.

The core idea:
- agents are external contact records assigned to one Marketing `sales-promoter`
- question creation supports a reusable dynamic select source called `assigned_agents`
- `/logs/new` continues to be the entry point, but a `sales-promoter` can submit multiple call reports on the same date
- duplicate reports for the same agent on the same date are blocked at the database layer

User stories:
- As a Marketing `sales-promoter`, I can submit multiple call reports on the same date, one per assigned agent.
- As a Marketing `sales-promoter`, I only see agents assigned to me in the dropdown.
- As a Marketing `sales-promoter`, I cannot submit a second report for the same agent on the same date.
- As an admin, I can manage agent contact records and assign each one to a Marketing `sales-promoter`.
- As an admin creating profession questions, I can configure a dropdown question whose options come from the current `sales-promoter`'s assigned agents.

## Key Changes
### Data model and interfaces
- Add a new table for agent contact records, scoped to Marketing and assigned to one `sales-promoter`.
- Recommended table:
  - `marketing_agents`
  - fields:
    - `id`
    - `department_id`
    - `sales_promoter_user_id`
    - `name`
    - `location`
    - `phone_e164`
    - `phone_raw`
    - `is_active`
    - `metadata`
    - timestamps
- Enforce at API/service level that:
  - `department_id` must be the Marketing department
  - `sales_promoter_user_id` must currently have an active `sales-promoter` profession assignment in that department
- Extend `captain_log_entries`:
  - `entry_kind = standard | agent_call`
  - `subject_agent_id`
  - `subject_agent_snapshot`
- Add partial unique indexes:
  - standard reports remain one per submitter + department + date
  - agent-call reports become one per submitter + department + date + agent
- Keep `custom_responses` for the actual answers, but save the chosen agent on the entry itself too.

### Question system changes
- Keep using `question_type = select`.
- Add a source contract in `role_questions.metadata`:
```json
{
  "legacy_question_key": "agent_contact",
  "option_source": {
    "kind": "assigned_agents"
  }
}
```
- For `assigned_agents` questions:
  - no static `options`
  - single-select only
  - required by default
  - only one assigned-agent source question allowed per scope
- Target these questions to the Marketing department's `sales-promoter` profession using the existing profession-scoped question model.

### Runtime reporting flow
- `/logs/new` keeps the current department/profession question loading behavior.
- When a question has `metadata.option_source.kind = assigned_agents`, the form fetches live options from a new authenticated API:
  - `GET /api/reporting/assigned-agents?departmentId=<id>&date=<yyyy-mm-dd>`
- That API:
  - verifies the logged-in user is active in the Marketing department with profession `sales-promoter`
  - loads active agents assigned to that user
  - checks which of those agents already have an `agent_call` entry for the selected date
  - returns:
```ts
type AssignedAgentOption = {
  id: string
  name: string
  location: string | null
  phone: string | null
  alreadyReported: boolean
}
```
- In the form:
  - the dropdown shows only assigned agents
  - already-reported agents are hidden or disabled
  - selecting an agent shows read-only location and phone
  - changing the report date refetches agent availability
  - if no agents are left for that date, submit is disabled and the UI explains why

### Save flow and read surfaces
- On submit:
  - resolve the selected agent again on the server
  - validate it still belongs to the logged-in `sales-promoter`
  - save:
    - `entry_kind = agent_call`
    - `subject_agent_id`
    - `subject_agent_snapshot = { name, location, phone }`
  - store the select response in `custom_responses.value` as `{ value, label }`
- Translate duplicate-key DB errors into:
  - `A call report for this agent already exists on this date.`
- Update logs list, preview, and report detail surfaces so same-day entries are distinguishable:
  - show agent name on the list card
  - show the saved agent snapshot in preview/detail
- Adjust wording that currently implies "one report per day" so the `sales-promoter` workflow reads as call-report tracking rather than daily completion tracking.

## Test Plan
- Database verification:
  - `marketing_agents` exists with the expected indexes
  - `agent_call` uniqueness blocks same-agent same-date duplicates
  - standard report uniqueness still works unchanged
- Question creator tests:
  - `select` can be configured as `assigned_agents`
  - static select behavior still works unchanged
  - assigned-agent source forces required and hides manual options
  - duplicate assigned-agent source questions in the same scope are rejected
- Assigned-agents API tests:
  - only Marketing `sales-promoter` users can access it
  - only that user's active agents are returned
  - already-reported agents are flagged correctly for the selected date
- `/logs/new` and form tests:
  - dynamic dropdown populates from assigned agents
  - date changes refresh availability
  - selected agent details render correctly
  - no available agents disables submit
  - same user can submit two same-day reports for two different agents
  - same user cannot submit two same-day reports for the same agent
- Read-surface tests:
  - logs list shows agent identity
  - preview/detail shows the saved snapshot
- Regression tests:
  - existing non-agent profession reporting still works
  - existing department-report behavior is unchanged
  - existing static dropdown questions are unchanged

## Assumptions and defaults
- `sales-promoter` is a `department_profession` in the Marketing department, not an access level.
- Agents are external contact records, not platform users.
- Each agent belongs to one `sales-promoter` at a time.
- The first dynamic option source is only `assigned_agents`.
- Historical reports keep the saved agent snapshot even if the agent record later changes.
- The dropdown source is reusable in the question system, but this first rollout is only intended for Marketing `sales-promoter` workflows.
- Existing standard reports remain `entry_kind = standard`; this feature only introduces `entry_kind = agent_call` for the new workflow.
