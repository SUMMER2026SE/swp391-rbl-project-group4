'use strict';

// Build frozen passage snapshots for bank questions being "taken out" (imported
// into a quiz/exam/mock or copied bank→bank). A snapshot freezes the passage
// content onto the destination question so it survives edits/deletes of the source.
//
// Snapshot shape:
//   { kind:'reading'|'listening', title, content?, image_url?, audio_url?, transcript?, description?, duration_sec? }

const { supabaseAdmin } = require('../config/supabase');

const READING_COLS   = 'id, title, content, image_url';
const LISTENING_COLS = 'id, title, audio_url, transcript, description, duration_sec';

const readingSnap = (p) => ({
  kind: 'reading',
  title: p.title || null,
  content: p.content || null,
  image_url: p.image_url || null,
});

const listeningSnap = (p) => ({
  kind: 'listening',
  title: p.title || null,
  audio_url: p.audio_url || null,
  transcript: p.transcript || null,
  description: p.description || null,
  duration_sec: p.duration_sec ?? null,
});

// Batch-resolve snapshots for a set of bank rows. Returns a getter `(row) => snapshot|null`.
// opts:
//   readingClient / readingTable   — where reading passages live (default public.reading_passages)
//   listeningClient                — where listening passages live (default public.listening_passages)
//                                    (teacher bank has no listening column → pass rows without listening_passage_id)
async function snapshotsForBankRows(rows, opts = {}) {
  const readingClient   = opts.readingClient   || supabaseAdmin;
  const readingTable    = opts.readingTable    || 'reading_passages';
  const listeningClient = opts.listeningClient || supabaseAdmin;

  const readingIds   = [...new Set(rows.filter(r => r.passage_id).map(r => r.passage_id))];
  const listeningIds = [...new Set(rows.filter(r => r.listening_passage_id).map(r => r.listening_passage_id))];

  const rMap = new Map();
  const lMap = new Map();

  if (readingIds.length) {
    const { data } = await readingClient.from(readingTable).select(READING_COLS).in('id', readingIds);
    (data || []).forEach(p => rMap.set(p.id, readingSnap(p)));
  }
  if (listeningIds.length) {
    const { data } = await listeningClient.from('listening_passages').select(LISTENING_COLS).in('id', listeningIds);
    (data || []).forEach(p => lMap.set(p.id, listeningSnap(p)));
  }

  return (row) =>
    (row.passage_id && rMap.get(row.passage_id)) ||
    (row.listening_passage_id && lMap.get(row.listening_passage_id)) ||
    null;
}

module.exports = { snapshotsForBankRows };
