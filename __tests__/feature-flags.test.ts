import { parseBooleanEnvValue } from "@/lib/feature-flags/flags"
import { isFeatureEnabledServer } from "@/lib/feature-flags/server"

describe("feature flags", () => {
  describe("parseBooleanEnvValue", () => {
    it("parses truthy strings", () => {
      expect(parseBooleanEnvValue("true")).toBe(true)
      expect(parseBooleanEnvValue("1")).toBe(true)
      expect(parseBooleanEnvValue("yes")).toBe(true)
      expect(parseBooleanEnvValue("on")).toBe(true)
      expect(parseBooleanEnvValue("enabled")).toBe(true)
    })

    it("parses falsy strings", () => {
      expect(parseBooleanEnvValue("false")).toBe(false)
      expect(parseBooleanEnvValue("0")).toBe(false)
      expect(parseBooleanEnvValue("no")).toBe(false)
      expect(parseBooleanEnvValue("off")).toBe(false)
      expect(parseBooleanEnvValue("disabled")).toBe(false)
    })

    it("returns undefined for undefined and invalid strings", () => {
      expect(parseBooleanEnvValue(undefined)).toBeUndefined()
      expect(parseBooleanEnvValue("maybe")).toBeUndefined()
      expect(parseBooleanEnvValue("")).toBeUndefined()
    })
  })

  describe("isFeatureEnabledServer", () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      delete process.env.FF_ANALYTICS
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it("uses default when env is not set", () => {
      expect(isFeatureEnabledServer("ANALYTICS")).toBe(false)
    })

    it("uses env when set", () => {
      process.env.FF_ANALYTICS = "true"
      expect(isFeatureEnabledServer("ANALYTICS")).toBe(true)

      process.env.FF_ANALYTICS = "false"
      expect(isFeatureEnabledServer("ANALYTICS")).toBe(false)
    })
  })
})
