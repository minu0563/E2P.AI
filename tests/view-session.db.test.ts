/** 관리자 이미지 열람 세션: 열쇠 확인, 다른 관리자 거부, 무활동·최대 시간 만료, 종료 기록. DATABASE_URL이 없으면 건너뛴다 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const who = vi.hoisted(() => ({ email: "admin-vs@example.test" as string | null }));
vi.mock("@/system/admin/guard", async (orig) => ({
  ...(await orig<typeof import("@/system/admin/guard")>()),
  adminUser: async () => (who.email ? { email: who.email } : null),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("이미지 열람 세션", async () => {
  const { db } = await import("@/lib/db");
  const V = await import("@/system/admin/view-session");
  const req = (token?: string) => new Request("http://x/api", { headers: token ? { [V.VIEW_HEADER]: token } : {} });
  const cleanup = async () => {
    await db.imageViewSession.deleteMany({ where: { adminEmail: { endsWith: "-vs@example.test" } } });
    await db.adminLog.deleteMany({ where: { adminEmail: { endsWith: "-vs@example.test" } } });
  };
  beforeAll(cleanup);
  afterAll(cleanup);

  it("열쇠가 맞으면 통과, 없거나 틀리면 401, 관리자가 아니면 404", async () => {
    who.email = "admin-vs@example.test";
    const token = await V.createViewSession(who.email, "tuning");
    expect((await V.requireViewSession(req(token))).ok).toBe(true);
    expect(await V.requireViewSession(req())).toEqual({ ok: false, status: 401 });
    expect(await V.requireViewSession(req("x".repeat(43)))).toEqual({ ok: false, status: 401 });
    who.email = null;
    expect(await V.requireViewSession(req(token))).toEqual({ ok: false, status: 404 });
  });

  it("다른 관리자의 열쇠로는 못 본다", async () => {
    who.email = "admin-vs@example.test";
    const token = await V.createViewSession(who.email, "support");
    who.email = "other-vs@example.test";
    expect(await V.requireViewSession(req(token))).toEqual({ ok: false, status: 401 });
  });

  it("무활동·최대 시간이 지나면 끝나고 종료가 한 번 기록된다", async () => {
    who.email = "admin-vs@example.test";
    const idle = await V.createViewSession(who.email, "tuning");
    await db.imageViewSession.updateMany({ where: { adminEmail: who.email, endedAt: null, purpose: "tuning" }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await V.requireViewSession(req(idle))).toEqual({ ok: false, status: 401 });
    expect(await V.requireViewSession(req(idle))).toEqual({ ok: false, status: 401 });

    const max = await V.createViewSession(who.email, "other");
    await db.imageViewSession.updateMany({ where: { adminEmail: who.email, endedAt: null, purpose: "other" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await V.requireViewSession(req(max))).toEqual({ ok: false, status: 401 });

    const ends = await db.adminLog.findMany({ where: { adminEmail: who.email, action: "image_view_end" } });
    const reasons = ends.map((e) => (e.detail as { reason: string }).reason).sort();
    expect(reasons).toEqual(["idle", "max"]);
    const starts = await db.adminLog.count({ where: { adminEmail: who.email, action: "image_view_start" } });
    expect(starts).toBeGreaterThanOrEqual(3);
  });

  it("직접 종료하면 그 열쇠는 더 못 쓴다", async () => {
    who.email = "admin-vs@example.test";
    const token = await V.createViewSession(who.email, "tuning");
    const a = await V.requireViewSession(req(token));
    if (!a.ok) throw new Error("expected ok");
    await V.endViewSession(a.session, "manual");
    expect(await V.requireViewSession(req(token))).toEqual({ ok: false, status: 401 });
  });
});
