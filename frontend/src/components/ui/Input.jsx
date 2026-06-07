import { forwardRef, useState } from 'react';

const Input = forwardRef(function Input({ label, error, type = 'text', className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType  = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-on-muted">{label}</label>}
      <div className="relative">
        <input
          ref={ref}
          type={inputType}
          className={`w-full px-4 py-3 bg-white border ${error ? 'border-error' : 'border-outline'} rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all pr-${isPassword ? '10' : '4'} ${className}`}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-muted hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined text-xl">{show ? 'visibility_off' : 'visibility'}</span>
          </button>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
});

export default Input;
