interface Props {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

export default function Seg({ options, value, onChange }: Props) {
  return (
    <div className="seg">
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
