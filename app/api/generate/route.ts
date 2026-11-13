import appConfig from "@/config/app.json";
import { ImageError, processImage } from "@/lib/image";
import type { Fields } from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, FIELD_KEYS, PACES, getProfile, type Pace } from "@/lib/profile";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import { randomUUID } from "node:crypto";
import { getCurrentUser, hasCurrentConsent } from "@/lib/auth";
import { CREDIT_CONFIG, releaseCredits, reserveCredits } from "@/lib/credits";
import type { HistoryInput } from "@/lib/history";
import { QUEUE_CONFIG, RATE_CONFIG, claimSlot, dropImage, getQueue, putImage, releaseSlot } from "@/lib/queue";
import { clientIp, hit } from "@/lib/rate-limit";
import { forbidden, isSameOrigin } from "@/lib/security";
import { isTestAccount, testSafetyShadowAllowed } from "@/lib/test-accounts";

const { limits, features } = appConfig;

const bad = (message: string, status = 400) =>
  Response.json({ ok: false, code: "INVALID_INPUT", message }, { status });

const fail = (code: BlockCode, status: number) =>
  Response.json({ ok: false, code, message: BLOCK_MESSAGES[code] }, { status });

/**
 * 생성 요청 등록. 검증·속도 제한·크레딧 예약 뒤 큐에 넣고 바로 jobId를 돌려준다.
 * 진행 상태·결과는 GET /api/generate/[id], 취소는 DELETE /api/generate/[id].
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const ipOk = await hit(`ip:${clientIp(request)}`, RATE_CONFIG.ip_per_minute, 60);
  const user = await getCurrentUser();
  // 테스트 계정: 크레딧·속도 제한 없음 (TEST_ACCOUNTS)
  const test = isTestAccount(user?.email);
  if (!ipOk && !test) return fail("RATE_LIMITED", 429);
  if (!user) return fail("LOGIN_REQUIRED", 401);
  if (!(await hasCurrentConsent(user.id))) return fail("LOGIN_REQUIRED", 401);
  if (!test && !(await hit(`user:${user.id}`, RATE_CONFIG.user_per_minute, 60))) return fail("RATE_LIMITED", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return bad("이미지를 올려 주세요.");
  if (file.size > limits.max_upload_bytes) return bad("이미지는 10MB 이하만 가능합니다.");

  const profile = getProfile(String(form.get("profile") ?? DEFAULT_PROFILE));
  if (!profile) return bad("지원하지 않는 대상 모델입니다.");

  const inputMode = form.get("inputMode") === "fields" ? "fields" : "natural";
  const request_ = String(form.get("request") ?? "").trim();
  if (request_.length > limits.max_request_chars) {
    return bad(`요청은 ${limits.max_request_chars}자 이하로 입력해 주세요.`);
  }

  const fields = {} as Fields;
  for (const k of FIELD_KEYS) {
    const v = inputMode === "fields" ? String(form.get(`field.${k}`) ?? "").trim() : "";
    if (v.length > limits.max_field_chars) {
      return bad(`각 항목은 ${limits.max_field_chars}자 이하로 입력해 주세요.`);
    }
    fields[k] = v;
  }

  const placeholder = form.get("placeholder") === "on";
  if (placeholder && !features.placeholder_mode) return bad("이용 중인 요금제에서 지원하지 않는 기능입니다.");
  if (placeholder) fields.key_action = ""; // 빈칸 모드: 동작 텍스트를 받지 않는다
  if (inputMode === "natural" && !request_ && !placeholder) return bad("요청을 입력해 주세요.");

  const d = profile.duration;
  const durationRaw = Number(form.get("duration") ?? d.default);
  const duration = Number.isInteger(durationRaw) && durationRaw >= d.min && durationRaw <= d.max ? durationRaw : d.default;
  const ratioRaw = String(form.get("aspectRatio") ?? "");
  const aspectRatio = profile.aspect_ratios.includes(ratioRaw) ? ratioRaw : "";
  const paceRaw = String(form.get("pace") ?? "normal");
  const pace: Pace = (PACES as string[]).includes(paceRaw) ? (paceRaw as Pace) : "normal";

  let image;
  try {
    image = await processImage(Buffer.from(await file.arrayBuffer()), limits.max_image_side);
  } catch (e) {
    return bad(e instanceof ImageError ? e.message : "이미지를 읽을 수 없습니다.");
  }

  const queue = getQueue();
  if ((await queue.getWaitingCount()) >= QUEUE_CONFIG.max_waiting) return fail("QUEUE_FULL", 503);

  // 사용자당 동시 1건
  const requestId = randomUUID();
  if (!test && !(await claimSlot(user.id, requestId))) return fail("BUSY", 429);

  // 크레딧 예약 → 워커가 성공 시 확정, 실패·취소 시 반환, 차단은 하루 무료 횟수 뒤 차감
  // 테스트 계정은 예약하지 않는다 (예약이 없으면 워커의 확정·반환은 아무것도 하지 않음)
  if (!test) {
    const reserved = await reserveCredits(user.id, requestId, CREDIT_CONFIG.cost.generate);
    if (!reserved.ok) {
      await releaseSlot(user.id, requestId);
      return fail(reserved.reason, 402);
    }
  }

  // 다시 불러와 고칠 수 있도록 당시 입력값을 저장 (이미지는 저장하지 않음)
  const savedInput: HistoryInput = {
    inputMode,
    request: request_,
    fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v)),
    placeholder,
    duration,
    aspectRatio,
    pace,
  };

  try {
    await putImage(requestId, image);
    await queue.add(
      "generate",
      {
        requestId,
        userId: user.id,
        profileId: profile.profile,
        input: { inputMode, request: request_, fields, placeholder, duration, aspectRatio, pace },
        imageHash: image.hash,
        savedInput,
        // 안전 검사 shadow는 개발 환경의 테스트 계정만 (운영에서는 모두 같은 규칙)
        ...(test && { test: { safetyShadow: testSafetyShadowAllowed() } }),
      },
      { jobId: requestId },
    );
  } catch (e) {
    console.error("[generate] enqueue failed", String(e).slice(0, 300));
    await dropImage(requestId).catch(() => {});
    await releaseCredits(user.id, requestId, "error").catch(() => {});
    await releaseSlot(user.id, requestId).catch(() => {});
    return fail("SYSTEM_ERROR", 503);
  }
  return Response.json({ ok: true, queued: true, jobId: requestId }, { status: 202 });
}
