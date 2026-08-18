interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export default function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? "var(--accent)" : "var(--border-strong)" }}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: checked ? "21px" : "3px" }}
      />
    </button>
  );
}
