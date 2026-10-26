// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhoneNumberField } from "@/components/portfolio/PhoneNumberField";

describe("PhoneNumberField", () => {
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
