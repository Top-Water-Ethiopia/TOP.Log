
import { evaluateConditionalLogic } from "../lib/reporting-logic"

describe("evaluateConditionalLogic", () => {
  const responses = {
    simple_text: "Yes",
    another_text: "No",
    status_checked: true,
    status_unchecked: false,
    list_values: ["A", "B", "C"],
  }

  it("returns true if logic is missing or empty", () => {
    expect(evaluateConditionalLogic(null, responses)).toBe(true)
    expect(evaluateConditionalLogic({}, responses)).toBe(true)
    expect(evaluateConditionalLogic({ showIf: null }, responses)).toBe(true)
  })

  describe("operator: equals", () => {
    it("returns true when value matches", () => {
      const logic = { showIf: { questionKey: "simple_text", operator: "equals", value: "Yes" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })

    it("returns false when value does not match", () => {
      const logic = { showIf: { questionKey: "simple_text", operator: "equals", value: "No" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(false)
    })
  })

  describe("operator: not_equals", () => {
    it("returns true when value is different", () => {
      const logic = { showIf: { questionKey: "simple_text", operator: "not_equals", value: "No" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })

    it("returns false when value is the same", () => {
      const logic = { showIf: { questionKey: "simple_text", operator: "not_equals", value: "Yes" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(false)
    })
  })

  describe("operator: contains", () => {
    it("returns true when array contains value", () => {
      const logic = { showIf: { questionKey: "list_values", operator: "contains", value: "B" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })

    it("returns false when array does not contain value", () => {
      const logic = { showIf: { questionKey: "list_values", operator: "contains", value: "D" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(false)
    })

    it("returns true when string includes value", () => {
      const logic = { showIf: { questionKey: "simple_text", operator: "contains", value: "e" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })
  })

  describe("operator: checked", () => {
    it("returns true when boolean is true", () => {
      const logic = { showIf: { questionKey: "status_checked", operator: "checked" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })

    it("returns false when boolean is false", () => {
      const logic = { showIf: { questionKey: "status_unchecked", operator: "checked" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(false)
    })
  })

  describe("operator: not_checked", () => {
    it("returns true when boolean is false", () => {
      const logic = { showIf: { questionKey: "status_unchecked", operator: "not_checked" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(true)
    })

    it("returns false when boolean is true", () => {
      const logic = { showIf: { questionKey: "status_checked", operator: "not_checked" } }
      expect(evaluateConditionalLogic(logic, responses)).toBe(false)
    })
  })
})
