import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { workerRequest } from "@/platform/env";

/**
 * DB 클라이언트는 이 파일에서만 만든다 (CLAUDE-cloudflare.md 2장 2번).
 * - Workers: 요청마다 새 클라이언트(Hyperdrive 연결, maxUses 1). 한 요청 안에서는 재사용한다.
 *   Workers는 한 요청에서 연 소켓을 다른 요청이 쓰는 것을 허용하지 않으므로 모듈 전역 클라이언트를 공유하지 않는다.
 * - Node(next dev·테스트): 프로세스에 하나 (DATABASE_URL).
 * 기존 코드가 `db.user…`처럼 쓰도록 `db`는 호출 시점의 클라이언트로 위임하는 프록시다.
 */
const perRequest = new WeakMap<object, PrismaClient>();
const g = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  const w = workerRequest();
  if (w) {
    const url = w.env.HYPERDRIVE?.connectionString;
    if (!url) throw new Error("HYPERDRIVE binding not configured");
    let client = perRequest.get(w.key);
    if (!client) {
      client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, maxUses: 1 }) });
      // maxUses 1: 연결은 한 번 쓰고 닫힌다 (Hyperdrive가 풀링을 맡는다). 요청이 끝나면 WeakMap에서 함께 사라진다
      perRequest.set(w.key, client);
    }
    return client;
  }
  g.prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  return g.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
