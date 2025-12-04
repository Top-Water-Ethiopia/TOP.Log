"use client"

import { z } from "zod"

// ==================== USER SCHEMA ====================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  role: z.enum(["admin", "manager", "programmer", "qa", "tech-support", "graphic-designer", "viewer"]),
  department: z.string().optional(),
  isActive: z.boolean().default(true),
  lastLogin: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type User = z.infer<typeof UserSchema>

// ==================== ROLE SCHEMA ====================

export const RoleSchema = z.object({
  id: z.string(),
  name: z.enum(["admin", "manager", "programmer", "qa", "tech-support", "graphic-designer", "viewer"]),
  displayName: z.string(),
  description: z.string(),
  level: z.number(), // Higher number = more permissions (admin: 5, manager: 4, programmer/qa: 3, tech-support/graphic-designer: 2, viewer: 1)
  permissions: z.array(z.string()),
  accessScopes: z.array(z.string()).default([]),
  isSystem: z.boolean().default(false), // System roles cannot be deleted
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Role = z.infer<typeof RoleSchema>

// ==================== PERMISSION SCHEMA ====================

export const PermissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource: z.string(), // e.g., "entries", "users", "analytics", "admin"
  action: z.string(), // e.g., "create", "read", "update", "delete", "manage"
  description: z.string(),
  category: z.enum(["read", "write", "delete", "admin"]),
})

export type Permission = z.infer<typeof PermissionSchema>

// ==================== DEPARTMENT SCHEMA ====================

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
  description: z.string().optional(),
  managerId: z.string().optional(),
  leadEmail: z.string().email().optional(),
  parentDepartmentId: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type Department = z.infer<typeof DepartmentSchema>

// ==================== ACCESS SCOPE SCHEMA ====================

export const AccessScopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  description: z.string(),
  resources: z.array(z.string()),
  defaultPermissions: z.array(z.string()).default([]),
  isSystem: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export type AccessScope = z.infer<typeof AccessScopeSchema>

// ==================== SESSION SCHEMA ====================

export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  lastActivity: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})

export type Session = z.infer<typeof SessionSchema>

// ==================== RBAC CONFIGURATION ====================

export const DEFAULT_ROLES: Role[] = [
  {
    id: "role-admin",
    name: "admin",
    displayName: "System Administrator",
    description: "Full access to all system resources and user management",
    level: 5,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete",
      "entries.export",
      "entries.import",
      "users.create",
      "users.read",
      "users.update",
      "users.delete",
      "users.manage",
      "analytics.read",
      "analytics.advanced",
      "admin.system",
      "admin.audit",
      "admin.backup",
      "admin.restore",
      "admin.settings",
    ],
    accessScopes: [
      "scope-system-admin",
      "scope-team-operations",
      "scope-delivery-engineering",
      "scope-quality-assurance",
      "scope-support-operations",
      "scope-creative-studio",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-manager",
    name: "manager",
    displayName: "Manager",
    description: "Can manage entries and view analytics, limited user management",
    level: 4,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete",
      "entries.export",
      "users.read",
      "analytics.read",
      "analytics.team",
    ],
    accessScopes: [
      "scope-team-operations",
      "scope-delivery-engineering",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-programmer",
    name: "programmer",
    displayName: "Programmer",
    description: "Software developer with programming and technical responsibilities",
    level: 3,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete.own",
      "entries.export",
      "entries.import",
      "analytics.read",
      "analytics.advanced",
    ],
    accessScopes: [
      "scope-delivery-engineering",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-qa",
    name: "qa",
    displayName: "Quality Assurance",
    description: "Quality assurance specialist with testing and quality responsibilities",
    level: 3,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete.own",
      "analytics.read",
      "analytics.advanced",
    ],
    accessScopes: [
      "scope-quality-assurance",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-tech-support",
    name: "tech-support",
    displayName: "Technical Support",
    description: "Technical support specialist with customer service responsibilities",
    level: 2,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete.own",
      "analytics.read",
    ],
    accessScopes: [
      "scope-support-operations",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-graphic-designer",
    name: "graphic-designer",
    displayName: "Graphic Designer",
    description: "Graphic designer with creative and design responsibilities",
    level: 2,
    permissions: [
      "entries.create",
      "entries.read",
      "entries.update",
      "entries.delete.own",
      "analytics.read",
    ],
    accessScopes: [
      "scope-creative-studio",
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "role-viewer",
    name: "viewer",
    displayName: "Viewer",
    description: "Read-only access to entries and basic analytics",
    level: 1,
    permissions: [
      "entries.read",
      "entries.export.own",
      "analytics.read.own",
    ],
    accessScopes: [
      "scope-observability",
    ],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const DEFAULT_PERMISSIONS: Permission[] = [
  // Entry permissions
  { id: "perm-entries-create", name: "entries.create", resource: "entries", action: "create", description: "Create new log entries", category: "write" },
  { id: "perm-entries-read", name: "entries.read", resource: "entries", action: "read", description: "View log entries", category: "read" },
  { id: "perm-entries-update", name: "entries.update", resource: "entries", action: "update", description: "Update existing log entries", category: "write" },
  { id: "perm-entries-delete", name: "entries.delete", resource: "entries", action: "delete", description: "Delete log entries", category: "delete" },
  { id: "perm-entries-export", name: "entries.export", resource: "entries", action: "export", description: "Export all log entries", category: "read" },
  { id: "perm-entries-export-own", name: "entries.export.own", resource: "entries", action: "export", description: "Export own log entries", category: "read" },
  { id: "perm-entries-import", name: "entries.import", resource: "entries", action: "import", description: "Import log entries", category: "write" },
  
  // User permissions
  { id: "perm-users-create", name: "users.create", resource: "users", action: "create", description: "Create new users", category: "write" },
  { id: "perm-users-read", name: "users.read", resource: "users", action: "read", description: "View user information", category: "read" },
  { id: "perm-users-update", name: "users.update", resource: "users", action: "update", description: "Update user information", category: "write" },
  { id: "perm-users-delete", name: "users.delete", resource: "users", action: "delete", description: "Delete users", category: "delete" },
  { id: "perm-users-manage", name: "users.manage", resource: "users", action: "manage", description: "Manage user roles and permissions", category: "admin" },
  
  // Analytics permissions
  { id: "perm-analytics-read", name: "analytics.read", resource: "analytics", action: "read", description: "View analytics dashboard", category: "read" },
  { id: "perm-analytics-read-own", name: "analytics.read.own", resource: "analytics", action: "read", description: "View own analytics", category: "read" },
  { id: "perm-analytics-advanced", name: "analytics.advanced", resource: "analytics", action: "advanced", description: "View advanced analytics", category: "read" },
  { id: "perm-analytics-team", name: "analytics.team", resource: "analytics", action: "team", description: "View team analytics", category: "read" },
  
  // Admin permissions
  { id: "perm-admin-system", name: "admin.system", resource: "admin", action: "system", description: "Access system administration", category: "admin" },
  { id: "perm-admin-audit", name: "admin.audit", resource: "admin", action: "audit", description: "View audit logs", category: "admin" },
  { id: "perm-admin-backup", name: "admin.backup", resource: "admin", action: "backup", description: "Create system backups", category: "admin" },
  { id: "perm-admin-restore", name: "admin.restore", resource: "admin", action: "restore", description: "Restore system backups", category: "admin" },
  { id: "perm-admin-settings", name: "admin.settings", resource: "admin", action: "settings", description: "Manage system settings", category: "admin" },
]

// ==================== DEFAULT ACCESS SCOPES ====================

export const DEFAULT_ACCESS_SCOPES: AccessScope[] = [
  {
    id: "scope-system-admin",
    name: "System Administration",
    key: "system-admin",
    description: "Full administrative control over system-wide settings, RBAC, and audit visibility.",
    resources: ["admin", "settings", "rbac", "audit"],
    defaultPermissions: ["admin.system", "admin.settings", "admin.audit", "users.manage"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-team-operations",
    name: "Team Operations",
    key: "team-operations",
    description: "Manage user accounts, departments, and team-level analytics.",
    resources: ["users", "departments", "analytics"],
    defaultPermissions: ["users.create", "users.read", "users.update", "analytics.team"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-delivery-engineering",
    name: "Delivery & Engineering",
    key: "delivery-engineering",
    description: "Access to engineering workflow entries, imports, and exports.",
    resources: ["entries", "analytics"],
    defaultPermissions: ["entries.create", "entries.read", "entries.update", "entries.export", "entries.import", "analytics.advanced"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-quality-assurance",
    name: "Quality Assurance",
    key: "quality-assurance",
    description: "QA-centric access to testing artifacts and reporting.",
    resources: ["entries", "analytics"],
    defaultPermissions: ["entries.create", "entries.read", "entries.update", "analytics.advanced"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-support-operations",
    name: "Support Operations",
    key: "support-operations",
    description: "Customer support visibility into service tickets and related metrics.",
    resources: ["entries", "analytics"],
    defaultPermissions: ["entries.create", "entries.read", "entries.update", "analytics.read"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-creative-studio",
    name: "Creative Studio",
    key: "creative-studio",
    description: "Design-focused scope covering creative deliverables and review workflows.",
    resources: ["entries"],
    defaultPermissions: ["entries.create", "entries.read", "entries.update"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "scope-observability",
    name: "Observability",
    key: "observability",
    description: "Read-only access to personal entries and basic analytics dashboards.",
    resources: ["entries", "analytics"],
    defaultPermissions: ["entries.read", "entries.export.own", "analytics.read.own"],
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ==================== DEFAULT DEPARTMENTS ====================

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: "dept-it-services",
    name: "IT Services",
    code: "IT",
    description: "Responsible for internal IT service management and infrastructure.",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dept-product-engineering",
    name: "Product Engineering",
    code: "ENG",
    description: "Builds and maintains core product experiences and platforms.",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dept-quality-assurance",
    name: "Quality Assurance",
    code: "QA",
    description: "Ensures product quality through rigorous testing practices.",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dept-customer-support",
    name: "Customer Support",
    code: "SUP",
    description: "Delivers world-class support and customer success operations.",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dept-creative-studio",
    name: "Creative Studio",
    code: "DES",
    description: "Drives product and brand design initiatives.",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// ==================== AUTHENTICATION TYPES ====================

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  session: Session | null
  isLoading: boolean
  error: string | null
}

export interface AuthContextType extends AuthState {
  isInitialized: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (userData: Omit<User, "id" | "createdAt" | "updatedAt"> & { password: string }) => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  refreshToken: () => Promise<void>
  clearError: () => void
}

// ==================== RBAC HELPER TYPES ====================

export interface PermissionCheck {
  resource: string
  action: string
  ownResource?: boolean // For ownership-based permissions
}

export interface RoleHierarchy {
  [key: string]: number // role name -> level mapping
}

export const ROLE_HIERARCHY: RoleHierarchy = {
  viewer: 1,
  "tech-support": 2,
  "graphic-designer": 2,
  qa: 3,
  programmer: 3,
  manager: 4,
  admin: 5,
}

// ==================== ROLE-BASED CUSTOM QUESTIONS ====================

export interface CustomQuestion {
  id: string
  key: string // Field key for storage
  label: string
  type: "text" | "textarea" | "email" | "url" | "phone" | "select" | "multiselect" | "checkbox" | "number" | "date" | "time" | "datetime" | "daterange" | "duration" | "priority" | "status" | "radio" | "tags" | "rating" | "slider" | "nps" | "file" | "image" | "rich-text" | "currency" | "percentage"
  required: boolean
  placeholder?: string
  options?: string[] // For select/multiselect types
  validation?: {
    min?: number
    max?: number
    pattern?: string
    custom?: (value: any) => string | null
  }
  defaultValue?: any
  description?: string
  category?: string // For grouping questions
  order: number // Display order
}

export interface RoleQuestionSet {
  roleId: string
  roleName: string
  questions: CustomQuestion[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  version: number
}

export interface QuestionResponse {
  questionId: string
  questionKey: string
  questionLabel: string
  questionType: CustomQuestion["type"]
  questionCategory?: string
  value: any
  timestamp: string
}

// ==================== DEFAULT ROLE-BASED QUESTIONS ====================

export const DEFAULT_QUESTION_SETS: RoleQuestionSet[] = [
  {
    roleId: "viewer",
    roleName: "viewer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "viewer-summary",
        key: "dailySummary",
        label: "Daily Summary",
        type: "textarea",
        required: true,
        placeholder: "Brief summary of your daily activities...",
        description: "Provide a concise overview of your work today",
        category: "General",
        order: 1,
      },
      {
        id: "viewer-challenges",
        key: "challenges",
        label: "Challenges Faced",
        type: "textarea",
        required: false,
        placeholder: "Any challenges or blockers encountered...",
        description: "Optional: Describe any issues you faced",
        category: "Challenges",
        order: 2,
      },
    ],
  },
  {
    roleId: "tech-support",
    roleName: "tech-support",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "ts-tickets-handled",
        key: "ticketsHandled",
        label: "Tickets Handled",
        type: "number",
        required: true,
        placeholder: "Number of tickets resolved",
        validation: { min: 0 },
        description: "Total number of support tickets resolved today",
        category: "Performance",
        order: 1,
      },
      {
        id: "ts-customer-satisfaction",
        key: "customerSatisfaction",
        label: "Customer Satisfaction Rating",
        type: "select",
        required: true,
        options: ["Excellent", "Good", "Average", "Poor", "Very Poor"],
        defaultValue: "Good",
        description: "Overall customer feedback for today",
        category: "Performance",
        order: 2,
      },
      {
        id: "ts-common-issues",
        key: "commonIssues",
        label: "Common Issues Resolved",
        type: "multiselect",
        required: false,
        options: [
          "Login Problems", "Software Installation", "Network Connectivity", 
          "Password Reset", "Hardware Issues", "Account Configuration", 
          "Email Issues", "System Errors", "Other"
        ],
        description: "Select the most common issues you resolved today",
        category: "Support",
        order: 3,
      },
      {
        id: "ts-escalations",
        key: "escalations",
        label: "Escalations to Senior Team",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of issues escalated to senior support",
        category: "Support",
        order: 4,
      },
      {
        id: "ts-knowledge-base",
        key: "knowledgeBaseContributions",
        label: "Knowledge Base Contributions",
        type: "textarea",
        required: false,
        placeholder: "Documentation or solutions added to knowledge base...",
        description: "Any new documentation or solutions you created",
        category: "Documentation",
        order: 5,
      },
      {
        id: "ts-challenges",
        key: "challenges",
        label: "Challenges & Blockers",
        type: "textarea",
        required: false,
        placeholder: "Any challenges or blockers encountered...",
        description: "Describe obstacles that prevented you from resolving tickets",
        category: "Challenges",
        order: 6,
      },
    ],
  },
  {
    roleId: "programmer",
    roleName: "programmer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "dev-features-completed",
        key: "featuresCompleted",
        label: "Features Completed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of features or user stories completed",
        category: "Development",
        order: 1,
      },
      {
        id: "dev-bugs-fixed",
        key: "bugsFixed",
        label: "Bugs Fixed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of bugs resolved",
        category: "Development",
        order: 2,
      },
      {
        id: "dev-code-review",
        key: "codeReviewsCompleted",
        label: "Code Reviews Completed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of pull requests reviewed",
        category: "Development",
        order: 3,
      },
      {
        id: "dev-technologies",
        key: "technologiesUsed",
        label: "Technologies Worked On",
        type: "multiselect",
        required: false,
        options: [
          "Frontend (React/Vue/Angular)", "Backend (Node.js/Python/Java)", 
          "Database (SQL/NoSQL)", "API Development", "Mobile Development",
          "DevOps/CI/CD", "Testing", "Documentation", "Other"
        ],
        description: "Select technologies you worked with today",
        category: "Technical",
        order: 4,
      },
      {
        id: "dev-technical-debt",
        key: "technicalDebtAddressed",
        label: "Technical Debt Addressed",
        type: "textarea",
        required: false,
        placeholder: "Refactoring, optimization, or cleanup tasks...",
        description: "Any technical debt or code quality improvements made",
        category: "Technical",
        order: 5,
      },
      {
        id: "dev-blockers",
        key: "blockers",
        label: "Development Blockers",
        type: "textarea",
        required: false,
        placeholder: "Issues that blocked your progress...",
        description: "Describe any technical blockers or dependencies",
        category: "Challenges",
        order: 6,
      },
      {
        id: "dev-learning",
        key: "learningAndResearch",
        label: "Learning & Research",
        type: "textarea",
        required: false,
        placeholder: "New technologies, techniques, or research...",
        description: "Any new skills learned or research conducted",
        category: "Learning",
        order: 7,
      },
    ],
  },
  {
    roleId: "qa",
    roleName: "qa",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "qa-tests-executed",
        key: "testsExecuted",
        label: "Test Cases Executed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of test cases executed",
        category: "Testing",
        order: 1,
      },
      {
        id: "qa-defects-found",
        key: "defectsFound",
        label: "Defects Found",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of new defects identified",
        category: "Testing",
        order: 2,
      },
      {
        id: "qa-defects-verified",
        key: "defectsVerified",
        label: "Defects Verified Fixed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of defects verified as fixed",
        category: "Testing",
        order: 3,
      },
      {
        id: "qa-test-types",
        key: "testTypesPerformed",
        label: "Test Types Performed",
        type: "multiselect",
        required: false,
        options: [
          "Functional Testing", "Regression Testing", "Performance Testing",
          "Security Testing", "Usability Testing", "API Testing",
          "Integration Testing", "Unit Testing", "Exploratory Testing"
        ],
        description: "Select types of testing performed today",
        category: "Testing",
        order: 4,
      },
      {
        id: "qa-automation",
        key: "automationProgress",
        label: "Test Automation Progress",
        type: "textarea",
        required: false,
        placeholder: "Scripts written, frameworks updated, etc...",
        description: "Progress on test automation initiatives",
        category: "Automation",
        order: 5,
      },
      {
        id: "qa-quality-metrics",
        key: "qualityMetrics",
        label: "Quality Metrics",
        type: "select",
        required: true,
        options: ["Excellent", "Good", "Satisfactory", "Needs Improvement"],
        defaultValue: "Good",
        description: "Overall quality assessment of tested features",
        category: "Quality",
        order: 6,
      },
      {
        id: "qa-blockers",
        key: "testingBlockers",
        label: "Testing Blockers",
        type: "textarea",
        required: false,
        placeholder: "Issues preventing testing progress...",
        description: "Any blockers affecting your testing activities",
        category: "Challenges",
        order: 7,
      },
    ],
  },
  {
    roleId: "graphic-designer",
    roleName: "graphic-designer",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "gd-designs-completed",
        key: "designsCompleted",
        label: "Designs Completed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of design deliverables completed",
        category: "Design",
        order: 1,
      },
      {
        id: "gd-design-types",
        key: "designTypesCreated",
        label: "Design Types Created",
        type: "multiselect",
        required: false,
        options: [
          "UI/UX Designs", "Marketing Materials", "Brand Assets",
          "Social Media Graphics", "Print Design", "Logo Design",
          "Web Banners", "Infographics", "Presentations", "Other"
        ],
        description: "Select types of design work completed",
        category: "Design",
        order: 2,
      },
      {
        id: "gd-client-feedback",
        key: "clientFeedback",
        label: "Client Feedback",
        type: "select",
        required: true,
        options: ["Excellent", "Good", "Average", "Needs Revision", "Rejected"],
        defaultValue: "Good",
        description: "Feedback received on submitted designs",
        category: "Feedback",
        order: 3,
      },
      {
        id: "gd-revisions",
        key: "revisionsCompleted",
        label: "Revisions Completed",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of design revisions completed",
        category: "Design",
        order: 4,
      },
      {
        id: "gd-tools-used",
        key: "designToolsUsed",
        label: "Design Tools Used",
        type: "multiselect",
        required: false,
        options: [
          "Adobe Photoshop", "Adobe Illustrator", "Figma", "Sketch",
          "Adobe XD", "InDesign", "After Effects", "Canva", "Other"
        ],
        description: "Select design tools used today",
        category: "Technical",
        order: 5,
      },
      {
        id: "gd-inspiration",
        key: "creativeInspiration",
        label: "Creative Inspiration & Research",
        type: "textarea",
        required: false,
        placeholder: "Design trends, inspiration sources, research...",
        description: "Any creative research or inspiration gathering",
        category: "Creative",
        order: 6,
      },
      {
        id: "gd-blockers",
        key: "creativeBlockers",
        label: "Creative Blockers",
        type: "textarea",
        required: false,
        placeholder: "Creative blocks or resource limitations...",
        description: "Any obstacles affecting your design work",
        category: "Challenges",
        order: 7,
      },
    ],
  },
  {
    roleId: "manager",
    roleName: "manager",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "mgr-team-objectives",
        key: "teamObjectives",
        label: "Team Objectives Progress",
        type: "textarea",
        required: true,
        placeholder: "Progress on team objectives and goals...",
        description: "How the team progressed toward its objectives",
        category: "Leadership",
        order: 1,
      },
      {
        id: "mgr-team-performance",
        key: "teamPerformance",
        label: "Team Performance Assessment",
        type: "select",
        required: true,
        options: ["Excellent", "Good", "Satisfactory", "Needs Improvement"],
        defaultValue: "Good",
        description: "Overall team performance assessment",
        category: "Performance",
        order: 2,
      },
      {
        id: "mgr-issues-resolved",
        key: "issuesResolved",
        label: "Team Issues Resolved",
        type: "number",
        required: true,
        placeholder: "0",
        validation: { min: 0 },
        description: "Number of team or project issues resolved",
        category: "Management",
        order: 3,
      },
      {
        id: "mgr-decisions",
        key: "keyDecisions",
        label: "Key Decisions Made",
        type: "textarea",
        required: true,
        placeholder: "Important decisions made today...",
        description: "Document significant decisions and their rationale",
        category: "Leadership",
        order: 4,
      },
      {
        id: "mgr-resource-needs",
        key: "resourceNeeds",
        label: "Resource Requirements",
        type: "multiselect",
        required: false,
        options: ["Additional Staff", "Training", "Tools/Software", "Budget", "Office Space", "Other"],
        description: "Select resources needed by the team",
        category: "Resources",
        order: 5,
      },
      {
        id: "mgr-team-morale",
        key: "teamMorale",
        label: "Team Morale",
        type: "select",
        required: true,
        options: ["Very High", "High", "Neutral", "Low", "Very Low"],
        defaultValue: "High",
        description: "Current team morale assessment",
        category: "Performance",
        order: 6,
      },
    ],
  },
  {
    roleId: "admin",
    roleName: "admin",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    questions: [
      {
        id: "admin-system-health",
        key: "systemHealth",
        label: "System Health Status",
        type: "select",
        required: true,
        options: ["Excellent", "Good", "Degraded", "Critical"],
        defaultValue: "Good",
        description: "Overall system health assessment",
        category: "Operations",
        order: 1,
      },
      {
        id: "admin-issues",
        key: "criticalIssues",
        label: "Critical Issues",
        type: "textarea",
        required: false,
        placeholder: "Any critical issues requiring attention...",
        description: "Document critical system or operational issues",
        category: "Operations",
        order: 2,
      },
      {
        id: "admin-security",
        key: "securityReview",
        label: "Security Review",
        type: "textarea",
        required: true,
        placeholder: "Security activities and findings...",
        description: "Security-related work and concerns",
        category: "Security",
        order: 3,
      },
      {
        id: "admin-upgrades",
        key: "systemUpgrades",
        label: "System Upgrades",
        type: "multiselect",
        required: false,
        options: ["Security Patches", "Performance", "New Features", "Infrastructure", "Documentation", "Other"],
        description: "Types of system upgrades performed",
        category: "Operations",
        order: 4,
      },
      {
        id: "admin-user-management",
        key: "userManagementActivities",
        label: "User Management Activities",
        type: "textarea",
        required: false,
        placeholder: "User accounts created, modified, or disabled...",
        description: "User administration tasks completed",
        category: "Administration",
        order: 5,
      },
    ],
  },
]

// ==================== DEFAULT ADMIN USER ====================

export const DEFAULT_ADMIN_USER: Omit<User, "id" | "createdAt" | "updatedAt"> & { password: string } = {
  email: "admin@captains-log.local",
  name: "System Administrator",
  role: "admin",
  department: "IT",
  isActive: true,
  password: "admin123", // In production, this should be properly hashed
  metadata: {
    isDefault: true,
    requiresPasswordChange: true,
  },
}
