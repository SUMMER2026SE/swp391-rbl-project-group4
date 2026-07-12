'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Log a "student used a teacher's content" event for revenue attribution.
// Fire-and-forget, deduped to one row per (student, content, day) via a unique index.
// Only teacher-created content counts; the owner's own views are ignored.
//
//   logContentUse({ userId, contentType, contentId, creatorType, ownerId })
async function logContentUse({ userId, contentType, contentId, creatorType, ownerId }) {
  try {
    if (!userId || !contentId) return;              // must be authenticated + real content
    if (creatorType !== 'teacher' || !ownerId) return; // admin content → not in the pool
    if (userId === ownerId) return;                 // don't count the author's own views

    const now = new Date();
    const period_key = now.toISOString().slice(0, 7);  // YYYY-MM
    const day_key    = now.toISOString().slice(0, 10); // YYYY-MM-DD

    await supabaseAdmin.from('content_usage_events').upsert(
      { student_id: userId, content_type: contentType, content_id: contentId, teacher_id: ownerId, period_key, day_key },
      { onConflict: 'student_id,content_type,content_id,day_key', ignoreDuplicates: true }
    );
  } catch (e) {
    console.error('logContentUse failed (non-critical):', e.message);
  }
}

module.exports = { logContentUse };
