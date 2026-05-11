import { resolveConfiguredQuestionPairs } from "@/lib/marketing-kpis/config/resolve-configured-question-pairs"

function createThenableBuilder(result: any) {
  const builder: any = {
    select: jest.fn(() => builder),
    or: jest.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

describe("resolveConfiguredQuestionPairs", () => {
  it("dedupes identical pairs but preserves same key across different entry kinds", async () => {
    const fromMock = jest.fn().mockReturnValue(
      createThenableBuilder({
        data: [
          {
            question_label: "Followers gained",
            question_type: "number",
            entry_kind: " dmal ",
            metadata: { legacy_question_key: "how_many_new_followers_were_gained" },
          },
          // duplicate pair
          {
            question_label: "Followers gained",
            question_type: "number",
            entry_kind: "dmal",
            metadata: { legacy_question_key: "how_many_new_followers_were_gained" },
          },
          // same key, different entry kind should be preserved
          {
            question_label: "Followers gained",
            question_type: "number",
            entry_kind: "daily_supervisors_report",
            metadata: { legacy_question_key: "how_many_new_followers_were_gained" },
          },
          // wrong type ignored
          {
            question_label: "Followers gained",
            question_type: "text",
            entry_kind: "dmal",
            metadata: { legacy_question_key: "how_many_new_followers_were_gained" },
          },
        ],
        error: null,
      })
    )

    const supabase: any = { from: fromMock }
    const resolved = await resolveConfiguredQuestionPairs({
      supabase,
      questionKeys: ["how_many_new_followers_were_gained"],
      expectedQuestionType: "number",
    })

    expect(resolved.resolvedKeys).toEqual(["how_many_new_followers_were_gained"])
    expect(new Set(resolved.resolvedEntryKinds)).toEqual(new Set(["dmal", "daily_supervisors_report"]))
    expect(resolved.stats.duplicatePairsRemoved).toBe(1)
    expect(resolved.stats.nonMatchingType).toBe(1)
  })
})

