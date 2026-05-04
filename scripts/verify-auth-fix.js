#!/usr/bin/env node

/**
 * Script to verify the authentication fix for the entry form
 * This script checks that the authentication checks are properly in place
 */

const fs = require('fs');
const path = require('path');

// Path to the entry form component
const entryFormPath = path.join(__dirname, '..', 'components', 'entry-form-multistep.tsx');

console.log('🔍 Verifying authentication fix in entry form...\n');

try {
  // Read the file content
  const content = fs.readFileSync(entryFormPath, 'utf8');
  
  // Check if the authentication check is present
  const hasAuthCheck = content.includes('if (!isAuthenticated || !user)') && 
                      content.includes('toast.error("Please sign in to submit logs.")');
  
  // Check if the useAuth import is present (both single and double quotes)
  const hasUseAuthImport = content.includes('import { useAuth } from "@/contexts/auth-context"') ||
                          content.includes("import { useAuth } from '@/contexts/auth-context'");
  
  // Check if the auth destructuring is present
  const hasAuthDestructuring = content.includes('const { isAuthenticated, user } = useAuth()');
  
  // Check if the authentication check is in the right place (before both addEntry and updateEntry)
  const lines = content.split('\n');
  let authCheckLine = -1;
  let addEntryLine = -1;
  let updateEntryLine = -1;
  
  lines.forEach((line, index) => {
    if (line.includes('if (!isAuthenticated || !user)')) authCheckLine = index;
    if (line.includes('await addEntry(')) addEntryLine = index;
    if (line.includes('await updateEntry(')) updateEntryLine = index;
  });
  
  const authCheckBeforeOperations = authCheckLine < addEntryLine && authCheckLine < updateEntryLine && authCheckLine !== -1;
  
  console.log('✅ Authentication check found:', hasAuthCheck);
  console.log('✅ useAuth import found:', hasUseAuthImport);
  console.log('✅ Auth destructuring found:', hasAuthDestructuring);
  console.log('✅ Auth check positioned correctly:', authCheckBeforeOperations);
  
  if (hasAuthCheck && hasUseAuthImport && hasAuthDestructuring && authCheckBeforeOperations) {
    console.log('\n🎉 All authentication fix checks passed!');
    console.log('The entry form now properly checks authentication before submitting entries.');
    process.exit(0);
  } else {
    console.log('\n❌ Some authentication fix checks failed!');
    console.log('Please review the entry form component.');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error verifying authentication fix:', error.message);
  process.exit(1);
}