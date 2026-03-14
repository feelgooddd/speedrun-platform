"use client";
import AdminRunCard, { QueueRun } from "./AdminRunCard";

interface AdminRunsTabProps {
  runs: QueueRun[];
  loading: boolean;
  error: string;
  rejectRunId: string | null;
  rejectReason: string;
  onVerify: (runId: string) => void;
  onRejectToggle: (runId: string) => void;
  onRejectReasonChange: (reason: string) => void;
  onRejectConfirm: (runId: string) => void;
}

export default function AdminRunsTab({
  runs,
  loading,
  error,
  rejectRunId,
  rejectReason,
  onVerify,
  onRejectToggle,
  onRejectReasonChange,
  onRejectConfirm,
}: AdminRunsTabProps) {
  return (
    <div className="admin-runs-tab">
      <div className="profile-section">
        <h2 className="profile-section-title">
          Pending Runs {runs.length > 0 && `(${runs.length})`}
        </h2>
        {error && <p className="auth-error">{error}</p>}
        {loading ? (
          <p className="admin-runs-empty">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="admin-runs-empty">No pending runs.</p>
        ) : (
          runs.map((run) => (
            <AdminRunCard
              key={run.id}
              run={run}
              rejectRunId={rejectRunId}
              rejectReason={rejectReason}
              onVerify={onVerify}
              onRejectToggle={onRejectToggle}
              onRejectReasonChange={onRejectReasonChange}
              onRejectConfirm={onRejectConfirm}
            />
          ))
        )}
      </div>
    </div>
  );
}