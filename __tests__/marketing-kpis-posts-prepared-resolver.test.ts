import { resolveConfiguredPostPreparedPairs } from "@/lib/marketing-kpis/posts-prepared-resolver"

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    in: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("posts prepared resolver", () => {
  it("trims, validates, dedupes, and preserves different keys", async () => {
    const fromMock = jest.fn().mockReturnValue(
      createThenableBuilder({
        data: [
          {
            question_label: "What content did you share today?",
            question_type: "image",
            entry_kind: " dmal ",
            metadata: { legacy_question_key: " what_content_did_you_share_today " },
          },
          // Duplicate pair should be removed
          {
            question_label: "What content did you share today?",
            question_type: "image",
            entry_kind: "dmal",
            metadata: { legacy_question_key: "what_content_did_you_share_today" },
          },
          // Same label, different key should be preserved
          {
            question_label: "What content did you share today?",
            question_type: "image",
            entry_kind: "dmal",
            metadata: { legacy_question_key: "other_key" },
          },
          // Non-image should be ignored
          {
            question_label: "What post content did you share today? ...",
            question_type: "text",
            entry_kind: "daily_supervisors_report",
            metadata: { legacy_question_key: "k" },
          },
          // Missing key should be ignored
          {
            question_label: "What post content did you share today? ...",
            question_type: "image",
            entry_kind: "daily_supervisors_report",
            metadata: {},
          },
        ],
        error: null,
      })
    )

    const supabase: any = { from: fromMock }
    const resolved = await resolveConfiguredPostPreparedPairs({
      supabase,
      questionLabels: ["What content did you share today?"] as const,
    })

    expect(resolved.resolvedKeys.sort()).toEqual(["other_key", "what_content_did_you_share_today"].sort())
    expect(resolved.resolvedEntryKinds).toEqual(["dmal"])
    expect(resolved.stats.duplicatePairsRemoved).toBe(1)
    expect(resolved.stats.nonImageCandidates).toBe(1)
    expect(resolved.stats.missingLegacyKey).toBe(1)
  })
})

