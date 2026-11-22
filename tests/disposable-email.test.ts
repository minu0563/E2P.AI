import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "@/lib/disposable-email";

describe("일회용 메일", () => {
  it("목록 도메인과 하위 도메인은 막고, 일반 메일은 통과", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("A@YopMail.com")).toBe(true);
    expect(isDisposableEmail("a@x.guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
    expect(isDisposableEmail("a@naver.com")).toBe(false);
    expect(isDisposableEmail("a@notmailinator.com")).toBe(false);
    expect(isDisposableEmail("broken")).toBe(false);
  });
});
