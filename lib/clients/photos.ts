// Client photos are keyed by the normalized client name, shared across a workspace.
export const CLIENT_PHOTO_BUCKET = "client-photos";
export const CLIENT_PHOTO_MAX_BYTES = 2_097_152;

export function clientKey(name: string) {
  return name.trim().toLowerCase();
}
