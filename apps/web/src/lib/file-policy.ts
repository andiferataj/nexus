import { DomainError } from "@nexus/contracts";

export const maxUploadBytes = 20 * 1024 * 1024;
export function inspectFile(
  name: string,
  bytes: Uint8Array,
): { originalName: string; contentType: string } {
  const originalName =
    name
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\x00-\x1f\x7f]/g, "")
      .trim()
      .slice(0, 240) ?? "";
  if (
    !originalName ||
    bytes.byteLength < 1 ||
    bytes.byteLength > maxUploadBytes
  )
    throw new DomainError("VALIDATION", "Choose a supported file up to 20 MB.");
  const extension = originalName.split(".").at(-1)?.toLowerCase();
  const prefix = Buffer.from(bytes.subarray(0, 12));
  let contentType = "";
  if (extension === "pdf" && prefix.subarray(0, 5).toString() === "%PDF-")
    contentType = "application/pdf";
  if (
    extension === "png" &&
    prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    contentType = "image/png";
  if (
    ["jpg", "jpeg"].includes(extension ?? "") &&
    prefix[0] === 255 &&
    prefix[1] === 216 &&
    prefix[2] === 255
  )
    contentType = "image/jpeg";
  if (
    extension === "webp" &&
    prefix.subarray(0, 4).toString() === "RIFF" &&
    prefix.subarray(8, 12).toString() === "WEBP"
  )
    contentType = "image/webp";
  if (["txt", "csv"].includes(extension ?? "")) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error();
      contentType = extension === "csv" ? "text/csv" : "text/plain";
    } catch {
      throw new DomainError(
        "VALIDATION",
        "Text files must contain valid UTF-8 text.",
      );
    }
  }
  if (!contentType)
    throw new DomainError(
      "VALIDATION",
      "Supported files: PDF, PNG, JPEG, WebP, plain text, and CSV. The file contents must match its extension.",
    );
  return { originalName, contentType };
}
