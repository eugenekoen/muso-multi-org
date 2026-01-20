/**
 * Supabase Client Configuration
 * Initializes the Supabase client for the application
 */

const SUPABASE_URL = 'https://xikllcuwvyuqcvcjjimw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2xsY3V3dnl1cWN2Y2pqaW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjkyMTYsImV4cCI6MjA4NDQ0NTIxNn0.DqAsJ2BXAzwnggId0nMihzfxN9UpslAUQzm-V5sgfWY';

let supabaseClient = null;

try
{
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized.");
} catch (e)
{
    console.error("Error initializing Supabase client:", e);
}

// Export for use in other modules
window.getSupabaseClient = function ()
{
    return supabaseClient;
};
