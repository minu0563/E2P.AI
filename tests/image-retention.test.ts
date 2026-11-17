import { describe, expect, it } from "vitest";
import { decideTier, isQuarantineClass } from "@/lib/image-retention";
import type { Judgment } from "@/lib/pipeline";

const img = (o: Partial<NonNullable<Judgment["image"]>> = {}) =>
  ({ image_type: "photo", person_count: 1, person_centric: true, estimated_age: 28, minor_cues: [], age_assessment: "clearly_adult", sexual_content: "none", shot_type: "bust", viewpoint: "front", text_in_image: "", subject: "", scene: "", appearance: "", pose: "", composition: "", lighting: "", visible_body_parts: [], not_visible_body_parts: [], ...o }) as NonNullable<Judgment["image"]>;
const j = (o: Partial<Judgment> = {}): Judgment => ({ imageHash: "h", image: img(), request: { request_level: "general", third_party_claim: false }, keywords: {}, rule: null, ...o });
const on = { store_enabled: true, quarantine_enabled: true };
const off = { store_enabled: true, quarantine_enabled: false };

describe("이미지 보관 폴더", () => {
  it("성공·오류·취소는 recent", () => {
    expect(decideTier("ok", null, j(), off)).toBe("recent");
    expect(decideTier("error", "SYSTEM_ERROR", null, off)).toBe("recent");
    expect(decideTier("cancel", null, j(), off)).toBe("recent");
    expect(decideTier("block", "SYSTEM_ERROR", j(), off)).toBe("recent");
  });
  it("일반 정책 차단은 blocked (연령 애매 + 일상 요청, 제3자, 출력 필터)", () => {
    expect(decideTier("block", "AGE_UNCERTAIN", j({ image: img({ age_assessment: "ambiguous", estimated_age: 19 }) }), off)).toBe("blocked");
    expect(decideTier("block", "THIRD_PARTY_CLAIM", j({ request: { request_level: "general", third_party_claim: true } }), off)).toBe("blocked");
    expect(decideTier("block", "OUTPUT_FILTER", j(), off)).toBe("blocked");
    // 성인 이미지 + 성적 요청 (이미지 자체는 성적이지 않음)
    expect(decideTier("block", "SEXUAL_REQUEST", j({ request: { request_level: "suggestive", third_party_claim: false } }), off)).toBe("blocked");
  });
  it("법령 위반 의심은 격리 대상", () => {
    expect(isQuarantineClass("SEXUAL_IMAGE", j())).toBe(true);
    expect(isQuarantineClass("AGE_UNCERTAIN", j({ image: img({ age_assessment: "possibly_minor" }), request: { request_level: "suggestive", third_party_claim: false } }))).toBe(true);
    expect(isQuarantineClass("AGE_UNCERTAIN", j({ image: img({ age_assessment: "ambiguous", sexual_content: "suggestive" }) }))).toBe(true);
    expect(isQuarantineClass("SEXUAL_REQUEST", j({ keywords: { minor: ["중학생"], suggestive: ["x"] }, image: null, request: null }))).toBe(true);
    expect(isQuarantineClass("SEXUAL_REQUEST", j({ image: img({ sexual_content: "explicit" }) }))).toBe(true);
    // 판정 근거 없이 성적 요청·우회 시도 → 이미지를 확인할 수 없으니 격리 쪽
    expect(isQuarantineClass("SEXUAL_REQUEST", j({ image: null, request: null, keywords: { explicit: ["x"] } }))).toBe(true);
    expect(isQuarantineClass("MODE_RESTRICTED", null)).toBe(true);
  });
  it("격리 스위치가 꺼져 있으면 저장하지 않는다 (recent에도 넣지 않음)", () => {
    expect(decideTier("block", "SEXUAL_IMAGE", j(), off)).toBeNull();
    expect(decideTier("block", "SEXUAL_IMAGE", j(), on)).toBe("quarantine");
    // 성공했더라도 성적 신호 + 연령 애매면 (shadow 등) 격리 규칙을 따른다
    expect(decideTier("ok", null, j({ image: img({ age_assessment: "ambiguous", sexual_content: "suggestive" }) }), off)).toBeNull();
  });
  it("저장 끄면 아무것도 저장하지 않는다", () => {
    expect(decideTier("ok", null, j(), { store_enabled: false, quarantine_enabled: true })).toBeNull();
  });
});
