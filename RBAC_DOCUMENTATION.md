# RBAC Implementation Documentation

## Overview

This document describes the Role-Based Access Control (RBAC) system implemented in the TOP Log application. The RBAC system provides granular control over user permissions and access to various features within the application.

## Architecture

### Core Components

1. **Authentication Context** (`/contexts/auth-context.tsx`)
   - Manages user authentication state
   - Handles login, logout, registration
   - Manages user sessions and tokens
   - Provides authentication methods to the application

2. **RBAC Types** (`/lib/rbac/types.ts`)
   - Defines user, role, and permission schemas
   - Contains default roles and permissions
   - Provides TypeScript interfaces for type safety

3. **RBAC Utilities** (`/lib/rbac/utils.ts`)
   - Permission checking functions
   - Role hierarchy management
   - Security utilities (password hashing, validation)
   - Local storage management

4. **RBAC Hooks** (`/hooks/use-rbac.ts`)
   - React hooks for permission checking
   - Specialized hooks for different resource types
   - Higher-order components for route protection

5. **UI Components**
   - `AuthDialog`: Login and registration interface
   - `UserProfileDialog`: User profile management
   - `UserManagementDialog`: Admin user management
   - Updated `AdminDashboard` with RBAC features

## Role Hierarchy

The system implements a hierarchical role structure:

```
Admin (Level 4)
├── Manager (Level 3)
│   ├── User (Level 2)
│   │   └── Viewer (Level 1)
```

### Role Definitions

#### Admin
- **Level**: 4
- **Permissions**: Full system access
- **Capabilities**:
  - Manage all users and roles
  - Access all system settings
  - View and manage audit logs
  - Create system backups
  - Full data import/export

#### Manager
- **Level**: 3
- **Permissions**: Team management
- **Capabilities**:
  - Create, read, update, delete entries
  - Export data
  - View analytics
  - View user information (limited)

#### User
- **Level**: 2
- **Permissions**: Standard access
- **Capabilities**:
  - Create and manage own entries
  - Export own data
  - View own analytics
  - Update own profile

#### Viewer
- **Level**: 1
- **Permissions**: Read-only access
- **Capabilities**:
  - View entries
  - Export own data
  - View own analytics

## Permission System

### Permission Format

Permissions follow the format: `resource.action`

Examples:
- `entries.create` - Create new log entries
- `users.manage` - Manage user accounts
- `admin.system` - Access system administration

### Permission Categories

1. **Read Permissions**: Viewing data
   - `entries.read`, `users.read`, `analytics.read`

2. **Write Permissions**: Creating and modifying data
   - `entries.create`, `entries.update`, `users.create`

3. **Delete Permissions**: Removing data
   - `entries.delete`, `users.delete`

4. **Admin Permissions**: System administration
   - `admin.system`, `admin.audit`, `admin.backup`

### Ownership-Based Permissions

Some permissions support ownership-based access control:
- `entries.update.own` - Update own entries only
- `entries.delete.own` - Delete own entries only
- `analytics.read.own` - View own analytics only

## Implementation Details

### Authentication Flow

1. **Initialization**: On app load, the `AuthProvider` initializes and checks for existing sessions
2. **Login**: Users authenticate with email/password
3. **Session Management**: JWT-like tokens stored in localStorage
4. **Permission Loading**: User roles and permissions loaded from storage

### Permission Checking

```typescript
// Basic permission check
const canCreate = hasPermission(user, 'entries.create', roles)

// Resource-specific permission with ownership
const canUpdate = canPerformAction(
  user, 
  { resource: 'entries', action: 'update', ownResource: true },
  roles,
  entry.userId
)

// Role-based access
const isAdmin = hasRoleLevel(user, ROLE_HIERARCHY.admin)
```

### Data Storage

All RBAC data is stored in localStorage:

- `captain-log-users`: User accounts
- `captain-log-roles`: Role definitions
- `captain-log-permissions`: Permission definitions
- `captain-log-sessions`: Active sessions
- `captain-log-current-session`: Current user session

### Security Features

1. **Password Hashing**: SHA-256 with salt (for demo purposes)
2. **Session Management**: Automatic expiration and cleanup
3. **Input Validation**: Email format, password strength
4. **Audit Logging**: All actions tracked with user context
5. **Ownership Enforcement**: Users can only access their own data unless elevated permissions

## Usage Examples

### Protecting Components

```typescript
// Using hooks
function MyComponent() {
  const { canCreateEntries } = useEntryPermissions()
  
  if (!canCreateEntries) {
    return <AccessDenied />
  }
  
  return <EntryForm />
}

// Using HOC
export default withPermission('entries.create', EntryForm)

// Role-based protection
export default withRole('manager', ManagerDashboard)
```

### Checking Permissions in Logic

```typescript
function handleDeleteEntry(entryId: string) {
  const { user, canDeleteEntries } = useRBAC()
  const entry = getEntry(entryId)
  
  if (!canDeleteEntries(entry.userId)) {
    toast.error('Insufficient permissions')
    return
  }
  
  // Proceed with deletion
}
```

### API Integration

The RBAC system is designed to integrate with backend APIs:

```typescript
// Example API call with permission check
async function exportData() {
  const { hasPermission } = useRBAC()
  
  if (!hasPermission('entries.export')) {
    throw new Error('Insufficient permissions')
  }
  
  const response = await fetch('/api/export', {
    headers: {
      'Authorization': `Bearer ${user.token}`
    }
  })
  
  return response.json()
}
```

## Default Configuration

### Default Admin User

- **Email**: `admin@captains-log.local`
- **Password**: `admin123`
- **Role**: Admin
- **Note**: Should be changed in production

### Default Roles

The system includes four pre-configured roles with appropriate permissions. These roles are marked as `isSystem: true` and cannot be deleted.

## Migration Guide

### From Single-User to Multi-User

1. **Data Migration**: Existing entries will not have a `userId` field
2. **Ownership Assignment**: Admin can assign ownership of existing entries
3. **Access Control**: New users will only see their own entries by default

### Backward Compatibility

- Existing entries without `userId` are treated as system-owned
- Admin users can manage all entries regardless of ownership
- API responses include ownership information for new entries

## Testing

### Permission Testing

```typescript
// Test user roles
describe('RBAC Permissions', () => {
  test('Admin can manage users', () => {
    const adminUser = { role: 'admin', isActive: true }
    expect(hasPermission(adminUser, 'users.manage', roles)).toBe(true)
  })
  
  test('User cannot delete others entries', () => {
    const user = { role: 'user', isActive: true, id: 'user1' }
    const canDelete = canPerformAction(
      user, 
      { resource: 'entries', action: 'delete', ownResource: true },
      roles,
      'user2' // Different user's entry
    )
    expect(canDelete).toBe(false)
  })
})
```

### Integration Testing

1. **Authentication Flow**: Test login/logout functionality
2. **Permission Enforcement**: Verify protected routes and actions
3. **Role Hierarchy**: Test role-based access controls
4. **Data Ownership**: Verify users can only access their data

## Security Considerations

### Current Limitations

1. **Client-Side Only**: All authorization logic runs on the client
2. **Simple Password Hashing**: Uses basic SHA-256 (upgrade to bcrypt in production)
3. **No Rate Limiting**: Login attempts are not rate-limited
4. **Session Storage**: Tokens stored in localStorage (consider httpOnly cookies)

### Production Recommendations

1. **Backend Integration**: Move authorization logic to server-side
2. **Enhanced Security**: Implement proper password hashing, rate limiting
3. **Session Management**: Use secure, httpOnly cookies
4. **Audit Trail**: Implement comprehensive server-side logging
5. **Multi-Factor Authentication**: Add 2FA for sensitive operations

## Future Enhancements

1. **Custom Roles**: Allow creation of custom roles beyond the default four
2. **Resource-Specific Permissions**: More granular control over specific resources
3. **Time-Based Access**: Temporary permissions and access schedules
4. **Delegation**: Allow users to temporarily delegate permissions
5. **Audit Dashboard**: Enhanced audit log viewing and filtering

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check user role and status
2. **Session Expired**: Automatic re-authentication required
3. **Storage Issues**: Clear browser localStorage if corrupted
4. **Role Assignment**: Only higher-level roles can assign lower-level roles

### Debug Information

Enable debug logging by setting `localStorage.debug = 'rbac:*'` in browser console.

## API Reference

### Core Functions

- `hasPermission(user, permission, roles)`: Check specific permission
- `canPerformAction(user, check, roles, ownerId)`: Check action with ownership
- `hasRoleLevel(user, requiredLevel, hierarchy)`: Check role hierarchy
- `canManageUser(manager, targetUser, hierarchy)`: Check user management

### Hooks

- `useRBAC()`: Main RBAC hook with all utilities
- `useEntryPermissions()`: Entry-specific permissions
- `useUserPermissions()`: User management permissions
- `useAnalyticsPermissions()`: Analytics access permissions
- `useAdminPermissions()`: Administrative permissions

### Components

- `AuthProvider`: Authentication context provider
- `AuthDialog`: Login/registration modal
- `UserProfileDialog`: User profile management
- `UserManagementDialog`: Admin user management
- `withPermission()`: Permission-based HOC
- `withRole()`: Role-based HOC

---

This documentation provides a comprehensive overview of the RBAC system implementation. For specific code examples or troubleshooting assistance, refer to the source code files mentioned in each section.
