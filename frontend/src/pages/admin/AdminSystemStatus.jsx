import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const AUTO_REFRESH_S = 30;

// ── helpers ──────────────────────────────────────────────────────────────────
function latencyColor(ms) {
  if (ms == null) return 'text-on-muted';
  if (ms < 100)  return 'text-emerald-600';
  if (ms < 500)  return 'text-amber-500';
  return 'text-red-500';
}
function latencyBg(ms) {
  if (ms == null) return 'bg-surface-low';
  if (ms < 100)  return 'bg-emerald-50';
  if (ms < 500)  return 'bg-amber-50';
  return 'bg-red-50';
}

// ── status dot ───────────────────────────────────────────────────────────────
function StatusDot({ ok, pulse }) {
  const color = ok == null ? 'bg-surface-low' : ok ? 'bg-emerald-500' : 'bg-red-500';
  return (
    <span className="relative inline-flex h-3 w-3">
      {ok && pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
  );
}

// ── single service card ───────────────────────────────────────────────────────
function ServiceCard({ icon, label, data, loading, rows }) {
  const ok = loading ? null : data?.ok;
  const latency = data?.latency;

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${
      loading ? 'border-outline bg-white' :
      ok ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'
    }`}>
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            loading ? 'bg-surface-low' : ok ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            <span className={`material-symbols-outlined text-[20px] ${
              loading ? 'text-on-muted' : ok ? 'text-emerald-600' : 'text-red-500'
            }`}>{icon}</span>
          </div>
          <span className="font-semibold text-sm text-charcoal">{label}</span>
        </div>
        {loading
          ? <span className="w-3 h-3 rounded-full bg-surface-low animate-pulse" />
          : <StatusDot ok={ok} pulse />
        }
      </div>

      {/* status + latency */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          loading ? 'bg-surface-low text-on-muted' :
          ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        }`}>
          {loading ? '...' : ok ? 'Online' : 'Offline'}
        </span>
        {latency != null && (
          <span className={`text-xs font-mono font-semibold ${latencyColor(latency)}`}>
            {latency} ms
          </span>
        )}
      </div>

      {/* detail rows */}
      {!loading && rows && (
        <div className="space-y-1.5 border-t border-outline/20 pt-3 mt-3">
          {rows.map(([k, v]) => v != null && (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-on-muted">{k}</span>
              <span className="font-medium text-charcoal text-right ml-4 truncate max-w-[140px]">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* error */}
      {!loading && !ok && data?.error && (
        <p className="mt-2 text-xs text-red-500 break-all">{data.error}</p>
      )}
    </div>
  );
}

// ── latency bar ───────────────────────────────────────────────────────────────
function LatencyBar({ label, ms }) {
  const max = 1000;
  const pct = ms != null ? Math.min((ms / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-on-muted w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface-low rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            ms == null ? '' : ms < 100 ? 'bg-emerald-400' : ms < 500 ? 'bg-amber-400' : 'bg-red-400'
          }`}
          style={{ width: pct + '%' }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-14 text-right ${latencyColor(ms)}`}>
        {ms != null ? ms + ' ms' : '—'}
      </span>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function AdminSystemStatus() {
  const [status, setStatus]       = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastCheck, setLastCheck]     = useState(null);
  const [countdown, setCountdown]     = useState(AUTO_REFRESH_S);

  const check = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [r, pingLatency] = await Promise.all([
        api.get('/admin/system-status'),
        (async () => {
          const t = performance.now();
          await api.get('/health');
          return Math.round(performance.now() - t);
        })(),
      ]);
      setStatus({ ...r.data, frontend: { ok: true, latency: pingLatency } });
      setLastCheck(new Date());
      setCountdown(AUTO_REFRESH_S);
    } catch (e) {
      setStatus(prev => ({ ...prev, error: e.message }));
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  // initial + auto-refresh
  useEffect(() => { check(); }, [check]);
  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { check(); return AUTO_REFRESH_S; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [check]);

  const loading = initialLoad;
  const allOk = status && !status.error &&
    status.backend?.ok && status.database?.ok && status.ai?.ok && status.frontend?.ok;

  return (
    <AdminLayout title="Hoạt động hệ thống">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            Hoạt động hệ thống
            {!loading && (
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-0.5 rounded-full ml-1 ${
                allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                <StatusDot ok={allOk} pulse={allOk} />
                {allOk ? 'Tất cả hoạt động' : 'Có sự cố'}
              </span>
            )}
          </h1>
          {lastCheck && (
            <p className="text-sm text-on-muted mt-0.5">
              Cập nhật lúc {lastCheck.toLocaleTimeString('vi-VN')}
              {' · '}làm mới sau <span className="font-mono">{countdown}s</span>
            </p>
          )}
        </div>
        <button onClick={() => check(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline text-sm font-medium hover:bg-surface-low transition-colors disabled:opacity-50">
          <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
          Làm mới
        </button>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ServiceCard
          icon="dns" label="Backend"
          data={status?.backend} loading={loading}
          rows={[
            ['Uptime',    status?.backend?.uptimeLabel],
            ['Node.js',   status?.backend?.nodeVersion],
            ['RAM (RSS)', status?.backend?.memoryMB != null ? status.backend.memoryMB + ' MB' : null],
            ['Heap',      status?.backend?.heapMB    != null ? status.backend.heapMB    + ' MB' : null],
          ]}
        />
        <ServiceCard
          icon="storage" label="Database"
          data={status?.database} loading={loading}
          rows={[
            ['Provider',  'Supabase PostgreSQL'],
            ['Từ vựng',   status?.database?.vocabCount != null ? status.database.vocabCount + ' bản ghi' : null],
            ['Kanji',     status?.database?.kanjiCount != null ? status.database.kanjiCount + ' bản ghi' : null],
          ]}
        />
        <ServiceCard
          icon="smart_toy" label="AI API"
          data={status?.ai} loading={loading}
          rows={[
            ['Provider',  'FPT AI Factory'],
            ['Model',     status?.ai?.model],
            ['Endpoint',  'mkp-api.fptcloud.com'],
          ]}
        />
        <ServiceCard
          icon="web" label="Frontend"
          data={status?.frontend} loading={loading}
          rows={[
            ['Framework', 'React + Vite'],
            ['Round-trip', status?.frontend?.latency != null ? status.frontend.latency + ' ms' : null],
          ]}
        />
      </div>

      {/* Latency chart */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-tsubaki-red">speed</span>
          Độ trễ dịch vụ
        </h2>
        <div className="space-y-3">
          <LatencyBar label="Backend"  ms={loading ? null : status?.backend?.latency} />
          <LatencyBar label="Database" ms={loading ? null : status?.database?.latency} />
          <LatencyBar label="AI API"   ms={loading ? null : status?.ai?.latency} />
          <LatencyBar label="Frontend" ms={loading ? null : status?.frontend?.latency} />
        </div>
        <div className="flex gap-4 mt-4 pt-3 border-t border-outline/20">
          {[['bg-emerald-400','< 100ms Tốt'], ['bg-amber-400','100–500ms Chậm'], ['bg-red-400','> 500ms Kém']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-on-muted">
              <span className={`w-2.5 h-2.5 rounded-full ${c}`} />
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* System info table */}
      {!loading && status?.backend && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-display font-bold text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-tsubaki-red">info</span>
            Thông tin hệ thống
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              ['Node.js version', status.backend.nodeVersion],
              ['Uptime',          status.backend.uptimeLabel],
              ['Memory (RSS)',    status.backend.memoryMB + ' MB'],
              ['Heap used',       status.backend.heapMB + ' MB'],
              ['AI model',        status.ai?.model || '—'],
              ['DB provider',     'Supabase PostgreSQL'],
              ['Từ vựng DB',      (status.database?.vocabCount ?? '—') + ' bản ghi'],
              ['Kanji DB',        (status.database?.kanjiCount ?? '—') + ' bản ghi'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-outline/10">
                <span className="text-on-muted">{k}</span>
                <span className="font-mono font-medium text-charcoal">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
