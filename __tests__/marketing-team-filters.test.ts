import {
  canonicalRole,
  convert09ToE164IfApplicable,
  digitsOnly,
  indexTeamMember,
  matchesTeamSearch,
  normalizeE164,
  normalizeE164Prefix,
} from "@/lib/marketing/team-filters"

describe("marketing team filters - phone normalization & matching", () => {
  test("normalizeE164 validates and strips formatting", () => {
    expect(normalizeE164("+251 911 234 567")).toBe("+251911234567")
    expect(normalizeE164("+251-911-234-567")).toBe("+251911234567")
    expect(normalizeE164("251911234567")).toBeNull()
    expect(normalizeE164("+000123")).toBeNull()
  })

  test("normalizeE164Prefix allows partial + prefixes", () => {
    expect(normalizeE164Prefix("+251 911")).toBe("+251911")
    expect(normalizeE164Prefix("+000123")).toBeNull()
    expect(normalizeE164Prefix("251911")).toBeNull()
  })

  test("ET local 09XXXXXXXX converts to +2519XXXXXXXX", () => {
    const qRaw = "09 11 23 45 67"
    const qDigits = digitsOnly(qRaw)
    expect(convert09ToE164IfApplicable(qDigits, qRaw)).toBe("+251911234567")
  })

  test("non-ET 10-digit input does not convert", () => {
    const qRaw = "0812345678"
    const qDigits = digitsOnly(qRaw)
    expect(convert09ToE164IfApplicable(qDigits, qRaw)).toBeNull()
  })

  test("09 prefix matches via ET conversion (prefix mode, not digits rule)", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "0911234567" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "09 112 345 67" })).toBe(true)
  })

  test("matches +251... when user types +251...", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "+251 911" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "+251-911-234" })).toBe(true)
  })

  test("invalid E.164 query does not match", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "+000123" })).toBe(false)
  })

  test("does not match phone when phone is hidden (privacy invariant)", () => {
    const hidden = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: false,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member: hidden, query: "0911234567" })).toBe(false)
    expect(matchesTeamSearch({ member: hidden, query: "+251911" })).toBe(false)
    // but name search still works
    expect(matchesTeamSearch({ member: hidden, query: "ali" })).toBe(true)
  })

  test("invalid phoneRaw does not produce searchable digits", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "0911234567", // invalid (not E.164)
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "91123" })).toBe(false)
    expect(matchesTeamSearch({ member, query: "0911234567" })).toBe(false)
  })

  test("empty or whitespace query matches all (no filter)", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "   " })).toBe(true)
  })

  test("digits-only fallback requires minimum digits (default 5)", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "9112" })).toBe(false)
    expect(matchesTeamSearch({ member, query: "91123" })).toBe(true)
  })

  test("digits-only query matches when >= 5 digits", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "91123" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "12345" })).toBe(true)
  })

  test("multiple tokens require all to match (AND across tokens)", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "alice 91123" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "alice wrongtoken" })).toBe(false)
  })

  test("mixed query matches by name (phone fallback not required)", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "alice 78" })).toBe(true)
  })

  test("07/09 local prefix guards: 07 and 09 alone do not phone-match", () => {
    const member07 = indexTeamMember({
      userId: "u7",
      name: "Bob",
      phoneVisible: true,
      phoneRaw: "+251711234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member: member07, query: "07" })).toBe(false)
    expect(matchesTeamSearch({ member: member07, query: "071" })).toBe(true)

    const member09 = indexTeamMember({
      userId: "u9",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member: member09, query: "09" })).toBe(false)
    expect(matchesTeamSearch({ member: member09, query: "091" })).toBe(true)
  })

  test("251 prefix guard: 2519 alone does not prefix-match", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "251" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "2519" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "25191" })).toBe(true)
  })

  test("name matching is case-insensitive", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: false,
      phoneRaw: null,
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "ALICE" })).toBe(true)
  })
})

describe("marketing team filters - role normalization", () => {
  test("canonicalRole collapses casing and whitespace", () => {
    expect(canonicalRole(" Sales   Manager ")).toBe("sales manager")
    expect(canonicalRole("sales manager")).toBe("sales manager")
  })

  test("role normalization affects indexed roleKey", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: false,
      phoneRaw: null,
      roleLabel: " Sales   Manager ",
    })
    expect(member.roleKey).toBe("sales manager")
  })
})
