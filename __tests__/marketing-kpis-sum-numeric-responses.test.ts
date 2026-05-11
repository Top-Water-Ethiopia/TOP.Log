import { sumNumericResponses } from "@/lib/marketing-kpis/numeric/sum-numeric-responses"

describe("sumNumericResponses", () => {
  it("sums decimals and rejects negatives, locale strings, and non-finite", () => {
    const allowed = new Map<string, Set<string>>([["k1", new Set(["e1"])]])
    const rows = [
      { question_key: "k1", entry_kind: "e1", value: "2.5" },
      { question_key: "k1", entry_kind: "e1", value: 1 },
      { question_key: "k1", entry_kind: "e1", value: "-1" },
      { question_key: "k1", entry_kind: "e1", value: "1,200" },
      { question_key: "k1", entry_kind: "e1", value: "Infinity" },
      { question_key: "k1", entry_kind: "wrong", value: "10" },
      { question_key: " ", entry_kind: "e1", value: "10" },
    ]

    const result = sumNumericResponses({
      rows,
      allowedPairsByKey: allowed,
      getQuestionKey: (r) => r.question_key,
      getEntryKind: (r) => r.entry_kind,
      getValue: (r) => r.value,
    })

    expect(result.sum).toBe(3.5)
    expect(result.skipped.negative).toBe(1)
    expect(result.skipped.malformed).toBe(2) // "1,200" + "Infinity" (fails regex)
    expect(result.skipped.pairMismatch).toBe(1)
    expect(result.skipped.missingKey).toBe(1)
  })

  it("rejects NaN and non-numeric objects", () => {
    const allowed = new Map<string, Set<string>>([["k1", new Set(["e1"])]])
    const rows = [
      { question_key: "k1", entry_kind: "e1", value: NaN },
      { question_key: "k1", entry_kind: "e1", value: {} },
    ]
    const result = sumNumericResponses({
      rows,
      allowedPairsByKey: allowed,
      getQuestionKey: (r) => r.question_key,
      getEntryKind: (r) => r.entry_kind,
      getValue: (r) => r.value,
    })
    expect(result.sum).toBe(0)
    expect(result.skipped.nonFinite).toBe(1)
    expect(result.skipped.malformed).toBe(1)
  })
})

