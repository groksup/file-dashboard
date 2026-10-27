export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Bot-Name, X-File-Path, X-Upload-Key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body, status = 200, extra = {}) {
  return Response.json(body, {
    status,
    headers: {
      ...CORS,
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

export function fail(err) {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : "The desk could not finish that request.";
  if (!(err instanceof HttpError)) console.error(err);
  return json({ error: message }, status);
}
