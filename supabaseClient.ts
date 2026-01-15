import { createClient } from '@supabase/supabase-js';

// Menggunakan kredensial langsung untuk memastikan koneksi stabil di browser
const SUPABASE_URL = 'https://jvwwazeuxmisehplhmtl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3dhemV1eG1pc2VocGxobXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODM2NjUsImV4cCI6MjA4NDA1OTY2NX0.72ydk1kZOO_WnQthfHKyuFZHJwmxk0Zi4kOWjkYLzy0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);