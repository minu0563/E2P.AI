import { getCurrentUser } from "@/lib/auth";
import { getQueue, queuePosition, releaseSlot, requestCancel, dropImage, type JobStage } from "@/lib/queue";
import { finishCancelled } from "@/lib/queue/process";
import { forbidden, isSameOrigin } from "@/lib/security";

type Ctx = { params: Promise<{ id: string }> };

/** 본인 작업만 (없거나 남의 것이면 404 — 존재 여부도 알려주지 않는다) */
async function ownJob(ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await ctx.params;
  const job = await getQueue().getJob(id);
  if (!job || job.data.userId !== user.id) return null;
  return job;
}

const notFound = () => Response.json({ status: "gone" }, { status: 404 });

/** 진행 상태: queued(대기 순번) → active(단계) → done(결과) */
export async function GET(_req: Request, ctx: Ctx) {
  const job = await ownJob(ctx);
  if (!job) return notFound();
  const state = await job.getState();
  if (state === "completed") return Response.json({ status: "done", result: job.returnvalue });
  if (state === "failed") return Response.json({ status: "done", result: { ok: false, code: "SYSTEM_ERROR" } });
  if (state === "active") {
    const stage = (job.progress as { stage?: JobStage } | undefined)?.stage ?? "analyzing";
    return Response.json({ status: "active", stage });
  }
  return Response.json({ status: "queued", position: await queuePosition(job.id!) });
}

/** 취소. 대기 중이면 바로 빼고 크레딧 반환, 처리 중이면 워커가 확인해 반환한다 */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!isSameOrigin(req)) return forbidden();
  const job = await ownJob(ctx);
  if (!job) return notFound();
  await requestCancel(job.id!);
  if ((await job.getState()) === "waiting") {
    try {
      await job.remove(); // 워커가 막 집어 갔으면 실패한다 → 워커가 취소 표시를 보고 처리
      await finishCancelled(job.data);
      await dropImage(job.id!);
      await releaseSlot(job.data.userId, job.id!);
    } catch {
      /* 워커가 처리 */
    }
  }
  return Response.json({ ok: true });
}
