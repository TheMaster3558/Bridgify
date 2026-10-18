import { z } from "zod";
import { api, checked, ApiError } from "@/lib/api";
import { readBody, readJson } from "@/lib/body";
import {
  CLIENT_PHOTO_BUCKET,
  CLIENT_PHOTO_MAX_BYTES,
  clientKey,
} from "@/lib/clients/photos";
import type { db } from "@/lib/db/server";

type Client = Awaited<ReturnType<typeof db>>;

const clientName = z.string().trim().min(1).max(120);

function imageType(bytes: Uint8Array) {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return { type: "image/png", ext: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (text.startsWith("RIFF") && text.endsWith("WEBP"))
    return { type: "image/webp", ext: "webp" };
  return null;
}

async function ownerOrganization(client: Client, userId: string) {
  const membership = checked(
    await client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle(),
  ) as { organization_id: string } | null;
  if (!membership)
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only the workspace owner can do this.",
    );
  return membership.organization_id;
}

async function existingPath(client: Client, organization: string, key: string) {
  const row = checked(
    await client
      .from("client_photos")
      .select("storage_path")
      .eq("organization_id", organization)
      .eq("client_key", key)
      .maybeSingle(),
  ) as { storage_path: string } | null;
  return row?.storage_path ?? null;
}

export async function POST(request: Request) {
  return api(request, async (client, user) => {
    const organization = await ownerOrganization(client, user.id);
    const form = await new Response(
      await readBody(request, CLIENT_PHOTO_MAX_BYTES + 8192),
      {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      },
    ).formData();
    const key = clientKey(clientName.parse(form.get("clientName")));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size)
      throw new ApiError(400, "VALIDATION", "Choose an image to upload.");
    if (file.size > CLIENT_PHOTO_MAX_BYTES)
      throw new ApiError(400, "TOO_LARGE", "Photos can be up to 2 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = imageType(bytes);
    if (!kind)
      throw new ApiError(400, "UNSUPPORTED", "Use a PNG, JPEG or WebP image.");

    const previous = await existingPath(client, organization, key);
    const path = `${organization}/${crypto.randomUUID()}.${kind.ext}`;
    const upload = await client.storage
      .from(CLIENT_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: kind.type, upsert: false });
    if (upload.error)
      throw new ApiError(503, "STORAGE", "Photo upload failed. Try again.");
    checked(
      await client.from("client_photos").upsert({
        organization_id: organization,
        client_key: key,
        storage_path: path,
        updated_at: new Date().toISOString(),
      }),
    );
    if (previous)
      await client.storage.from(CLIENT_PHOTO_BUCKET).remove([previous]);
    const { data } = await client.storage
      .from(CLIENT_PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);
    return { clientKey: key, url: data?.signedUrl ?? null };
  });
}

export async function DELETE(request: Request) {
  return api(request, async (client, user) => {
    const organization = await ownerOrganization(client, user.id);
    const input = z
      .object({ clientName })
      .strict()
      .parse(await readJson(request));
    const key = clientKey(input.clientName);
    const previous = await existingPath(client, organization, key);
    if (!previous) return { clientKey: key, removed: false };
    checked(
      await client
        .from("client_photos")
        .delete()
        .eq("organization_id", organization)
        .eq("client_key", key),
    );
    await client.storage.from(CLIENT_PHOTO_BUCKET).remove([previous]);
    return { clientKey: key, removed: true };
  });
}
