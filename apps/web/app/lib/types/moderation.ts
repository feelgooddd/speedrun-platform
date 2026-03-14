// app/lib/types/moderation.ts

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

export interface RunVariable {
  variable: string;
  variable_slug: string;
  value: string;
  value_slug: string;
}

export interface PendingRun {
  id: string;
  is_coop: boolean;
  is_il: boolean;
  level?: string | null;
  user: User | null;
  runners: User[] | null;
  subcategory?: string | null;
  category: string;
  platform: string;
  comment: string | null;
  system: string | null;
  realtime_ms?: number | null;
  gametime_ms?: number | null;
  realtime_display?: string | null;
  gametime_display?: string | null;
  video_url: string;
  submitted_at: string;
  rejected?: boolean;
  reject_reason?: string | null;
  variable_values: RunVariable[]; // 👈 new
}
