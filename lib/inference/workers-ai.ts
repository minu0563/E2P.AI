import { workerRequest } from "@/platform/env";
import { withTimeout } from "./retry";
import { InferenceError, isRetryableStatus, type ChatRequest, type ChatResult, type InferenceClient } from "./types";

/**
 * Cloudflare Workers AI (바인딩 env.AI). API 키가 없다 — 바인딩은 이 Worker 안에서만 쓸 수 있다.
 * 입력·출력은 OpenAI 호환 형식 (messages, response_format json_schema, choices[0].message.content, usage).
 * 바인딩은 호출 시점에 요청 컨텍스트에서 꺼낸다 (모듈 전역에 붙잡아 두지 않는다).
 */
type AiBinding = { run(model: string, input: unknown): Promise<unknown> };

type AiOutput = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** 재시도해도 되는 오류인지 (용량 부족·일시 장애). 오류 문구는 업체가 바꿀 수 있어 넓게 본다 */
function classify(e: unknown): InferenceError {
  const msg = String((e as Error)?.message ?? e).slice(0, 200);
  const status = Number((e as { status?: unknown })?.status) || Number(msg.match(/\b([45]\d\d)\b/)?.[1]) || undefined;
  const retryable =
    (status !== undefined && isRetryableStatus(status)) || /capacity|temporarily|overloaded|try again|\b3040\b/i.test(msg);
  return new InferenceError(`workers-ai: ${msg}`, { status, retryable });
}

export class WorkersAIClient implements InferenceClient {
  readonly provider = "workers-ai";

  async chat(req: ChatRequest): Promise<ChatResult> {
    const ai = workerRequest()?.env.AI as AiBinding | undefined;
    if (!ai || typeof ai.run !== "function") throw new InferenceError("workers-ai: AI binding not configured");
    if (!req.model.startsWith("@cf/")) throw new InferenceError(`workers-ai: unsupported model ${req.model}`);

    const content = req.images?.length
      ? [
          { type: "text", text: req.user },
          ...req.images.map((b64) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } })),
        ]
      : req.user;

    const started = Date.now();
    let data: AiOutput;
    try {
      data = (await withTimeout(
        ai.run(req.model, {
          messages: [
            { role: "system", content: req.system },
            { role: "user", content },
          ],
          temperature: req.temperature ?? 0,
          max_completion_tokens: req.maxTokens ?? 800,
          ...(req.schema && { response_format: { type: "json_schema", json_schema: { name: "out", schema: req.schema } } }),
          // 생각 모드 기본값이 켜짐이라 명시적으로 끈다 (생각 토큰도 출력 요금)
          chat_template_kwargs: { enable_thinking: req.think ?? false },
        }),
        req.timeoutMs ?? 60_000,
        "workers-ai",
      )) as AiOutput;
    } catch (e) {
      throw e instanceof InferenceError ? e : classify(e);
    }

    const choice = data?.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      provider: this.provider,
      model: req.model,
      usage: {
        inputTokens: data?.usage?.prompt_tokens ?? 0,
        outputTokens: data?.usage?.completion_tokens ?? 0,
      },
      timings: { totalMs: Date.now() - started },
      finishReason: choice?.finish_reason,
    };
  }
}
