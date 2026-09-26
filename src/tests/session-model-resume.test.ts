import { describe, it, expect, vi } from "vitest";
import type { ModelInfo, Query, Settings } from "@anthropic-ai/claude-agent-sdk";
import { getAvailableModels } from "../session-model.js";

// A gateway COMBO is a router: the id the caller asks for (`deepseek-v4-flash`) is
// not the id that serves the request, and `message.model` comes back as the
// UPSTREAM name (`DeepSeek-V4-Flash`). The CLI writes that echo into the session
// transcript, so on resume `resumedModelHint` is the upstream name while the
// catalog entry it reconciles to is the combo id.
const CATALOG: ModelInfo[] = [
  { value: "default", displayName: "Default (recommended)", description: "Opus (1M context)" },
  { value: "deepseek-v4-flash", displayName: "DeepSeek V4 Flash", description: "combo" },
  { value: "gpt-6-luna", displayName: "GPT 6 Luna", description: "" },
];

function harness() {
  const setModel = vi.fn(async () => {});
  return {
    setModel,
    query: { setModel } as unknown as Query,
    settingsManager: { getSettings: () => ({}) as Settings },
    logger: { log: () => {}, error: () => {} },
  };
}

async function resolve(setModel: (m: string) => Promise<void>, hint?: string) {
  const query = { setModel } as unknown as Query;
  return getAvailableModels(
    query,
    CATALOG,
    CATALOG,
    { getSettings: () => ({}) as Settings },
    { log: () => {}, error: () => {} },
    true,
    "session-under-test",
    hint,
  );
}

describe("getAvailableModels on a resumed session", () => {
  it("re-asserts the resolved catalog id when the transcript holds an upstream echo", async () => {
    const { setModel } = harness();
    const state = await resolve(setModel, "DeepSeek-V4-Flash");

    // The echo reconciles back to the combo id, which is what the gateway routes.
    expect(state.currentModelId).toBe("deepseek-v4-flash");
    // The SDK is actually running the upstream name, so the reported value is a
    // lie until this call happens.
    expect(setModel).toHaveBeenCalledWith("deepseek-v4-flash");
  });

  it("skips the round-trip when the transcript already holds the catalog id", async () => {
    const { setModel } = harness();
    const state = await resolve(setModel, "gpt-6-luna");

    expect(state.currentModelId).toBe("gpt-6-luna");
    expect(setModel).not.toHaveBeenCalled();
  });

  it("skips the round-trip when the transcript holds no real record", async () => {
    const { setModel } = harness();
    await resolve(setModel, undefined);

    expect(setModel).not.toHaveBeenCalled();
  });
});
