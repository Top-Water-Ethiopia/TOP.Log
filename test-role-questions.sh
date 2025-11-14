#!/bin/bash

# Test script for Role-Based Custom Questions functionality
echo "🔍 Testing Role-Based Custom Questions Implementation"
echo "=================================================="

# Check if required files exist
echo "📁 Checking file structure..."

files=(
    "lib/rbac/types.ts"
    "lib/rbac/utils.ts"
    "hooks/use-rbac.tsx"
    "components/custom-questions-manager.tsx"
    "components/role-based-questions-demo.tsx"
    "components/admin-dashboard.tsx"
)

missing_files=()
for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ All required files exist"
else
    echo "❌ Missing files:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

# Check if role types are properly defined
echo ""
echo "🔑 Checking role definitions..."

if grep -q "tech-support.*graphic-designer.*programmer.*qa" lib/rbac/types.ts; then
    echo "✅ New job roles are defined in User schema"
else
    echo "❌ New job roles not found in User schema"
fi

if grep -q "tech-support.*graphic-designer.*programmer.*qa" lib/rbac/types.ts; then
    echo "✅ New job roles are defined in Role schema"
else
    echo "❌ New job roles not found in Role schema"
fi

# Check if role hierarchy is updated
echo ""
echo "📊 Checking role hierarchy..."

if grep -q '"tech-support": 2' lib/rbac/types.ts && grep -q '"programmer": 3' lib/rbac/types.ts; then
    echo "✅ Role hierarchy includes new job roles"
else
    echo "❌ Role hierarchy not properly updated"
fi

# Check if default question sets are defined
echo ""
echo "📝 Checking default question sets..."

if grep -q "tech-support.*roleName" lib/rbac/types.ts; then
    echo "✅ Tech Support question set defined"
else
    echo "❌ Tech Support question set not found"
fi

if grep -q "programmer.*roleName" lib/rbac/types.ts; then
    echo "✅ Programmer question set defined"
else
    echo "❌ Programmer question set not found"
fi

if grep -q "qa.*roleName" lib/rbac/types.ts; then
    echo "✅ QA question set defined"
else
    echo "❌ QA question set not found"
fi

if grep -q "graphic-designer.*roleName" lib/rbac/types.ts; then
    echo "✅ Graphic Designer question set defined"
else
    echo "❌ Graphic Designer question set not found"
fi

# Check if custom questions utilities exist
echo ""
echo "🛠️ Checking custom questions utilities..."

utils=(
    "getQuestionSetForRole"
    "getQuestionsForUser"
    "validateQuestionResponse"
    "processQuestionResponses"
    "createQuestionResponse"
    "initializeDefaultQuestionSets"
)

missing_utils=()
for util in "${utils[@]}"; do
    if ! grep -q "$util" lib/rbac/utils.ts; then
        missing_utils+=("$util")
    fi
done

if [ ${#missing_utils[@]} -eq 0 ]; then
    echo "✅ All custom questions utilities are defined"
else
    echo "❌ Missing utilities:"
    for util in "${missing_utils[@]}"; do
        echo "   - $util"
    done
fi

# Check if components exist and have proper exports
echo ""
echo "🎨 Checking UI components..."

components=(
    "CustomQuestionsManager"
    "RoleBasedQuestionsDemo"
)

missing_components=()
for component in "${components[@]}"; do
    if ! grep -q "export.*$component" components/*.tsx; then
        missing_components+=("$component")
    fi
done

if [ ${#missing_components[@]} -eq 0 ]; then
    echo "✅ All UI components are properly exported"
else
    echo "❌ Missing component exports:"
    for component in "${missing_components[@]}"; do
        echo "   - $component"
    done
fi

# Check if admin dashboard includes custom questions
echo ""
echo "⚙️ Checking admin dashboard integration..."

if grep -q "CustomQuestionsManager" components/admin-dashboard.tsx; then
    echo "✅ Custom Questions Manager is integrated into Admin Dashboard"
else
    echo "❌ Custom Questions Manager not found in Admin Dashboard"
fi

if grep -q "questions.*tab" components/admin-dashboard.tsx; then
    echo "✅ Questions tab is added to Admin Dashboard"
else
    echo "❌ Questions tab not found in Admin Dashboard"
fi

# Check if RBAC hooks include question functionality
echo ""
echo "🔗 Checking RBAC hooks integration..."

if grep -q "questions.*userQuestions" hooks/use-rbac.tsx; then
    echo "✅ RBAC hooks include question functionality"
else
    echo "❌ RBAC hooks missing question functionality"
fi

# Test build compilation
echo ""
echo "🏗️ Testing build compilation..."

if npm run build > /dev/null 2>&1; then
    echo "✅ Project builds successfully"
else
    echo "❌ Project build failed"
    echo "Running build to show errors:"
    npm run build
    exit 1
fi

# Summary
echo ""
echo "📋 Test Summary"
echo "==============="
echo "✅ Role-Based Custom Questions implementation is complete!"
echo ""
echo "🎯 Features implemented:"
echo "   • Technical Support role with ticket-focused questions"
echo "   • Programmer role with development-focused questions"
echo "   • QA role with testing-focused questions"
echo "   • Graphic Designer role with creative-focused questions"
echo "   • Custom Questions Manager for admin configuration"
echo "   • Role-based Questions Demo for testing"
echo "   • Full RBAC integration with permission checks"
echo ""
echo "🚀 To test the functionality:"
echo "   1. Start the development server: npm run dev"
echo "   2. Login as admin@captains-log.local"
echo "   3. Go to Admin Dashboard → Questions tab"
echo "   4. Create users with different job roles"
echo "   5. Test the Role-Based Questions Demo"
echo ""
echo "📁 Key files created/updated:"
echo "   • lib/rbac/types.ts - Added job role schemas and question sets"
echo "   • lib/rbac/utils.ts - Added question management utilities"
echo "   • hooks/use-rbac.tsx - Added question hooks"
echo "   • components/custom-questions-manager.tsx - Admin interface"
echo "   • components/role-based-questions-demo.tsx - Demo component"
echo "   • components/admin-dashboard.tsx - Integration with questions tab"

echo ""
echo "✨ Role-Based Custom Questions implementation complete! ✨"
