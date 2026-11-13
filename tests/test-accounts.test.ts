import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("테스트 계정", async () => {
  const { isTestAccount, testSafetyShadowAllowed } = await import("@/lib/test-accounts");
  afterEach(() => vi.unstubAllEnvs());

  it("TEST_ACCOUNTS에 있는 이메일만 (대소문자·공백 무시)", () => {
    vi.stubEnv("TEST_ACCOUNTS", " a@example.test , B@Example.test ");
    expect(isTestAccount("a@example.test")).toBe(true);
    expect(isTestAccount("b@example.TEST")).toBe(true);
    expect(isTestAccount("c@example.test")).toBe(false);
    expect(isTestAccount(null)).toBe(false);
  });

  it("설정이 비어 있으면 아무도 아님", () => {
    vi.stubEnv("TEST_ACCOUNTS", "");
    expect(isTestAccount("a@example.test")).toBe(false);
  });

  it("안전 검사 shadow는 운영에서 허용하지 않는다", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(testSafetyShadowAllowed()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(testSafetyShadowAllowed()).toBe(true);
  });
});
