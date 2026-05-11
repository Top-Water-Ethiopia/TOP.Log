import { countEntryKindInWindow } from "@/lib/marketing-kpis/entries/count-entry-kind-in-window"

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("countEntryKindInWindow", () => {
  it("counts captain_log_entries by entry_kind with window filters", async () => {
    const fromMock = jest.fn().mockReturnValue(createThenableBuilder({ count: 3, error: null }))
    const supabase: any = { from: fromMock }
    const result = await countEntryKindInWindow({
      supabase,
      marketingDepartmentId: "dept-marketing",
      entryKind: "dmal",
      window: { start: "2026-05-01", end: "2026-05-02" },
    })
    expect(result.value).toBe(3)
    expect(fromMock).toHaveBeenCalledWith("captain_log_entries")
  })
})

