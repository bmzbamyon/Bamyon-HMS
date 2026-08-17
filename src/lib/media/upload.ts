import type { ProductMedia } from "@/types";

/**
 * Uploads a File to Cloudinary using a server-issued signature (see
 * app/api/media/sign-upload). Returns the ProductMedia record shape used
 * throughout the app — callers just push the result into a product's
 * `media` array or a review's `media` array.
 */
export async function uploadMediaFile(
  file: File,
  folder: string
): Promise<ProductMedia> {
  const signRes = await fetch("/api/media/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  const signJson = await signRes.json();
  if (!signRes.ok) throw new Error(signJson.error ?? "Could not get upload signature.");

  const { signature, timestamp, apiKey, cloudName } = signJson;
  const isVideo = file.type.startsWith("video/");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? "video" : "image"}/upload`,
    { method: "POST", body: formData }
  );
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(uploadJson.error?.message ?? "Upload failed.");

  return {
    publicId: uploadJson.public_id,
    url: uploadJson.secure_url,
    isVideo,
  };
}
