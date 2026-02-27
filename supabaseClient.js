import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ezsqpiwzcuczgqdqyuqx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6c3FwaXd6Y3VjemdxZHF5dXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzcwMzAsImV4cCI6MjA4Nzc1MzAzMH0.3xYPeMNkPx9fU8rXqpTRvJGqReSw3AYKk6uxZkMDTJE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
