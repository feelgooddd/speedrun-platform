"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";
import Link from "next/link";
import "../../styles/auth.css";

const COUNTRIES = [
  { code: "", label: "No country" },
  { code: "ad", label: "Andorra" },
  { code: "ae", label: "United Arab Emirates" },
  { code: "af", label: "Afghanistan" },
  { code: "ag", label: "Antigua and Barbuda" },
  { code: "al", label: "Albania" },
  { code: "am", label: "Armenia" },
  { code: "ao", label: "Angola" },
  { code: "ar", label: "Argentina" },
  { code: "at", label: "Austria" },
  { code: "au", label: "Australia" },
  { code: "az", label: "Azerbaijan" },
  { code: "ba", label: "Bosnia and Herzegovina" },
  { code: "bb", label: "Barbados" },
  { code: "bd", label: "Bangladesh" },
  { code: "be", label: "Belgium" },
  { code: "bf", label: "Burkina Faso" },
  { code: "bg", label: "Bulgaria" },
  { code: "bh", label: "Bahrain" },
  { code: "bi", label: "Burundi" },
  { code: "bj", label: "Benin" },
  { code: "bn", label: "Brunei" },
  { code: "bo", label: "Bolivia" },
  { code: "br", label: "Brazil" },
  { code: "bs", label: "Bahamas" },
  { code: "bt", label: "Bhutan" },
  { code: "bw", label: "Botswana" },
  { code: "by", label: "Belarus" },
  { code: "bz", label: "Belize" },
  { code: "ca", label: "Canada" },
  { code: "cd", label: "DR Congo" },
  { code: "cf", label: "Central African Republic" },
  { code: "cg", label: "Republic of the Congo" },
  { code: "ch", label: "Switzerland" },
  { code: "ci", label: "Ivory Coast" },
  { code: "cl", label: "Chile" },
  { code: "cm", label: "Cameroon" },
  { code: "cn", label: "China" },
  { code: "co", label: "Colombia" },
  { code: "cr", label: "Costa Rica" },
  { code: "cu", label: "Cuba" },
  { code: "cv", label: "Cape Verde" },
  { code: "cy", label: "Cyprus" },
  { code: "cz", label: "Czech Republic" },
  { code: "de", label: "Germany" },
  { code: "dj", label: "Djibouti" },
  { code: "dk", label: "Denmark" },
  { code: "dm", label: "Dominica" },
  { code: "do", label: "Dominican Republic" },
  { code: "dz", label: "Algeria" },
  { code: "ec", label: "Ecuador" },
  { code: "ee", label: "Estonia" },
  { code: "eg", label: "Egypt" },
  { code: "er", label: "Eritrea" },
  { code: "es", label: "Spain" },
  { code: "et", label: "Ethiopia" },
  { code: "fi", label: "Finland" },
  { code: "fj", label: "Fiji" },
  { code: "fm", label: "Micronesia" },
  { code: "fr", label: "France" },
  { code: "ga", label: "Gabon" },
  { code: "gb", label: "United Kingdom" },
  { code: "gd", label: "Grenada" },
  { code: "ge", label: "Georgia" },
  { code: "gh", label: "Ghana" },
  { code: "gm", label: "Gambia" },
  { code: "gn", label: "Guinea" },
  { code: "gq", label: "Equatorial Guinea" },
  { code: "gr", label: "Greece" },
  { code: "gt", label: "Guatemala" },
  { code: "gw", label: "Guinea-Bissau" },
  { code: "gy", label: "Guyana" },
  { code: "hn", label: "Honduras" },
  { code: "hr", label: "Croatia" },
  { code: "ht", label: "Haiti" },
  { code: "hu", label: "Hungary" },
  { code: "id", label: "Indonesia" },
  { code: "ie", label: "Ireland" },
  { code: "il", label: "Israel" },
  { code: "in", label: "India" },
  { code: "iq", label: "Iraq" },
  { code: "ir", label: "Iran" },
  { code: "is", label: "Iceland" },
  { code: "it", label: "Italy" },
  { code: "jm", label: "Jamaica" },
  { code: "jo", label: "Jordan" },
  { code: "jp", label: "Japan" },
  { code: "ke", label: "Kenya" },
  { code: "kg", label: "Kyrgyzstan" },
  { code: "kh", label: "Cambodia" },
  { code: "ki", label: "Kiribati" },
  { code: "km", label: "Comoros" },
  { code: "kn", label: "Saint Kitts and Nevis" },
  { code: "kp", label: "North Korea" },
  { code: "kr", label: "South Korea" },
  { code: "kw", label: "Kuwait" },
  { code: "kz", label: "Kazakhstan" },
  { code: "la", label: "Laos" },
  { code: "lb", label: "Lebanon" },
  { code: "lc", label: "Saint Lucia" },
  { code: "li", label: "Liechtenstein" },
  { code: "lk", label: "Sri Lanka" },
  { code: "lr", label: "Liberia" },
  { code: "ls", label: "Lesotho" },
  { code: "lt", label: "Lithuania" },
  { code: "lu", label: "Luxembourg" },
  { code: "lv", label: "Latvia" },
  { code: "ly", label: "Libya" },
  { code: "ma", label: "Morocco" },
  { code: "mc", label: "Monaco" },
  { code: "md", label: "Moldova" },
  { code: "me", label: "Montenegro" },
  { code: "mg", label: "Madagascar" },
  { code: "mh", label: "Marshall Islands" },
  { code: "mk", label: "North Macedonia" },
  { code: "ml", label: "Mali" },
  { code: "mm", label: "Myanmar" },
  { code: "mn", label: "Mongolia" },
  { code: "mr", label: "Mauritania" },
  { code: "mt", label: "Malta" },
  { code: "mu", label: "Mauritius" },
  { code: "mv", label: "Maldives" },
  { code: "mw", label: "Malawi" },
  { code: "mx", label: "Mexico" },
  { code: "my", label: "Malaysia" },
  { code: "mz", label: "Mozambique" },
  { code: "na", label: "Namibia" },
  { code: "ne", label: "Niger" },
  { code: "ng", label: "Nigeria" },
  { code: "ni", label: "Nicaragua" },
  { code: "nl", label: "Netherlands" },
  { code: "no", label: "Norway" },
  { code: "np", label: "Nepal" },
  { code: "nr", label: "Nauru" },
  { code: "nz", label: "New Zealand" },
  { code: "om", label: "Oman" },
  { code: "pa", label: "Panama" },
  { code: "pe", label: "Peru" },
  { code: "pg", label: "Papua New Guinea" },
  { code: "ph", label: "Philippines" },
  { code: "pk", label: "Pakistan" },
  { code: "pl", label: "Poland" },
  { code: "pt", label: "Portugal" },
  { code: "pw", label: "Palau" },
  { code: "py", label: "Paraguay" },
  { code: "qa", label: "Qatar" },
  { code: "ro", label: "Romania" },
  { code: "rs", label: "Serbia" },
  { code: "ru", label: "Russia" },
  { code: "rw", label: "Rwanda" },
  { code: "sa", label: "Saudi Arabia" },
  { code: "sb", label: "Solomon Islands" },
  { code: "sc", label: "Seychelles" },
  { code: "sd", label: "Sudan" },
  { code: "se", label: "Sweden" },
  { code: "sg", label: "Singapore" },
  { code: "si", label: "Slovenia" },
  { code: "sk", label: "Slovakia" },
  { code: "sl", label: "Sierra Leone" },
  { code: "sm", label: "San Marino" },
  { code: "sn", label: "Senegal" },
  { code: "so", label: "Somalia" },
  { code: "sr", label: "Suriname" },
  { code: "ss", label: "South Sudan" },
  { code: "st", label: "São Tomé and Príncipe" },
  { code: "sv", label: "El Salvador" },
  { code: "sy", label: "Syria" },
  { code: "sz", label: "Eswatini" },
  { code: "td", label: "Chad" },
  { code: "tg", label: "Togo" },
  { code: "th", label: "Thailand" },
  { code: "tj", label: "Tajikistan" },
  { code: "tl", label: "Timor-Leste" },
  { code: "tm", label: "Turkmenistan" },
  { code: "tn", label: "Tunisia" },
  { code: "to", label: "Tonga" },
  { code: "tr", label: "Turkey" },
  { code: "tt", label: "Trinidad and Tobago" },
  { code: "tv", label: "Tuvalu" },
  { code: "tz", label: "Tanzania" },
  { code: "ua", label: "Ukraine" },
  { code: "ug", label: "Uganda" },
  { code: "us", label: "United States" },
  { code: "uy", label: "Uruguay" },
  { code: "uz", label: "Uzbekistan" },
  { code: "va", label: "Vatican City" },
  { code: "vc", label: "Saint Vincent and the Grenadines" },
  { code: "ve", label: "Venezuela" },
  { code: "vn", label: "Vietnam" },
  { code: "vu", label: "Vanuatu" },
  { code: "ws", label: "Samoa" },
  { code: "ye", label: "Yemen" },
  { code: "za", label: "South Africa" },
  { code: "zm", label: "Zambia" },
  { code: "zw", label: "Zimbabwe" },
];

export default function MePage() {
  const router = useRouter();
  const { user, token, login, loading } = useAuth();
  const [form, setForm] = useState({ email: "", country: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
const [pwError, setPwError] = useState("");
const [pwSuccess, setPwSuccess] = useState(false);
const [pwLoading, setPwLoading] = useState(false);

const handleChangePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setPwError("");
  setPwSuccess(false);
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    setPwError("New passwords don't match");
    return;
  }
  if (pwForm.newPassword.length < 8) {
    setPwError("New password must be at least 8 characters");
    return;
  }
  setPwLoading(true);
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setPwError(data.error); return; }
    setPwSuccess(true);
    setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  } catch {
    setPwError("Something went wrong");
  } finally {
    setPwLoading(false);
  }
};

  useEffect(() => {
    if (loading) return; // wait for auth to hydrate
    if (!user) {
      router.push("/login");
      return;
    }
    setForm({
      email: user.email || "",
      country: user.country || "",
    });
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }

      // Update auth context with new user data
      login(data, token!);
      setSuccess("Profile updated successfully.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-back">
          ← Back
        </Link>

        <div className="auth-header">
          <div className="auth-icon">⚡</div>
          <h1 className="auth-title">My Profile</h1>
          <p className="auth-subtitle">{user.display_name || user.username}</p>
        </div>

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
<div className="auth-form" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "2rem", paddingTop: "2rem" }}>
  <h2 style={{ fontSize: "1rem", marginBottom: "1rem", opacity: 0.8 }}>Change Password</h2>
  <form onSubmit={handleChangePassword} className="auth-form">
    <div className="auth-field">
      <label className="auth-label">Current Password</label>
      <input className="auth-input" type="password" value={pwForm.currentPassword}
        onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
    </div>
    <div className="auth-field">
      <label className="auth-label">New Password</label>
      <input className="auth-input" type="password" value={pwForm.newPassword}
        onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
    </div>
    <div className="auth-field">
      <label className="auth-label">Confirm New Password</label>
      <input className="auth-input" type="password" value={pwForm.confirmPassword}
        onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
    </div>
    {pwError && <p className="auth-error">{pwError}</p>}
    {pwSuccess && <p className="auth-success">✓ Password updated successfully</p>}
    <button type="submit" className="btn btn-primary auth-submit" disabled={pwLoading}>
      {pwLoading ? "Updating..." : "Update Password"}
    </button>
  </form>
</div>
        <p className="auth-switch">
          <Link href={`/profile/${user.username}`} className="auth-switch-link">
            View your public profile →
          </Link>
        </p>
      </div>
    </div>
  );
}
