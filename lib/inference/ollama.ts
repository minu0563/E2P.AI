import { InferenceError, isRetryableStatus, type ChatRequest, type ChatResult, type InferenceClient } from "./types";

const ns = (v?: number) => (v ? Math.round(v / 1e6) : undefined);

export class OllamaClient implements InferenceClient {
  readonly provider = "ollama";

  constructor(
    private baseUrl: string,
    private keepAlive: string,
  ) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(req.timeoutMs ?? 120_000),
      body: JSON.stringify({
        model: req.model,
        stream: false,
        keep_alive: this.keepAlive,
        format: req.schema,
        think: req.think ?? false,
        options: {
          temperature: req.temperature ?? 0,
          num_predict: req.maxTokens ?? 800,
          ...(req.contextTokens && { num_ctx: req.contextTokens }),
        },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user, images: req.images },
        ],
      }),
    });
    if (!res.ok) {
      throw new InferenceError(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`, {
        status: res.status,
        retryable: isRetryableStatus(res.status),
      });
    }
    const data = await res.json();
    return {
      content: data.message?.content ?? "",
      provider: this.provider,
      model: req.model,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
      timings: {
        totalMs: Date.now() - started,
        loadMs: ns(data.load_duration),
        promptMs: ns(data.prompt_eval_duration),
        evalMs: ns(data.eval_duration),
      },
    };
  }
}
