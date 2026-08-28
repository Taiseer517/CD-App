/**
 * "Unfiled" is not a real shelf — it is the absence of one — but it still
 * needs an address, so it travels through the router under this slug and is
 * translated back to a null shelfId at both ends.
 */
export const UNFILED_SLUG = 'unfiled'

export function shelfIdFromParam(param: string | undefined): string | null {
  return !param || param === UNFILED_SLUG ? null : param
}
