import { fail, json, CORS, HttpError } from "../../../lib/http.js";
import { maxUploadBytes, normalizeBot, safeFileName } from "../../../lib/paths.js";
import { tokensMatch, sessionToken } from "../../../lib/session.js";
import { listCatalog, saveUpload } from "../../../lib/vault.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function asString(value) {
  return typeof value === "string" ? value : "";
}

function assertUploadKey(request, provided) {
  const expected = process.env.UPLOAD_KEY || "";
  if (!expected) return;
  const got = (provided || request.headers.get("x-upload-key") || "").trim();
  if (!tokensMatch(sessionToken(got), sessionToken(expected))) {
    throw new HttpError(401, "Send the upload key in the X-Upload-Key header.");
  }
}

function assertSize(request) {
  const declared = Number(request.headers.get("content-length"));
  const limit = maxUploadBytes();
  if (Number.isFinite(declared) && declared > limit + 64 * 1024) {
    throw new HttpError(413, `Upload is larger than ${limit} bytes.`);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request) {
  try {
    const prefix = new URL(request.url).searchParams.get("prefix") || "";
    return json(await listCatalog(prefix));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  try {
    assertSize(request);
    const contentType = request.headers.get("content-type") || "";
    const headerBot = request.headers.get("x-bot-name");
    const headerPath = request.headers.get("x-file-path");
    let bot = headerBot || "";
    let rel = headerPath || "";
    let buffer;
    let key = "";

    if (contentType.includes("multipart/form-data")) {
      let form;
      try {
        form = await request.formData();
      } catch {
        throw new HttpError(400, "The upload form could not be read.");
      }
      key = asString(form.get("key"));
      assertUploadKey(request, key);
      const file = form.get("file");
      if (!file || typeof file.arrayBuffer !== "function") {
        throw new HttpError(400, "multipart uploads need a file field named file.");
      }
      bot = asString(form.get("bot")) || headerBot || "";
      rel = asString(form.get("path")) || headerPath || "";
      if (rel.endsWith("/")) rel += safeFileName(file.name || "");
      buffer = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes("application/json") && !headerPath) {
      const body = await request.json().catch(() => {
        throw new HttpError(400, "The JSON body could not be parsed.");
      });
      key = asString(body?.key);
      assertUploadKey(request, key);
      if (!body || typeof body.content !== "string") {
        throw new HttpError(
          400,
          "JSON uploads must include string fields bot, path, and content.",
        );
      }
      bot = asString(body.bot) || headerBot || "";
      rel = asString(body.path) || "";
      buffer = Buffer.from(body.content, "utf8");
    } else {
      assertUploadKey(request, "");
      if (!headerPath) {
        throw new HttpError(
          415,
          "Send multipart form fields file, path, and bot; a JSON object with path, bot, and content; or the raw file bytes with X-File-Path and X-Bot-Name.",
        );
      }
      bot = headerBot || "";
      rel = headerPath;
      buffer = Buffer.from(await request.arrayBuffer());
    }

    const saved = await saveUpload({
      relPath: rel,
      bot: normalizeBot(bot),
      buffer,
    });
    return json(
      {
        ok: true,
        file: saved.file,
        git: saved.git,
        github: saved.github,
      },
      201,
    );
  } catch (err) {
    return fail(err);
  }
}
