"use client";
import { useState } from "react";
import { COUNTRIES } from "@/app/lib/countries";
import InfoPanel from "@/app/components/ui/InfoPanel";

import { UseUpdateProfileReturn } from "@/app/lib/hooks/useUpdateProfile";

interface ProfileFormProps {
  profile: UseUpdateProfileReturn; 
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { form, setForm, error, success, submitting, handleSubmit } = profile;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-field">
        <label className="auth-label">Email</label>
        <input
          className="auth-input"
          type="email"
          name="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-label">Display Name:</label>
        <div className="auth-group">
          <input
            className="auth-input"
            type="text"
            name="display-name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Display"
            required
          />
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="house-btn"
            type="button"
          >
            {!showInfo ? "?" : "x"}
          </button>
        </div>
        {showInfo && <InfoPanel />}
      </div>

      <div className="auth-field">
        <label className="auth-label">Country</label>
        <select
          className="auth-input"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}

      <button
        type="submit"
        className="btn btn-primary auth-submit"
        disabled={submitting}
      >
        {submitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
