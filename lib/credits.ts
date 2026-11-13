/**
 * 크레딧 원장 (사람이 직접 검토할 코드 — CLAUDE.md 2장, 9장).
 * - 추가만 하는 거래 내역. 잔액은 내역에서 계산.
 * - 예약 → 성공 시 확정 / 실패·취소 시 반환. 사용자별 advisory lock으로 원자적 처리(음수 잔액 금지).
 * - 차단: 하루 block_fee.free_per_day회까지 반환, 그 뒤(센 사유만)는 차감. 이미지 판정 차단·시스템 오류는 항상 반환.
 * - 확정·반환 없이 reservation_ttl_minutes가 지난 예약은 자동 반환.
 * - 멱등성 키로 같은 이벤트·요청의 중복 처리를 막는다.
 * - 서버에서만 실행.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import creditConfig from "@/config/credits.json";
import type { CreditType, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export const CREDIT_CONFIG = creditConfig as {
  signup: { amount: number; credit_type: CreditType; expires_days: number };
  monthly_promo_budget: number;
  daily_limit: number;
  cost: { generate: number };
  day_utc_offset_hours: number;
  reservation_ttl_minutes: number;
  block_fee: { free_per_day: number; counted_codes: string[] };
};

/** 하루 시작 시각 (설정 시간대 기준 자정, 기본 한국) */
export function dayStart(now = new Date()) {
  const off = CREDIT_CONFIG.day_utc_offset_hours * 3_600_000;
  return new Date(Math.floor((now.getTime() + off) / 86_400_000) * 86_400_000 - off);
}

/**
 * 정산 항목(멱등성 키 settle:*)의 note 규칙
 * - "generate": 성공 확정
 * - "block:<CODE>": 차단, 반환 / "block_fee:<CODE>": 차단, 차감
 * - "error" | "cancel" | "stale": 반환
 */
export type SettleReason =
  | { type: "generate" }
  | { type: "block"; code: string }
  | { type: "error" | "cancel" | "stale" };

/** 오늘 센 차단 수 (락 안에서 호출해야 동시 요청에도 정확) */
async function countedBlocksToday(tx: Tx, userId: string, now = new Date()) {
  const notes = CREDIT_CONFIG.block_fee.counted_codes.flatMap((c) => [`block:${c}`, `block_fee:${c}`]);
  return tx.creditEntry.count({
    where: {
      userId,
      kind: { in: ["confirm", "release"] },
      idempotencyKey: { startsWith: "settle:" },
      note: { in: notes },
      createdAt: { gte: dayStart(now) },
    },
  });
}

/** 같은 사용자의 원장 작업을 직렬화 (트랜잭션 종료 시 자동 해제) */
async function lockUser(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credit:${userId}`}))`;
}

const active = (now: Date) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

/** 유효한 지급분별 남은 양 (만료 임박 순) */
async function grantBalances(tx: Tx, userId: string, now = new Date()) {
  const grants = await tx.creditEntry.findMany({
    where: { userId, kind: "grant", ...active(now) },
    select: { id: true, creditType: true, expiresAt: true },
  });
  if (!grants.length) return [];
  const sums = await tx.creditEntry.groupBy({
    by: ["grantId"],
    where: { userId, grantId: { in: grants.map((g) => g.id) } },
    _sum: { amount: true },
  });
  const left = new Map(sums.map((s) => [s.grantId, s._sum.amount ?? 0]));
  return grants
    .map((g) => ({ ...g, left: left.get(g.id) ?? 0 }))
    .filter((g) => g.left > 0)
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
}

export async function getBalance(userId: string) {
  await releaseStaleReservations(userId).catch((e) => console.error("[credits] stale release failed", String(e).slice(0, 200)));
  const gs = await grantBalances(db, userId);
  return {
    total: gs.reduce((n, g) => n + g.left, 0),
    nextExpiry: gs.find((g) => g.expiresAt)?.expiresAt ?? null,
  };
}

/** 지급. 멱등성 키가 이미 있으면 아무것도 하지 않는다. */
export async function grantCredits(args: {
  userId: string;
  amount: number;
  creditType: CreditType;
  expiresAt: Date | null;
  idempotencyKey: string;
  note?: string;
}) {
  if (args.amount <= 0) throw new Error("amount must be positive");
  if (args.creditType === "promo" && !args.expiresAt) throw new Error("promo credits need an expiry");
  return db.$transaction(async (tx) => {
    if (await tx.creditEntry.findUnique({ where: { idempotencyKey: args.idempotencyKey } })) return false;
    const id = randomUUID();
    await tx.creditEntry.create({
      data: {
        id,
        grantId: id,
        userId: args.userId,
        kind: "grant",
        creditType: args.creditType,
        amount: args.amount,
        expiresAt: args.expiresAt,
        idempotencyKey: args.idempotencyKey,
        note: args.note,
      },
    });
    return true;
  });
}

/** 가입 무료 지급. 월 프로모션 예산을 넘으면 지급하지 않는다. */
export async function grantSignupCredits(userId: string) {
  const s = CREDIT_CONFIG.signup;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const used = await db.creditEntry.aggregate({
    where: { kind: "grant", creditType: "promo", createdAt: { gte: monthStart } },
    _sum: { amount: true },
  });
  if ((used._sum.amount ?? 0) + s.amount > CREDIT_CONFIG.monthly_promo_budget) {
    console.warn("[credits] monthly promo budget reached; signup grant skipped", { userId });
    return false;
  }
  return grantCredits({
    userId,
    amount: s.amount,
    creditType: s.credit_type,
    expiresAt: new Date(Date.now() + s.expires_days * 86_400_000),
    idempotencyKey: `signup:${userId}`,
    note: "signup",
  });
}

export type ReserveResult = { ok: true } | { ok: false; reason: "NO_CREDITS" | "DAILY_LIMIT" };

/** 요청 시작 시 예약. 만료 임박 지급분부터 차감. */
export async function reserveCredits(userId: string, requestId: string, cost = CREDIT_CONFIG.cost.generate) {
  await releaseStaleReservations(userId);
  sweepAllStale();
  return db.$transaction(async (tx): Promise<ReserveResult> => {
    await lockUser(tx, userId);
    if (await tx.creditEntry.findFirst({ where: { requestId, kind: "reserve" } })) return { ok: true };

    // 하루 상한은 성공한 생성만 센다 (차단 수수료 제외; note 없는 건 이전 기록)
    const today = await tx.creditEntry.count({
      where: {
        userId,
        kind: "confirm",
        OR: [{ note: null }, { note: "generate" }],
        createdAt: { gte: dayStart() },
      },
    });
    if (today >= CREDIT_CONFIG.daily_limit) return { ok: false, reason: "DAILY_LIMIT" };

    const gs = await grantBalances(tx, userId);
    if (gs.reduce((n, g) => n + g.left, 0) < cost) return { ok: false, reason: "NO_CREDITS" };

    let need = cost;
    for (const g of gs) {
      if (!need) break;
      const take = Math.min(g.left, need);
      need -= take;
      await tx.creditEntry.create({
        data: {
          id: randomUUID(),
          userId,
          kind: "reserve",
          creditType: g.creditType,
          amount: -take,
          grantId: g.id,
          requestId,
          idempotencyKey: `reserve:${requestId}:${g.id}`,
        },
      });
    }
    return { ok: true };
  });
}

export type SettleResult = {
  /** 이번 요청을 정산했는지 (이미 정산됐으면 false) */
  settled: boolean;
  /** 크레딧이 차감됐는지 (성공 또는 차단 수수료) */
  charged: boolean;
  /** 차단 수수료로 차감됐는지 */
  blockFee: boolean;
  /** 이번 차단으로 무료 횟수를 다 썼다 → 다음 센 차단부터 차감 */
  blockWarn: boolean;
};

/** 확정 또는 반환. 한 요청은 한 번만 정산된다. 차단은 오늘 센 차단 수에 따라 결정. */
async function settle(userId: string, requestId: string, reason: SettleReason): Promise<SettleResult> {
  return db.$transaction(async (tx) => {
    const none: SettleResult = { settled: false, charged: false, blockFee: false, blockWarn: false };
    await lockUser(tx, userId);
    const reserves = await tx.creditEntry.findMany({ where: { userId, requestId, kind: "reserve" } });
    if (!reserves.length) return none;
    const settled = await tx.creditEntry.findFirst({
      where: { requestId, kind: { in: ["confirm", "release"] } },
    });
    if (settled) return none;

    let confirm = reason.type === "generate";
    let note: string = reason.type;
    let blockFee = false;
    let blockWarn = false;
    if (reason.type === "block") {
      note = `block:${reason.code}`;
      if (CREDIT_CONFIG.block_fee.counted_codes.includes(reason.code)) {
        const before = await countedBlocksToday(tx, userId);
        const free = CREDIT_CONFIG.block_fee.free_per_day;
        if (before >= free) {
          confirm = true;
          blockFee = true;
          note = `block_fee:${reason.code}`;
        } else {
          blockWarn = before + 1 === free;
        }
      }
    }

    if (confirm) {
      await tx.creditEntry.create({
        data: {
          id: randomUUID(),
          userId,
          kind: "confirm",
          creditType: reserves[0].creditType,
          amount: 0,
          grantId: reserves[0].grantId,
          requestId,
          idempotencyKey: `settle:${requestId}`,
          note,
        },
      });
    } else {
      for (const [i, r] of reserves.entries()) {
        await tx.creditEntry.create({
          data: {
            id: randomUUID(),
            userId,
            kind: "release",
            creditType: r.creditType,
            amount: -r.amount,
            grantId: r.grantId,
            requestId,
            idempotencyKey: i === 0 ? `settle:${requestId}` : `release:${requestId}:${r.grantId}`,
            note: i === 0 ? note : null,
          },
        });
      }
    }
    return { settled: true, charged: confirm, blockFee, blockWarn };
  });
}

/** 생성 성공 → 확정 */
export const confirmCredits = (userId: string, requestId: string) => settle(userId, requestId, { type: "generate" });
/** 차단 → 오늘 센 차단 수에 따라 반환 또는 차감 */
export const settleBlocked = (userId: string, requestId: string, code: string) =>
  settle(userId, requestId, { type: "block", code });
/** 시스템 오류·취소 → 항상 반환 */
export const releaseCredits = (userId: string, requestId: string, why: "error" | "cancel" = "error") =>
  settle(userId, requestId, { type: why });

/**
 * 확정·반환 없이 오래 남은 예약을 반환한다 (생성 중 서버가 죽은 경우 등).
 * userId가 없으면 전체 사용자 대상 (정리 작업용). 반환한 요청 수를 돌려준다.
 */
export async function releaseStaleReservations(userId?: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - CREDIT_CONFIG.reservation_ttl_minutes * 60_000);
  const stale = await db.$queryRaw<{ userId: string; requestId: string }[]>`
    SELECT DISTINCT r."userId", r."requestId"
    FROM "CreditEntry" r
    WHERE r.kind = 'reserve'
      AND r."createdAt" < ${cutoff}
      AND r."requestId" IS NOT NULL
      AND (${userId ?? null}::text IS NULL OR r."userId" = ${userId ?? null})
      AND NOT EXISTS (
        SELECT 1 FROM "CreditEntry" s
        WHERE s."requestId" = r."requestId" AND s.kind IN ('confirm', 'release')
      )
    LIMIT 200`;
  let n = 0;
  for (const s of stale) {
    if ((await settle(s.userId, s.requestId, { type: "stale" })).settled) n++;
  }
  if (n) console.warn("[credits] released stale reservations", { count: n });
  return n;
}

/** 전체 사용자 예약 정리. 요청이 들어올 때 최대 1분에 한 번, 응답을 기다리지 않고 돌린다. */
let lastSweep = 0;
function sweepAllStale() {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  releaseStaleReservations().catch((e) => console.error("[credits] stale sweep failed", String(e).slice(0, 200)));
}
