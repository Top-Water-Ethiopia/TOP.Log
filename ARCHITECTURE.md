# Architecture Documentation

## 📐 System Architecture

Captain's Log is a client-side single-page application (SPA) built with modern web technologies. This document provides a comprehensive overview of the system architecture, design decisions, and technical implementation.

## 🏗 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Captain's Log Application                 │  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   Next.js    │  │    React     │  │  TypeScript │ │  │
│  │  │  App Router  │  │   Context    │  │    Types    │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │            Component Layer                        │ │  │
│  │  │  • CalendarView  • EntryForm  • EntryDetails    │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │            State Management                       │ │  │
│  │  │           (React Context API)                     │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │          Data Persistence Layer                   │ │  │
│  │  │            (LocalStorage API)                     │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Technology Stack

### Core Framework
- **Next.js 16.0**: React framework with App Router for file-based routing and server components
- **React 19.2**: UI library with concurrent features and automatic batching
- **TypeScript 5.x**: Static type checking and enhanced IDE support

### UI Layer
- **Tailwind CSS 4.1**: Utility-first CSS framework for rapid styling
- **shadcn/ui**: Pre-built, customizable component library
- **Radix UI**: Unstyled, accessible component primitives
- **Lucide React**: Modern icon library

### State & Data Management
- **React Context API**: Global state management
- **LocalStorage API**: Client-side data persistence
- **React Hook Form**: Form state and validation

### Development Tools
- **ESLint**: Code quality and consistency
- **PostCSS**: CSS processing and transformations
- **Autoprefixer**: Automatic vendor prefixing

## 📂 Project Structure

```
captain_log/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (HTML structure, providers)
│   ├── page.tsx                  # Home page component
│   └── globals.css               # Global styles and Tailwind directives
│
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitive components
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── card.tsx
│   │   └── ...                   # Other UI primitives
│   │
│   ├── calendar-view.tsx         # Calendar interface component
│   ├── entry-details.tsx         # Entry viewing/display component
│   ├── entry-form.tsx            # Entry creation/editing form
│   ├── main-layout.tsx           # Main application layout
│   └── theme-provider.tsx        # Theme context provider
│
├── contexts/                     # React Context providers
│   └── captain-log-context.tsx   # Global state and data operations
│
├── hooks/                        # Custom React hooks
│   └── use-toast.ts              # Toast notification hook
│
├── lib/                          # Utility functions
│   └── utils.ts                  # Helper utilities (cn, etc.)
│
├── styles/                       # Additional stylesheets
│   └── globals.css               # Extended global styles
│
├── public/                       # Static assets
│   └── ...                       # Images, icons, etc.
│
├── .gitignore                    # Git ignore patterns
├── components.json               # shadcn/ui configuration
├── next.config.mjs               # Next.js configuration
├── package.json                  # Dependencies and scripts
├── postcss.config.mjs            # PostCSS configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## 🔄 Data Flow

### Application Data Flow

```
┌─────────────┐
│   User      │
│  Interaction│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   React Component               │
│   (CalendarView, EntryForm)     │
└──────┬──────────────────────────┘
       │
       │ Calls context method
       ▼
┌─────────────────────────────────┐
│   CaptainLogContext             │
│   • addEntry()                  │
│   • updateEntry()               │
│   • deleteEntry()               │
│   • getEntryByDate()            │
└──────┬──────────────────────────┘
       │
       │ Updates state
       ▼
┌─────────────────────────────────┐
│   React State                   │
│   (entries array)               │
└──────┬──────────────────────────┘
       │
       │ useEffect triggers
       ▼
┌─────────────────────────────────┐
│   LocalStorage                  │
│   (Persistent storage)          │
└─────────────────────────────────┘
       │
       │ Re-render
       ▼
┌─────────────────────────────────┐
│   UI Update                     │
│   (Component re-renders)        │
└─────────────────────────────────┘
```

## 🎯 Core Components

### 1. Application Root (`app/page.tsx`)

**Purpose**: Entry point of the application

```typescript
export default function Home() {
  // Client-side only rendering
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <CaptainLogProvider>
      <MainLayout />
    </CaptainLogProvider>
  )
}
```

**Responsibilities**:
- Initialize client-side rendering
- Wrap application with context providers
- Render main layout

### 2. Context Provider (`contexts/captain-log-context.tsx`)

**Purpose**: Global state management and data operations

```typescript
interface CaptainLogContextType {
  entries: CaptainLogEntry[]
  addEntry: (entry: Omit<CaptainLogEntry, "id" | "createdAt" | "updatedAt">) => void
  updateEntry: (id: string, entry: Partial<CaptainLogEntry>) => void
  deleteEntry: (id: string) => void
  getEntryByDate: (date: string) => CaptainLogEntry | undefined
}
```

**Key Features**:
- Centralized state management
- CRUD operations for entries
- LocalStorage synchronization
- Type-safe operations

**Data Model**:

```typescript
interface CaptainLogEntry {
  id: string                      // Unique identifier (timestamp-based)
  date: string                    // ISO date string (YYYY-MM-DD)
  developmentTasks: string        // Daily development tasks
  featuresCompleted: string       // Completed features/PRs
  challengesAndBlockers: string   // Issues and blockers
  codeAndPriorities: string       // Code reviews and priorities
  systemImprovements: string      // Infrastructure improvements
  projectUpdates: string          // Project milestones
  createdAt: string              // ISO timestamp
  updatedAt: string              // ISO timestamp
}
```

### 3. Main Layout (`components/main-layout.tsx`)

**Purpose**: Application layout and view routing

**View States**:
- `calendar`: Default view showing calendar
- `form`: Entry creation/editing view
- `details`: Entry display view

**State Management**:
```typescript
const [selectedDate, setSelectedDate] = useState<string>(currentDate)
const [viewMode, setViewMode] = useState<"calendar" | "form" | "details">("calendar")
```

**Navigation Logic**:
- Date selection → Switch to form view
- Save entry → Switch to details view
- Back button → Return to calendar view

### 4. Calendar View (`components/calendar-view.tsx`)

**Purpose**: Interactive calendar interface

**Features**:
- Month navigation
- Date selection
- Visual indicators for days with entries
- Current date highlighting
- Responsive grid layout

**Key Functions**:
```typescript
const hasEntry = (date: string) => {
  return entries.some(entry => entry.date === date)
}

const handleDateSelect = (date: string) => {
  onDateSelect(date)
}
```

### 5. Entry Form (`components/entry-form.tsx`)

**Purpose**: Create and edit log entries

**Form Fields**:
1. Development Tasks
2. Features Completed
3. Challenges & Blockers
4. Code Review & Priorities
5. System Improvements
6. Project Updates

**Form Handling**:
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  
  const existingEntry = getEntryByDate(date)
  
  if (existingEntry) {
    updateEntry(existingEntry.id, formData)
  } else {
    addEntry(formData)
  }
  
  onSave()
}
```

**Features**:
- Auto-load existing entry data
- Real-time form state updates
- Validation and error handling
- Loading states

### 6. Entry Details (`components/entry-details.tsx`)

**Purpose**: Display saved log entries

**Features**:
- Read-only view of entry data
- Edit functionality
- Delete functionality
- Formatted date display
- Section-based layout

## 🔐 Data Persistence

### LocalStorage Implementation

**Storage Key**: `captain-log-entries`

**Data Format**: JSON-stringified array of `CaptainLogEntry` objects

**Implementation Pattern**:

```typescript
// Load on mount
useEffect(() => {
  const stored = localStorage.getItem("captain-log-entries")
  if (stored) {
    try {
      setEntries(JSON.parse(stored))
    } catch (e) {
      console.error("Failed to load entries:", e)
    }
  }
  setIsLoaded(true)
}, [])

// Save on change
useEffect(() => {
  if (isLoaded) {
    localStorage.setItem("captain-log-entries", JSON.stringify(entries))
  }
}, [entries, isLoaded])
```

**Benefits**:
- Zero backend infrastructure
- Instant read/write operations
- Offline-first architecture
- No authentication required
- Complete data privacy

**Limitations**:
- Storage limit (~5-10MB per domain)
- No cross-device synchronization
- Data tied to browser/device
- No server-side backup

### Future: Backend Integration

For future scalability, the architecture supports migration to a backend:

```typescript
// Example backend integration
interface DataService {
  getEntries: () => Promise<CaptainLogEntry[]>
  createEntry: (entry: CreateEntryDTO) => Promise<CaptainLogEntry>
  updateEntry: (id: string, updates: UpdateEntryDTO) => Promise<CaptainLogEntry>
  deleteEntry: (id: string) => Promise<void>
}
```

## 🎨 Styling Architecture

### Tailwind CSS Approach

**Configuration**: `tailwind.config.ts`

```typescript
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
      },
      // Custom utilities
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
}
```

**Utility-First Pattern**:
```tsx
<div className="
  flex items-center justify-between
  px-4 py-2
  bg-white dark:bg-gray-800
  border border-gray-200
  rounded-lg shadow-sm
  hover:shadow-md transition-shadow
">
```

### Theme System

**Implementation**: `next-themes` library

```typescript
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

**Supported Themes**:
- Light mode
- Dark mode
- System preference

### Component Variants

Using `class-variance-authority` (cva):

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input bg-background",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
  }
)
```

## 🔀 Routing Architecture

### Next.js App Router

**File-based Routing**:
```
app/
├── layout.tsx       → Root layout (applies to all routes)
└── page.tsx         → / (home route)
```

**Client-Side Navigation**:
- All routing handled client-side via view state
- No page reloads
- Instant transitions

### View State Management

```typescript
// State-based routing within SPA
type ViewMode = "calendar" | "form" | "details"

const [viewMode, setViewMode] = useState<ViewMode>("calendar")

// View switching logic
const navigateToForm = (date: string) => {
  setSelectedDate(date)
  setViewMode("form")
}
```

## 🧩 Component Design Patterns

### 1. Container/Presenter Pattern

**Container** (Smart Component):
```typescript
// components/main-layout.tsx
export function MainLayout() {
  const [selectedDate, setSelectedDate] = useState(...)
  const [viewMode, setViewMode] = useState(...)
  
  // Business logic here
  
  return (
    <EntryForm 
      date={selectedDate}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
}
```

**Presenter** (Dumb Component):
```typescript
// components/entry-form.tsx
export function EntryForm({ date, onSave, onCancel }: EntryFormProps) {
  // UI logic only
  return <form>...</form>
}
```

### 2. Compound Component Pattern

```typescript
// UI components from shadcn/ui
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>
```

### 3. Custom Hooks Pattern

```typescript
// hooks/use-captain-log.ts
export function useCaptainLog() {
  const context = useContext(CaptainLogContext)
  if (!context) {
    throw new Error("useCaptainLog must be used within CaptainLogProvider")
  }
  return context
}
```

## 🎭 State Management Strategy

### Local vs Global State

**Local State** (useState):
- Form input values
- UI toggles (modals, dropdowns)
- Component-specific data

**Global State** (Context):
- Log entries data
- Shared application state
- Cross-component communication

### State Update Patterns

**Immutable Updates**:
```typescript
// ✅ Correct
setEntries([...entries, newEntry])
setEntries(entries.map(e => e.id === id ? {...e, ...updates} : e))

// ❌ Incorrect
entries.push(newEntry) // Mutation
setEntries(entries)
```

## 🚀 Performance Considerations

### Optimization Strategies

1. **React.memo**: Memoize expensive components
2. **useCallback**: Stabilize callback references
3. **useMemo**: Cache computed values
4. **Code Splitting**: Automatic route-based splitting
5. **Lazy Loading**: Import components on-demand

### Current Performance Profile

- **First Load**: < 100KB JavaScript
- **Interaction**: < 50ms response time
- **Memory**: Minimal footprint (localStorage only)

## 🔒 Security Considerations

### Client-Side Security

1. **Data Privacy**: All data stored locally
2. **XSS Prevention**: React's built-in escaping
3. **Input Sanitization**: Form validation with Zod
4. **No External Requests**: Zero network vulnerabilities

### Future Backend Security

When implementing backend:
- JWT authentication
- HTTPS only
- CSRF protection
- Rate limiting
- Input validation
- SQL injection prevention

## 🧪 Testing Strategy

### Planned Testing Approach

**Unit Tests**:
```typescript
// Context methods
describe('CaptainLogContext', () => {
  it('should add entry correctly', () => {
    // Test addEntry method
  })
})

// Component logic
describe('EntryForm', () => {
  it('should validate required fields', () => {
    // Test validation
  })
})
```

**Integration Tests**:
```typescript
describe('Entry Creation Flow', () => {
  it('should create entry from calendar', () => {
    // Test full user flow
  })
})
```

**E2E Tests**:
- User journey testing
- Cross-browser compatibility
- Responsive design verification

## 📈 Scalability Considerations

### Current Limitations

- **Storage**: ~5-10MB LocalStorage limit
- **Concurrency**: Single-user only
- **Sync**: No multi-device support

### Scaling Path

1. **Phase 1**: Current (LocalStorage)
2. **Phase 2**: Backend API + Database
3. **Phase 3**: Multi-user + Authentication
4. **Phase 4**: Real-time sync + Collaboration

### Migration Strategy

```typescript
// Abstract data layer for easy migration
interface DataRepository {
  getEntries(): Promise<Entry[]>
  addEntry(entry: CreateEntryDTO): Promise<Entry>
  // ...
}

class LocalStorageRepository implements DataRepository {
  // Current implementation
}

class APIRepository implements DataRepository {
  // Future implementation
}
```

## 🔄 Future Architecture Enhancements

### Planned Features

1. **Search & Filter**: Full-text search across entries
2. **Export**: PDF/CSV export functionality
3. **Templates**: Pre-defined entry templates
4. **Analytics**: Visual insights and charts
5. **Reminders**: Daily logging reminders
6. **Backup/Restore**: Data export/import

### Technical Debt

- Add comprehensive test coverage
- Implement error boundaries
- Add analytics tracking
- Improve accessibility (ARIA labels)
- Add loading skeletons
- Implement offline detection

## 📚 References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainers**: Captain's Log Team

For questions or suggestions regarding the architecture, please open an issue or discussion on GitHub.
