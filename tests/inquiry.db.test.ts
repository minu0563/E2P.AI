/** 문의: 자기 생성 건에만 연결, 같은 건 중복 불가, 일반 문의는 여러 건, 이미지 확인 가능 여부. DATABASE_URL이 없으면 건너뛴다 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("문의", async () => {
  const { db } = await import("@/lib/db");
  const I = await import("@/lib/inquiry");
  let me = "";
  let other = "";
  const log = (userId: string, extra: object = {}) =>
    db.generationLog.create({
      data: { requestId: randomUUID(), userId, mode: "natural", profile: "p", requestText: "걷는다", outcome: "block", blockCode: "AGE_UNCERTAIN", creditCost: 0, ...extra },
    });

  beforeAll(async () => {
    me = (await db.user.create({ data: { email: `inq-me-${Date.now()}@example.test` } })).id;
    other = (await db.user.create({ data: { email: `inq-other-${Date.now()}@example.test` } })).id;
  });
  afterAll(async () => {
    await db.inquiry.deleteMany({ where: { userId: { in: [me, other] } } }); // 기록이 남은 사용자는 삭제가 거부된다
    await db.generationLog.deleteMany({ where: { userId: { in: [me, other] } } });
    await db.user.deleteMany({ where: { id: { in: [me, other] } } });
  });

  it("자기 생성 건에 연결해 접수, 같은 건은 한 번만", async () => {
    const l = await log(me);
    expect(await I.createInquiry(me, { requestId: l.requestId, category: "appeal", body: "성인입니다 확인 부탁" })).toMatchObject({ ok: true });
    expect(await I.createInquiry(me, { requestId: l.requestId, category: "appeal", body: "다시 보냅니다" })).toEqual({ ok: false, code: "DUPLICATE" });
  });

  it("남의 생성 건에는 연결할 수 없다", async () => {
    const l = await log(other);
    expect(await I.createInquiry(me, { requestId: l.requestId, category: "appeal", body: "남의 건 시도" })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await I.inquiryTarget(me, l.requestId)).toBeNull();
  });

  it("일반 문의는 여러 건 가능", async () => {
    expect((await I.createInquiry(me, { category: "other", body: "일반 문의 하나" })).ok).toBe(true);
    expect((await I.createInquiry(me, { category: "other", body: "일반 문의 둘" })).ok).toBe(true);
  });

  it("이미지 확인 가능 여부만 알린다 (보관 폴더는 알리지 않음)", async () => {
    const stored = await log(me, { imageTier: "blocked", imageStoredAt: new Date(), imageExpiresAt: new Date(Date.now() + 86_400_000) });
    const expired = await log(me, { imageTier: "recent", imageStoredAt: new Date(), imageExpiresAt: new Date(Date.now() - 1000) });
    const t1 = await I.inquiryTarget(me, stored.requestId);
    expect(t1).toMatchObject({ imageAvailable: true });
    expect(t1).not.toHaveProperty("imageTier");
    expect(await I.inquiryTarget(me, expired.requestId)).toMatchObject({ imageAvailable: false });
  });

  it("입력 검사: 너무 짧거나 길면 거절, 유형은 정해진 것만", () => {
    expect(I.InquiryInput.safeParse({ category: "other", body: "짧" }).success).toBe(false);
    expect(I.InquiryInput.safeParse({ category: "other", body: "가".repeat(1001) }).success).toBe(false);
    expect(I.InquiryInput.safeParse({ category: "refund", body: "환불해 주세요" }).success).toBe(false);
    expect(I.InquiryInput.safeParse({ requestId: "not-uuid", category: "other", body: "요청 아이디 형식" }).success).toBe(false);
  });
});
