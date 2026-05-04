#!/usr/bin/env node

/**
 * Script to verify the spacing improvements on the login page
 */

const fs = require('fs');
const path = require('path');

// Path to the login page component
const loginPagePath = path.join(__dirname, '..', 'app', 'login', 'page.tsx');

console.log('🔍 Verifying login page spacing improvements...\n');

try {
  // Read the file content
  const content = fs.readFileSync(loginPagePath, 'utf8');
  
  // Check for the improved spacing classes
  const hasIncreasedPadding = content.includes('space-y-6') && content.includes('pt-4');
  const hasButtonStyling = content.includes('h-12') && content.includes('text-base');
  
  console.log('✅ Increased vertical spacing (space-y-6):', content.includes('space-y-6'));
  console.log('✅ Increased top padding (pt-4):', content.includes('pt-4'));
  console.log('✅ Button height styling (h-12):', content.includes('h-12'));
  console.log('✅ Button text size (text-base):', content.includes('text-base'));
  
  if (hasIncreasedPadding && hasButtonStyling) {
    console.log('\n🎉 All spacing improvements verified successfully!');
    console.log('The login page now has proper industrial padding space.');
    process.exit(0);
  } else {
    console.log('\n❌ Some spacing improvements are missing!');
    console.log('Please review the login page component.');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error verifying login page spacing:', error.message);
  process.exit(1);
}