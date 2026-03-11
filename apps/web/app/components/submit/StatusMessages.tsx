// @/app/components/submit/StatusMessages.tsx

interface StatusMessagesProps {
  success: boolean;
  error: string;
}

export default function StatusMessages({ success, error }: StatusMessagesProps) {
  if (success)
    return (
      <div
        style={{
          padding: "1rem",
          marginBottom: "2rem",
          background: "rgba(0, 255, 0, 0.1)",
          border: "1px solid rgba(0, 255, 0, 0.3)",
          borderRadius: "4px",
          color: "var(--accent)",
          textAlign: "center",
        }}
      >
        ✓ Run submitted successfully! Awaiting verification.
      </div>
    );

  if (error)
    return (
      <div
        style={{
          padding: "1rem",
          marginBottom: "2rem",
          background: "rgba(255, 0, 0, 0.1)",
          border: "1px solid rgba(255, 0, 0, 0.3)",
          borderRadius: "4px",
          color: "#ff4444",
          textAlign: "center",
        }}
      >
        {error}
      </div>
    );

  return null;
}