import "server-only";
import { OllamaClient } from "./ollama";
import { OpenAICompatibleClient } from "./openai";
import type { InferenceClient } from "./types";

export type { ChatRequest, ChatResult, InferenceClient } from "./types";

let client: InferenceClient | undefined;

export function getInferenceClient(): InferenceClient {
  if (client) return client;
  const provider = process.env.INFERENCE_PROVIDER ?? "ollama";
  if (provider === "ollama") {
    client = new OllamaClient(
      process.env.OLLAMA_URL ?? "http://localhost:11434",
      process.env.OLLAMA_KEEP_ALIVE ?? "30m",
    );
  } else if (provider === "openai") {
    const key = process.env.INFERENCE_API_KEY;
    const url = process.env.INFERENCE_BASE_URL;
    if (!key || !url) throw new Error("INFERENCE_API_KEY / INFERENCE_BASE_URL 필요");
    client = new OpenAICompatibleClient(url, key, process.env.INFERENCE_PROVIDER_NAME);
  } else {
    throw new Error(`알 수 없는 INFERENCE_PROVIDER: ${provider}`);
  }
  return client;
}

/**
 * 모델 하나로 이미지 분석·요청 분류·프롬프트 작성을 모두 한다 (로컬 gemma4:12b, 운영 Workers AI Gemma 4 26B A4B).
 * 세 호출의 컨텍스트 크기가 같아야 Ollama가 모델을 다시 올리지 않는다.
 */
export const models = {
  main: () => process.env.MODEL ?? "gemma4:12b",
  numCtx: () => Number(process.env.MODEL_NUM_CTX ?? 16384),
};
