export default function Button({ children, variant = 'primary', size = 'md', loading, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed';
  const sizes  = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3 text-sm', lg: 'px-8 py-4 text-base' };
  const variants = {
    primary:   'bg-tsubaki-red text-white shadow-sm hover:bg-primary',
    secondary: 'bg-surface-low text-charcoal border border-outline hover:bg-outline/30',
    danger:    'bg-error text-white hover:opacity-90',
    ghost:     'text-on-muted hover:bg-surface-low',
    purple:    'bg-sumire-purple text-white hover:opacity-90',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
      {children}
    </button>
  );
}
