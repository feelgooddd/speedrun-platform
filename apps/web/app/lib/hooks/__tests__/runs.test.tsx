import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModQueue } from "@/app/lib/hooks/useModQueue";
import { useSubmitRunForm } from "@/app/lib/hooks/useSubmitRunForm";
import RejectedRuns from "@/app/components/profile/RejectedRuns";

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

vi.mock("@/app/components/auth/AuthContext", () => ({
  useAuth: () => ({ user: { username: "ryan" }, token: "test-token" }),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

function jsonResponse(data: any, ok = true) {
  return Promise.resolve({ ok, json: async () => data });
}

// ----------------------------------------------------------------
// useModQueue
// ----------------------------------------------------------------

describe("useModQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.setItem("token", "test-token");
  });

  it("fetches the mod queue on mount", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        runs: [
          { id: "run-1", rejected: false, is_il: false },
          { id: "run-2", rejected: false, is_il: true },
        ],
        game: "Harry Potter 1",
      }),
    });

    const { result } = renderHook(() => useModQueue("hp1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.queue.pending).toHaveLength(1);
    expect(result.current.queue.pendingIL).toHaveLength(1);
    expect(result.current.gameName).toBe("Harry Potter 1");
  });

  it("approving a run removes it from the queue", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{ id: "run-1", rejected: false, is_il: false }],
          game: "hp1",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.verifyRun("run-1", true);
    });

    expect(result.current.queue.pending).toHaveLength(0);
  });

  it("rejecting a run moves it to the rejected section", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{ id: "run-1", rejected: false, is_il: false }],
          game: "hp1",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.verifyRun("run-1", false, "Invalid video proof");
    });

    expect(result.current.queue.pending).toHaveLength(0);
    expect(result.current.queue.rejected).toHaveLength(1);
    expect(result.current.queue.rejected[0].reject_reason).toBe("Invalid video proof");
  });

  it("rejecting an IL run moves it to rejectedIL", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{ id: "run-il-1", rejected: false, is_il: true }],
          game: "hp1",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.verifyRun("run-il-1", false, "Wrong category");
    });

    expect(result.current.queue.pendingIL).toHaveLength(0);
    expect(result.current.queue.rejectedIL).toHaveLength(1);
  });

  it("sets error state when verification fails", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [{ id: "run-1", rejected: false, is_il: false }], game: "hp1" }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.verifyRun("run-1", true);
    });

    expect(result.current.error).toBe("Verification failed");
  });

  it("sets processing state while verifying", async () => {
    let resolveVerify!: () => void;
    const verifyPromise = new Promise<void>((res) => { resolveVerify = res; });

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [{ id: "run-1", rejected: false, is_il: false }], game: "hp1" }),
      })
      .mockReturnValueOnce(verifyPromise.then(() => ({ ok: true, json: async () => ({}) })));

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.verifyRun("run-1", true); });
    expect(result.current.processing["run-1"]).toBe(true);

    await act(async () => { resolveVerify(); });
    expect(result.current.processing["run-1"]).toBe(false);
  });

  it("handles fetch error on queue load", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useModQueue("hp1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network error");
  });
});

// ----------------------------------------------------------------
// RejectedRuns
// ----------------------------------------------------------------

describe("RejectedRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there are no rejected runs", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [] }),
    });

    const { container } = render(<RejectedRuns username="ryan" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders rejected runs with reject reason", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{
            id: "run-1",
            is_il: false,
            game: "Harry Potter 1",
            game_slug: "hp1",
            category: "Any%",
            level: null,
            platform: "PC",
            platform_slug: "pc",
            system_id: null,
            realtime_ms: 3600000,
            gametime_ms: null,
            realtime_display: "1:00:00",
            gametime_display: null,
            score_value: null,
            scoring_type: null,
            video_url: "https://youtube.com/watch?v=abc",
            comment: null,
            reject_reason: "Invalid video proof",
            submitted_at: "2026-01-01T00:00:00Z",
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ systems: [] }),
      });

    await act(async () => {
      render(<RejectedRuns username="ryan" />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Harry Potter 1 — Any%/)).toBeInTheDocument();
      expect(screen.getByText("Invalid video proof")).toBeInTheDocument();
    });
  });

  it("expands a run when clicked", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{
            id: "run-1",
            is_il: false,
            game: "Harry Potter 1",
            game_slug: "hp1",
            category: "Any%",
            level: null,
            platform: "PC",
            platform_slug: "pc",
            system_id: null,
            realtime_ms: 3600000,
            gametime_ms: null,
            realtime_display: "1:00:00",
            gametime_display: null,
            score_value: null,
            scoring_type: null,
            video_url: "https://youtube.com/watch?v=abc",
            comment: null,
            reject_reason: "Invalid video",
            submitted_at: "2026-01-01T00:00:00Z",
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ systems: [] }) });

    await act(async () => { render(<RejectedRuns username="ryan" />); });

    await waitFor(() => screen.getByText(/Harry Potter 1/));
    fireEvent.click(screen.getByText(/Harry Potter 1 — Any%/));

    expect(screen.getByText("Resubmit Run")).toBeInTheDocument();
  });

  it("shows error when resubmitting without a video URL", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{
            id: "run-1",
            is_il: false,
            game: "Harry Potter 1",
            game_slug: "hp1",
            category: "Any%",
            level: null,
            platform: "PC",
            platform_slug: "pc",
            system_id: null,
            realtime_ms: 3600000,
            gametime_ms: null,
            realtime_display: "1:00:00",
            gametime_display: null,
            score_value: null,
            scoring_type: null,
            video_url: "",
            comment: null,
            reject_reason: "Invalid video",
            submitted_at: "2026-01-01T00:00:00Z",
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ systems: [] }) });

    await act(async () => { render(<RejectedRuns username="ryan" />); });
    await waitFor(() => screen.getByText(/Harry Potter 1/));

    fireEvent.click(screen.getByText(/Harry Potter 1 — Any%/));
    fireEvent.click(screen.getByText("Resubmit Run"));

    await waitFor(() => {
      expect(screen.getByText("Video URL is required")).toBeInTheDocument();
    });
  });

  it("removes run from list after successful resubmit", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runs: [{
            id: "run-1",
            is_il: false,
            game: "Harry Potter 1",
            game_slug: "hp1",
            category: "Any%",
            level: null,
            platform: "PC",
            platform_slug: "pc",
            system_id: null,
            realtime_ms: 3600000,
            gametime_ms: null,
            realtime_display: "1:00:00",
            gametime_display: null,
            score_value: null,
            scoring_type: null,
            video_url: "https://youtube.com/watch?v=abc",
            comment: null,
            reject_reason: "Invalid video",
            submitted_at: "2026-01-01T00:00:00Z",
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ systems: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ run: { id: "run-1" } }) });

    await act(async () => { render(<RejectedRuns username="ryan" />); });
    await waitFor(() => screen.getByText(/Harry Potter 1/));

    fireEvent.click(screen.getByText(/Harry Potter 1 — Any%/));
    fireEvent.click(screen.getByText("Resubmit Run"));

    await waitFor(() => {
      expect(screen.queryByText(/Harry Potter 1 — Any%/)).not.toBeInTheDocument();
    });
  });
});

// ----------------------------------------------------------------
// useSubmitRunForm
// ----------------------------------------------------------------

const baseProps = {
  token: "test-token",
  selectedGame: "hp1",
  selectedPlatform: "pc",
  selectedCategory: "any",
  selectedCategoryData: undefined,
  isGametime: false,
  runners: [],
  isIL: false,
};

function makeEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

describe("useSubmitRunForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false and sets error when RTA is 0", async () => {
    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    let success: boolean;
    await act(async () => {
      success = await result.current.handleSubmit(makeEvent());
    });

    expect(success!).toBe(false);
    expect(result.current.states.error).toBe("Please enter a valid RTA time");
  });

  it("returns false and sets error when video URL is missing", async () => {
    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.handleSubmit(makeEvent());
    });

    expect(success!).toBe(false);
    expect(result.current.states.error).toBe("Video URL is required");
  });

  it("submits successfully with valid time and video", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: { id: "new-run-1" } }),
    });

    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
      result.current.states.setVideoUrl("https://youtube.com/watch?v=abc");
    });

    let success: boolean;
    await act(async () => {
      success = await result.current.handleSubmit(makeEvent());
    });

    expect(success!).toBe(true);
    expect(result.current.states.success).toBe(true);
  });

  it("resets form after successful submission", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: { id: "new-run-1" } }),
    });

    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
      result.current.states.setVideoUrl("https://youtube.com/watch?v=abc");
      result.current.states.setComment("sub 1 hour!");
    });

    await act(async () => {
      await result.current.handleSubmit(makeEvent());
    });

    expect(result.current.states.rtaParts).toEqual({ h: "", m: "", s: "", ms: "" });
    expect(result.current.states.videoUrl).toBe("");
    expect(result.current.states.comment).toBe("");
  });

  it("sets error when API returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Category not found" }),
    });

    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
      result.current.states.setVideoUrl("https://youtube.com/watch?v=abc");
    });

    await act(async () => {
      await result.current.handleSubmit(makeEvent());
    });

    expect(result.current.states.error).toBe("Category not found");
    expect(result.current.states.success).toBe(false);
  });

  it("validates co-op runner count", async () => {
    const { result } = renderHook(() => useSubmitRunForm({
      ...baseProps,
      runners: [{ id: "user-1" }],
      selectedCategoryData: {
        id: "cat-1",
        name: "Any%",
        slug: "any",
        timing_method: "realtime",
        subcategories: [],
        variables: [
          {
            id: "var-1",
            name: "Players",
            slug: "players",
            is_subcategory: true,
            order: 0,
            values: [
              {
                id: "val-1",
                name: "2 Player",
                slug: "2p",
                is_coop: true,
                required_players: 2,
                hidden_variables: [],
              },
            ],
          },
        ],
      } as any,
    }));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
      result.current.states.setVideoUrl("https://youtube.com/watch?v=abc");
      result.current.states.setSelectedVariableValues({ "var-1": "val-1" });
    });

    await act(async () => {
      await result.current.handleSubmit(makeEvent());
    });

    expect(result.current.states.error).toBe("This category requires exactly 2 runners");
  });

  it("sets submitting state during submission", async () => {
    let resolveSubmit!: () => void;
    const submitPromise = new Promise<void>((res) => { resolveSubmit = res; });

    global.fetch = vi.fn().mockReturnValueOnce(
      submitPromise.then(() => ({ ok: true, json: async () => ({ run: { id: "r1" } }) }))
    );

    const { result } = renderHook(() => useSubmitRunForm(baseProps));

    act(() => {
      result.current.states.setRtaParts({ h: "1", m: "0", s: "0", ms: "0" });
      result.current.states.setVideoUrl("https://youtube.com/watch?v=abc");
    });

    act(() => { result.current.handleSubmit(makeEvent()); });
    expect(result.current.states.submitting).toBe(true);

    await act(async () => { resolveSubmit(); });
    expect(result.current.states.submitting).toBe(false);
  });
});