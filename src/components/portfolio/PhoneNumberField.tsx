"use client";

import { useState } from "react";
import { combinePhoneNumber, splitPhoneNumber } from "@/features/portfolio/phone-number";

export function PhoneNumberField({
  value,
  onChange,
  name,
  required = false,
  defaultCallingCode = "",
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  defaultCallingCode?: string;
  hint?: string;
}) {
  const [emptyNumberCode, setEmptyNumberCode] = useState(defaultCallingCode.replace(/\D/g, "").slice(0, 3));
  const parts = splitPhoneNumber(value, emptyNumberCode);
  const callingCode = parts.callingCode;
  const nationalNumber = parts.nationalNumber;

  return (
    <fieldset className="split-phone-field">
      <legend>Phone number{required ? " *" : ""}</legend>
      <div className="split-phone-inputs">
        <label>
          <span>Country code</span>
          <span className="split-phone-code">
            <span aria-hidden="true">+</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="tel-country-code"
              aria-label="Country calling code"
              value={callingCode}
              onChange={(event) => {
                const code = event.target.value.replace(/\D/g, "").slice(0, 3);
                setEmptyNumberCode(code);
                if (nationalNumber) onChange(combinePhoneNumber(code, nationalNumber));
              }}
              pattern="[1-9][0-9]{0,2}"
              maxLength={3}
              placeholder="91"
              required={required || Boolean(nationalNumber)}
            />
          </span>
        </label>
        <label>
          <span>Phone number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-label="Phone number"
            value={nationalNumber}
            onChange={(event) => {
              const entered = event.target.value;
              if (entered.startsWith("+")) {
                const pasted = splitPhoneNumber(entered);
                if (pasted.callingCode) {
                  setEmptyNumberCode(pasted.callingCode);
                  onChange(combinePhoneNumber(pasted.callingCode, pasted.nationalNumber));
                  return;
                }
                setEmptyNumberCode("");
                onChange(entered);
                return;
              }
              setEmptyNumberCode(callingCode);
              onChange(combinePhoneNumber(callingCode, entered));
            }}
            maxLength={24}
            placeholder="98765 43210"
            required={required}
          />
        </label>
      </div>
      {hint && <small>{hint}</small>}
      {nationalNumber.startsWith("+") && <small role="alert">Enter the country calling code separately and remove it from the phone number to avoid a wrong number.</small>}
      {name && <input type="hidden" name={name} value={value} />}
    </fieldset>
  );
}
