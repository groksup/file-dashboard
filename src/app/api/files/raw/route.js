import { fail, CORS, HttpError } from "../../../../lib/http.js";
import { inlineType } from "../../../../lib/paths.js";
import { readUpload } from "../../../../lib/vault.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function disposition(filename, download) {
  const ascii = filename.replace(/[^\w.\- ]+/g, "_") || "file";
  const star = encodeURIComponent(filename);
  const kind = download ? "attachment" : "inline";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${star}`;
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const rel = params.get("path");
    if (!rel) {
      throw new HttpError(
        400,
        "path is required. Example: /api/files/raw?path=ideas/014-market-map/brief.md",
      );
    }
    const file = await readUpload(rel);
    const download = params.get("download") === "1";
    const type = inlineType(file.contentType);
    const forceDownload = download || type === "application/octet-stream";
    return new Response(file.buffer, {
      headers: {
        ...CORS,
        "Content-Type": type,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": disposition(file.path.split("/").pop(), forceDownload),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Bot-Name": file.bot,
        "X-Uploaded-At": file.uploadedAt || "",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
