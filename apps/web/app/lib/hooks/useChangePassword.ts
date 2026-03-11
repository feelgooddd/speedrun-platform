import { useState } from "react";

export interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string ;
}

export interface UseChangePasswordReturn {
  pwForm: PasswordFormState;
  setPwForm: React.Dispatch<React.SetStateAction<PasswordFormState>>;
  pwError: string;
  pwSuccess: boolean;
  pwLoading: boolean;
  handleChangePassword: (e: React.FormEvent) => Promise<void>;
}

export function useChangePassword(token: string | null): UseChangePasswordReturn {
  const [pwForm, setPwForm] = useState<PasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
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
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setPwSuccess(true);
      // Clear the form on success
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPwError(err.message || "Something went wrong");
    } finally {
      setPwLoading(false);
    }
  };

  return { 
    pwForm, 
    setPwForm, 
    pwError, 
    pwSuccess, 
    pwLoading, 
    handleChangePassword 
  };
}