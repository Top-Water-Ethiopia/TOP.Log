#!/usr/bin/env node

/**
 * Script to verify the super admin dashboard access functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying super admin dashboard access...\n');

// Check supabase-nav.tsx
const supabaseNavPath = path.join(__dirname, '..', 'components', 'supabase-nav.tsx');
const supabaseNavContent = fs.readFileSync(supabaseNavPath, 'utf8');

const hasSuperAdminCheck = supabaseNavContent.includes('const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID');
const hasSuperAdminDashboardLink = supabaseNavContent.includes('isSuperAdmin && (') && supabaseNavContent.includes('LayoutDashboard');
const hasLayoutDashboardImport = supabaseNavContent.includes('LayoutDashboard');

console.log('=== Supabase Navigation Component ===');
console.log('✅ Super admin check implemented:', hasSuperAdminCheck);
console.log('✅ Super admin dashboard link:', hasSuperAdminDashboardLink);
console.log('✅ LayoutDashboard icon imported:', hasLayoutDashboardImport);

// Check main-layout-updated.tsx
const mainLayoutUpdatedPath = path.join(__dirname, '..', 'components', 'main-layout-updated.tsx');
const mainLayoutUpdatedContent = fs.readFileSync(mainLayoutUpdatedPath, 'utf8');

const hasSuperAdminCheckMain = mainLayoutUpdatedContent.includes('const isSuperAdmin = profile?.role_id === SUPER_ADMIN_ROLE_ID');
const hasAdminAccessForSuperAdmin = mainLayoutUpdatedContent.includes('(canAccessAdmin || isSuperAdmin) && (');

console.log('\n=== Main Layout Updated Component ===');
console.log('✅ Super admin check implemented:', hasSuperAdminCheckMain);
console.log('✅ Admin access for super admin:', hasAdminAccessForSuperAdmin);

// Check main-layout.tsx
const mainLayoutPath = path.join(__dirname, '..', 'components', 'main-layout.tsx');
const mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf8');

const hasSuperAdminCheckMainLayout = mainLayoutContent.includes('const isSuperAdmin = supabaseProfile?.role_id === SUPER_ADMIN_ROLE_ID');
const hasAdminAccessForSuperAdminMainLayout = mainLayoutContent.includes('(canAccessAdmin || isSuperAdmin) && (');

console.log('\n=== Main Layout Component ===');
console.log('✅ Super admin check implemented:', hasSuperAdminCheckMainLayout);
console.log('✅ Admin access for super admin:', hasAdminAccessForSuperAdminMainLayout);

// Overall verification
const allChecksPassed = 
  hasSuperAdminCheck && hasSuperAdminDashboardLink && hasLayoutDashboardImport &&
  hasSuperAdminCheckMain && hasAdminAccessForSuperAdmin &&
  hasSuperAdminCheckMainLayout && hasAdminAccessForSuperAdminMainLayout;

if (allChecksPassed) {
  console.log('\n🎉 All super admin dashboard access checks passed!');
  console.log('Super admins will now see the dashboard button in the navigation menu.');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed!');
  console.log('Please review the implementation.');
  process.exit(1);
}