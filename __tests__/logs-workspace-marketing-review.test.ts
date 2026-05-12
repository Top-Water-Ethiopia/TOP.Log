import {
  formatMarketingEntryKindLabel,
  MARKETING_REVIEW_ENTRY_KINDS,
  summarizeMarketingReviewRows,
} from "@/lib/logs-workspace/marketing-review"

describe("marketing review workspace helpers", () => {
  it("summarizes operational counts and quality signals deterministically", () => {
    const summary = summarizeMarketingReviewRows([
      { id: "1", entry_kind: MARKETING_REVIEW_ENTRY_KINDS.agentContact, response_count: 2, subject_agent_name: "Shop A" },
      { id: "2", entry_kind: MARKETING_REVIEW_ENTRY_KINDS.majorActivity, response_count: 0, subject_agent_name: null },
      { id: "3", entry_kind: MARKETING_REVIEW_ENTRY_KINDS.supervisorDailyReport, response_count: 5, subject_agent_name: null },
      { id: "4", entry_kind: "unknown_kind", response_count: 1, subject_agent_name: null },
      { id: "5", entry_kind: MARKETING_REVIEW_ENTRY_KINDS.agentContact, response_count: 1, subject_agent_name: null },
    ])

    expect(summary.operational).toEqual({
      totalReports: 5,
      agentContacts: 2,
      majorActivities: 1,
      supervisorDailyReports: 1,
    })
    expect(summary.quality).toEqual({
      emptyReports: 1,
      missingAgent: 1,
      unknownTypes: 1,
    })
  })

  it("formats known and fallback entry kinds", () => {
    expect(formatMarketingEntryKindLabel("agent_contact")).toBe("Agent contact")
    expect(formatMarketingEntryKindLabel("custom_report_kind")).toBe("Custom Report Kind")
  })
})

