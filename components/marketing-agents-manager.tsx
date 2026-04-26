"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { toast } from "sonner"
import { Loader2, MapPin, Pencil, Phone, UserRound, UserRoundCheck, Plus, RefreshCw, X, Search } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type SalesPromoterOption = {
  user_id: string
  name: string | null
  email: string | null
  profession_id: string | null
  profession_key: string
  profession_label: string | null
}

type AgentPhone = {
  id: string
  agent_id: string
  phone_e164: string | null
  phone_raw: string | null
  is_primary: boolean
  is_active: boolean
}

type AgentPlate = {
  id: string
  agent_id: string
  plate_number: string
  is_active: boolean
}

type MarketingAgent = {
  id: string
  department_id: string
  sales_promoter_user_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
  sales_promoter: SalesPromoterOption | null
  phones: AgentPhone[]
  plates: AgentPlate[]
}

type MarketingAgentsPayload = {
  department: {
    id: string
    name: string
  }
  salesPromoters: SalesPromoterOption[]
  agents: MarketingAgent[]
}

type PhoneEntry = {
  id: string | null
  phone_e164: string
  phone_raw: string
  is_primary: boolean
}

type PlateEntry = {
  id: string | null
  plate_number: string
}

type CoverageEntry = {
  id: string | null
  coverage_type: "global" | "region" | "city" | "route"
  region_id: string | null
  city_id: string | null
  route_id: string | null
}

type AgentFormState = {
  id: string | null
  name: string
  sales_promoter_user_id: string
  is_active: boolean
  phoneEntries: PhoneEntry[]
  plateEntries: PlateEntry[]
  coverageEntries: CoverageEntry[]
}

const EMPTY_FORM: AgentFormState = {
  id: null,
  name: "",
  sales_promoter_user_id: "",
  is_active: true,
  phoneEntries: [{ id: null, phone_e164: "", phone_raw: "", is_primary: true }],
  plateEntries: [{ id: null, plate_number: "" }],
  coverageEntries: [{ id: null, coverage_type: "global", region_id: null, city_id: null, route_id: null }],
}

function getSalesPromoterLabel(salesPromoter: SalesPromoterOption | null | undefined) {
  if (!salesPromoter) return "Unassigned"
  return salesPromoter.name || salesPromoter.email || "Unknown Sales Promoter"
}

type SidebarState = { open: false } | { open: true; mode: "create" } | { open: true; mode: "edit"; agentId: string }

export function MarketingAgentsManager() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<MarketingAgentsPayload | null>(null)
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([])
  const [sidebar, setSidebar] = useState<SidebarState>({ open: false })
  const [isDirty, setIsDirty] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(async (showRefreshingState = false) => {
    try {
      if (showRefreshingState) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const response = await apiFetch<{ data: MarketingAgentsPayload }>("/api/admin/marketing-agents")
      setData(response.data)

      const [regionsData, citiesData, routesData] = await Promise.all([
        apiFetch("/api/admin/regions"),
        apiFetch("/api/admin/cities"),
        apiFetch("/api/admin/routes"),
      ])
      setRegions(regionsData as { id: string; name: string }[])
      setCities(citiesData as { id: string; name: string }[])
      setRoutes(routesData as { id: string; name: string }[])

      setForm((current) => {
        if (current.sales_promoter_user_id) {
          return current
        }

        const defaultSalesPromoter = response.data.salesPromoters[0]
        return {
          ...current,
          sales_promoter_user_id: defaultSalesPromoter?.user_id || "",
        }
      })
    } catch (loadError) {
      console.error("Failed to load marketing agents:", loadError)
      setData(null)
      setError(getErrorMessage(loadError, "Failed to load marketing agents"))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const salesPromoters = useMemo(() => data?.salesPromoters ?? [], [data?.salesPromoters])
  const agents = useMemo(() => data?.agents ?? [], [data?.agents])
  const departmentName = data?.department.name || "Marketing"

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents
    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.sales_promoter?.name?.toLowerCase().includes(query) ||
        agent.sales_promoter?.email?.toLowerCase().includes(query) ||
        agent.phones.some(
          (p) => p.phone_e164?.toLowerCase().includes(query) || p.phone_raw?.toLowerCase().includes(query)
        )
    )
  }, [agents, searchQuery])

  const selectedSalesPromoter = useMemo(() => {
    return salesPromoters.find((salesPromoter) => salesPromoter.user_id === form.sales_promoter_user_id) || null
  }, [form.sales_promoter_user_id, salesPromoters])

  // URL Sync
  useEffect(() => {
    const sidebarParam = searchParams.get("sidebar")
    const agentIdParam = searchParams.get("agentId")

    if (sidebarParam === "create") {
      if (!sidebar.open || sidebar.mode !== "create") {
        setSidebar({ open: true, mode: "create" })
        setForm({
          ...EMPTY_FORM,
          sales_promoter_user_id: salesPromoters[0]?.user_id || "",
        })
        setIsDirty(false)
      }
    } else if (sidebarParam === "edit" && agentIdParam) {
      const agent = agents.find((a) => a.id === agentIdParam)
      if (agent && (!sidebar.open || (sidebar.open && sidebar.mode === "edit" && sidebar.agentId !== agentIdParam))) {
        setSidebar({ open: true, mode: "edit", agentId: agentIdParam })
        populateForm(agent)
        setIsDirty(false)
      }
    } else if (!sidebarParam && sidebar.open) {
      setSidebar({ open: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, agents, salesPromoters])

  const updateUrl = (state: SidebarState) => {
    const params = new URLSearchParams(searchParams.toString())
    if (state.open) {
      params.set("sidebar", state.mode)
      if (state.mode === "edit") {
        params.set("agentId", state.agentId)
      } else {
        params.delete("agentId")
      }
    } else {
      params.delete("sidebar")
      params.delete("agentId")
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const populateForm = (agent: MarketingAgent) => {
    setForm({
      id: agent.id,
      name: agent.name,
      sales_promoter_user_id: agent.sales_promoter_user_id,
      is_active: agent.is_active,
      phoneEntries: agent.phones.map((p) => ({
        id: p.id,
        phone_e164: p.phone_e164 || "",
        phone_raw: p.phone_raw || "",
        is_primary: p.is_primary,
      })),
      plateEntries: agent.plates.map((p) => ({
        id: p.id,
        plate_number: p.plate_number,
      })),
      coverageEntries: (
        agent as MarketingAgent & {
          agent_coverage?: Array<{
            id: string
            coverage_type: string
            region_id: string | null
            city_id: string | null
            route_id: string | null
          }>
        }
      ).agent_coverage?.map((c) => ({
        id: c.id,
        coverage_type: c.coverage_type as "global" | "region" | "city" | "route",
        region_id: c.region_id,
        city_id: c.city_id,
        route_id: c.route_id,
      })) || [{ id: null, coverage_type: "global", region_id: null, city_id: null, route_id: null }],
    })
  }

  const updateForm = <K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setIsDirty(true)
  }

  const handleOpenEdit = (agent: MarketingAgent) => {
    updateUrl({ open: true, mode: "edit", agentId: agent.id })
  }

  const handleCloseSidebar = () => {
    if (isDirty) {
      setShowExitConfirm(true)
    } else {
      forceCloseSidebar()
    }
  }

  const forceCloseSidebar = () => {
    updateUrl({ open: false })
    setShowExitConfirm(false)
    setIsDirty(false)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name.trim()) {
      toast.error("Agent name is required")
      return
    }

    if (!form.sales_promoter_user_id) {
      toast.error("Choose a Sales Promoter")
      return
    }

    const validPhones = form.phoneEntries.filter((p) => p.phone_e164.trim() || p.phone_raw.trim())
    if (validPhones.length === 0) {
      toast.error("At least one phone number is required")
      return
    }
    const hasPrimary = validPhones.some((p) => p.is_primary)
    if (!hasPrimary) {
      toast.error("One phone must be marked as primary")
      return
    }

    if (form.coverageEntries.length === 0) {
      toast.error("At least one coverage entry is required")
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        name: form.name.trim(),
        sales_promoter_user_id: form.sales_promoter_user_id,
        is_active: form.is_active,
        phones: form.phoneEntries.filter((p) => p.phone_e164.trim() || p.phone_raw.trim()),
        plates: form.plateEntries.filter((p) => p.plate_number.trim()),
        coverage: form.coverageEntries,
      }

      if (form.id) {
        await apiFetch(`/api/admin/marketing-agents/${form.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
        toast.success("Agent updated")
      } else {
        await apiFetch("/api/admin/marketing-agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
        toast.success("Agent created")
      }

      forceCloseSidebar()
      await loadData(true)
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to save marketing agent"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (agent: MarketingAgent, nextIsActive: boolean) => {
    try {
      if (nextIsActive) {
        await apiFetch(`/api/admin/marketing-agents/${agent.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_active: true }),
        })
        toast.success("Agent reactivated")
      } else {
        await apiFetch(`/api/admin/marketing-agents/${agent.id}`, {
          method: "DELETE",
        })
        toast.success("Agent deactivated")
      }

      if (sidebar.open && sidebar.mode === "edit" && sidebar.agentId === agent.id && !nextIsActive) {
        forceCloseSidebar()
      }

      await loadData(true)
    } catch (toggleError) {
      toast.error(getErrorMessage(toggleError, "Failed to update marketing agent"))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Marketing Agents</CardTitle>
            <CardDescription>Loading agents and Sales Promoters...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading data...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-lg border p-4 text-sm">
        <div className="font-medium">{departmentName} department</div>
        <p className="text-muted-foreground mt-1">
          Sales Promoters available: {salesPromoters.length}. Active agents:{" "}
          {agents.filter((agent) => agent.is_active).length}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search agents by name, promoter, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={isRefreshing} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="max-w-full">
        {filteredAgents.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              {searchQuery
                ? "No agents match your search."
                : "No agents have been added yet for the Marketing Sales Promoter workflow."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="flex flex-col">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg leading-tight">{agent.name}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {getSalesPromoterLabel(agent.sales_promoter)}
                      </CardDescription>
                    </div>
                    {!agent.is_active && (
                      <Badge variant="secondary" className="shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-4 pt-0">
                  <div className="flex-1 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="line-clamp-1">{getSalesPromoterLabel(agent.sales_promoter)}</span>
                    </div>
                    {agent.sales_promoter?.email ? (
                      <div className="flex items-center gap-2 text-xs">
                        <UserRoundCheck className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="text-muted-foreground truncate">{agent.sales_promoter.email}</span>
                      </div>
                    ) : null}
                    {agent.phones.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Phone className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">
                          {agent.phones.map((p) => p.phone_e164 || p.phone_raw).join(", ")}
                        </span>
                      </div>
                    ) : null}
                    {agent.plates.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{agent.plates.map((p) => p.plate_number).join(", ")}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenEdit(agent)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant={agent.is_active ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => handleToggleActive(agent, !agent.is_active)}
                    >
                      {agent.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={sidebar.open} onOpenChange={(open) => !open && handleCloseSidebar()}>
        <SheetContent
          className="flex flex-col p-6 sm:max-w-md"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              handleCloseSidebar()
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault()
              formRef.current?.requestSubmit()
            }
          }}
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {sidebar.open && "mode" in sidebar && sidebar.mode === "create" ? "Add Agent" : "Edit Agent"}
            </SheetTitle>
            <SheetDescription>
              {sidebar.open && "mode" in sidebar && sidebar.mode === "create"
                ? "Create a new agent contact and assign them to a Sales Promoter."
                : "Update agent details and coverage information."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="sales-promoter">Sales Promoter</Label>
                  <Select
                    value={form.sales_promoter_user_id}
                    onValueChange={(value) => updateForm("sales_promoter_user_id", value)}
                  >
                    <SelectTrigger id="sales-promoter">
                      <SelectValue placeholder="Choose a Sales Promoter" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesPromoters.map((salesPromoter) => (
                        <SelectItem key={salesPromoter.user_id} value={salesPromoter.user_id}>
                          {getSalesPromoterLabel(salesPromoter)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSalesPromoter ? (
                    <p className="text-muted-foreground text-xs italic">
                      {selectedSalesPromoter.email ||
                        selectedSalesPromoter.profession_label ||
                        "Marketing Sales Promoter"}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-name">Agent name</Label>
                  <Input
                    id="agent-name"
                    ref={firstInputRef}
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Agent full name"
                  />
                </div>
              </div>

              <div className="border-t" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Phone numbers</Label>
                    <p className="text-muted-foreground text-xs">
                      Add one or more contact numbers. One must be marked as primary.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const newEntries = [
                        ...form.phoneEntries,
                        { id: null, phone_e164: "", phone_raw: "", is_primary: false },
                      ]
                      updateForm("phoneEntries", newEntries)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Phone
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.phoneEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-muted-foreground text-sm">No phone numbers added</p>
                      <p className="text-muted-foreground text-xs">Add at least one contact number</p>
                    </div>
                  ) : (
                    form.phoneEntries.map((phoneEntry, index) => (
                      <div key={index} className="group flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            value={phoneEntry.phone_e164}
                            onChange={(e) => {
                              const newEntries = [...form.phoneEntries]
                              newEntries[index].phone_e164 = e.target.value
                              updateForm("phoneEntries", newEntries)
                            }}
                            placeholder="0912345678"
                            className={
                              phoneEntry.phone_e164 && !/^\d{9,}$/.test(phoneEntry.phone_e164.replace(/[^\d]/g, ""))
                                ? "border-destructive"
                                : ""
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2 px-2">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name="primary-phone"
                              checked={phoneEntry.is_primary}
                              onChange={() => {
                                const newEntries = form.phoneEntries.map((p, i) => ({
                                  ...p,
                                  is_primary: i === index,
                                }))
                                updateForm("phoneEntries", newEntries)
                              }}
                              className="text-primary h-4 w-4"
                            />
                            <span
                              className={
                                phoneEntry.is_primary ? "text-xs font-medium" : "text-muted-foreground text-xs"
                              }
                            >
                              Primary
                            </span>
                          </label>
                        </div>
                        {form.phoneEntries.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => {
                              const newEntries = form.phoneEntries.filter((_, i) => i !== index)
                              if (!newEntries.some((p) => p.is_primary) && newEntries.length > 0) {
                                newEntries[0].is_primary = true
                              }
                              updateForm("phoneEntries", newEntries)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {!form.phoneEntries.some((p) => p.is_primary) && form.phoneEntries.length > 0 && (
                  <p className="text-destructive text-xs">One phone must be marked as primary</p>
                )}
                {form.phoneEntries.some((p, i, arr) =>
                  arr.some((other, j) => i !== j && p.phone_e164 && p.phone_e164 === other.phone_e164)
                ) && <p className="text-destructive text-xs">Duplicate phone numbers detected</p>}
              </div>

              <div className="border-t" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Plate numbers</Label>
                    <p className="text-muted-foreground text-xs">Vehicle plate numbers for identification purposes.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const newEntries = [...form.plateEntries, { id: null, plate_number: "" }]
                      updateForm("plateEntries", newEntries)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Plate
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.plateEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-muted-foreground text-sm">No plate numbers added</p>
                      <p className="text-muted-foreground text-xs">Add vehicle plate numbers if applicable</p>
                    </div>
                  ) : (
                    form.plateEntries.map((plateEntry, index) => (
                      <div key={index} className="group flex items-center gap-2">
                        <Input
                          value={plateEntry.plate_number}
                          onChange={(e) => {
                            const newEntries = [...form.plateEntries]
                            newEntries[index].plate_number = e.target.value
                            updateForm("plateEntries", newEntries)
                          }}
                          placeholder="AA-1234"
                          className="flex-1"
                        />
                        {form.plateEntries.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => {
                              const newEntries = form.plateEntries.filter((_, i) => i !== index)
                              updateForm("plateEntries", newEntries)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Geographic coverage</Label>
                    <p className="text-muted-foreground text-xs">
                      Define where this agent operates. Global means all regions and routes.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const newEntries = [
                        ...form.coverageEntries,
                        { id: null, coverage_type: "global", region_id: null, city_id: null, route_id: null },
                      ] as CoverageEntry[]
                      updateForm("coverageEntries", newEntries)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Coverage
                  </Button>
                </div>
                <div className="space-y-3">
                  {form.coverageEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-muted-foreground text-sm">No coverage defined</p>
                      <p className="text-muted-foreground text-xs">Add at least one coverage entry</p>
                    </div>
                  ) : (
                    form.coverageEntries.map((coverageEntry, index) => (
                      <div key={index} className="bg-muted/20 group space-y-3 rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={coverageEntry.coverage_type}
                            onValueChange={(value: "global" | "region" | "city" | "route") => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = {
                                ...newEntries[index],
                                coverage_type: value,
                                region_id: null,
                                city_id: null,
                                route_id: null,
                              }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="Coverage type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="global">Global</SelectItem>
                              <SelectItem value="region">Region</SelectItem>
                              <SelectItem value="city">City</SelectItem>
                              <SelectItem value="route">Route</SelectItem>
                            </SelectContent>
                          </Select>
                          {form.coverageEntries.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => {
                                const newEntries = form.coverageEntries.filter((_, i) => i !== index)
                                updateForm("coverageEntries", newEntries)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {coverageEntry.coverage_type === "region" && (
                          <Select
                            value={coverageEntry.region_id || ""}
                            onValueChange={(value) => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = { ...newEntries[index], region_id: value }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                              {regions.map((region) => (
                                <SelectItem key={region.id} value={region.id}>
                                  {region.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {coverageEntry.coverage_type === "city" && (
                          <Select
                            value={coverageEntry.city_id || ""}
                            onValueChange={(value) => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = { ...newEntries[index], city_id: value }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem key={city.id} value={city.id}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {coverageEntry.coverage_type === "route" && (
                          <Select
                            value={coverageEntry.route_id || ""}
                            onValueChange={(value) => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = { ...newEntries[index], route_id: value }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select route" />
                            </SelectTrigger>
                            <SelectContent>
                              {routes.map((route) => (
                                <SelectItem key={route.id} value={route.id}>
                                  {route.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {coverageEntry.coverage_type === "city" && (
                          <Select
                            value={coverageEntry.city_id || ""}
                            onValueChange={(value) => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = { ...newEntries[index], city_id: value }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem key={city.id} value={city.id}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {coverageEntry.coverage_type === "route" && (
                          <Select
                            value={coverageEntry.route_id || ""}
                            onValueChange={(value) => {
                              const newEntries = [...form.coverageEntries]
                              newEntries[index] = { ...newEntries[index], route_id: value }
                              updateForm("coverageEntries", newEntries)
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select route" />
                            </SelectTrigger>
                            <SelectContent>
                              {routes.map((route) => (
                                <SelectItem key={route.id} value={route.id}>
                                  {route.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {form.coverageEntries.length > 0 &&
                  form.coverageEntries.every(
                    (c) => c.coverage_type !== "global" && !c.region_id && !c.city_id && !c.route_id
                  ) && (
                    <p className="text-destructive text-xs">
                      Please select a region, city, or route for each coverage entry
                    </p>
                  )}
              </div>

              {sidebar.open && "mode" in sidebar && sidebar.mode === "edit" && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.is_active ? "active" : "inactive"}
                    onValueChange={(value) => updateForm("is_active", value === "active")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form>
          </div>

          <div className="shrink-0 border-t pt-4">
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleCloseSidebar} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={isSaving || salesPromoters.length === 0}
                onClick={(e) => {
                  e.preventDefault()
                  formRef.current?.requestSubmit()
                }}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {sidebar.open && "mode" in sidebar && sidebar.mode === "edit" ? "Save Changes" : "Create Agent"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the form. Are you sure you want to close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={forceCloseSidebar} className="bg-destructive text-destructive-foreground">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
