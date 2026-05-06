import {
  canonicalRole,
  convert09ToE164IfApplicable,
  digitsOnly,
  indexTeamMember,
  matchesTeamSearch,
  normalizeE164,
} from "@/lib/marketing/team-filters"

describe("marketing team filters - phone normalization & matching", () => {
  test("normalizeE164 validates and strips formatting", () => {
    expect(normalizeE164("+251 911 234 567")).toBe("+251911234567")
    expect(normalizeE164("+251-911-234-567")).toBe("+251911234567")
    expect(normalizeE164("251911234567")).toBeNull()
    expect(normalizeE164("+000123")).toBeNull()
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

  test("matches +251... when user types 09...", () => {
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

  test("matches by name OR phone", () => {
    const member = indexTeamMember({
      userId: "u1",
      name: "Alice",
      phoneVisible: true,
      phoneRaw: "+251911234567",
      roleLabel: "Sales Promoter",
    })

    expect(matchesTeamSearch({ member, query: "ali" })).toBe(true)
    expect(matchesTeamSearch({ member, query: "0911234567" })).toBe(true)
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
