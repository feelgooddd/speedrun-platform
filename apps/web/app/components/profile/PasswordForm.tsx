"use client";

import { UseChangePasswordReturn } from "@/app/lib/hooks/useChangePassword";

interface PasswordFormProps {
  security: UseChangePasswordReturn;
}

export function PasswordForm({ security }: PasswordFormProps) {
  const { pwForm, setPwForm, pwError, pwSuccess, pwLoading, handleChangePassword } = security;

  return (
    <div
      className="auth-form"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.1)",
        marginTop: "2rem",
        paddingTop: "2rem",
      }}
    >
      <h2 style={{ fontSize: "1rem", marginBottom: "1rem", opacity: 0.8 }}>
        Change Password
      </h2>
      <form onSubmit={handleChangePassword} className="auth-form">
        <div className="auth-field">
          <label className="auth-label">Current Password</label>
          <input
            className="auth-input"
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) =>
              setPwForm({ ...pwForm, currentPassword: e.target.value })
            }
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-label">New Password</label>
          <input
            className="auth-input"
            type="password"
            value={pwForm.newPassword}
            onChange={(e) =>
              setPwForm({ ...pwForm, newPassword: e.target.value })
            }
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-label">Confirm New Password</label>
          <input
            className="auth-input"
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) =>
              setPwForm({ ...pwForm, confirmPassword: e.target.value })
            }
            required
          />
        </div>
        
        {pwError && <p className="auth-error">{pwError}</p>}
        {pwSuccess && (
          <p className="auth-success">✓ Password updated successfully</p>
        )}
        
        <button
          type="submit"
          className="btn btn-primary auth-submit"
          disabled={pwLoading}
        >
          {pwLoading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}