import {
  buildMembershipHistorySummary,
  decodeMembershipHistoryCursor,
  encodeMembershipHistoryCursor,
  normalizeLegacyMembershipEvent,
} from "@/lib/memberships/history"

describe("membership history helpers", () => {
  it("normalizes a primary change into a user-facing history item", () => {
    const item = normalizeLegacyMembershipEvent({
      id: "evt-1",
      action: "primary_changed",
      previous_is_primary: false,
      new_is_primary: true,
      performed_at: "2026-04-13T08:30:00.000Z",
      performer_name: "TopWater Admin",
    })

    expect(item.eventKind).toBe("MEMBERSHIP_PRIMARY_CHANGED")
    expect(item.summary).toBe("Primary membership changed")
    expect(item.details).toEqual(["Primary changed from No to Yes"])
    expect(item.actor).toBe("TopWater Admin")
    expect(item.timestampLabel).not.toBe("Date unavailable")
  })

  it("falls back safely for invalid timestamps", () => {
    const item = normalizeLegacyMembershipEvent({
      id: "evt-2",
      action: "deactivated",
      performed_at: "not-a-date",
    })

    expect(item.timestamp).toBeNull()
    expect(item.timestampLabel).toBe("Date unavailable")
  })

  it("encodes and decodes stable cursors", () => {
    const encoded = encodeMembershipHistoryCursor("2026-04-13T08:30:00.000Z", "evt-9")

    expect(decodeMembershipHistoryCursor(encoded)).toEqual({
      timestamp: "2026-04-13T08:30:00.000Z",
      id: "evt-9",
    })
  })

  it("builds a summary from membership snapshot and latest event", () => {
    const latest = normalizeLegacyMembershipEvent({
      id: "evt-3",
      action: "activated",
      performed_at: "2026-04-13T08:30:00.000Z",
    })

    const summary = buildMembershipHistorySummary(
      {
        isActive: true,
        isPrimary: false,
        role: "Mobile",
      },
      latest
    )

    expect(summary).toEqual({
      status: "active",
      isPrimary: false,
      role: "Mobile",
      lastChangedAt: latest.timestamp,
      lastChangedLabel: latest.timestampLabel,
    })
  })
})
