import { InferenceError, type ChatRequest, type ChatResult, type InferenceClient } from "./types";

/**
 * 재시도 감싸기: 재시도 가능한 오류(429·5xx·용량 부족)만 maxRetries회 다시 한다.
 * 시간 초과·4xx·응답 형식 오류는 다시 하지 않는다 (비용이 이미 나갔을 수 있고, 다시 해도 같은 결과).
 */
export function withRetry(
  inner: InferenceClient,
  opts: { maxRetries: number; backoffMs: number; sleep?: (ms: number) => Promise<void> },
): InferenceClient {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  return {
    provider: inner.provider,
    async chat(req: ChatRequest): Promise<ChatResult> {
      for (let attempt = 0; ; attempt++) {
        try {
          return await inner.chat(req);
        } catch (e) {
          const retryable = e instanceof InferenceError && e.opts.retryable && !e.opts.timeout;
          if (!retryable || attempt >= opts.maxRetries) throw e;
          await sleep(opts.backoffMs * (attempt + 1));
        }
      }
    },
  };
}

/** 시간 제한. 넘으면 InferenceError(timeout) — 호출 자체는 업체 쪽에서 계속될 수 있다 */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new InferenceError(`${label} timeout after ${ms}ms`, { timeout: true })), ms);
  });
  try {
    return await Promise.race([p, t]);
  } finally {
    clearTimeout(timer);
  }
}
