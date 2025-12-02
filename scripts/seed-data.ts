// scripts/seed-data.ts
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Role definitions
const ROLES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'admin',
    description: 'Administrator with full access'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'manager',
    description: 'Team manager with reporting access'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'developer',
    description: 'Software developer'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'designer',
    description: 'UI/UX Designer'
  }
];

// Report questions by role
const REPORT_QUESTIONS = {
  developer: [
    {
      question_key: 'tasks_completed',
      question_label: 'What tasks did you complete today?',
      question_type: 'text',
      question_category: 'work'
    },
    {
      question_key: 'blockers',
      question_label: 'What blockers are you facing?',
      question_type: 'text',
      question_category: 'challenges'
    }
  ],
  designer: [
    {
      question_key: 'designs_created',
      question_label: 'What designs did you work on today?',
      question_type: 'text',
      question_category: 'work'
    },
    {
      question_key: 'feedback',
      question_label: 'Any feedback received on your designs?',
      question_type: 'text',
      question_category: 'feedback'
    }
  ],
  manager: [
    {
      question_key: 'team_updates',
      question_label: 'Team updates for today:',
      question_type: 'text',
      question_category: 'updates'
    },
    {
      question_key: 'impediments',
      question_label: 'Any impediments to report?',
      question_type: 'text',
      question_category: 'challenges'
    }
  ]
};

// Create roles
async function seedRoles() {
  console.log('Seeding roles...');
  for (const role of ROLES) {
    const { error } = await supabase
      .from('roles')
      .upsert(role, { onConflict: 'id' });
    
    if (error) {
      console.error('Error seeding role:', role.name, error);
    } else {
      console.log('Seeded role:', role.name);
    }
  }
}

// Create users with profiles
async function seedUsers() {
  console.log('\nSeeding users...');
  const users = [
    // Admin
    {
      email: 'admin@example.com',
      password: 'admin123',
      profile: {
        name: 'Admin User',
        role_id: '00000000-0000-0000-0000-000000000001', // admin
        department: 'Management'
      }
    },
    // Manager
    {
      email: 'manager@example.com',
      password: 'manager123',
      profile: {
        name: 'Project Manager',
        role_id: '00000000-0000-0000-0000-000000000002', // manager
        department: 'Project Management'
      }
    },
    // Developers
    ...Array(3).fill(0).map((_, i) => ({
      email: `dev${i + 1}@example.com`,
      password: 'dev12345',
      profile: {
        name: `Developer ${i + 1}`,
        role_id: '00000000-0000-0000-0000-000000000003', // developer
        department: 'Engineering'
      }
    })),
    // Designers
    ...Array(2).fill(0).map((_, i) => ({
      email: `designer${i + 1}@example.com`,
      password: 'design123',
      profile: {
        name: `Designer ${i + 1}`,
        role_id: '00000000-0000-0000-0000-000000000004', // designer
        department: 'Design'
      }
    }))
  ];

  for (const user of users) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.email)
        .maybeSingle();

      if (!existingUser) {
        // Create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        });

        if (authError) throw authError;

        // Create profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: authUser.user.id,
            name: user.profile.name,
            role_id: user.profile.role_id,
            department: user.profile.department,
            is_active: true
          }, { onConflict: 'user_id' });

        if (profileError) throw profileError;

        console.log(`✅ Created user: ${user.email} (${user.profile.name})`);
      } else {
        console.log(`ℹ️  User already exists: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error creating user ${user.email}:`, error);
    }
  }
}

// Create report questions
async function seedReportQuestions() {
  console.log('\nSeeding report questions...');
  for (const [roleName, questions] of Object.entries(REPORT_QUESTIONS)) {
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError || !role) {
      console.error(`Role not found: ${roleName}`, roleError);
      continue;
    }

    // Note: role_questions seeding removed as report_questions table has been deleted
    console.log(`ℹ️  Skipping question seeding for ${roleName} (table removed)`);
  }
}

// Update the main function
async function main() {
  console.log('🚀 Starting database seeding...\n');
  
  try {
    // Run the seeders
    await seedRoles();
    await seedUsers();
    // Note: seedReportQuestions skipped as report_questions table has been deleted
    console.log('ℹ️  Skipped report questions seeding (table removed)');
    
    console.log('\n✨ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during database seeding:', error);
    process.exit(1);
  }
}

main();
