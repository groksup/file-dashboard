import { HttpError } from "./http.js";

const SEGMENT = /^[\w .()+-]+$/;
const IDEA = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/;

function validSegment(segment) {
  return (
    segment.length > 0 &&
    segment.length <= 120 &&
    !segment.startsWith(".") &&
    SEGMENT.test(segment) &&
    segment.trim() === segment
  );
}

function splitPath(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new HttpError(
      400,
      "path is required. Example: ideas/014-market-map/evidence.csv",
    );
  }
  let value = input.trim().replace(/\\/g, "/");
  if (value.startsWith("/")) value = value.slice(1);
  value = value.replace(/^\.\//, "");
  const directory = value.endsWith("/");
  if (directory) value = value.slice(0, -1);
  const parts = value.split("/");
  if (
    !value ||
    value.length > 240 ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new HttpError(400, "invalid path");
  }
  return { value, parts, directory };
}

export function normalizeRepoPath(input) {
  const { value, parts, directory } = splitPath(input);
  if (directory) {
    throw new HttpError(
      400,
      "path must include a file name. Example: ideas/014-market-map/brief.md",
    );
  }
  if (value === "INDEX.md") return value;

  if (parts[0] === "shared") {
    if (parts.length < 2 || !parts.slice(1).every(validSegment)) {
      throw new HttpError(
        400,
        "shared uploads need a file name, for example shared/sources.csv",
      );
    }
    return value;
  }

  if (parts[0] === "ideas") {
    if (parts.length < 2 || !IDEA.test(parts[1])) {
      throw new HttpError(
        400,
        "idea folders must look like ideas/<ID>-<slug>/. Example: ideas/014-market-map/brief.md",
      );
    }
    if (parts.length < 3 || !parts.slice(2).every(validSegment)) {
      throw new HttpError(
        400,
        "include a file name under the idea folder. Example: ideas/014-market-map/evidence.csv",
      );
    }
    return value;
  }

  throw new HttpError(
    400,
    "path must be INDEX.md, shared/<file>, or ideas/<ID>-<slug>/<file>",
  );
}

export function normalizePrefix(input) {
  if (!input) return "";
  const { value, parts } = splitPath(input.endsWith("/") ? input : input);
  if (value === "INDEX.md" || value === "ideas" || value === "shared") {
    return value;
  }
  if (parts[0] === "shared" && parts.slice(1).every(validSegment)) return value;
  if (
    parts[0] === "ideas" &&
    IDEA.test(parts[1] || "") &&
    parts.slice(2).every(validSegment)
  ) {
    return value;
  }
  throw new HttpError(400, "invalid prefix");
}

export function normalizeBot(input) {
  if (typeof input !== "string") {
    throw new HttpError(
      400,
      "bot is required. Send it as the form field bot, the JSON field bot, or the X-Bot-Name header.",
    );
  }
  const bot = input.trim();
  if (!bot || bot.length > 64 || !/^[\w .@+-]+$/.test(bot)) {
    throw new HttpError(
      400,
      "bot must be 1–64 characters (letters, numbers, spaces, . _ @ + -).",
    );
  }
  return bot;
}

export function safeFileName(name) {
  if (typeof name !== "string") {
    throw new HttpError(400, "file is required");
  }
  const base = name.split(/[/\\]/).pop() || "";
  if (!validSegment(base)) {
    throw new HttpError(400, "invalid file name");
  }
  return base;
}

const EXT = {
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  html: "text/html",
  htm: "text/html",
};

export function looksBinary(buffer) {
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function contentTypeFor(relPath, buffer) {
  const base = relPath.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (EXT[ext]) return EXT[ext];
  if (looksBinary(buffer)) return "application/octet-stream";
  return "text/markdown";
}

export function inlineType(contentType) {
  const safe = new Set([
    "text/markdown",
    "text/plain",
    "text/csv",
    "text/tab-separated-values",
    "application/json",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
  ]);
  return safe.has(contentType) ? contentType : "application/octet-stream";
}

export function maxUploadBytes() {
  const fallback = 4 * 1024 * 1024;
  const parsed = Number(process.env.MAX_UPLOAD_BYTES || fallback);
  if (!Number.isFinite(parsed) || parsed < 1024) return fallback;
  return Math.min(Math.floor(parsed), fallback);
}
