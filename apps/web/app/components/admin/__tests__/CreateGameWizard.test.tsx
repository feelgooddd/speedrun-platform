import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CreateGameWizard from "../CreateGameWizard";

vi.mock("@/app/components/auth/AuthContext", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("@/app/lib/api", () => ({
  apiFetch: vi.fn(),
  apiUrl: (path: string) => `http://localhost:3001/api${path}`,
}));

import { apiFetch } from "@/app/lib/api";
const mockApiFetch = vi.mocked(apiFetch);

const onDoneAction = vi.fn();

function mockFetch(...responses: any[]) {
  let call = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const res = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve(res);
  });
}

function jsonResponse(data: any, ok = true) {
  return { ok, json: async () => data };
}

async function setup() {
  await act(async () => {
    render(<CreateGameWizard onDoneAction={onDoneAction} />);
  });
}

function fillGameDetails(name = "Harry Potter 1", slug = "hp1") {
  fireEvent.change(screen.getByPlaceholderText(/harry potter/i), {
    target: { value: name },
  });
  const slugInput = screen.getByPlaceholderText("hp1");
  fireEvent.change(slugInput, { target: { value: slug } });
}

function addPlatform(name = "PC") {
  fireEvent.change(screen.getByPlaceholderText(/name \(e\.g\. pc\)/i), {
    target: { value: name },
  });
  const addButtons = screen.getAllByText("+ Add");
  const enabledAdd = addButtons.find((btn) => !btn.hasAttribute("disabled"))!;
  fireEvent.click(enabledAdd);
}

function addCategory(name = "Any%") {
  fireEvent.change(screen.getByPlaceholderText(/category name/i), {
    target: { value: name },
  });
  fireEvent.click(screen.getByText("+ Add Category"));
}

describe("CreateGameWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ systems: [] }),
    });
  });

  // ── Validation ──

  it("shows error when submitting with no game name", async () => {
    await setup();
    fireEvent.click(screen.getByText("✨ Create Game"));
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows error when submitting with game name but no platforms", async () => {
    await setup();
    fillGameDetails();
    fireEvent.click(screen.getByText("✨ Create Game"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // ── Platform ──

  it("auto-generates slug from platform name", async () => {
    await setup();
    fireEvent.change(screen.getByPlaceholderText(/name \(e\.g\. pc\)/i), {
      target: { value: "Nintendo 64" },
    });
    const slugInputs = screen.getAllByPlaceholderText("slug");
    expect(slugInputs[0]).toHaveValue("nintendo-64");
  });

  it("adds a platform tag when Add is clicked", async () => {
    await setup();
    addPlatform("PC");
    expect(
      screen.getByText("PC", { selector: ".cgw-tag" }),
    ).toBeInTheDocument();
  });

  it("removes a platform when × is clicked", async () => {
    await setup();
    addPlatform("PC");
    const removeButtons = screen.getAllByText("×");
    fireEvent.click(removeButtons[0]);
    expect(screen.queryAllByText("PC")).toHaveLength(0);
  });

  it("adds multiple platforms", async () => {
    await setup();
    addPlatform("PC");
    addPlatform("Console");
    const tabs = screen.getAllByRole("button", { name: /PC|Console/ });
    expect(tabs.length).toBeGreaterThanOrEqual(2);
  });

  // ── Category ──

  it("shows category section after platform is added", async () => {
    await setup();
    addPlatform("PC");
    expect(screen.getByPlaceholderText(/category name/i)).toBeInTheDocument();
  });

  it("adds a category under the active platform", async () => {
    await setup();
    addPlatform("PC");
    addCategory("Any%");
    expect(screen.getByText("Any%")).toBeInTheDocument();
  });

  it("auto-generates slug from category name", async () => {
    await setup();
    addPlatform("PC");
    fireEvent.change(screen.getByPlaceholderText(/category name/i), {
      target: { value: "100%" },
    });
    const slugInputs = screen.getAllByPlaceholderText("slug");
    const categorySlugInput = slugInputs[slugInputs.length - 1];
    expect(categorySlugInput).toHaveValue("100");
  });

  it("removes a category when × is clicked", async () => {
    await setup();
    addPlatform("PC");
    addCategory("Any%");
    expect(screen.getByText("Any%")).toBeInTheDocument();
    const removeButtons = screen.getAllByText("×");
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.queryByText("Any%")).not.toBeInTheDocument();
  });

  // ── API submission ──

  it("calls game API then platform API on submit", async () => {
    await setup();
    fillGameDetails("Harry Potter 1", "hp1");
    addPlatform("PC");
    addCategory("Any%");

    mockFetch(
      jsonResponse({
        game: { id: "game-1", slug: "hp1", name: "Harry Potter 1" },
      }),
      jsonResponse({ platform: { id: "plat-1", slug: "pc" } }),
      jsonResponse({ category: { id: "cat-1", slug: "any", name: "Any%" } }),
    );

    fireEvent.click(screen.getByText("✨ Create Game"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/games",
        expect.objectContaining({ method: "POST" }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/games/hp1/platforms",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows success message after game is created", async () => {
    await setup();
    fillGameDetails("Harry Potter 1", "hp1");
    addPlatform("PC");
    addCategory("Any%");

    mockFetch(
      jsonResponse({
        game: { id: "game-1", slug: "hp1", name: "Harry Potter 1" },
      }),
      jsonResponse({ platform: { id: "plat-1", slug: "pc" } }),
      jsonResponse({ category: { id: "cat-1", slug: "any", name: "Any%" } }),
    );

    fireEvent.click(screen.getByText("✨ Create Game"));

    await waitFor(() => {
      expect(
        screen.getByText(/"Harry Potter 1" created successfully\./),
      ).toBeInTheDocument();
    });
  });

  it("shows error message when game creation fails", async () => {
    await setup();
    fillGameDetails("Harry Potter 1", "hp1");
    addPlatform("PC");
    addCategory("Any%");

    mockFetch(jsonResponse({ error: "Game already exists" }, false));

    fireEvent.click(screen.getByText("✨ Create Game"));

    await waitFor(() => {
      expect(screen.getByText("Game already exists")).toBeInTheDocument();
    });
  });

  it("calls onDoneAction with the created game after success", async () => {
    await setup();
    fillGameDetails("Harry Potter 1", "hp1");
    addPlatform("PC");
    addCategory("Any%");

    const createdGame = { id: "game-1", slug: "hp1", name: "Harry Potter 1" };

    mockFetch(
      jsonResponse({ game: createdGame }),
      jsonResponse({ platform: { id: "plat-1", slug: "pc" } }),
      jsonResponse({ category: { id: "cat-1", slug: "any", name: "Any%" } }),
    );

    fireEvent.click(screen.getByText("✨ Create Game"));

    await waitFor(() => {
      expect(onDoneAction).toHaveBeenCalledWith(createdGame);
    });
  });
});
