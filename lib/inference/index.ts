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

export const models = {
  // thinking 변형(qwen3-vl:8b)은 think:false를 무시해 분석이 20~90초 → instruct 변형 사용(약 3.5초)
  analysis: () => process.env.ANALYSIS_MODEL ?? "qwen3-vl:8b-instruct",
  generation: () => process.env.GENERATION_MODEL ?? "gemma4:e4b",
};
