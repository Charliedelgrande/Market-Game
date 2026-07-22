import type { CSSProperties } from 'react';

interface Props {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

export default function Seg({ options, value, onChange }: Props) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const style = { '--seg-n': options.length, '--seg-i': idx } as CSSProperties;
  return (
    <div className="seg" style={style}>
      <div className="seg-ind" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
