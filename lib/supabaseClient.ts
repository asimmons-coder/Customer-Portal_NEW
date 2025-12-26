import { createClient } from '@supabase/supabase-js';

// Securely read from Vercel/Next.js Environment Variables
// We use a safe check for 'process' to avoid ReferenceError in browser-only environments.
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://nbwwqreqmxakevkwzmij.supabase.co';
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id3dxcmVxbXhha2V2a3d6bWlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTY2OTUsImV4cCI6MjA4MDk5MjY5NX0.Xd0bdoQHW9oJLznRC6JC7kLevjB5Wh0hYOpRKVPjIq8';

// Initialize the Supabase client with increased row limit
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'boon-dashboard' },
  },
});