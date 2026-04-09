import { getEntryKindEditorTitle } from "@/lib/entry-kinds"

describe("getEntryKindEditorTitle", () => {
  it("uses the editable label for standard instead of the raw system key", () => {
    const result = getEntryKindEditorTitle({
      entry_kind: "standard",
      label: "Daily Report",
      is_active: true,
    } as any)

    expect(result).toEqual({
      title: "Daily Report",
      keyLabel: "standard",
    })
  })

  it("keeps the inactive indicator on the editable title", () => {
    const result = getEntryKindEditorTitle({
      entry_kind: "standard",
      label: "Daily Report",
      is_active: false,
    } as any)

    expect(result).toEqual({
      title: "Daily Report (Inactive)",
      keyLabel: "standard",
    })
  })
})
