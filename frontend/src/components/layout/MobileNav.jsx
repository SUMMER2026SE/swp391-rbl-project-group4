import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const PRIMARY_COUNT = 4;

function isActive(pathname, link) {
  return link.exact
    ? pathname === link.to
    : (pathname === link.to || pathname.startsWith(link.to + '/'));
}

export default function MobileNav({ links }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const primary = links.slice(0, PRIMARY_COUNT);
  const primaryActive = primary.some((l) => isActive(location.pathname, l));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-outline/30 h-16 flex justify-around items-center z-50">
        {primary.map((link) => {
          const active = isActive(location.pathname, link);
          return (
            <Link key={link.to} to={link.to}
              className={`flex flex-col items-center gap-0.5 transition-colors ${
                active ? 'text-tsubaki-red' : 'text-on-muted hover:text-tsubaki-red'
              }`}>
              <span className={`material-symbols-outlined text-xl ${active ? 'fill' : ''}`}>{link.icon}</span>
              <span className="text-[10px] font-bold">{link.label.split(' ')[0]}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)}
          className={`flex flex-col items-center gap-0.5 transition-colors ${
            !primaryActive ? 'text-tsubaki-red' : 'text-on-muted hover:text-tsubaki-red'
          }`}>
          <span className="material-symbols-outlined text-xl">menu</span>
          <span className="text-[10px] font-bold">Thêm</span>
        </button>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] overflow-y-auto p-4 pb-8"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-charcoal">Tất cả mục</span>
              <button onClick={() => setOpen(false)} className="text-on-muted hover:text-tsubaki-red transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {links.map((link) => {
                const active = isActive(location.pathname, link);
                return (
                  <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-3 text-center transition-colors ${
                      active ? 'bg-tsubaki-red/10 text-tsubaki-red' : 'text-on-muted hover:bg-surface-low'
                    }`}>
                    <span className={`material-symbols-outlined text-xl ${active ? 'fill' : ''}`}>{link.icon}</span>
                    <span className="text-[11px] font-medium leading-tight">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
