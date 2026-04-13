"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useScopeEntryKindsV2, type ScopeEntryKind } from "@/hooks/use-entry-kinds"
import {
  getEntryKindLabel,
  getEntryKindEditorTitle,
  SYSTEM_ENTRY_KIND_DEFAULTS,
  isValidEntryKindKey,
  normalizeEntryKindKey,
} from "@/lib/entry-kinds"
import {
  AlertCircle,
  ArrowLeft,
  Save,
  Loader2,
  GripVertical,
  FileText,
  Phone,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react"

interface Department {
  id: string
  name: string
  description: string | null
}

interface DepartmentProfession {
  key: string
  label: string
  department_id: string
  is_active: boolean
}

export default function EntryKindsConfigPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")
  const [selectedSystem, setSelectedSystem] = useState<"personal" | "dept_report">("personal")
  const [selectedProfession, setSelectedProfession] = useState<string>("_dept_wide_personal_")
  const [professions, setProfessions] = useState<DepartmentProfession[]>([])
  const [isLoadingProfessions, setIsLoadingProfessions] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [deactivationBlock, setDeactivationBlock] = useState<{ entryKind: string; count: number } | null>(null)

  // Create Entry Kind Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newEntryKind, setNewEntryKind] = useState({
    entry_kind: "",
    label: "",
    description: "",
    supports_assigned_agent: false,
    allow_multiple_per_day: false,
    color: "#6B7280",
    icon: "FileText",
  })
  const [keyError, setKeyError] = useState<string | null>(null)

  // Local state for editing configs
  const [editedConfigs, setEditedConfigs] = useState<ScopeEntryKind[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const effectiveScopeType =
    selectedSystem === "dept_report"
      ? ("dept_report" as const)
      : selectedProfession === "_dept_wide_personal_"
        ? ("dept_wide_personal" as const)
        : ("profession_personal" as const)

  const effectiveProfessionRoleId =
    effectiveScopeType === "profession_personal"
      ? selectedProfession === "_dept_wide_personal_"
        ? null
        : selectedProfession
      : null

  // Fetch scope entry kinds (new model)
  const {
    entryKinds,
    isLoading: isLoadingConfigs,
    mutate,
  } = useScopeEntryKindsV2(selectedDepartment || null, {
    scopeType: effectiveScopeType,
    professionRoleId: effectiveProfessionRoleId,
  })

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setIsLoadingDepartments(true)
        const response = await fetch("/api/admin/departments", {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error("Failed to load departments")

        const result = (await response.json()) as unknown
        const data =
          typeof result === "object" && result !== null && "data" in result
            ? (result as { data?: unknown }).data
            : undefined

        setDepartments(Array.isArray(data) ? (data as Department[]) : [])
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load departments",
          variant: "destructive",
        })
      } finally {
        setIsLoadingDepartments(false)
      }
    }

    void loadDepartments()
  }, [toast])

  useEffect(() => {
    if (!selectedDepartment) {
      setProfessions([])
      setSelectedProfession("_dept_wide_personal_")
      return
    }

    const loadProfessions = async () => {
      try {
        // Prevent showing stale professions from a previous department while loading
        setProfessions([])
        setSelectedProfession("_dept_wide_personal_")
        setIsLoadingProfessions(true)
        const response = await fetch(
          `/api/admin/departments/${encodeURIComponent(selectedDepartment)}/profession-roles`,
          {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        )

        if (!response.ok) throw new Error("Failed to load professions")

        const result = (await response.json()) as unknown
        const data =
          typeof result === "object" && result !== null && "data" in result
            ? (result as { data?: unknown }).data
            : undefined

        const rows = Array.isArray(data) ? (data as unknown[]) : []

        const loadedProfessions = rows
          .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
          .map((r) => ({
            key: String(r.id ?? ""),
            label: String(r.display_name ?? ""),
            department_id: String(r.department_id ?? selectedDepartment),
            is_active: r.is_active !== false,
          }))
          .filter((p) => p.key !== "")
          .filter((p) => p.department_id === selectedDepartment)

        setProfessions(loadedProfessions)
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load professions",
          variant: "destructive",
        })
      } finally {
        setIsLoadingProfessions(false)
      }
    }

    void loadProfessions()
  }, [selectedDepartment, toast])

  const visibleProfessions = useMemo(
    () => professions.filter((p) => p.department_id === selectedDepartment),
    [professions, selectedDepartment]
  )

  useEffect(() => {
    setEditedConfigs([])
    setHasChanges(false)
    setValidationError(null)
    setDeactivationBlock(null)
    initializedScopeKey.current = "" // Reset so init effect runs with fresh data
  }, [selectedDepartment, selectedProfession, selectedSystem])

  // Initialize edited configs when entry kinds load (only once per scope change)
  const initializedScopeKey = useRef<string>("")

  const currentScopeKey = `${selectedDepartment}|${selectedSystem}|${selectedProfession}`

  useEffect(() => {
    if (entryKinds.length > 0 && initializedScopeKey.current !== currentScopeKey) {
      // Deduplicate by entry_kind to prevent React key warnings
      const seen = new Set<string>()
      const deduplicated = entryKinds.filter((config) => {
        if (seen.has(config.entry_kind)) return false
        seen.add(config.entry_kind)
        return true
      })
      setEditedConfigs(deduplicated)
      initializedScopeKey.current = currentScopeKey
    }
  }, [entryKinds, currentScopeKey])

  // Validation
  const validation = useMemo(() => {
    const active = editedConfigs.filter((c) => c.is_active)
    const defaults = active.filter((c) => c.is_default)

    if (editedConfigs.length === 0) {
      return { valid: true, error: null }
    }

    const requiresActive = effectiveScopeType !== "profession_personal"

    if (requiresActive && active.length === 0) {
      return { valid: false, error: "At least one entry kind must be active" }
    }

    if (active.length > 0 && defaults.length !== 1) {
      return { valid: false, error: "Exactly one active entry kind must be set as default" }
    }

    return { valid: true, error: null }
  }, [editedConfigs, effectiveScopeType])

  const handleToggleActive = (index: number) => {
    const config = editedConfigs[index]
    if (!config) return

    // Check if deactivating would be blocked
    if (config.is_active) {
      // This would be checked on the server, but we can optimistically update
      setDeactivationBlock(null)
    }

    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...config, is_active: !config.is_active }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleSetDefault = (index: number) => {
    const newConfigs = editedConfigs.map((c, i) => ({
      ...c,
      is_default: i === index,
    }))
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateLabel = (index: number, label: string) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], label }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateDescription = (index: number, description: string) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], description }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateColor = (index: number, color: string) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], color }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateSupportsAssignedAgent = (index: number, value: boolean) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], supports_assigned_agent: value }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateAllowMultiplePerDay = (index: number, value: boolean) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], allow_multiple_per_day: value }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleUpdateIcon = (index: number, icon: string) => {
    const newConfigs = [...editedConfigs]
    newConfigs[index] = { ...newConfigs[index], icon }
    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleMoveOrder = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === editedConfigs.length - 1) return

    const newConfigs = [...editedConfigs]
    const targetIndex = direction === "up" ? index - 1 : index + 1

    // Swap sort_order
    const tempOrder = newConfigs[index].sort_order
    newConfigs[index].sort_order = newConfigs[targetIndex].sort_order
    newConfigs[targetIndex].sort_order = tempOrder

    // Swap positions
    ;[newConfigs[index], newConfigs[targetIndex]] = [newConfigs[targetIndex], newConfigs[index]]

    setEditedConfigs(newConfigs)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!validation.valid) {
      setValidationError(validation.error)
      return
    }

    setIsSaving(true)
    setValidationError(null)
    setDeactivationBlock(null)

    try {
      const response = await fetch("/api/admin/scope-entry-kinds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departmentId: selectedDepartment,
          scopeType: effectiveScopeType,
          professionRoleId: effectiveProfessionRoleId,
          configs: editedConfigs.map((c) => ({
            id: c.id,
            entry_kind: c.entry_kind,
            label: c.label,
            description: c.description,
            sort_order: c.sort_order,
            is_default: c.is_default,
            is_active: c.is_active,
            supports_assigned_agent: c.supports_assigned_agent ?? false,
            allow_multiple_per_day: c.allow_multiple_per_day ?? false,
            color: c.color,
            icon: c.icon,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()

        // Check for deactivation block
        if (error.blocking_count && error.entry_kind) {
          setDeactivationBlock({
            entryKind: error.entry_kind,
            count: error.blocking_count,
          })
        }

        throw new Error(error.error || "Failed to save configuration")
      }

      toast({
        title: "Configuration Saved",
        description: "Entry kind configuration has been updated successfully.",
      })

      setHasChanges(false)
      mutate()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Get icon component
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "Phone":
        return <Phone className="h-4 w-4" />
      case "Calendar":
        return <Calendar className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  // Create Entry Kind handlers
  const handleKeyInputChange = (value: string) => {
    // Auto-normalize to lowercase
    const normalized = normalizeEntryKindKey(value)
    setNewEntryKind((prev) => ({ ...prev, entry_kind: normalized }))

    // Validate key format
    if (normalized) {
      const validation = isValidEntryKindKey(normalized)
      setKeyError(validation.error || null)
    } else {
      setKeyError(null)
    }
  }

  const handleCreateEntryKind = async () => {
    if (!selectedDepartment) return

    // Validate key
    const validation = isValidEntryKindKey(newEntryKind.entry_kind)
    if (!validation.valid) {
      setKeyError(validation.error || "Invalid key")
      return
    }

    // Check for duplicate in current scope
    const exists = editedConfigs.some((c) => c.entry_kind === newEntryKind.entry_kind)
    if (exists) {
      setKeyError("Entry kind already exists in this scope")
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const response = await fetch("/api/admin/scope-entry-kinds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departmentId: selectedDepartment,
          scopeType: effectiveScopeType,
          professionRoleId: effectiveProfessionRoleId,
          config: {
            entry_kind: newEntryKind.entry_kind,
            label: newEntryKind.label || newEntryKind.entry_kind,
            description: newEntryKind.description || null,
            supports_assigned_agent: newEntryKind.supports_assigned_agent,
            allow_multiple_per_day: newEntryKind.allow_multiple_per_day,
            color: newEntryKind.color,
            icon: newEntryKind.icon,
            sort_order: editedConfigs.length,
            is_default: false,
            is_active: true,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create entry kind")
      }

      const { data } = await response.json()

      // Add new entry kind to edited configs
      setEditedConfigs((prev) => [...prev, data])
      setHasChanges(true)

      toast({
        title: "Entry Kind Created",
        description: `"${data.label}" has been created successfully.`,
      })

      // Reset form and close modal
      setNewEntryKind({
        entry_kind: "",
        label: "",
        description: "",
        supports_assigned_agent: false,
        allow_multiple_per_day: false,
        color: "#6B7280",
        icon: "FileText",
      })
      setKeyError(null)
      setIsCreateModalOpen(false)

      // Refresh data
      mutate()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create entry kind")
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create entry kind",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    setNewEntryKind({
      entry_kind: "",
      label: "",
      description: "",
      supports_assigned_agent: false,
      allow_multiple_per_day: false,
      color: "#6B7280",
      icon: "FileText",
    })
    setKeyError(null)
    setCreateError(null)
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/admin/settings")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Entry Kinds Configuration</h1>
          <p className="text-muted-foreground">
            Configure which report types are available for each department or profession
          </p>
        </div>
      </div>

      {/* Scope Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration Mode</CardTitle>
          <CardDescription>Personal entry kinds are separate from department report entry kinds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system">System</Label>
              <Select
                value={selectedSystem}
                onValueChange={(v) => setSelectedSystem(v as any)}
                disabled={!selectedDepartment}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDepartment ? "Select system" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal logging</SelectItem>
                  <SelectItem value="dept_report">Department reporting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedSystem === "personal" && (
            <div className="space-y-2">
              <Label htmlFor="profession">Personal Scope</Label>
              <Select
                value={selectedProfession}
                onValueChange={setSelectedProfession}
                disabled={!selectedDepartment || isLoadingProfessions}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDepartment ? "Dept-wide personal" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_dept_wide_personal_">Dept-wide personal</SelectItem>
                  {visibleProfessions.map((prof) => (
                    <SelectItem key={prof.key} value={prof.key}>
                      <span className={prof.is_active ? "" : "text-muted-foreground italic"}>
                        {prof.is_active ? prof.label : `(Archived) ${prof.label}`}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Personal logging uses: profession override → dept-wide personal. Department reporting uses a separate
                configuration and never mixes with personal scopes.
              </p>
            </div>
          )}

          {selectedSystem === "dept_report" && (
            <p className="text-muted-foreground text-xs">
              Department reporting uses department-report entry kinds only. If none are configured, department reports
              should fail with a clear error.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Validation Error */}
      {validationError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Configuration</AlertTitle>
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Deactivation Block */}
      {deactivationBlock && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot Deactivate Entry Kind</AlertTitle>
          <AlertDescription>
            Cannot deactivate {getEntryKindLabel(deactivationBlock.entryKind)} because it has {deactivationBlock.count}{" "}
            active question(s). Please reassign or archive these questions first.
          </AlertDescription>
        </Alert>
      )}

      {/* Entry Kinds List */}
      {selectedDepartment && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entry Kinds</CardTitle>
                <CardDescription>Configure available report types for this scope</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)} disabled={!selectedDepartment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Entry Kind
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || isSaving || !validation.valid}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingConfigs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : editedConfigs.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                No entry kinds configured for this scope yet.
                <br />
                The system will auto-create a default configuration when you first access the question creator.
              </div>
            ) : (
              <div className="space-y-4">
                {editedConfigs.map((config, index) => {
                  const editorTitle = getEntryKindEditorTitle(config)
                  return (
                    <div
                      key={`${config.entry_kind}-${index}`}
                      className={`rounded-lg border p-4 ${config.is_active ? "bg-white" : "bg-gray-50 opacity-75"}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Drag Handle */}
                        <div className="flex flex-col gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => handleMoveOrder(index, "up")}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <GripVertical className="text-muted-foreground h-4 w-4" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === editedConfigs.length - 1}
                            onClick={() => handleMoveOrder(index, "down")}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Icon & System Key */}
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                          {getIconComponent(config.icon || "FileText")}
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{editorTitle.title}</span>
                            <span className="text-muted-foreground text-xs">{editorTitle.keyLabel}</span>
                            {config.is_active && config.is_default && <Badge variant="default">Default</Badge>}
                            {!config.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Display Label</Label>
                              <Input
                                value={config.label}
                                onChange={(e) => handleUpdateLabel(index, e.target.value)}
                                placeholder={SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.label}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={config.description || ""}
                                onChange={(e) => handleUpdateDescription(index, e.target.value)}
                                placeholder={SYSTEM_ENTRY_KIND_DEFAULTS[config.entry_kind]?.description}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Color</Label>
                              <input
                                type="color"
                                value={config.color || "#6B7280"}
                                onChange={(e) => handleUpdateColor(index, e.target.value)}
                                className="h-8 w-8 rounded border p-0"
                              />
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={config.is_active}
                                  onCheckedChange={() => handleToggleActive(index)}
                                  id={`active-${config.entry_kind}`}
                                />
                                <Label htmlFor={`active-${config.entry_kind}`} className="text-sm">
                                  Active
                                </Label>
                              </div>

                              {config.is_active && (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={config.is_default}
                                    onCheckedChange={() => handleSetDefault(index)}
                                    id={`default-${config.entry_kind}`}
                                  />
                                  <Label htmlFor={`default-${config.entry_kind}`} className="text-sm">
                                    Default
                                  </Label>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={config.supports_assigned_agent}
                                  onCheckedChange={() =>
                                    handleUpdateSupportsAssignedAgent(index, !config.supports_assigned_agent)
                                  }
                                  id={`supports-assigned-${config.entry_kind}`}
                                />
                                <Label htmlFor={`supports-assigned-${config.entry_kind}`} className="text-sm">
                                  Supports Assigned Agents
                                </Label>
                              </div>

                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={config.allow_multiple_per_day ?? false}
                                  onCheckedChange={() =>
                                    handleUpdateAllowMultiplePerDay(index, !(config.allow_multiple_per_day ?? false))
                                  }
                                  id={`allow-multiple-${config.entry_kind}`}
                                />
                                <Label htmlFor={`allow-multiple-${config.entry_kind}`} className="text-sm">
                                  Allow Multiple Per Day
                                </Label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Entry Kind Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Entry Kind</h2>
              <Button variant="ghost" size="icon" onClick={handleCloseCreateModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {createError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key (lowercase, alphanumeric + underscores)</Label>
                <Input
                  id="key"
                  value={newEntryKind.entry_kind}
                  onChange={(e) => handleKeyInputChange(e.target.value)}
                  placeholder="e.g., daily_report"
                  className={keyError ? "border-red-500" : ""}
                />
                {keyError && <p className="text-sm text-red-500">{keyError}</p>}
                <p className="text-muted-foreground text-xs">
                  This is the machine identifier. Use lowercase letters, numbers, and underscores only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Display Label</Label>
                <Input
                  id="label"
                  value={newEntryKind.label}
                  onChange={(e) => setNewEntryKind((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Daily Report"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newEntryKind.description}
                  onChange={(e) => setNewEntryKind((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this report type"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Color</Label>
                  <input
                    type="color"
                    value={newEntryKind.color}
                    onChange={(e) => setNewEntryKind((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-8 w-8 rounded border p-0"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newEntryKind.supports_assigned_agent}
                    onCheckedChange={(checked) =>
                      setNewEntryKind((prev) => ({ ...prev, supports_assigned_agent: checked }))
                    }
                    id="new-supports-assigned"
                  />
                  <Label htmlFor="new-supports-assigned">Supports Assigned Agents</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newEntryKind.allow_multiple_per_day}
                    onCheckedChange={(checked) =>
                      setNewEntryKind((prev) => ({ ...prev, allow_multiple_per_day: checked }))
                    }
                    id="new-allow-multiple"
                  />
                  <Label htmlFor="new-allow-multiple">Allow Multiple Per Day</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select
                  value={newEntryKind.icon}
                  onValueChange={(value) => setNewEntryKind((prev) => ({ ...prev, icon: value }))}
                >
                  <SelectTrigger id="icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FileText">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>File Text</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Phone">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>Phone</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Calendar">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Calendar</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseCreateModal}>
                Cancel
              </Button>
              <Button onClick={handleCreateEntryKind} disabled={isCreating || !!keyError || !newEntryKind.entry_kind}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Entry Kind"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
