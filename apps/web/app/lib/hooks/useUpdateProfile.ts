import { useState, useEffect } from "react";

export interface ProfileFormState {
  email: string;
  country: string;
  display_name: string;
}

export interface UseUpdateProfileReturn {
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  error: string;
  success: string;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useUpdateProfile(
  user: any, 
  token: string | null, 
  login: Function
): UseUpdateProfileReturn { // <--- Added the return type here
  const [form, setForm] = useState<ProfileFormState>({
    email: "",
    country: "",
    display_name: "",
  });
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || "",
        country: user.country || "",
        display_name: user.display_name || "",
      });
    }
  }, [user]);

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
      if (!res.ok) throw new Error(data.error || "Update failed");

      login(data, token!);
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return { form, setForm, error, success, submitting, handleSubmit };
}