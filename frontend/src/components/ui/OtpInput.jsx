import { useRef } from 'react';

export const OTP_LENGTH = 6;

// Ô nhập OTP 6 chữ số: tự nhảy ô, hỗ trợ dán, xóa lùi.
export default function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([]);

  const handleChange = (i, ch) => {
    const digit = ch.replace(/\D/g, '').slice(-1);
    const next = value.split('');
    next[i] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
    if (digit && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (digits) {
      onChange(digits);
      refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-bold border border-outline rounded-xl bg-white focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/20 outline-none transition-all disabled:opacity-50"
        />
      ))}
    </div>
  );
}
