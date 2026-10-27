import { createHash } from "crypto";
import { githubStatus, listStoredFiles, readStoredFile, writeStoredFile } from "./github.js";
import { HttpError } from "./http.js";
import { contentTypeFor, maxUploadBytes, normalizePrefix, normalizeRepoPath } from "./paths.js";

export async function listCatalog(prefixInput = "") {
  const prefix = normalizePrefix(prefixInput);
  const files = (await listStoredFiles()).filter(
    (file) => !prefix || file.path === prefix || file.path.startsWith(`${prefix}/`),
  );
  const github = githubStatus();
  return {
    storage: "github",
    github,
    limits: {
      maxBytes: maxUploadBytes(),
      uploadKey: Boolean(process.env.UPLOAD_KEY),
    },
    count: files.length,
    files,
    usage: {
      upload: "POST /api/files",
      list: "GET /api/files",
      listPrefix: "GET /api/files?prefix=ideas/014-market-map",
      read: "GET /api/files/raw?path=ideas/014-market-map/brief.md",
      download: "GET /api/files/raw?path=ideas/014-market-map/brief.md&download=1",
      stamp:
        "Send the bot name as the form field bot, the JSON field bot, or the X-Bot-Name header.",
      path:
        "Send the repo path as the form field path, the JSON field path, or the X-File-Path header.",
    },
  };
}

export async function readUpload(relInput) {
  const rel = normalizeRepoPath(relInput);
  return readStoredFile(rel);
}

export async function saveUpload({ relPath, bot, buffer }) {
  const limit = maxUploadBytes();
  if (buffer.length > limit) {
    throw new HttpError(413, `File is larger than ${limit} bytes.`);
  }
  const rel = normalizeRepoPath(relPath);
  const contentType = contentTypeFor(rel, buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const file = await writeStoredFile({ rel, bot, buffer, contentType, sha256 });
  return {
    file,
    git: { committed: true, revision: file.gitRevision },
    github: file.github,
  };
}
