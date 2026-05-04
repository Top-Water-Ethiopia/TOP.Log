import { supabase } from './supabase-client';
import * as supabaseData from './supabase-data';

/**
 * Simple test function to verify Supabase connection
 * Run this after setting up your Supabase credentials
 */
export async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase.from('roles').select('count');
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return {
        success: false,
        message: error.message,
        error
      };
    }
    
    console.log('✅ Connection successful!', data);
    return {
      success: true,
      message: 'Connection successful',
      data
    };
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      error
    };
  }
}

/**
 * Create sample test data in Supabase
 * @param userId The authenticated user ID
 */
export async function createSampleData(userId: string) {
  console.log('Creating sample data for user:', userId);
  
  try {
    // Create a few sample entries
    const dates = ['2025-11-01', '2025-11-05', '2025-11-10'];
    const entries = [];
    
    for (const date of dates) {
      const entry = await supabaseData.createEntry({
        user_id: userId,
        date,
        metadata: {
          sample: true,
          note: `Sample entry for ${date}`,
        },
      });
      
      entries.push(entry);
      
      // Create some custom responses for this entry
      if (date === '2025-11-10') {
        await supabaseData.createCustomResponse({
          entry_id: entry.id,
          question_id: 'q1',
          question_key: 'dailyRating',
          question_label: 'How was your day?',
          question_type: 'select',
          value: 'Productive',
          timestamp: new Date().toISOString()
        });
        
        await supabaseData.createCustomResponse({
          entry_id: entry.id,
          question_id: 'q2',
          question_key: 'learnings',
          question_label: 'What did you learn today?',
          question_type: 'textarea',
          value: 'Learned how to integrate Supabase with Next.js',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log('✅ Sample data created successfully:', entries.length, 'entries');
    return {
      success: true,
      message: `Created ${entries.length} sample entries`,
      entries
    };
  } catch (error) {
    console.error('❌ Failed to create sample data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create sample data',
      error
    };
  }
}

/**
 * Clean up sample test data in Supabase
 * @param userId The authenticated user ID
 */
export async function cleanupSampleData(userId: string) {
  console.log('Cleaning up sample data for user:', userId);
  
  try {
    // Get all entries for this user
    const entries = await supabaseData.getEntriesByUserId(userId);
    
    // Delete each entry
    for (const entry of entries) {
      await supabaseData.deleteEntry(entry.id);
    }
    
    console.log('✅ Sample data cleaned up successfully:', entries.length, 'entries deleted');
    return {
      success: true,
      message: `Deleted ${entries.length} sample entries`,
      count: entries.length
    };
  } catch (error) {
    console.error('❌ Failed to clean up sample data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clean up sample data',
      error
    };
  }
}
