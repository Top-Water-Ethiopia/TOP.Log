export type TimeWindowPreset = "today" | "yesterday" | "last7" | "thisMonth" | "custom"

export type TimeWindow = {
  start: string // YYYY-MM-DD (EAT calendar day)
  end: string // YYYY-MM-DD (EAT calendar day)
  preset: TimeWindowPreset
  timezone: "Africa/Addis_Ababa"
  key: string // `${start}:${end}`
  hash: string // sha256(`v1|${start}|${end}|${departmentId}`)
}

