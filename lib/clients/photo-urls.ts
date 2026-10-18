import "server-only";
import type { db } from "@/lib/db/server";
import { CLIENT_PHOTO_BUCKET, clientKey } from "@/lib/clients/photos";

type Client = Awaited<ReturnType<typeof db>>;

// Signed URLs keyed by clientKey(name). Missing photos and storage errors are
// left out so the UI falls back to initials.
export async function loadClientPhotos(client: Client, names: string[]) {
  const keys = [...new Set(names.map(clientKey).filter(Boolean))];
  if (!keys.length) return {};
  const { data: rows, error } = await client
    .from("client_photos")
    .select("client_key,storage_path")
    .in("client_key", keys);
  if (error || !rows?.length) return {};
  const { data: signed } = await client.storage
    .from(CLIENT_PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    );
  const urls: Record<string, string> = {};
  rows.forEach((row, index) => {
    const url = signed?.[index]?.signedUrl;
    if (url) urls[row.client_key] = url;
  });
  return urls;
}
