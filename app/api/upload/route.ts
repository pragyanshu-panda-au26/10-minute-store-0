import { NextRequest, NextResponse } from "next/server";
import { fail, handleOptions, handler, ok, requireAuth } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";

/**
 * POST /api/upload
 * Admin-only. Multipart form-data with a `file` field.
 * Returns { url, publicId } from Cloudinary.
 *
 * We stream the file straight through — no disk write, no /tmp scratch, works
 * on Vercel serverless. The `folder` query param (default "satyug_products")
 * groups uploads in Cloudinary for tidy management.
 *
 * Client usage:
 *   const fd = new FormData();
 *   fd.append("file", fileFromInput);
 *   fetch("/api/upload?folder=satyug_products", { method: "POST", body: fd, credentials: "include" });
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder") || "satyug_products";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Expected multipart/form-data body", 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return fail("Missing `file` field", 400);
  }

  const blob = file as unknown as Blob & { name?: string; type?: string; size?: number };
  const size = blob.size ?? 0;
  const type = blob.type ?? "";
  if (size > MAX_BYTES) return fail(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`, 413);
  if (!ALLOWED.includes(type)) return fail(`Unsupported image type: ${type}`, 415);

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const { secure_url, public_id } = await uploadToCloudinary(buffer, folder);
    console.log(`[upload] admin=${auth.userId} folder=${folder} size=${size} url=${secure_url}`);
    return ok({ url: secure_url, publicId: public_id, bytes: size, contentType: type });
  } catch (err: any) {
    console.error("[upload] cloudinary error:", err);
    return fail(err?.message ?? "Upload failed", 502);
  }
});

export const OPTIONS = handleOptions;
