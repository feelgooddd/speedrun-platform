// @/app/components/submit/LoginRequiredView.tsx
import Link from "next/link";

export default function LoginRequiredView() {
  return (
    <div className="landing">
      <div
        className="section"
        style={{ paddingTop: "6rem", textAlign: "center" }}
      >
        <h1 className="section-title">Submit Run</h1>
        <p className="section-subtitle">You must be logged in to submit runs</p>
        <Link
          href="/login"
          className="btn btn-primary"
          style={{ marginTop: "2rem" }}
        >
          Login
        </Link>
      </div>
    </div>
  );
}