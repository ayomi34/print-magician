// Real page-count detection for uploaded files.
// PDF: parsed with pdfjs-dist (exact). Images: 1 page. DOCX/DOC: not supported.

export type CountResult =
  | { ok: true; pages: number; method: "pdf" | "image" }
  | { ok: false; reason: string };

export async function countPages(file: File): Promise<CountResult> {
  const name = file.name.toLowerCase();

  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) {
    return { ok: true, pages: 1, method: "image" };
  }

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const pdfjs = await import("pdfjs-dist");
      // Use the bundled worker as a URL so Vite ships it correctly
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const pages = doc.numPages;
      await doc.destroy();
      return { ok: true, pages, method: "pdf" };
    } catch (e) {
      return { ok: false, reason: "Could not read PDF. Please try again or re-export the file." };
    }
  }

  if (/\.(docx?|odt|rtf)$/i.test(name)) {
    return {
      ok: false,
      reason: "Word docs don't have a fixed page count. Please export to PDF and re-upload for an exact count.",
    };
  }

  return { ok: false, reason: "Unsupported file type." };
}
