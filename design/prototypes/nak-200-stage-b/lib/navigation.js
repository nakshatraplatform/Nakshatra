export function screenLink(screen, extra = {}) {
  return `/?${new URLSearchParams({ screen, ...extra }).toString()}`;
}
