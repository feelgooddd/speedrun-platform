import { TimeParts } from "@/app/lib/types/submission";
import React from "react";

interface TimeInputGroupProps {
  label: string;
  parts: TimeParts;
  setParts: (parts: TimeParts | ((prev: TimeParts) => TimeParts)) => void;
  disabled?: boolean;
}

const timeFieldConfig: Record<
  keyof TimeParts,
  { placeholder: string; max: number }
> = {
  h: { placeholder: "HH", max: 9999 },
  m: { placeholder: "MM", max: 59 },
  s: { placeholder: "SS", max: 59 },
  ms: { placeholder: "MS", max: 999 },
};

export default function TimeInputGroup({
  label,
  parts,
  setParts,
  disabled = false,
}: TimeInputGroupProps) {
  const handleChange = (key: keyof TimeParts, value: string) => {
    const num = Number(value);
    const max = timeFieldConfig[key].max;
    if (value !== "" && num > max) {
      setParts((prev) => ({ ...prev, [key]: String(max) }));
    } else {
      setParts((prev) => ({ ...prev, [key]: value }));
    }
  };
  const handleBlur = (key: keyof TimeParts, value: string) => {
    const num = Number(value);
    const max = timeFieldConfig[key].max;
    if (value === "") return;
    const clamped = Math.min(Math.max(num, 0), max);
    setParts((prev) => ({ ...prev, [key]: String(clamped) }));
  };

  return (
    <div
      className="form-group"
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <label className="form-label">{label}</label>
      <div className="time-input-group">
        {(Object.keys(timeFieldConfig) as (keyof TimeParts)[]).map(
          (key, i, arr) => (
            <React.Fragment key={key}>
              <input
                type="number"
                placeholder={timeFieldConfig[key].placeholder}
                value={parts[key]}
                min={0}
                max={timeFieldConfig[key].max}
                onChange={(e) => handleChange(key, e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onBlur={(e) => handleBlur(key, e.target.value)}
                className="auth-input"
              />
              {i < arr.length - 1 && (
                <span className="time-separator">{i === 2 ? "." : ":"}</span>
              )}
            </React.Fragment>
          ),
        )}
      </div>
    </div>
  );
}
