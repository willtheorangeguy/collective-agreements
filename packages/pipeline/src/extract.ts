import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";
import { createWorker } from "tesseract.js";

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<{ text: string; method: string }> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdf(buffer);
    case "text/plain":
    case "text/csv":
      return { text: buffer.toString("utf8"), method: "plain" };
    case "image/png":
    case "image/jpeg":
    case "image/tiff":
    case "image/webp":
      return { text: await ocrImage(buffer), method: "ocr" };
    default:
      throw new ExtractionError(`unsupported mime type: ${mimeType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; method: string }> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await unpdfExtract(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;
  if (merged.replace(/\s/g, "").length < 200) {
    const ocrText = await ocrScannedPdf(buffer);
    return { text: ocrText, method: "ocr" };
  }
  return { text: merged, method: "pdf-text-layer" };
}

async function ocrScannedPdf(_buffer: Buffer): Promise<string> {
  throw new ExtractionError(
    "scanned PDF detected: rasterize pages to images before upload (OCR for multi-page PDFs not yet enabled)",
  );
}

export async function ocrImage(buffer: Buffer): Promise<string> {
  const lang = process.env.OCR_LANG ?? "eng";
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(buffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
