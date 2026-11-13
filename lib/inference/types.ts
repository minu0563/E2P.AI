export type ChatRequest = {
  model: string;
  system: string;
  user: string;
  /** base64 (data URL 접두사 없이) */
  images?: string[];
  /** JSON Schema. 있으면 구조화 출력 */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** 생각(thinking) 모드. 기본 false — 출력 길이·지연을 줄인다 */
  think?: boolean;
  /** 문맥 길이(토큰). 긴 가이드를 넣을 때 필요 (Ollama 기본 4096) */
  contextTokens?: number;
};

export type ChatResult = {
  content: string;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  /** 단계별 시간(ms). 업체가 주지 않으면 totalMs만 */
  timings: {
    totalMs: number;
    loadMs?: number;
    promptMs?: number;
    evalMs?: number;
  };
};

/** 모든 모델 호출은 이 인터페이스 뒤로 숨긴다. 업체 전환은 설정만으로. */
export interface InferenceClient {
  readonly provider: string;
  chat(req: ChatRequest): Promise<ChatResult>;
}
