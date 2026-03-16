import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AdminRunCard, { QueueRun } from "../AdminRunCard";

const mockRun: QueueRun = {
  id: "run-1",
  is_coop: false,
  user: {
    id: "user-1",
    username: "ryangoodss",
    display_name: "RyAn",
    country: "CA",
  },
  runners: null,
  game: "Harry Potter 1",
  game_slug: "hp1",
  category: "Any%",
  level: null,
  subcategory: null,
  variable_values: [
    { variable: "Type", variable_slug: "type", value: "Solo", value_slug: "solo" },
  ],
  platform: "PC",
  timing_method: "realtime",
  realtime_ms: 3723000,
  realtime_display: "1h 02m 03s",
  gametime_ms: null,
  gametime_display: null,
  video_url: "https://youtube.com/watch?v=123",
  submitted_at: "2026-01-01T00:00:00Z",
  comment: null,
};

const defaultProps = {
  run: mockRun,
  rejectRunId: null,
  rejectReason: "",
  onVerify: vi.fn(),
  onRejectToggle: vi.fn(),
  onRejectReasonChange: vi.fn(),
  onRejectConfirm: vi.fn(),
};

describe("AdminRunCard", () => {
  it("renders runner display name", () => {
    render(<AdminRunCard {...defaultProps} />);
    expect(screen.getByText("RyAn")).toBeInTheDocument();
  });

  it("renders game, platform and category", () => {
    render(<AdminRunCard {...defaultProps} />);
    expect(screen.getByText(/Harry Potter 1/)).toBeInTheDocument();
    expect(screen.getByText(/PC/)).toBeInTheDocument();
    expect(screen.getByText(/Any%/)).toBeInTheDocument();
  });

  it("renders variable values", () => {
    render(<AdminRunCard {...defaultProps} />);
    expect(screen.getByText("Type:")).toBeInTheDocument();
    expect(screen.getByText("Solo")).toBeInTheDocument();
  });

  it("renders time", () => {
    render(<AdminRunCard {...defaultProps} />);
    expect(screen.getByText("1h 02m 03s")).toBeInTheDocument();
  });

  it("renders watch link when video_url present", () => {
    render(<AdminRunCard {...defaultProps} />);
    expect(screen.getByText("▶ Watch")).toBeInTheDocument();
  });
});