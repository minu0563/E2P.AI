import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const env = vi.hoisted(() => ({ current: null as null | { env: Record<string, unknown> } }));
vi.mock("@/platform/env", () => ({ workerRequest: () => env.current }));

import { withRetry, withTimeout } from "@/lib/inference/retry";
import { InferenceError, type ChatRequest, type ChatResult } from "@/lib/inference/types";
import { WorkersAIClient } from "@/lib/inference/workers-ai";

const req: ChatRequest = { model: "@cf/google/gemma-4-26b-a4b-it", system: "s", user: "u" };
const result: ChatResult = { content: "{}", provider: "x", model: "m", usage: { inputTokens: 1, outputTokens: 1 }, timings: { totalMs: 1 } };
const noSleep = { sleep: async () => {} };

describe("재시도", () => {
  it("429·5xx는 max_retries회만 다시", async () => {
    const chat = vi.fn().mockRejectedValue(new InferenceError("busy", { status: 429, retryable: true }));
    await expect(withRetry({ provider: "x", chat }, { maxRetries: 1, backoffMs: 0, ...noSleep }).chat(req)).rejects.toThrow("busy");
    expect(chat).toHaveBeenCalledTimes(2);
  });
  it("한 번 실패 뒤 성공하면 결과", async () => {
    const chat = vi.fn().mockRejectedValueOnce(new InferenceError("x", { status: 503, retryable: true })).mockResolvedValue(result);
    expect(await withRetry({ provider: "x", chat }, { maxRetries: 1, backoffMs: 0, ...noSleep }).chat(req)).toBe(result);
  });
  it("시간 초과·4xx·일반 오류는 다시 하지 않는다", async () => {
    for (const e of [new InferenceError("t", { timeout: true, retryable: true }), new InferenceError("bad", { status: 400 }), new Error("parse")]) {
      const chat = vi.fn().mockRejectedValue(e);
      await expect(withRetry({ provider: "x", chat }, { maxRetries: 3, backoffMs: 0, ...noSleep }).chat(req)).rejects.toBe(e);
      expect(chat).toHaveBeenCalledTimes(1);
    }
  });
  it("시간 제한", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "t")).rejects.toMatchObject({ opts: { timeout: true } });
  });
});

describe("Workers AI 어댑터", () => {
  it("바인딩이 없으면 실패", async () => {
    env.current = null;
    await expect(new WorkersAIClient().chat(req)).rejects.toThrow("AI binding not configured");
  });
  it("@cf/ 모델만", async () => {
    env.current = { env: { AI: { run: vi.fn() } } };
    await expect(new WorkersAIClient().chat({ ...req, model: "gpt-4" })).rejects.toThrow("unsupported model");
  });
  it("요청 형식(이미지 data URL, 생각 모드 끔, JSON 스키마)과 응답·사용량", async () => {
    const run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1200, completion_tokens: 150 },
    });
    env.current = { env: { AI: { run } } };
    const r = await new WorkersAIClient().chat({ ...req, images: ["QUJD"], schema: { type: "object" }, maxTokens: 50 });
    const [model, body] = run.mock.calls[0];
    expect(model).toBe(req.model);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body.max_completion_tokens).toBe(50);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[1].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
    expect(r).toMatchObject({ content: '{"a":1}', usage: { inputTokens: 1200, outputTokens: 150 }, finishReason: "stop" });
  });
  it("용량 부족 오류는 재시도 대상, 그 밖은 아님", async () => {
    env.current = { env: { AI: { run: vi.fn().mockRejectedValue(new Error("3040: Capacity temporarily exceeded")) } } };
    await expect(new WorkersAIClient().chat(req)).rejects.toMatchObject({ opts: { retryable: true } });
    env.current = { env: { AI: { run: vi.fn().mockRejectedValue(new Error("5006: invalid input")) } } };
    await expect(new WorkersAIClient().chat(req)).rejects.toMatchObject({ opts: { retryable: false } });
  });
});
