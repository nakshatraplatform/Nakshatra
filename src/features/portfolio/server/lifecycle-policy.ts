import "server-only";

export const FULL_VIEW_LIFETIME_DAYS = 15;

/** Public introductions remain available until their owner unpublishes them. */
export function resolvePublicationExpiry(
  _currentExpiry?: string | null,
  _isPublished?: boolean,
  _now?: Date
) {
  void _currentExpiry;
  void _isPublished;
  void _now;
  return null;
}
