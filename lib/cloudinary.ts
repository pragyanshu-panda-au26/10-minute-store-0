import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary config — reads STRICTLY from env vars. Do not hardcode secrets
 * here (they'd land in git). If any of these env vars are missing, calls to
 * the helpers below will throw at runtime with a clear message; that's on
 * purpose so a mis-configured deploy fails fast instead of silently uploading
 * to the wrong account.
 */

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

function assertConfigured() {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment."
    );
  }
}

export async function uploadToCloudinary(
  file: string | Buffer,
  folder: string = "satyug_store"
): Promise<{ secure_url: string; public_id: string }> {
  assertConfigured();
  return new Promise((resolve, reject) => {
    if (typeof file === "string") {
      cloudinary.uploader.upload(
        file,
        { folder, resource_type: "auto" },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Cloudinary upload failed"));
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        }
      );
    } else {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "auto" },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Cloudinary upload stream failed"));
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        }
      );
      uploadStream.end(file);
    }
  });
}

export default cloudinary;
