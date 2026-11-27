import appConfig from "@/config/app.json";
import { isRestricted } from "@/lib/abuse";
import { checkBudget } from "@/lib/ai-budget";
import { ImageError, validateImage } from "@/lib/image";
import { parseCameraPreset } from "@/lib/camera";
import type { Fields } from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, FIELD_KEYS, PACES, getProfile, type Pace } from "@/lib/profile";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import { randomUUID } from "node:crypto";
import { getCurrentUser, hasCurrentConsent, hasSessionCookie } from "@/lib/auth";
import { CREDIT_CONFIG, grantDailyCredits, reserveCredits } from "@/lib/credits";
import type { HistoryInput } from "@/lib/history";
import { runGeneration } from "@/lib/generate";
import { GENERATION_CONFIG, RATE_CONFIG, activeCount, claimSlot, clientIp, hit, releaseSlot } from "@/lib/limits";
import { forbidden, isSameOrigin } from "@/lib/security";
import { isTestAccount, testSafetyShadowAllowed } from "@/lib/test-accounts";
import { isAdminEmail } from "@/system/admin/guard";

const { limits, features } = appConfig;
/** 이미지 외 폼 필드(요청·항목·설정값)와 multipart 경계 여유분 */
const MAX_FORM_OVERHEAD = 64 * 1024;

const bad = (message: string, status = 400) =>
  Response.json({ ok: false, code: "INVALID_INPUT", message }, { status });

const fail = (code: BlockCode, status: number) =>
  Response.json({ ok: false, code, message: BLOCK_MESSAGES[code] }, { status });

/**
 * 생성 요청. 검증·속도 제한·크레딧 예약 뒤 같은 요청 안에서 끝까지 처리하고,
 * 진행 단계와 결과를 NDJSON 스트림으로 보낸다({type:"stage"} … {type:"result"}).
 * 큐·워커가 없으므로 Workers에서 그대로 돈다(추론 응답을 기다리는 시간은 CPU 시간이 아니다).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  // 로그인 쿠키조차 없으면 DB를 건드리기 전에 거절 (익명 폭주가 DB까지 오지 않게)
  if (!(await hasSessionCookie())) return fail("LOGIN_REQUIRED", 401);
  const user = await getCurrentUser();
  if (!user) return fail("LOGIN_REQUIRED", 401);
  // 테스트 계정: 크레딧·속도 제한 없음 (TEST_ACCOUNTS)
  const test = isTestAccount(user.email);
  if (!test && !(await hit(`ip:${clientIp(request)}`, RATE_CONFIG.ip_per_minute, 60))) return fail("RATE_LIMITED", 429);
  if (!(await hasCurrentConsent(user.id))) return fail("LOGIN_REQUIRED", 401);
  // 연속 차단으로 일시 제한된 계정 (lib/abuse.ts)
  if (isRestricted(user)) return fail("RESTRICTED", 429);
  // 첫 생성 전(약관 버전이 바뀐 뒤 포함) 이용약관·허용 정책 확인. 크레딧 예약 전이라 이 거절은 비용이 없다
  if (user.policyAckVersion !== process.env.TERMS_VERSION) return fail("POLICY_ACK_REQUIRED", 428);
  if (!test && !(await hit(`user:${user.id}`, RATE_CONFIG.user_per_minute, 60))) return fail("RATE_LIMITED", 429);

  // 본문을 메모리에 올리기 전에 크기 확인 (formData()는 본문 전체를 읽는다). 이미지 상한 + 글·필드 여유분
  // (헤더가 없는 경우는 막지 않는다 — 브라우저는 FormData 길이를 항상 보내고, 프록시 구간에서 빠질 수 있어 정상 요청을 막을 위험이 더 크다)
  // 시작·끝 이미지 모드는 이미지가 2장 (장마다 같은 상한)
  const declared = Number(request.headers.get("content-length"));
  if (declared > limits.max_upload_bytes * 2 + MAX_FORM_OVERHEAD) {
    return bad("이미지 파일이 너무 큽니다.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return bad("이미지를 올려 주세요.");
  if (file.size > limits.max_upload_bytes) return bad("이미지 파일이 너무 큽니다.");
  // 시작·끝 이미지 모드: 끝 이미지 필수 (끝 이미지만 넣는 경우는 없다). 지금은 최대 2장
  const frames = form.get("frames") === "start_end" ? "start_end" : "single";
  const fileEnd = frames === "start_end" ? form.get("imageEnd") : null;
  if (frames === "start_end" && !features.start_end_frames) return bad("이용 중인 요금제에서 지원하지 않는 기능입니다.");
  if (frames === "start_end" && (!(fileEnd instanceof File) || fileEnd.size === 0)) return bad("끝 이미지를 올려 주세요.");
  if (fileEnd instanceof File && fileEnd.size > limits.max_upload_bytes) return bad("이미지 파일이 너무 큽니다.");

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
  // 연출 설정 (목록에 없는 값은 기본값). 카메라 프리셋은 코드가 공식 문장으로 바꾼다
  const camera = parseCameraPreset(form.get("cameraMotion"), form.get("cameraAmplitude"), form.get("cameraSpeed"));
  const gaze = form.get("gaze") === "camera" ? "camera" : "auto";
  const dialogueMode = form.get("dialogueMode") === "voiceover" ? "voiceover" : "on_screen";

  let image;
  let imageEnd: Awaited<ReturnType<typeof validateImage>> | undefined;
  try {
    image = await validateImage(new Uint8Array(await file.arrayBuffer()), limits.max_image_side, limits.max_upload_bytes);
    if (fileEnd instanceof File) {
      imageEnd = await validateImage(new Uint8Array(await fileEnd.arrayBuffer()), limits.max_image_side, limits.max_upload_bytes);
    }
  } catch (e) {
    return bad(e instanceof ImageError ? e.message : "이미지를 읽을 수 없습니다.");
  }
  const cost = imageEnd ? CREDIT_CONFIG.cost.start_end : CREDIT_CONFIG.cost.generate;

  // 킬 스위치·AI 예산 (모든 계정, 테스트 계정 포함). 사유는 로그에만, 사용자에게는 "잠시 쉼"만
  const budget = await checkBudget();
  if (!budget.ok) {
    console.warn(`[budget] generation refused: ${budget.reason}`);
    return fail("PAUSED", 503);
  }

  // 전체 동시 생성 상한 (추론 서비스 분당 한도·비용 보호)
  if ((await activeCount()) >= GENERATION_CONFIG.max_active_total) return fail("QUEUE_FULL", 503);

  // 사용자당 동시 1건 (DB 유니크 키로 원자적)
  const requestId = randomUUID();
  if (!test && !(await claimSlot(user.id, requestId))) return fail("BUSY", 429);

  // 크레딧 예약. 테스트 계정은 예약하지 않는다 (예약이 없으면 확정·반환은 아무것도 하지 않음)
  if (!test) {
    // 오늘 무료 지급이 아직 없으면 먼저 지급 (하루 한 번)
    await grantDailyCredits(user.id);
    const reserved = await reserveCredits(user.id, requestId, cost);
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
    camera,
    gaze,
    dialogueMode,
    frames,
  };

  // 사용자가 취소하거나 연결이 끊기면: 남은 추론을 건너뛰고 크레딧 반환
  let aborted = false;
  request.signal.addEventListener("abort", () => (aborted = true));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (msg: object) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
        } catch {
          aborted = true; // 이미 닫힌 연결
        }
      };
      const result = await runGeneration(
        {
          requestId,
          userId: user.id,
          // 안전 검사 shadow는 개발 환경의 테스트 계정만 (운영에서는 모두 같은 규칙)
          ...(test && { test: { safetyShadow: testSafetyShadowAllowed() } }),
          // 관리자 계정은 생성 기록·이미지를 저장하지 않는다
          noRecord: isAdminEmail(user.email),
          profile,
          input: { inputMode, request: request_, fields, placeholder, duration, aspectRatio, pace, camera, gaze, dialogueMode },
          image,
          ...(imageEnd && { imageEnd }),
          cost,
          savedInput,
        },
        { onStage: (stage) => send({ type: "stage", stage }), isCancelled: () => aborted },
      );
      send({ type: "result", result });
      try {
        controller.close();
      } catch {
        /* 이미 닫힘 */
      }
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
