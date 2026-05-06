import { classifyOutcome, extractFailureReasons } from "@/lib/marketing-kpis/outcomes"

describe("Agent contact outcome classifier", () => {
  it("classifies Yes/No/other correctly", () => {
    expect(classifyOutcome("Yes")).toBe("success")
    expect(classifyOutcome("No")).toBe("failed")
    expect(classifyOutcome(null)).toBe("missing")
    expect(classifyOutcome("Maybe")).toBe("missing")
  })
})

describe("Failure reason parsing", () => {
  it("filters invalid reasons and dedupes per entry", () => {
    const reasons = extractFailureReasons(["No answer", "  ", "", "No answer", "Line busy"])
    expect(reasons.sort()).toEqual(["line_busy", "no_answer"].sort())
  })

  it("treats non-array values as empty", () => {
    expect(extractFailureReasons("No answer")).toEqual([])
    expect(extractFailureReasons(null)).toEqual([])
    expect(extractFailureReasons({})).toEqual([])
  })
})

