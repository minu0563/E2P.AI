import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const platform = vi.hoisted(() => ({ workerRequest: vi.fn() }));
vi.mock("@/platform/env", () => platform);

describe("DB 클라이언트 (Workers에서는 요청마다)", async () => {
  const { getDb } = await import("@/lib/db");
  afterEach(() => platform.workerRequest.mockReset());
  const req = (key: object, url = "postgres://u:p@hyperdrive.local/db") => ({ key, env: { HYPERDRIVE: { connectionString: url } }, waitUntil: () => {} });

  it("같은 요청 안에서는 같은 클라이언트, 다른 요청이면 새 클라이언트", () => {
    const a = {};
    const b = {};
    platform.workerRequest.mockReturnValue(req(a));
    const c1 = getDb();
    const c2 = getDb();
    platform.workerRequest.mockReturnValue(req(b));
    const c3 = getDb();
    expect(c1).toBe(c2);
    expect(c3).not.toBe(c1);
  });

  it("Workers인데 Hyperdrive 바인딩이 없으면 실패 (다른 DB로 새지 않게)", () => {
    platform.workerRequest.mockReturnValue({ key: {}, env: {}, waitUntil: () => {} });
    expect(() => getDb()).toThrow(/HYPERDRIVE/);
  });

  it("Workers 밖(Node)에서는 프로세스에 하나", () => {
    platform.workerRequest.mockReturnValue(null);
    expect(getDb()).toBe(getDb());
  });
});
