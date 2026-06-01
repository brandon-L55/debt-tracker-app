import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";

function getImageMeta(uri: string): { ext: string; contentType: string } {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  const raw = match?.[1]?.toLowerCase() ?? "jpg";
  if (raw === "png") return { ext: "png", contentType: "image/png" };
  if (raw === "webp") return { ext: "webp", contentType: "image/webp" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

/**
 * Uploads a local image URI to the `avatars` Supabase Storage bucket.
 *
 * Reads the file natively via expo-file-system and uploads the raw bytes as
 * a Uint8Array. This avoids the React Native Blob-serialisation bug where
 * fetch().blob() bodies arrive as 0 bytes at Supabase Storage.
 *
 * Uses upsert so a new photo replaces the previous one at the same path.
 * Appends ?t=<timestamp> to bust CDN cache after an overwrite.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string
): Promise<string> {
  const { ext, contentType } = getImageMeta(localUri);
  const filePath = `${userId}/avatar.${ext}`;

  console.log("[uploadAvatar] localUri:", localUri);
  console.log("[uploadAvatar] filePath:", filePath, "contentType:", contentType);

  // Open a native file reference and verify it exists before reading.
  const file = new File(localUri);
  console.log("[uploadAvatar] file.exists:", file.exists, "file.size:", file.size, "bytes");

  if (!file.exists) {
    throw new Error("Image file not found on device");
  }
  if (file.size === 0) {
    throw new Error("Image file is empty");
  }

  // Read the file as an ArrayBuffer, then wrap in Uint8Array.
  // Uint8Array uploads correctly through the Supabase JS client in React Native;
  // Blob objects created via fetch().blob() do not — they arrive as 0 bytes.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  console.log("[uploadAvatar] Uint8Array length:", bytes.length, "bytes");

  const { data: uploadData, error } = await supabase.storage
    .from("avatars")
    .upload(filePath, bytes, { contentType, upsert: true });

  if (error) {
    console.error("[uploadAvatar] upload error:", error.message);
    throw new Error(error.message);
  }

  console.log("[uploadAvatar] upload success:", JSON.stringify(uploadData));

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  // Cache-bust so CDN doesn't serve the old avatar after an overwrite.
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  console.log("[uploadAvatar] public URL:", publicUrl);
  return publicUrl;
}
