// @/app/components/submit/TimeInputGroup.tsx
import { TimeParts } from "@/app/lib/types/submission";

interface TimeInputGroupProps {
  label: string;
  parts: TimeParts;
  setParts: (parts: TimeParts | ((prev: TimeParts) => TimeParts)) => void;
  disabled?: boolean;
}

export default function TimeInputGroup({ label, parts, setParts, disabled = false }: TimeInputGroupProps) {
  const handleChange = (key: keyof TimeParts, value: string) => {
    setParts((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="form-group" style={{ opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <label className="form-label">{label}</label>
      <div className="time-input-group">
        <input type="number" placeholder="HH" value={parts.h} onChange={(e) => handleChange('h', e.target.value)} className="auth-input" />
        <span className="time-separator">:</span>
        <input type="number" placeholder="MM" value={parts.m} onChange={(e) => handleChange('m', e.target.value)} className="auth-input" />
        <span className="time-separator">:</span>
        <input type="number" placeholder="SS" value={parts.s} onChange={(e) => handleChange('s', e.target.value)} className="auth-input" />
        <span className="time-separator">.</span>
        <input type="number" placeholder="MS" value={parts.ms} onChange={(e) => handleChange('ms', e.target.value)} className="auth-input" />
      </div>
    </div>
  );
}