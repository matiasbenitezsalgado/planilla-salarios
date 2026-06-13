const SUPABASE_URL = 'https://mmtrxzqippddgsjhzail.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdHJ4enFpcHBkZGdzamh6YWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzE1MTUsImV4cCI6MjA5NjkwNzUxNX0.JJlLhuX9Xg5c6rr0_qDpjfw7yBSNwr_Z0wiUDJBkRc8';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const IPS_OBRERO = 0.09;
const IPS_PATRONAL = 0.14;
