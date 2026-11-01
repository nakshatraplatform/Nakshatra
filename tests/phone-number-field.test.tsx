// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PhoneNumberField } from "@/components/portfolio/PhoneNumberField";
import { isValidInterestPhoneNumber } from "@/features/portfolio/phone-number";

describe("PhoneNumberField", () => {
  it("accepts ten national digits for India and the US and retains other international lengths", () => {
    expect(isValidInterestPhoneNumber("+91 9876543210")).toBe(true);
    expect(isValidInterestPhoneNumber("+1 6175550123")).toBe(true);
    expect(isValidInterestPhoneNumber("+91 987654321")).toBe(false);
    expect(isValidInterestPhoneNumber("+1 61755501234")).toBe(false);
    expect(isValidInterestPhoneNumber("+44 7700900123")).toBe(true);
    expect(isValidInterestPhoneNumber("+91 abcdefghij")).toBe(false);
    expect(isValidInterestPhoneNumber("9876543210")).toBe(false);
    expect(isValidInterestPhoneNumber("+000 9876543210")).toBe(false);
  });
  it("keeps letters out of a visitor's phone field without blocking paste", () => {
    function Example() {
      const [value, setValue] = useState("");
      return <PhoneNumberField value={value} onChange={setValue} defaultCallingCode="91" interestContact required name="phone" />;
    }
    render(<Example />);
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "98ab765 43210" } });
    expect(screen.getByRole("textbox", { name: "Phone number" })).toHaveValue("9876543210");
    expect(screen.getByDisplayValue("+91 9876543210")).toHaveAttribute("type", "hidden");
  });
  it("does not silently shorten an overlong interest contact", () => {
    function Example() {
      const [value, setValue] = useState("");
      return <PhoneNumberField value={value} onChange={setValue} defaultCallingCode="91" interestContact required name="phone" />;
    }
    render(<Example />);
    const phone = screen.getByRole("textbox", { name: "Phone number" });
    fireEvent.change(phone, { target: { value: "98765432101" } });
    expect(phone).toHaveValue("98765432101");
    fireEvent.blur(phone, { relatedTarget: null });
    expect(screen.getByRole("alert")).toHaveTextContent("10-digit phone number");
  });
  it("announces a local syntax error only after leaving the phone group", () => {
    render(<PhoneNumberField value="123" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(screen.getByRole("textbox", { name: "Phone number" }), { relatedTarget: null });
    expect(screen.getByRole("alert")).toHaveTextContent("7–20 digits");
    expect(screen.getByRole("textbox", { name: "Phone number" })).toHaveAttribute("aria-invalid", "true");
  });
  it("associates an external error without duplicating its parent's announcement", () => {
    render(<PhoneNumberField value="123" error="Check this phone number." onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Phone number" })).toHaveAccessibleDescription("Check this phone number.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps an unfamiliar full international number intact when the code changes", () => {
    const onChange = vi.fn();
    render(<PhoneNumberField value="+212612345678" onChange={onChange} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Country calling code" }), { target: { value: "212" } });
    expect(onChange).toHaveBeenCalledWith("+212612345678");
  });

  it("does not prepend a previous country code when an unfamiliar full number is pasted", () => {
    const onChange = vi.fn();
    render(<PhoneNumberField value="+91 9876543210" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+212612345678" } });
    expect(onChange).toHaveBeenCalledWith("+212612345678");
  });
});
