import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("큐 이미지 암호화", async () => {
  beforeAll(() => {
    process.env.QUEUE_SECRET ??= randomBytes(32).toString("hex");
  });
  const { seal, open } = await import("@/lib/queue/crypto");

  it("암호화 → 복호화하면 원래 내용", () => {
    const data = randomBytes(5000);
    const sealed = seal(data);
    expect(sealed.includes(data.subarray(0, 64))).toBe(false);
    expect(open(sealed).equals(data)).toBe(true);
  });

  it("조금이라도 바뀌면 복호화 실패", () => {
    const sealed = seal(Buffer.from("hello"));
    sealed[sealed.length - 1] ^= 1;
    expect(() => open(sealed)).toThrow();
  });
});
