import { describe, expect, it } from "vitest";
import { combinePhoneNumber, splitPhoneNumber } from "@/features/portfolio/phone-number";

describe("split phone entry", () => {
  it("separates existing contiguous Indian numbers without changing the saved value", () => {
    expect(splitPhoneNumber("+919731939896")).toEqual({ callingCode: "91", nationalNumber: "9731939896" });
  });

  it("accepts an explicitly separated country code, including unfamiliar codes", () => {
    expect(splitPhoneNumber("+212 612345678")).toEqual({ callingCode: "212", nationalNumber: "612345678" });
    expect(combinePhoneNumber("212", "612345678")).toBe("+212 612345678");
  });

  it("keeps unknown legacy numbers intact rather than guessing a prefix", () => {
    expect(splitPhoneNumber("+212612345678")).toEqual({ callingCode: "", nationalNumber: "+212612345678" });
    expect(combinePhoneNumber("91", "+212612345678")).toBe("+212612345678");
    expect(splitPhoneNumber("", "1")).toEqual({ callingCode: "1", nationalNumber: "" });
  });

  it("does not store a calling code alone as a phone number", () => {
    expect(combinePhoneNumber("91", "  ")).toBe("");
    expect(combinePhoneNumber("91", "98765 43210")).toBe("+91 98765 43210");
  });
});
