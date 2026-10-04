// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhoneNumberField } from "@/components/portfolio/PhoneNumberField";

describe("PhoneNumberField", () => {
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
