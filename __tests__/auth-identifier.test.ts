import { getAuthIdentifierError, normalizeEthiopianPhone, parseAuthIdentifier } from "@/lib/auth/identifier"

describe("auth identifier helpers", () => {
  it("normalizes supported Ethiopian phone formats into E.164", () => {
    expect(normalizeEthiopianPhone("+251912345678")).toBe("+251912345678")
    expect(normalizeEthiopianPhone("251912345678")).toBe("+251912345678")
    expect(normalizeEthiopianPhone("2510912345678")).toBe("+251912345678")
    expect(normalizeEthiopianPhone("0912345678")).toBe("+251912345678")
    expect(normalizeEthiopianPhone("912345678")).toBe("+251912345678")
  })

  it("parses email identifiers", () => {
    expect(parseAuthIdentifier("User@Example.com")).toEqual({
      type: "email",
      value: "user@example.com",
    })
  })

  it("parses Ethiopian phone identifiers", () => {
    expect(parseAuthIdentifier("0912345678")).toEqual({
      type: "phone",
      value: "+251912345678",
    })
  })

  it("returns helpful validation messages", () => {
    expect(getAuthIdentifierError("")).toBe("Email or phone number is required")
    expect(getAuthIdentifierError("wrong@")).toBe("Enter a valid email address")
    expect(getAuthIdentifierError("0712345678")).toBe("Enter a valid Ethiopian phone number")
  })
})
