'use strict';

const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
}

// For auth (signUp, signIn) — public anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// For server-side DB operations — bypass RLS
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

// updateUserById GHI ĐÈ toàn bộ user_metadata — helper này đọc metadata hiện tại
// rồi merge patch vào, tránh làm mất role/full_name/avatar_url.
async function updateUserMetadata(userId, patch) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) return { data: null, error };
  return supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { ...data.user.user_metadata, ...patch },
  });
}

module.exports = { supabase, supabaseAdmin, updateUserMetadata };
