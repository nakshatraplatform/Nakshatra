// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const auth = vi.hoisted(() => vi.fn());
const action = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`redirect:${url}`); }));
vi.mock("@/lib/auth", () => ({ getApiUser: auth }));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/broker-introductions/server/introduction-workspace.service", () => ({ resolveIntroductionAction: action, resolveIntroductionWorkspaceList: list }));
vi.mock("@/components/brokerdesk/BrokerDeskHeader", () => ({ BrokerDeskHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }));
import ListPage from "../src/app/brokerdesk/w/[workspaceRef]/introductions/page";
import ActionPage from "../src/app/brokerdesk/w/[workspaceRef]/introductions/[introductionRef]/page";
import Loading from "../src/app/brokerdesk/w/[workspaceRef]/introductions/loading";
import { actionFixture, listData, workspace, introduction, date } from "./introduction-workspace.fixture";
const params = () => Promise.resolve({ workspaceRef: workspace, introductionRef: introduction });
const searchParams = () => Promise.resolve({});
describe("private broker Introduction pages", () => {
  beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ status: "authenticated", supabase: {} }); action.mockResolvedValue(actionFixture()); list.mockResolvedValue(listData); });
  it("links the list to a two-sided action workspace and a stable older cursor", async () => {
    list.mockResolvedValue({ ...listData, nextCursor: { createdAt: date, introductionRef: introduction } });
    render(await ListPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByRole("link", { name: "Open Introduction" })).toHaveAttribute("href", `/brokerdesk/w/${workspace}/introductions/${introduction}`);
    expect(screen.getByRole("link", { name: "Older Introductions" })).toHaveAttribute("href", expect.stringContaining("beforeRef="));
  });
  it("renders actual action controls from the authorized projection", async () => {
    render(await ActionPage({ params: params() }));
    expect(screen.getByRole("heading", { name: "Customer A & Customer B" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Copy link" })).toHaveLength(2);
  });
  it("handles invalid paths and cursors without data reads", async () => {
    render(await ActionPage({ params: Promise.resolve({ workspaceRef: "bad", introductionRef: introduction }) }));
    expect(screen.getByRole("heading", { name: "Introduction unavailable" })).toBeVisible(); expect(action).not.toHaveBeenCalled();
    render(await ListPage({ params: params(), searchParams: Promise.resolve({ beforeRef: introduction }) }));
    expect(screen.getByText("This page link is incomplete")).toBeVisible(); expect(list).not.toHaveBeenCalled();
  });
  it("handles empty and denied lists", async () => {
    list.mockResolvedValueOnce({ ...listData, introductions: [] });
    render(await ListPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText("No Introductions to show")).toBeVisible();
    list.mockResolvedValueOnce({ available: false });
    render(await ListPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText("Introductions are unavailable")).toBeVisible();
  });
  it("shows recoverable read errors without exposing data", async () => {
    action.mockRejectedValueOnce(new Error("private"));
    render(await ActionPage({ params: params() }));
    expect(screen.getByText(/We could not load this Introduction\./)).toBeVisible();
    list.mockRejectedValueOnce(new Error("private"));
    render(await ListPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText(/We could not load Introductions\./)).toBeVisible();
  });
  it("redirects signed-out users only to validated internal paths", async () => {
    auth.mockResolvedValue({ status: "missing_session" });
    await expect(ActionPage({ params: params() })).rejects.toThrow("redirect:/login?redirect=%2Fbrokerdesk");
    await expect(ListPage({ params: params(), searchParams: searchParams() })).rejects.toThrow("redirect:/login?redirect=%2Fbrokerdesk");
    expect(action).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled();
  });
  it("shows denied detail and outage states, with a loading indicator", async () => {
    action.mockResolvedValueOnce({ available: false }); render(await ActionPage({ params: params() }));
    expect(screen.getByText("Introduction unavailable")).toBeVisible();
    auth.mockResolvedValue({ status: "service_unavailable" });
    render(await ListPage({ params: params(), searchParams: searchParams() }));
    expect(screen.getByText(/We could not load Introductions\./)).toBeVisible();
    render(<Loading />); expect(screen.getByText("Loading your Introductions")).toBeVisible();
  });
});
