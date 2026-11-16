import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 플랫폼(Cloudflare) 의존 코드는 이 폴더에만 둔다 (CLAUDE-cloudflare.md 2장 11번, 12장).
 * Workers에서 실행 중이면 요청 컨텍스트와 바인딩을, 아니면(next dev·테스트·Node) null을 준다.
 */
export type WorkerRequest = {
  /** 요청마다 다른 객체 (요청 단위 캐시의 키로 쓴다) */
  key: object;
  env: { HYPERDRIVE?: { connectionString: string } } & Record<string, unknown>;
  waitUntil: (p: Promise<unknown>) => void;
};

export function workerRequest(): WorkerRequest | null {
  try {
    const { env, ctx } = getCloudflareContext();
    return {
      key: ctx as object,
      env: env as unknown as WorkerRequest["env"],
      waitUntil: (p) => (ctx as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(p),
    };
  } catch {
    return null; // Workers 밖 (next dev, vitest, 스크립트)
  }
}
