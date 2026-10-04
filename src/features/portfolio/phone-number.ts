// Stored portfolio and interest contracts keep one phone string. These helpers
// split that value only for editing; unfamiliar legacy prefixes remain intact.
const COMMON_CALLING_CODES = [
  "971", "966", "965", "974", "972", "973", "968", "977", "880", "852",
  "353", "358", "351", "352", "356", "357", "386", "420", "421", "423",
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "39", "40", "41",
  "43", "44", "45", "46", "47", "48", "49", "52", "55", "61", "64", "65",
  "66", "81", "82", "86", "90", "91", "92", "94",
].sort((left, right) => right.length - left.length);

export function splitPhoneNumber(value: string, defaultCallingCode = "") {
  const phone = value.trim();
  if (!phone) return { callingCode: defaultCallingCode.replace(/\D/g, "").slice(0, 3), nationalNumber: "" };

  const separated = phone.match(/^\+(\d{1,3})[\s().-]+(.+)$/);
  if (separated) return { callingCode: separated[1], nationalNumber: separated[2].trim() };

  const contiguous = phone.match(/^\+(\d{8,15})$/);
  if (contiguous) {
    const code = COMMON_CALLING_CODES.find((candidate) => contiguous[1].startsWith(candidate));
    if (code) return { callingCode: code, nationalNumber: contiguous[1].slice(code.length) };
  }

  // Never guess an unknown international prefix: doing so could alter a saved
  // family contact when the owner opens and resaves an older portfolio.
  return { callingCode: "", nationalNumber: phone };
}

export function combinePhoneNumber(callingCode: string, nationalNumber: string) {
  const code = callingCode.replace(/\D/g, "").slice(0, 3);
  const number = nationalNumber.trim();
  if (!number) return "";
  // A full international number must never inherit an older calling code.
  // Leave unfamiliar prefixes intact until the user separates them explicitly.
  if (number.startsWith("+")) return number;
  if (!code) return number;
  return `+${code} ${number}`;
}
