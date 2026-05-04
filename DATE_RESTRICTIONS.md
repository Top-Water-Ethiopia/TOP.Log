# Date Restrictions System

## Overview

The Captain Log application implements industrial-level date restrictions to ensure data integrity and enforce business rules around log entry management.

## Business Rules

### 1. **2-Day Editing Window**
- Users can **create** or **update** entries for:
  - **Today** (current date)
  - **Yesterday** (1 day ago)
  - **Day Before Yesterday** (2 days ago)
- Total window: **3 days** (today + last 2 days)

### 2. **No Deletion Policy**
- Log entries **cannot be deleted** by any user
- This enforces a **data retention policy** for audit and compliance purposes
- Delete buttons are visually disabled with explanatory tooltips

### 3. **Future Date Blocking**
- Users cannot create entries for future dates
- Prevents data entry errors and maintains data integrity

### 4. **Past Entry Protection**
- Entries older than 2 days are **read-only**
- Users can view but not edit or delete old entries
- This prevents retroactive data manipulation

## Technical Implementation

### Core Utility: `/lib/date-restrictions.ts`

This module provides all date validation functions:

#### Key Functions

```typescript
// Get today's date in YYYY-MM-DD format
getToday(): string

// Get the minimum allowed date (2 days ago)
getMinAllowedDate(): string

// Get the maximum allowed date (today)
getMaxAllowedDate(): string

// Check if date is within allowed range
isDateInAllowedRange(date: string): boolean

// Validate date for entry creation
canCreateEntryForDate(date: string): DateValidationResult

// Validate date for entry update
canUpdateEntryForDate(date: string, entryCreatedAt?: string): DateValidationResult

// Validate entry deletion (always returns false)
canDeleteEntry(entryDate: string): DateValidationResult

// Get human-readable date restriction message
getDateRestrictionMessage(): string

// Format date for user display
formatDateHuman(dateString: string): string
```

#### DateValidationResult Interface

```typescript
interface DateValidationResult {
  isValid: boolean
  error?: string
  severity?: 'info' | 'warning' | 'error'
}
```

### Integration Points

#### 1. **Entry Form** (`/components/entry-form-multistep.tsx`)

- Date input restricted with `min` and `max` attributes
- Real-time validation on date change
- Visual error messages for invalid dates
- Information banner explaining restrictions
- Submit button disabled if date is invalid

**Key Features:**
- Blue info banner displays date restriction rules
- Red error banner appears for invalid dates
- Human-friendly date display (e.g., "Today (Wed, Nov 27)")
- Validation runs before form submission

#### 2. **Entry Details View** (`/components/entry-details.tsx`)

- Edit button disabled for entries older than 2 days
- Delete button always disabled with tooltip
- Tooltip explains: "Deleting entries is not allowed due to data retention policy"
- Edit button tooltip shows: "Entries older than 2 days cannot be edited"

**Visual Indicators:**
- Disabled buttons have reduced opacity
- Tooltips provide clear explanations
- Cursor changes to `not-allowed` on hover

#### 3. **Calendar View** (`/components/calendar-view.tsx`)

Visual differentiation of dates:

- **Today**: Accent color with ring border
- **Future dates**: Greyed out, disabled, 40% opacity
- **Editable dates with entries**: Full color with green indicator dot
- **Past dates with entries**: Reduced opacity with dashed border and faded indicator
- **Editable dates without entries**: Standard background
- **Past dates without entries**: Reduced opacity

**Legend:**
- "Today" - Shows current date
- "Editable (last 2 days)" - Full green dot
- "View only (older)" - Faded green dot (50% opacity)

**Tooltips:**
- Future: "Cannot log future dates"
- Editable with entry: "View/Edit entry"
- Past with entry: "View only (older than 2 days)"
- Editable without entry: "Create entry (within 2-day window)"
- Past without entry: "Not editable (older than 2 days)"

#### 4. **Context Layer** (`/contexts/captain-log-context.tsx`)

Backend validation ensures:

- `addEntry()`: Validates with `canCreateEntryForDate()`
- `updateEntry()`: Validates with `canUpdateEntryForDate()`
- `deleteEntry()`: Validates with `validateDeleteEntry()` (always fails)

**Error Handling:**
- Throws `CaptainLogError` with appropriate severity
- User-friendly error messages
- Prevents API calls for invalid operations

## User Experience Flow

### Creating a New Entry

1. User opens entry form
2. Sees blue info banner: "You can create or update log entries for today and the last 2 days..."
3. Date picker shows `min` and `max` dates (2 days ago to today)
4. Browsers prevent manual selection of invalid dates
5. If user somehow enters invalid date, red error appears immediately
6. Submit button disabled until valid date selected
7. On submit, server-side validation double-checks date validity

### Editing an Existing Entry

1. User clicks on a calendar date with an entry
2. If entry is within 2-day window:
   - "Edit" button is enabled
   - User can modify entry
3. If entry is older than 2 days:
   - "Edit" button is disabled with tooltip
   - Entry shown in read-only mode
   - Past entries have visual indication (dashed border, faded)

### Attempting to Delete

1. User views any entry
2. "Delete" button always shows as "Delete (Disabled)"
3. Tooltip explains: "Deleting entries is not allowed due to data retention policy"
4. Button is greyed out and cursor shows `not-allowed`
5. If deletion is somehow attempted, backend throws error

## Error Messages

### Creation Errors

```
"Cannot create entries for future dates"
"Cannot create entries older than 2 days. This date is X days old."
```

### Update Errors

```
"Cannot update entries to future dates"
"Cannot update entries older than 2 days. This date is X days old."
```

### Deletion Errors

```
"Deleting entries is not allowed. Data retention policy requires all entries to be preserved."
```

## Timezone Considerations

- All dates use `YYYY-MM-DD` format
- Date calculations use local timezone via `new Date().toISOString().split('T')[0]`
- Consistent across all components
- No timezone conversion issues

## Testing Scenarios

### Test Case 1: Create Entry for Today
- **Input**: Today's date
- **Expected**: Success ✅
- **Validation**: `canCreateEntryForDate()` returns `{ isValid: true }`

### Test Case 2: Create Entry for Yesterday
- **Input**: 1 day ago
- **Expected**: Success ✅
- **Validation**: Date within allowed range

### Test Case 3: Create Entry for 2 Days Ago
- **Input**: 2 days ago
- **Expected**: Success ✅
- **Validation**: Exactly at minimum boundary

### Test Case 4: Create Entry for 3 Days Ago
- **Input**: 3 days ago
- **Expected**: Failure ❌
- **Error**: "Cannot create entries older than 2 days. This date is 3 days old."

### Test Case 5: Create Entry for Tomorrow
- **Input**: 1 day in future
- **Expected**: Failure ❌
- **Error**: "Cannot create entries for future dates"

### Test Case 6: Update Entry from 1 Day Ago
- **Input**: Update entry dated yesterday
- **Expected**: Success ✅
- **Validation**: Within 2-day window

### Test Case 7: Update Entry from 5 Days Ago
- **Input**: Update entry dated 5 days ago
- **Expected**: Failure ❌
- **Error**: "Cannot update entries older than 2 days. This date is 5 days old."

### Test Case 8: Delete Any Entry
- **Input**: Attempt to delete any entry
- **Expected**: Failure ❌
- **Error**: "Deleting entries is not allowed. Data retention policy requires all entries to be preserved."

## Benefits

### 1. **Data Integrity**
- Prevents retroactive data manipulation
- Maintains audit trail
- Ensures recent data accuracy

### 2. **Compliance**
- Enforces data retention policies
- Prevents unauthorized deletions
- Creates immutable historical record

### 3. **User Experience**
- Clear visual indicators
- Helpful error messages
- Predictable behavior
- Prevents user mistakes

### 4. **Performance**
- Client-side validation reduces API calls
- Quick feedback to users
- Optimistic UI updates

## Future Enhancements

Potential improvements:

1. **Configurable Window**: Allow admins to configure the 2-day window
2. **Role-Based Exceptions**: Allow admins to edit/delete any entry
3. **Archive System**: Move old entries to archive instead of deletion
4. **Audit Log**: Track all attempts to modify/delete entries
5. **Batch Operations**: Bulk export of old entries for compliance

## Code Maintainability

### Single Source of Truth
- All date logic centralized in `/lib/date-restrictions.ts`
- Easy to modify business rules in one place
- Consistent behavior across application

### Type Safety
- TypeScript interfaces ensure correct usage
- Return types clearly indicate success/failure
- Compile-time error checking

### Documentation
- Comprehensive JSDoc comments
- Clear function names
- Self-documenting code

## Summary

The date restrictions system provides a robust, industrial-level solution for managing log entry lifecycles. It balances user flexibility (recent entries) with data protection (historical entries), while enforcing organizational policies (no deletion). The multi-layered validation (UI + backend) ensures data integrity at all times.
