// Mock Vite environment variables
declare namespace NodeJS {
  interface ImportMetaEnv {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    // Add other environment variables as needed
  }
}
