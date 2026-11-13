/**
 * 크레딧 원장 (사람이 직접 검토할 코드 — CLAUDE.md 2장, 9장).
 * - 추가만 하는 거래 내역. 잔액은 내역에서 계산.
 * - 예약 → 성공 시 확정 / 실패·차단 시 반환. 사용자별 advisory lock으로 원자적 처리(음수 잔액 금지).
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
};

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
  return db.$transaction(async (tx): Promise<ReserveResult> => {
    await lockUser(tx, userId);
    if (await tx.creditEntry.findFirst({ where: { requestId, kind: "reserve" } })) return { ok: true };

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = await tx.creditEntry.count({
      where: { userId, kind: "confirm", createdAt: { gte: dayStart } },
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

/** 확정(성공) 또는 반환(실패·차단). 한 요청은 한 번만 정산된다. */
async function settle(userId: string, requestId: string, outcome: "confirm" | "release") {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const reserves = await tx.creditEntry.findMany({ where: { userId, requestId, kind: "reserve" } });
    if (!reserves.length) return false;
    const settled = await tx.creditEntry.findFirst({
      where: { requestId, kind: { in: ["confirm", "release"] } },
    });
    if (settled) return false;

    if (outcome === "confirm") {
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
          },
        });
      }
    }
    return true;
  });
}

export const confirmCredits = (userId: string, requestId: string) => settle(userId, requestId, "confirm");
export const releaseCredits = (userId: string, requestId: string) => settle(userId, requestId, "release");
