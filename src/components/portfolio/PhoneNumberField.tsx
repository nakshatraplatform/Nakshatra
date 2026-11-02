"use client";

import { useId, useState } from "react";
import { combinePhoneNumber, splitPhoneNumber, isValidPhoneNumber, isValidInterestPhoneNumber } from "@/features/portfolio/phone-number";

export function PhoneNumberField({
  value,
  onChange,
  name,
  required = false,
  defaultCallingCode = "",
  hint,
  label = "Phone number",
  error: externalError,
  showPartLabels = true,
  interestContact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  required?: boolean;
  defaultCallingCode?: string;
  hint?: string;
  label?: string;
  error?: string;
  showPartLabels?: boolean;
  interestContact?: boolean;
}) {
  const errorId = useId();
  const [touched, setTouched] = useState(false);
  const valid = interestContact ? isValidInterestPhoneNumber(value) : isValidPhoneNumber(value);
  const error = externalError || (touched && value.trim() && !valid
    ? interestContact && !value.trim().startsWith("+")
      ? "Add a country calling code before the phone number."
      : interestContact && (splitPhoneNumber(value).callingCode === "1" || splitPhoneNumber(value).callingCode === "91")
      ? "Enter a 10-digit phone number. Keep the country code separate."
      : "Enter a valid phone number with 7–20 digits, or leave it blank." : undefined);
  const [emptyNumberCode, setEmptyNumberCode] = useState(defaultCallingCode.replace(/\D/g, "").slice(0, 3));
  const parts = splitPhoneNumber(value, emptyNumberCode);
  const callingCode = parts.callingCode;
  const nationalNumber = parts.nationalNumber;

  return (
    <fieldset className="split-phone-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTouched(true); }}>
      <legend>{label}{required ? " *" : ""}</legend>
      <div className="split-phone-inputs">
        <label>
          <span className={showPartLabels ? undefined : "sr-only"}>Country code</span>
          <span className="split-phone-code">
            <span aria-hidden="true">+</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="tel-country-code"
              aria-label={label === "Phone number" ? "Country calling code" : `${label} country calling code`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
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
          <span className={showPartLabels ? undefined : "sr-only"}>Phone number</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            aria-label={label}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            value={nationalNumber}
            onChange={(event) => {
              const entered = event.target.value.replace(/[^\d+ ()-]/g, "");
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
              // Keep extra digits visible so validation can flag a mistaken paste;
              // silently trimming a contact number could send the wrong number.
              onChange(combinePhoneNumber(callingCode, entered.replace(/\D/g, "").slice(0, 20 - callingCode.length)));
            }}
            maxLength={24}
            placeholder="98765 43210"
            required={required}
          />
        </label>
      </div>
      {hint && <small>{hint}</small>}
      {error && <small id={errorId} role={externalError ? undefined : "alert"} className="interest-form-error">{error}</small>}
      {nationalNumber.startsWith("+") && nationalNumber.replace(/\D/g, "").length >= 7 && <small role="alert">Enter the country calling code separately and remove it from the phone number to avoid a wrong number.</small>}
      {name && <input type="hidden" name={name} value={value} />}
    </fieldset>
  );
}
