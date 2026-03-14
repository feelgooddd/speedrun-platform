"use client";
import { countryCodeToFlag } from "@/app/lib/flags";

interface RunVariable {
  variable: string;
  variable_slug: string;
  value: string;
  value_slug: string;
}

interface Runner {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

export interface QueueRun {
  id: string;
  is_coop: boolean;
  user: Runner | null;
  runners: Runner[] | null;
  game: string;
  game_slug: string;
  category: string;
  level: string | null;
  subcategory: string | null;
  variable_values: RunVariable[];
  platform: string;
  timing_method: string;
  realtime_ms: number | null;
  realtime_display: string | null;
  gametime_ms: number | null;
  gametime_display: string | null;
  video_url: string | null;
  submitted_at: string;
  comment: string | null;
}

interface AdminRunCardProps {
  run: QueueRun;
  rejectRunId: string | null;
  rejectReason: string;
  onVerify: (runId: string) => void;
  onRejectToggle: (runId: string) => void;
  onRejectReasonChange: (reason: string) => void;
  onRejectConfirm: (runId: string) => void;
}

export default function AdminRunCard({
  run,
  rejectRunId,
  rejectReason,
  onVerify,
  onRejectToggle,
  onRejectReasonChange,
  onRejectConfirm,
}: AdminRunCardProps) {
  const time =
    run.timing_method === "gametime"
      ? run.gametime_display || run.realtime_display || "—"
      : run.realtime_display || "—";

  return (
    <div className="admin-run-card">
      <div className="admin-run-card-inner">
        <div className="admin-run-info">
          {/* Runner */}
          <div className="admin-run-runner">
            {run.is_coop && run.runners ? (
              <div className="admin-run-coop-runners">
                {run.runners.map((r) => (
                  <span key={r.id}>
                    {r.country && (
                      <span className="runner-country">
                        {countryCodeToFlag(r.country)}
                      </span>
                    )}
                    {r.display_name || r.username}
                  </span>
                ))}
              </div>
            ) : run.user ? (
              <span>
                {run.user.country && (
                  <span className="runner-country">
                    {countryCodeToFlag(run.user.country)}
                  </span>
                )}
                {run.user.display_name || run.user.username}
              </span>
            ) : null}
          </div>

          {/* Game · Platform · Category */}
          <div className="admin-run-meta">
            {run.game} · {run.platform} · {run.category}
            {run.level && <> · {run.level}</>}
          </div>

          {/* Variables */}
          {run.variable_values?.length > 0 && (
            <div className="admin-run-variables">
              {run.variable_values.map((v) => (
                <span key={v.variable_slug} className="admin-run-variable">
                  <span className="admin-run-variable-name">{v.variable}:</span>{" "}
                  {v.value}
                </span>
              ))}
            </div>
          )}

          {/* Time */}
          <div className="admin-run-time">{time}</div>

          {/* Comment */}
          {run.comment && (
            <div className="admin-run-comment">"{run.comment}"</div>
          )}

          {/* Date */}
          <div className="admin-run-date">
            {new Date(run.submitted_at).toLocaleDateString()}
          </div>
        </div>

        {/* Actions */}
        <div className="admin-run-actions">
          {run.video_url && (
            <a
              href={run.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn admin-run-btn"
            >
              ▶ Watch
            </a>
          )}
          <button
            className="btn btn-primary admin-run-btn"
            onClick={() => onVerify(run.id)}
          >
            ✓ Verify
          </button>
          <button
            className="btn admin-run-btn admin-run-btn--reject"
            onClick={() => onRejectToggle(run.id)}
          >
            ✕ Reject
          </button>
        </div>
      </div>

      {/* Reject input */}
      {rejectRunId === run.id && (
        <div className="admin-run-reject-row">
          <input
            className="auth-input"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
          />
          <button
            className="btn admin-run-btn--reject"
            onClick={() => onRejectConfirm(run.id)}
          >
            Confirm Reject
          </button>
        </div>
      )}
    </div>
  );
}