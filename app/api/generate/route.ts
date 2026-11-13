import appConfig from "@/config/app.json";
import { ImageError, processImage } from "@/lib/image";
import { runPipeline } from "@/lib/pipeline";
import type { Fields } from "@/lib/pipeline/assemble";
import { DEFAULT_PROFILE, FIELD_KEYS, PACES, getProfile, type Pace } from "@/lib/profile";
import { BLOCK_MESSAGES, type BlockCode } from "@/lib/safety/messages";
import { randomUUID } from "node:crypto";
import { getCurrentUser, hasCurrentConsent } from "@/lib/auth";
import { CREDIT_CONFIG, confirmCredits, getBalance, releaseCredits, reserveCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import type { HistoryInput } from "@/lib/history";

const { limits, features } = appConfig;

const bad = (message: string, status = 400) =>
  Response.json({ ok: false, code: "INVALID_INPUT", message }, { status });

const fail = (code: BlockCode, status: number) =>
  Response.json({ ok: false, code, message: BLOCK_MESSAGES[code] }, { status });

export async function POST(request: Request) {
  // TODO(3단계): 사용자별 속도 제한·동시 요청 제한·큐
  const user = await getCurrentUser();
  if (!user) return fail("LOGIN_REQUIRED", 401);
  if (!(await hasCurrentConsent(user.id))) return fail("LOGIN_REQUIRED", 401);

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

  // 크레딧 예약 → 성공 시 확정, 차단·실패 시 반환
  const requestId = randomUUID();
  const cost = CREDIT_CONFIG.cost.generate;
  const reserved = await reserveCredits(user.id, requestId, cost);
  if (!reserved.ok) return fail(reserved.reason, 402);

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
  const writeLog = (outcome: string, blockCode: string | null, creditCost: number, prompt?: string) =>
    db.generationLog
      .create({
        data: {
          requestId,
          userId: user.id,
          mode: inputMode,
          profile: profile.profile,
          requestText: request_,
          outcome,
          blockCode,
          creditCost,
          prompt: prompt ?? null,
          input: savedInput,
        },
      })
      .catch((e) => console.error("[log] write failed", String(e).slice(0, 200)));

  try {
    const result = await runPipeline({
      requestId,
      profile,
      inputMode,
      request: request_,
      fields,
      placeholder,
      duration,
      aspectRatio,
      pace,
      image,
    });
    if (result.ok) {
      await confirmCredits(user.id, requestId);
      await writeLog("ok", null, cost, result.prompt);
    } else {
      await releaseCredits(user.id, requestId);
      await writeLog("block", result.code, 0);
    }
    const { total } = await getBalance(user.id);
    return Response.json({ ...result, balance: total });
  } catch (e) {
    console.error("[pipeline] unexpected", String(e).slice(0, 300));
    await releaseCredits(user.id, requestId).catch(() => {});
    await writeLog("error", "SYSTEM_ERROR", 0);
    return Response.json(
      { ok: false, code: "SYSTEM_ERROR", message: BLOCK_MESSAGES.SYSTEM_ERROR },
      { status: 500 },
    );
  }
}
