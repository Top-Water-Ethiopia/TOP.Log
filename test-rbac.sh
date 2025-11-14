#!/bin/bash

# RBAC Implementation Test Script
# This script tests the basic functionality of the RBAC system

echo "🔐 RBAC Implementation Test"
echo "=========================="

# Test 1: Check if all required files exist
echo "📁 Checking file structure..."

required_files=(
    "lib/rbac/types.ts"
    "lib/rbac/utils.ts"
    "contexts/auth-context.tsx"
    "hooks/use-rbac.tsx"
    "components/auth-dialog.tsx"
    "components/user-profile-dialog.tsx"
    "components/user-management-dialog.tsx"
    "RBAC_DOCUMENTATION.md"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All required files are present"
else
    echo "❌ Missing files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

# Test 2: Check if TypeScript compilation succeeds
echo "🔍 Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    echo "Run 'npm run build' to see the errors"
    exit 1
fi

# Test 3: Check if development server starts
echo "🚀 Checking development server..."
if npm run dev > /dev/null 2>&1 &
then
    sleep 3
    if curl -s http://localhost:3001 > /dev/null; then
        echo "✅ Development server is running"
        pkill -f "next dev"
    else
        echo "❌ Development server failed to start"
        exit 1
    fi
else
    echo "❌ Failed to start development server"
    exit 1
fi

# Test 4: Check imports in main files
echo "📦 Checking imports..."

# Check if main app imports AuthProvider
if grep -q "AuthProvider" app/page.tsx; then
    echo "✅ AuthProvider imported in main app"
else
    echo "❌ AuthProvider not imported in main app"
    exit 1
fi

# Check if main layout uses auth hooks
if grep -q "useAuth\|useRBAC" components/main-layout.tsx; then
    echo "✅ Auth hooks used in main layout"
else
    echo "❌ Auth hooks not used in main layout"
    exit 1
fi

# Test 5: Check RBAC protection in captain-log-context
echo "🔒 Checking RBAC protection..."
if grep -q "isAuthenticated\|canPerformAction" contexts/captain-log-context.tsx; then
    echo "✅ RBAC protection added to captain-log-context"
else
    echo "❌ RBAC protection not found in captain-log-context"
    exit 1
fi

# Test 6: Check default admin user configuration
echo "👤 Checking default admin user..."
if grep -q "admin@captains-log.local" lib/rbac/types.ts; then
    echo "✅ Default admin user configured"
else
    echo "❌ Default admin user not found"
    exit 1
fi

# Test 7: Check role definitions
echo "🛡️ Checking role definitions..."
role_count=$(grep -c "name: \"admin\"\|name: \"manager\"\|name: \"user\"\|name: \"viewer\"" lib/rbac/types.ts)
if [ $role_count -eq 4 ]; then
    echo "✅ All four default roles defined"
else
    echo "❌ Expected 4 roles, found $role_count"
    exit 1
fi

echo ""
echo "🎉 All RBAC implementation tests passed!"
echo ""
echo "📋 Next Steps:"
echo "   1. Start the development server: npm run dev"
echo "   2. Open http://localhost:3001 in your browser"
echo "   3. Click 'Login' to access the authentication dialog"
echo "   4. Use default admin credentials: admin@captains-log.local / admin123"
echo "   5. Test different user roles and permissions"
echo ""
echo "📚 For detailed documentation, see: RBAC_DOCUMENTATION.md"
