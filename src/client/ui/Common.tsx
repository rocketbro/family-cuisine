// Small shared pieces: segmented control, loading and error states.
import type { ReactNode } from 'react';

export function Segmented<T extends string | number>({ options, value, onChange, label, tight, disabled }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Many short options on one line. */
  tight?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={tight ? 'segmented tight' : 'segmented'} role="group" aria-label={label}>
      {options.map(option => (
        <button key={String(option.value)} type="button" disabled={disabled} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return <p className="faint italic loading" style={{ marginTop: 40, textAlign: 'center' }}>One moment…</p>;
}

export function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="stack" style={{ marginTop: 24 }}>
      <p className="error">{message}</p>
      {onRetry && <button className="button quiet" onClick={onRetry}>Try again</button>}
    </div>
  );
}
