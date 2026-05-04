"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { apiFetch, getErrorMessage } from "@/lib/api-client"
import { toast } from "sonner"
import { Loader2, MapPin, Pencil, Phone, UserRound, UserRoundCheck } from "lucide-react"

type SalesPromoterOption = {
  user_id: string
  name: string | null
  email: string | null
  profession_id: string | null
  profession_key: string
  profession_label: string | null
}

type MarketingAgent = {
  id: string
  department_id: string
  sales_promoter_user_id: string
  name: string
  location: string | null
  phone_e164: string | null
  phone_raw: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  sales_promoter: SalesPromoterOption | null
}

type MarketingAgentsPayload = {
  department: {
    id: string
    name: string
  }
  salesPromoters: SalesPromoterOption[]
  agents: MarketingAgent[]
}

type AgentFormState = {
  id: string | null
  name: string
  location: string
  phone: string
  sales_promoter_user_id: string
  is_active: boolean
}

const EMPTY_FORM: AgentFormState = {
  id: null,
  name: "",
  location: "",
  phone: "",
  sales_promoter_user_id: "",
  is_active: true,
}

function getAgentPhone(agent: Pick<MarketingAgent, "phone_e164" | "phone_raw">) {
  return agent.phone_e164 || agent.phone_raw || null
}

function getSalesPromoterLabel(salesPromoter: SalesPromoterOption | null | undefined) {
  if (!salesPromoter) return "Unassigned"
  return salesPromoter.name || salesPromoter.email || "Unknown Sales Promoter"
}

export function MarketingAgentsManager() {
  const [data, setData] = useState<MarketingAgentsPayload | null>(null)
  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const editingAgent = useMemo(() => {
    return agents.find((agent) => agent.id === form.id) || null
  }, [agents, form.id])

  const selectedSalesPromoter = useMemo(() => {
    return salesPromoters.find((salesPromoter) => salesPromoter.user_id === form.sales_promoter_user_id) || null
  }, [form.sales_promoter_user_id, salesPromoters])

  const updateForm = <K extends keyof AgentFormState,>(key: K, value: AgentFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      sales_promoter_user_id: salesPromoters[0]?.user_id || "",
    })
  }, [salesPromoters])

  const handleEdit = (agent: MarketingAgent) => {
    setForm({
      id: agent.id,
      name: agent.name,
      location: agent.location || "",
      phone: getAgentPhone(agent) || "",
      sales_promoter_user_id: agent.sales_promoter_user_id,
      is_active: agent.is_active,
    })
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

    try {
      setIsSaving(true)

      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        phone: form.phone.trim() || null,
        sales_promoter_user_id: form.sales_promoter_user_id,
        is_active: form.is_active,
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

      resetForm()
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

      if (form.id === agent.id && !nextIsActive) {
        resetForm()
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
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{editingAgent ? "Edit Agent" : "Add Agent"}</CardTitle>
          <CardDescription>
            Assign external agent contacts to a Marketing Sales Promoter so recurring call reports can use a live
            dropdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="font-medium">{departmentName} department</div>
            <p className="text-muted-foreground mt-1">
              Sales Promoters available: {salesPromoters.length}. Active agents: {agents.filter((agent) => agent.is_active).length}
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
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
                <p className="text-muted-foreground text-xs">
                  {selectedSalesPromoter.email || selectedSalesPromoter.profession_label || "Marketing Sales Promoter"}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Agent full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-location">Location</Label>
              <Input
                id="agent-location"
                value={form.location}
                onChange={(event) => updateForm("location", event.target.value)}
                placeholder="City or area"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-phone">Phone number</Label>
              <Input
                id="agent-phone"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="0912345678"
              />
              <p className="text-muted-foreground text-xs">
                Stored as a normalized Ethiopian number when valid. Leave blank if unavailable.
              </p>
            </div>

            {editingAgent ? (
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
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving || salesPromoters.length === 0}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingAgent ? "Save Changes" : "Create Agent"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                {editingAgent ? "Cancel Edit" : "Reset"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Assigned Agents</h2>
            <p className="text-muted-foreground text-sm">
              These are the contacts available to Sales Promoters in the recurring call-report workflow.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadData(true)} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No agents have been added yet for the Marketing Sales Promoter workflow.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription>{getSalesPromoterLabel(agent.sales_promoter)}</CardDescription>
                    </div>
                    <Badge variant={agent.is_active ? "default" : "secondary"}>
                      {agent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {agent.location ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span>{agent.location}</span>
                      </div>
                    ) : null}
                    {getAgentPhone(agent) ? (
                      <div className="flex items-center gap-2">
                        <Phone className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span>{getAgentPhone(agent)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <UserRound className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span>{getSalesPromoterLabel(agent.sales_promoter)}</span>
                    </div>
                    {agent.sales_promoter?.email ? (
                      <div className="flex items-center gap-2">
                        <UserRoundCheck className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span>{agent.sales_promoter.email}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(agent)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
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
    </div>
  )
}
