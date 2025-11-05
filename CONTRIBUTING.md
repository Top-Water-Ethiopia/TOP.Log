# Contributing to Captain's Log

First off, thank you for considering contributing to Captain's Log! It's people like you that make this tool better for everyone in the IT community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Community](#community)

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and considerate in all interactions.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

## 🤝 How Can I Contribute?

### Types of Contributions We Welcome

#### 🐛 Bug Reports
Found a bug? Help us fix it by submitting a detailed bug report.

#### ✨ Feature Requests
Have an idea for a new feature? We'd love to hear it!

#### 📝 Documentation
Help improve our documentation, fix typos, or add examples.

#### 💻 Code Contributions
Submit bug fixes, implement new features, or improve existing code.

#### 🎨 Design Improvements
Enhance UI/UX, create new themes, or improve accessibility.

#### 🧪 Testing
Write tests, improve test coverage, or test new features.

## 🛠 Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **Yarn** (v1.22.22 or higher)
- **Git**
- A code editor (we recommend [VS Code](https://code.visualstudio.com/))

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Initial Setup

1. **Fork the Repository**
   
   Click the "Fork" button at the top right of the repository page.

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/captain_log.git
   cd captain_log
   ```

3. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/captain_log.git
   ```

4. **Install Dependencies**
   ```bash
   yarn install
   ```

5. **Start Development Server**
   ```bash
   yarn dev
   ```

6. **Verify Installation**
   
   Open [http://localhost:3000](http://localhost:3000) and ensure the app loads correctly.

## 🔄 Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
# Update main branch
git checkout main
git pull upstream main

# Create a new feature branch
git checkout -b feature/your-feature-name
```

### Branch Naming Conventions

- **Features**: `feature/add-export-functionality`
- **Bug Fixes**: `fix/calendar-date-bug`
- **Documentation**: `docs/update-readme`
- **Refactoring**: `refactor/optimize-state-management`
- **Tests**: `test/add-entry-form-tests`
- **Chores**: `chore/update-dependencies`

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style and patterns
- Add comments for complex logic
- Update documentation if needed
- Write tests for new features

### 3. Test Your Changes

```bash
# Run linter
yarn lint

# Run type checking
yarn type-check

# Test the application manually
yarn dev
```

### 4. Commit Your Changes

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Open a Pull Request

Go to the original repository and click "New Pull Request".

## 📏 Coding Standards

### TypeScript Guidelines

#### Type Safety
```typescript
// ✅ Good - Explicit types
interface Entry {
  id: string
  date: string
  content: string
}

function createEntry(data: Omit<Entry, 'id'>): Entry {
  return {
    id: generateId(),
    ...data
  }
}

// ❌ Bad - Using 'any'
function createEntry(data: any): any {
  return { id: generateId(), ...data }
}
```

#### Interface vs Type
```typescript
// ✅ Prefer interfaces for objects
interface UserProps {
  name: string
  email: string
}

// ✅ Use types for unions and intersections
type Status = 'idle' | 'loading' | 'success' | 'error'
type AdminUser = User & { role: 'admin' }
```

### React Best Practices

#### Component Structure
```typescript
// ✅ Good - Clear prop types and structure
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function Button({ label, onClick, variant = 'primary', disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn('btn', `btn-${variant}`)}
    >
      {label}
    </button>
  )
}
```

#### Hooks Usage
```typescript
// ✅ Good - Custom hooks for reusable logic
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
```

#### State Management
```typescript
// ✅ Good - Structured state updates
const [formData, setFormData] = useState<FormData>(initialState)

const updateField = (field: keyof FormData, value: string) => {
  setFormData(prev => ({
    ...prev,
    [field]: value
  }))
}

// ❌ Bad - Direct state mutation
formData.name = "New Name" // Don't do this!
```

### Styling Guidelines

#### Tailwind CSS
```tsx
// ✅ Good - Semantic class organization
<div className="
  flex items-center justify-between
  px-4 py-2
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-lg shadow-sm
  hover:shadow-md transition-shadow
">
  {/* Content */}
</div>

// ✅ Use cn() for conditional classes
import { cn } from '@/lib/utils'

<button className={cn(
  'px-4 py-2 rounded',
  isPrimary && 'bg-blue-500 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed'
)}>
  Click Me
</button>
```

### File Organization

```typescript
// Component file structure
// 1. Imports
import React from 'react'
import { useContext } from 'react'

// 2. Types/Interfaces
interface ComponentProps {
  // props
}

// 3. Component
export function Component({ prop }: ComponentProps) {
  // Hooks
  const [state, setState] = useState()
  
  // Effects
  useEffect(() => {
    // ...
  }, [])
  
  // Handlers
  const handleClick = () => {
    // ...
  }
  
  // Render
  return (
    // JSX
  )
}
```

## 📝 Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **ci**: CI/CD configuration changes

### Examples

```bash
# Feature
git commit -m "feat(calendar): add month navigation controls"

# Bug fix
git commit -m "fix(entry-form): resolve date parsing issue in Safari"

# Documentation
git commit -m "docs(readme): add deployment instructions"

# Refactor
git commit -m "refactor(context): simplify state management logic"

# Multiple changes
git commit -m "feat(export): add CSV export functionality

- Add export button to calendar view
- Implement CSV generation utility
- Add download functionality
- Update documentation"
```

### Commit Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests in the footer
- Write meaningful commit messages that explain the "why"

## 🔀 Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] All tests pass
- [ ] Linter passes without errors
- [ ] Documentation is updated
- [ ] Commit messages follow our guidelines
- [ ] Branch is up to date with main

### PR Title Format

Follow the same format as commit messages:

```
feat(calendar): add export functionality
fix(ui): resolve mobile responsive issues
docs: update contribution guidelines
```

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- List specific changes
- Include relevant details
- Mention any technical decisions

## Testing
- Describe how you tested the changes
- List test cases covered

## Screenshots (if applicable)
Include screenshots for UI changes

## Related Issues
Closes #123
Related to #456

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented complex code sections
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have tested on different browsers
```

### Review Process

1. **Automated Checks**: CI/CD runs linter and tests
2. **Code Review**: Maintainers review your code
3. **Revisions**: Address feedback and push updates
4. **Approval**: Once approved, maintainers will merge

### Addressing Feedback

```bash
# Make requested changes
git add .
git commit -m "refactor: address PR feedback"
git push origin feature/your-feature-name
```

## 🐛 Reporting Bugs

### Before Submitting a Bug Report

- Check the documentation
- Search existing issues to avoid duplicates
- Try to reproduce the bug in the latest version
- Gather relevant information

### Bug Report Template

```markdown
## Bug Description
A clear description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Screenshots
If applicable, add screenshots.

## Environment
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14.1]
- Version: [e.g., 1.0.0]

## Additional Context
Any other relevant information.
```

## 💡 Suggesting Features

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature.

## Problem Statement
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
What alternatives have you thought about?

## Additional Context
Mockups, examples, or references.
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

- [ ] Test on Chrome, Firefox, and Safari
- [ ] Test on desktop and mobile viewports
- [ ] Test with light and dark themes
- [ ] Test all user interactions
- [ ] Check console for errors
- [ ] Verify accessibility with keyboard navigation

### Writing Tests (Future)

When we add automated testing:

```typescript
// Example test structure
describe('EntryForm', () => {
  it('should submit form with valid data', async () => {
    // Arrange
    const onSave = jest.fn()
    render(<EntryForm onSave={onSave} />)
    
    // Act
    await userEvent.type(screen.getByLabelText('Development Tasks'), 'Test task')
    await userEvent.click(screen.getByText('Save Entry'))
    
    // Assert
    expect(onSave).toHaveBeenCalled()
  })
})
```

## 📞 Community

### Getting Help

- **Documentation**: Check the [README](README.md) and [Architecture](ARCHITECTURE.md)
- **Issues**: Search or create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

### Recognition

Contributors will be:
- Listed in the project's README
- Mentioned in release notes
- Given credit in commit history

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Best Practices](https://react.dev/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Git Workflow Guide](https://guides.github.com/introduction/flow/)

---

**Thank you for contributing to Captain's Log! Your efforts help make this tool better for IT professionals everywhere.** 🚀

For questions about contributing, please open a discussion or reach out to the maintainers.
