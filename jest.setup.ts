// eslint-disable-next-line @typescript-eslint/no-var-requires
require("@testing-library/jest-dom");

// Provide dummy Supabase env vars for tests so client initialization does not throw
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
