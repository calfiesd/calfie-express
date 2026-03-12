import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CarrierCode } from "@/lib/domain-types";
import { env } from "@/lib/config";
import { put } from "@vercel/blob";

type PersistLabelArgs = {
  orderId: string;
  carrier: CarrierCode;
  serviceName: string;
  trackingNumber: string;
  labelUrl: string;
};

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "label";
}

function getStoragePaths(fileName: string) {
  const relativeDirectory = path.posix.join("stored-labels");
  const publicDirectory = path.join(process.cwd(), "public", relativeDirectory);
  return {
    relativeDirectory,
    publicDirectory,
    publicPath: path.join(publicDirectory, fileName),
    publicUrl: `/${relativeDirectory}/${fileName}`.replace(/\\/g, "/")
  };
}

function inferExtensionFromMime(mimeType: string) {
  if (mimeType.includes("pdf")) {
    return "pdf";
  }
  if (mimeType.includes("gif")) {
    return "gif";
  }
  if (mimeType.includes("png")) {
    return "png";
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpg";
  }
  return "bin";
}

function inferContentTypeFromExtension(extension: string) {
  if (extension === "pdf") {
    return "application/pdf";
  }
  if (extension === "gif") {
    return "image/gif";
  }
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "jpg") {
    return "image/jpeg";
  }
  if (extension === "html") {
    return "text/html; charset=utf-8";
  }
  return "application/octet-stream";
}

function parseDataUrl(labelUrl: string) {
  const match = labelUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] ?? "application/octet-stream",
    buffer: Buffer.from(match[2], "base64")
  };
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeBufferLabel(fileName: string, buffer: Buffer) {
  if (env.LABEL_STORAGE_BACKEND === "vercel_blob" && env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`stored-labels/${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: inferContentTypeFromExtension(path.extname(fileName).replace(/^\./, ""))
    });
    return blob.url;
  }

  const paths = getStoragePaths(fileName);
  await mkdir(paths.publicDirectory, { recursive: true });
  await writeFile(paths.publicPath, buffer);
  return paths.publicUrl;
}

async function writePlaceholderLabel(args: PersistLabelArgs) {
  const fileName = `${sanitizeSegment(args.orderId)}-${sanitizeSegment(args.trackingNumber)}.html`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stored Label ${args.orderId}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #1d2430; background: #f8f3ea; }
      .card { max-width: 720px; margin: 0 auto; background: white; border: 1px solid #d9d2c4; border-radius: 16px; padding: 24px; }
      h1 { margin-top: 0; }
      dt { font-weight: 700; margin-top: 12px; }
      dd { margin: 4px 0 0; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Stored Label Placeholder</h1>
      <p>The original carrier label asset was not returned as a durable file, so CALFIE EXPRESS saved this placeholder instead.</p>
      <dl>
        <dt>Order ID</dt><dd>${args.orderId}</dd>
        <dt>Carrier</dt><dd>${args.carrier}</dd>
        <dt>Service</dt><dd>${args.serviceName}</dd>
        <dt>Tracking</dt><dd>${args.trackingNumber}</dd>
      </dl>
    </div>
  </body>
</html>`;
  return writeBufferLabel(fileName, Buffer.from(html, "utf8"));
}

export async function persistLabelAsset(args: PersistLabelArgs) {
  if (!args.labelUrl) {
    return args.labelUrl;
  }

  const parsedDataUrl = parseDataUrl(args.labelUrl);
  if (parsedDataUrl) {
    const extension = inferExtensionFromMime(parsedDataUrl.mimeType);
    const fileName = `${sanitizeSegment(args.orderId)}-${sanitizeSegment(args.trackingNumber)}.${extension}`;
    return writeBufferLabel(fileName, parsedDataUrl.buffer);
  }

  if (args.labelUrl.startsWith("/")) {
    const relativePath = args.labelUrl.replace(/^\//, "").replace(/\//g, path.sep);
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    if (await fileExists(absolutePath)) {
      return args.labelUrl;
    }

    return writePlaceholderLabel(args);
  }

  if (/^https?:\/\//i.test(args.labelUrl)) {
    const response = await fetch(args.labelUrl);
    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const extension = inferExtensionFromMime(contentType);
      const fileName = `${sanitizeSegment(args.orderId)}-${sanitizeSegment(args.trackingNumber)}.${extension}`;
      const arrayBuffer = await response.arrayBuffer();
      return writeBufferLabel(fileName, Buffer.from(arrayBuffer));
    }

    return writePlaceholderLabel(args);
  }

  return writePlaceholderLabel(args);
}
