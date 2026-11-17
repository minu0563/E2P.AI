import "server-only";
import aiConfig from "@/config/ai.json";
import { OllamaClient } from "./ollama";
import { OpenAICompatibleClient } from "./openai";
import { withRetry } from "./retry";
import type { InferenceClient } from "./types";
import { WorkersAIClient } from "./workers-ai";

export type { ChatRequest, ChatResult, InferenceClient } from "./types";
export { InferenceError } from "./types";

// 클라이언트 객체는 설정값만 들고 있다 (연결·바인딩은 호출 시점에 잡는다) → 모듈 전역에 둬도 요청 간 공유 문제가 없다
let client: InferenceClient | undefined;

function build(): InferenceClient {
  const provider = process.env.INFERENCE_PROVIDER ?? "ollama";
  if (provider === "workers-ai") return new WorkersAIClient();
  if (provider === "ollama") {
    return new OllamaClient(process.env.OLLAMA_URL ?? "http://localhost:11434", process.env.OLLAMA_KEEP_ALIVE ?? "30m");
  }
  if (provider === "openai") {
    const key = process.env.INFERENCE_API_KEY;
    const url = process.env.INFERENCE_BASE_URL;
    if (!key || !url) throw new Error("INFERENCE_API_KEY / INFERENCE_BASE_URL 필요");
    return new OpenAICompatibleClient(url, key, process.env.INFERENCE_PROVIDER_NAME);
  }
  throw new Error(`알 수 없는 INFERENCE_PROVIDER: ${provider}`);
}

export function getInferenceClient(): InferenceClient {
  client ??= withRetry(build(), { maxRetries: aiConfig.retry.max_retries, backoffMs: aiConfig.retry.backoff_ms });
  return client;
}

/**
 * 모델 하나로 이미지 분석·요청 분류·프롬프트 작성을 모두 한다 (로컬 gemma4:12b, 스테이징·운영 Workers AI Gemma 4 26B A4B).
 * 세 호출의 컨텍스트 크기가 같아야 Ollama가 모델을 다시 올리지 않는다.
 */
export const models = {
  main: () => process.env.MODEL ?? "gemma4:12b",
  numCtx: () => Number(process.env.MODEL_NUM_CTX ?? 16384),
};

/** 호출별 상한·생각 모드 (config/ai.json) */
export const callLimits = {
  timeoutMs: aiConfig.timeout_ms,
  maxTokens: aiConfig.max_tokens,
  thinking: aiConfig.thinking,
};
