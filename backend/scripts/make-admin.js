'use strict';
/**
 * CLI tool to promote or demote a user's role.
 *
 * Usage:
 *   node backend/scripts/make-admin.js promote your@email.com
 *   node backend/scripts/make-admin.js demote  your@email.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const [,, action, email] = process.argv;

if (!['promote', 'demote'].includes(action) || !email) {
  console.error('Usage: node backend/scripts/make-admin.js <promote|demote> <email>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  // Find the user
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) { console.error('❌ Cannot list users:', error.message); process.exit(1); }

  const user = data.users.find(u => u.email === email);
  if (!user) { console.error(`❌ No user found with email: ${email}`); process.exit(1); }

  const newRole = action === 'promote' ? 'admin' : 'student';
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: newRole },
  });
  if (updateErr) { console.error('❌ Update failed:', updateErr.message); process.exit(1); }

  const emoji = action === 'promote' ? '✅' : '🔄';
  console.log(`${emoji} ${email} → role: ${newRole}`);
  console.log('   The user must sign out and sign back in for the change to take effect.');
}

run();
