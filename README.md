# Captain's Log 🚀

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)

**Captain's Log** is a modern, intuitive IT Department Daily Tracker designed to help IT professionals document their daily activities, track progress, and maintain a comprehensive record of development work, challenges, and achievements.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Data Storage](#data-storage)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

Captain's Log provides IT teams with a structured way to maintain daily logs of their work activities. The application features an interactive calendar interface for easy navigation between dates and comprehensive forms for documenting various aspects of daily IT work.

### Key Use Cases

- **Daily Standup Preparation**: Quick reference for what was accomplished yesterday
- **Sprint Retrospectives**: Historical data for team meetings and reviews
- **Performance Reviews**: Documented evidence of contributions and growth
- **Knowledge Transfer**: Searchable history of technical decisions and challenges
- **Time Management**: Track where time is being invested across different activities

## ✨ Features

### Core Functionality

- **📅 Calendar Navigation**: Interactive calendar view with visual indicators for days with entries
- **✍️ Structured Logging**: Comprehensive form with six key categories:
  - Development Tasks
  - Features Completed
  - Challenges & Blockers
  - Code Review & Priorities
  - System Improvements
  - Project Updates
- **💾 Persistent Storage**: Automatic local storage with no backend required
- **🎨 Modern UI**: Clean, professional interface built with shadcn/ui components
- **🌗 Theme Support**: Light and dark mode support
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **⚡ Real-time Updates**: Instant updates without page refreshes
- **🔍 Entry Management**: Create, read, update, and delete log entries

### Advanced Features

- **📥 Data Export**: Export entries in multiple formats
  - **CSV**: Open in Excel or Google Sheets
  - **JSON**: For backup and data portability
  - **Markdown**: Human-readable formatted document
- **📤 Data Import**: Import entries from previously exported JSON files
  - Automatic duplicate detection
  - Batch import support
  - Drag-and-drop file upload
- **🔍 Search**: Full-text search across all entry fields
  - Search through all sections
  - Instant results with highlighting
  - Jump directly to matching entries
- **📊 Analytics Dashboard**: Comprehensive insights
  - Total entries and activity tracking
  - Current and longest streak tracking
  - Completion rate metrics
  - Section usage visualization
  - Logging habits analysis
  - Quick insights and recommendations
- **📝 Entry Templates**: 8 pre-built templates for quick logging
  - Productive Day
  - Challenging Day
  - Learning Day
  - Meeting Heavy
  - Bug Fixing Day
  - Code Review Day
  - Planning Day
  - Deployment Day
- **🔔 Toast Notifications**: Real-time feedback for all actions

### User Experience

- **Zero Configuration**: No setup required, works immediately
- **Offline-First**: All data stored locally in the browser
- **Fast Performance**: Optimized with Next.js App Router and React 19
- **Intuitive Interface**: Clear navigation and user-friendly forms
- **Data Privacy**: All data stays on your device

## 🛠 Tech Stack

### Frontend Framework
- **[Next.js 16.0](https://nextjs.org/)** - React framework with App Router
- **[React 19.2](https://reactjs.org/)** - UI library with latest concurrent features
- **[TypeScript 5.x](https://www.typescriptlang.org/)** - Type-safe development

### UI & Styling
- **[Tailwind CSS 4.1](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - High-quality React components
- **[Radix UI](https://www.radix-ui.com/)** - Unstyled, accessible component primitives
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library

### Form Management
- **[React Hook Form](https://react-hook-form.com/)** - Performant form validation
- **[Zod](https://zod.dev/)** - TypeScript-first schema validation

### Additional Libraries
- **[date-fns](https://date-fns.org/)** - Modern date utility library
- **[next-themes](https://github.com/pacocoursey/next-themes)** - Theme management
- **[sonner](https://sonner.emilkowal.ski/)** - Toast notifications
- **[class-variance-authority](https://cva.style/)** - Component variant utilities

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **Yarn** (v1.22.22 or higher) - The project uses Yarn as the package manager

You can check your versions with:
```bash
node --version
yarn --version
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd captain_log
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

   This will install all required dependencies as specified in `package.json`.

### Running the Application

#### Development Mode

Start the development server with hot module reloading:

```bash
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

#### Production Build

Build the application for production:

```bash
yarn build
```

Start the production server:

```bash
yarn start
```

#### Code Quality

Run ESLint to check code quality:

```bash
yarn lint
```

## 📁 Project Structure

```
captain_log/
├── app/                      # Next.js App Router
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Home page
├── components/               # React components
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   └── ...              # Other UI primitives
│   ├── calendar-view.tsx    # Calendar interface component
│   ├── entry-details.tsx    # Entry viewing component
│   ├── entry-form.tsx       # Entry creation/editing form
│   ├── main-layout.tsx      # Main application layout
│   └── theme-provider.tsx   # Theme context provider
├── contexts/                 # React contexts
│   └── captain-log-context.tsx  # Global state management
├── hooks/                    # Custom React hooks
├── lib/                      # Utility functions
│   └── utils.ts             # Helper utilities
├── public/                   # Static assets
├── styles/                   # Additional styles
├── .gitignore               # Git ignore rules
├── components.json          # shadcn/ui configuration
├── next.config.mjs          # Next.js configuration
├── package.json             # Project dependencies
├── postcss.config.mjs       # PostCSS configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

### Key Files

- **`contexts/captain-log-context.tsx`**: Global state management for log entries
- **`components/main-layout.tsx`**: Main application layout and routing logic
- **`components/entry-form.tsx`**: Form component for creating/editing entries
- **`components/calendar-view.tsx`**: Calendar interface for date selection
- **`components/entry-details.tsx`**: Display component for viewing log entries

## 💡 Usage

### Creating a Log Entry

1. **Select a Date**: Click on any date in the calendar
2. **Fill Out the Form**: Complete the six structured fields:
   - **Development Tasks**: Current tasks and their status
   - **Features Completed**: Finished features, bug fixes, or merged PRs
   - **Challenges & Blockers**: Issues or dependencies affecting progress
   - **Code Review & Priorities**: Review activities and next priorities
   - **System Improvements**: Infrastructure or performance enhancements
   - **Project Updates**: Important project changes or milestones
3. **Save**: Click "Save Entry" to store your log

### Viewing Entries

- Click on a highlighted date in the calendar to view existing entries
- Navigate between view and edit modes using the "Edit" button
- Return to calendar view using the "Back" button

### Editing Entries

1. Navigate to the entry you want to edit
2. Click the "Edit" button
3. Modify the fields as needed
4. Save your changes

### Deleting Entries

Entries can be deleted from the entry details view using the delete functionality.

## 💾 Data Storage

Captain's Log uses **browser Local Storage** for data persistence:

- **Storage Key**: `captain-log-entries`
- **Format**: JSON array of entry objects
- **Capacity**: Typically 5-10MB per domain (browser-dependent)
- **Privacy**: All data remains on your local device

### Data Structure

Each entry follows this TypeScript interface:

```typescript
interface CaptainLogEntry {
  id: string                    // Unique identifier
  date: string                  // ISO date string (YYYY-MM-DD)
  developmentTasks: string      // Development tasks description
  featuresCompleted: string     // Completed features
  challengesAndBlockers: string // Challenges encountered
  codeAndPriorities: string     // Code reviews and priorities
  systemImprovements: string    // System improvements made
  projectUpdates: string        // Project updates
  createdAt: string            // ISO timestamp of creation
  updatedAt: string            // ISO timestamp of last update
}
```

### Backup and Export

To backup your data:

1. Open browser Developer Tools (F12)
2. Navigate to Application/Storage → Local Storage
3. Find `captain-log-entries` key
4. Copy the JSON value and save to a file

To restore:
1. Open browser Developer Tools
2. Navigate to Application/Storage → Local Storage
3. Set `captain-log-entries` key with your backup JSON

## 🔧 Development

### Code Style

The project follows these conventions:

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Naming**: PascalCase for components, camelCase for functions
- **File Organization**: Co-located components and styles

### Component Development

When creating new components:

1. Use TypeScript interfaces for props
2. Follow the existing component structure
3. Use shadcn/ui components where possible
4. Ensure responsive design with Tailwind utilities
5. Add proper TypeScript types

### Adding New UI Components

The project uses shadcn/ui. To add new components:

```bash
npx shadcn-ui@latest add [component-name]
```

### State Management

Global state is managed through React Context (`captain-log-context.tsx`). For new features requiring global state:

1. Extend the context interface
2. Add methods to the provider
3. Update the context type definitions

## 🏗 Building for Production

### Optimization

The production build includes:

- **Code Splitting**: Automatic route-based splitting
- **Minification**: Optimized JavaScript and CSS
- **Image Optimization**: Next.js Image component
- **Font Optimization**: Automatic font loading

### Deployment Options

Captain's Log can be deployed to:

- **[Vercel](https://vercel.com/)** (Recommended - Zero configuration)
  ```bash
  yarn build
  vercel
  ```

- **[Netlify](https://www.netlify.com/)**
  ```bash
  yarn build
  # Deploy the .next folder
  ```

- **Static Export** (Optional)
  Configure for static export in `next.config.mjs` if no SSR is needed

### Environment Variables

Currently, the application doesn't require environment variables as it uses local storage. For future backend integration, create a `.env.local` file:

```env
# Example for future API integration
# NEXT_PUBLIC_API_URL=https://api.example.com
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **shadcn** for the beautiful UI component library
- **Vercel** for Next.js and hosting platform
- **The React team** for React 19
- **The Open Source Community** for the excellent tools and libraries

---

**Made with ❤️ for IT professionals who value organized documentation**

For questions, issues, or feature requests, please [open an issue](../../issues) on GitHub.
