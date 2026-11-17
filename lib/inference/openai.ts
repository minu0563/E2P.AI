import { InferenceError, isRetryableStatus, type ChatRequest, type ChatResult, type InferenceClient } from "./types";

/** OpenAI 호환 호스팅 API 어댑터(OpenRouter, Together, Novita 등). 6단계에서 실측. */
export class OpenAICompatibleClient implements InferenceClient {
  readonly provider: string;

  constructor(
    private baseUrl: string,
    private apiKey: string,
    provider = "openai-compatible",
  ) {
    this.provider = provider;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const userContent = [
      { type: "text", text: req.user },
      ...(req.images ?? []).map((b64) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${b64}` },
      })),
    ];
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      body: JSON.stringify({
        model: req.model,
        temperature: req.temperature ?? 0,
        max_tokens: req.maxTokens ?? 800,
        response_format: req.schema
          ? { type: "json_schema", json_schema: { name: "out", schema: req.schema } }
          : undefined,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      throw new InferenceError(`${this.provider} ${res.status}: ${(await res.text()).slice(0, 200)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status),
      });
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      provider: this.provider,
      model: req.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      timings: { totalMs: Date.now() - started },
    };
  }
}
