/** 보관 기간 파기·탈퇴: 기록이 남은 사용자는 삭제 거부, 오래된 기록만 삭제, hold는 남김, 탈퇴 계정은 기간 뒤 삭제. DATABASE_URL이 없으면 건너뛴다 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import appConfig from "@/config/app.json";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => {} }) }));

const run = process.env.DATABASE_URL ? describe : describe.skip;
const DAY = 86_400_000;
const R = appConfig.retention;

run("보관 기간 파기·탈퇴", async () => {
  const { db } = await import("@/lib/db");
  const { purgeExpired } = await import("@/lib/retention");
  const { withdrawUser, upsertGoogleUser } = await import("@/lib/auth");
  const ids: string[] = [];
  const newUser = async (data: object = {}) => {
    const id = (await db.user.create({ data: { email: `ret-${randomUUID()}@example.test`, ...data } })).id;
    ids.push(id);
    return id;
  };
  const log = (userId: string, createdAt: Date, imageTier: string | null = null) =>
    db.generationLog.create({
      data: { requestId: randomUUID(), userId, mode: "natural", profile: "p", requestText: "x", outcome: "ok", creditCost: 1, createdAt, imageTier },
    });
  const exists = async (requestId: string) => !!(await db.generationLog.findUnique({ where: { requestId } }));
  const old = () => new Date(Date.now() - (R.record_days + 2) * DAY);

  afterAll(async () => {
    await db.creditEntry.deleteMany({ where: { userId: { in: ids } } });
    await db.inquiry.deleteMany({ where: { userId: { in: ids } } });
    await db.generationLog.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("기록이 남은 사용자는 DB가 삭제를 거부한다", async () => {
    const u = await newUser();
    await log(u, new Date());
    await expect(db.user.delete({ where: { id: u } })).rejects.toThrow();
  });

  it("오래된 기록만 지우고, 최근 기록과 hold는 남긴다", async () => {
    const u = await newUser();
    const a = await log(u, old());
    const b = await log(u, new Date());
    const h = await log(u, old(), "hold");
    await purgeExpired();
    expect(await exists(a.requestId)).toBe(false);
    expect(await exists(b.requestId)).toBe(true);
    expect(await exists(h.requestId)).toBe(true);
  });

  it("탈퇴는 표시만, 기록은 남는다. 다시 로그인하면 같은 계정이 되살아난다", async () => {
    const sub = `sub-${randomUUID()}`;
    const email = `ret-${randomUUID()}@example.test`;
    const u = await newUser({ email, googleSub: sub });
    const l = await log(u, new Date());
    await withdrawUser(u);
    expect((await db.user.findUniqueOrThrow({ where: { id: u } })).withdrawnAt).not.toBeNull();
    expect(await exists(l.requestId)).toBe(true);
    const back = await upsertGoogleUser({ sub, email, name: null });
    expect(back.id).toBe(u);
    expect(back.withdrawnAt).toBeNull();
  });

  it("탈퇴 후 보관 기간이 지난 계정은 기록과 함께 삭제, hold가 있으면 남긴다", async () => {
    const longAgo = new Date(Date.now() - (R.withdrawn_days + 2) * DAY);
    const gone = await newUser({ withdrawnAt: longAgo });
    await log(gone, new Date());
    const held = await newUser({ withdrawnAt: longAgo });
    await log(held, new Date(), "hold");
    const recent = await newUser({ withdrawnAt: new Date() });
    await purgeExpired();
    expect(await db.user.findUnique({ where: { id: gone } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: held } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: recent } })).not.toBeNull();
  });

  it("오래되고 만료된 지급분만 크레딧 내역에서 지운다", async () => {
    const u = await newUser();
    const mk = (createdAt: Date, expiresAt: Date | null) => {
      const id = randomUUID();
      return db.creditEntry.create({
        data: { id, grantId: id, userId: u, kind: "grant", creditType: "promo", amount: 1, createdAt, expiresAt, idempotencyKey: `ret:${id}` },
      });
    };
    const oldExpired = await mk(old(), new Date(old().getTime() + DAY));
    const recent = await mk(new Date(), new Date(Date.now() + DAY));
    await purgeExpired();
    expect(await db.creditEntry.findUnique({ where: { id: oldExpired.id } })).toBeNull();
    expect(await db.creditEntry.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});
