import { describe, it, expect } from "vitest";
import { fmt, initials, relativeTime, formatDate } from "@/lib/utils";

describe("fmt — locale-stable formatter", () => {
  it("formats with comma separator", () => {
    expect(fmt(2496)).toBe("2,496");
    expect(fmt(5778)).toBe("5,778");
    expect(fmt(1_000_000)).toBe("1,000,000");
  });
  it("handles 0/null/undefined", () => {
    expect(fmt(0)).toBe("0");
    expect(fmt(null)).toBe("0");
    expect(fmt(undefined)).toBe("0");
  });
  it("handles bigint", () => {
    expect(fmt(BigInt(2496))).toBe("2,496");
  });
});

describe("initials", () => {
  it("two words → first letters", () => { expect(initials("Jane Doe")).toBe("JD"); });
  it("one word → first letter", () => { expect(initials("Madonna")).toBe("M"); });
  it("null/empty → ?", () => {
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});

describe("formatDate / relativeTime", () => {
  it("formatDate handles null", () => { expect(formatDate(null)).toBe("—"); });
  it("relativeTime handles null", () => { expect(relativeTime(null)).toBe("—"); });
  it("relativeTime returns 'just now' for recent", () => {
    expect(relativeTime(new Date())).toBe("just now");
  });
  it("relativeTime returns minutes for older", () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5m ago");
  });
});
