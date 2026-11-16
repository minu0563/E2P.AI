import appConfig from "@/config/app.json";
import { ImageError, validateImage } from "@/lib/image";
import type { Fields } from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, FIELD_KEYS, PACES, getProfile, type Pace } from "@/lib/profile";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import { randomUUID } from "node:crypto";
import { getCurrentUser, hasCurrentConsent, hasSessionCookie } from "@/lib/auth";
import { CREDIT_CONFIG, reserveCredits } from "@/lib/credits";
import type { HistoryInput } from "@/lib/history";
import { runGeneration } from "@/lib/generate";
import { GENERATION_CONFIG, RATE_CONFIG, activeCount, claimSlot, clientIp, hit, releaseSlot } from "@/lib/limits";
import { forbidden, isSameOrigin } from "@/lib/security";
import { isTestAccount, testSafetyShadowAllowed } from "@/lib/test-accounts";

const { limits, features } = appConfig;

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
  if (!test && !(await hit(`user:${user.id}`, RATE_CONFIG.user_per_minute, 60))) return fail("RATE_LIMITED", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return bad("이미지를 올려 주세요.");
  if (file.size > limits.max_upload_bytes) return bad("이미지 파일이 너무 큽니다.");

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
    image = await validateImage(new Uint8Array(await file.arrayBuffer()), limits.max_image_side, limits.max_upload_bytes);
  } catch (e) {
    return bad(e instanceof ImageError ? e.message : "이미지를 읽을 수 없습니다.");
  }

  // 전체 동시 생성 상한 (추론 서비스 분당 한도·비용 보호)
  if ((await activeCount()) >= GENERATION_CONFIG.max_active_total) return fail("QUEUE_FULL", 503);

  // 사용자당 동시 1건 (DB 유니크 키로 원자적)
  const requestId = randomUUID();
  if (!test && !(await claimSlot(user.id, requestId))) return fail("BUSY", 429);

  // 크레딧 예약. 테스트 계정은 예약하지 않는다 (예약이 없으면 확정·반환은 아무것도 하지 않음)
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
          profile,
          input: { inputMode, request: request_, fields, placeholder, duration, aspectRatio, pace },
          image,
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
