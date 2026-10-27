import { HttpError } from "./http.js";
import { contentTypeFor } from "./paths.js";

const INDEX_PATH = ".desk/index.json";

function config() {
  return {
    token: process.env.GITHUB_TOKEN || "",
    repo: process.env.GITHUB_REPO || "groksup/research-data",
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

export function githubStatus() {
  const { token, repo, branch } = config();
  if (!token) {
    return {
      repo,
      branch,
      enabled: false,
      reason: "Set GITHUB_TOKEN. Files are stored in GitHub, not on this server.",
    };
  }
  return { repo, branch, enabled: true };
}

function requireConfig() {
  const current = config();
  if (!current.token) {
    throw new HttpError(
      503,
      "Set GITHUB_TOKEN. This desk stores files in GitHub so they are available from any device.",
    );
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(current.repo)) {
    throw new HttpError(503, "GITHUB_REPO must look like owner/name.");
  }
  return current;
}

function encodedPath(rel) {
  return rel.split("/").map(encodeURIComponent).join("/");
}

function htmlUrl(rel) {
  const { repo, branch } = requireConfig();
  const branchPath = branch.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repo}/blob/${branchPath}/${encodedPath(rel)}`;
}

async function githubFetch(pathname, options = {}) {
  const { token, repo } = requireConfig();
  const response = await fetch(`https://api.github.com/repos/${repo}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "idea-validation-desk",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  return response;
}

async function readBody(response) {
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    const tooLarge = /too large/i.test(data.message || "");
    if (!tooLarge) {
      throw new HttpError(
        503,
        data.message || "GitHub rejected GITHUB_TOKEN. It needs read and write access to the repo.",
      );
    }
  }
  return data;
}

function isHidden(rel) {
  return rel.split("/").some((part) => part.startsWith("."));
}

function decodeBase64(content) {
  return Buffer.from(String(content || "").replace(/\n/g, ""), "base64");
}

async function getTree() {
  const { branch } = requireConfig();
  const response = await githubFetch(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (response.status === 409 || response.status === 404) return [];
  const data = await readBody(response);
  if (!response.ok) {
    throw new HttpError(503, data.message || "GitHub could not list the repository.");
  }
  return (data.tree || []).filter((entry) => entry.type === "blob" && entry.path && !isHidden(entry.path));
}

async function getContents(rel) {
  const { branch } = requireConfig();
  const response = await githubFetch(`/contents/${encodedPath(rel)}?ref=${encodeURIComponent(branch)}`);
  if (response.status === 404) return null;
  const data = await readBody(response);
  if (response.ok && data && !Array.isArray(data)) return data;
  if (/too large/i.test(data.message || "")) {
    const tree = await getTree();
    const entry = tree.find((item) => item.path === rel);
    if (!entry) return null;
    return { sha: entry.sha, size: entry.size, html_url: htmlUrl(rel) };
  }
  if (!response.ok) {
    throw new HttpError(503, data.message || "GitHub could not read that file.");
  }
  return null;
}

async function getBlob(sha) {
  const response = await githubFetch(`/git/blobs/${sha}`);
  const data = await readBody(response);
  if (!response.ok) {
    throw new HttpError(503, data.message || "GitHub could not read that file.");
  }
  return decodeBase64(data.content);
}

async function putContent(rel, buffer, message, sha) {
  const { branch } = requireConfig();
  const body = {
    message,
    content: Buffer.from(buffer).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const response = await githubFetch(`/contents/${encodedPath(rel)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readBody(response);
  if (response.status === 409 || response.status === 422) {
    return { conflict: true };
  }
  if (!response.ok) {
    throw new HttpError(503, data.message || "GitHub could not save that file.");
  }
  return {
    conflict: false,
    sha: data.content?.sha || null,
    commitSha: data.commit?.sha || null,
    url: data.content?.html_url || htmlUrl(rel),
  };
}

async function existingSha(rel) {
  const current = await getContents(rel);
  return current?.sha || null;
}

async function writeContent(rel, buffer, message) {
  let sha = await existingSha(rel);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await putContent(rel, buffer, message, sha);
    if (!result.conflict) return result;
    sha = await existingSha(rel);
  }
  throw new HttpError(503, "GitHub could not save that file. Try the upload again.");
}

async function readIndex() {
  const current = await getContents(INDEX_PATH);
  if (!current) return { sha: null, files: {} };
  let parsed = { files: {} };
  if (current.content) {
    try {
      parsed = JSON.parse(decodeBase64(current.content).toString("utf8"));
    } catch {
      parsed = { files: {} };
    }
  } else if (current.sha) {
    try {
      parsed = JSON.parse((await getBlob(current.sha)).toString("utf8"));
    } catch {
      parsed = { files: {} };
    }
  }
  return { sha: current.sha || null, files: parsed.files || {} };
}

let indexQueue = Promise.resolve();

function withIndexLock(fn) {
  const run = indexQueue.then(fn, fn);
  indexQueue = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function saveStamp(rel, record) {
  return withIndexLock(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const index = await readIndex();
      index.files[rel] = record;
      const body = Buffer.from(JSON.stringify({ files: index.files }, null, 2));
      const result = await putContent(
        INDEX_PATH,
        body,
        `stamp ${rel}\n\nBot: ${record.bot}`,
        index.sha,
      );
      if (!result.conflict) return result;
    }
    throw new HttpError(503, "GitHub saved the file but could not save the bot stamp. Upload it again.");
  });
}

export async function listStoredFiles() {
  const [tree, index] = await Promise.all([getTree(), readIndex()]);
  return tree
    .map((entry) => {
      const meta = index.files[entry.path] || {};
      const revision = meta.gitRevision || entry.sha || "";
      return {
        path: entry.path,
        bot: meta.bot || "repo",
        uploadedAt: meta.uploadedAt || null,
        size: Number.isFinite(meta.size) ? meta.size : entry.size || 0,
        contentType: meta.contentType || contentTypeFor(entry.path, Buffer.alloc(0)),
        sha256: meta.sha256 || null,
        gitRevision: revision ? String(revision).slice(0, 7) : null,
        github: { synced: true, url: htmlUrl(entry.path) },
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function readStoredFile(rel) {
  const current = await getContents(rel);
  if (!current?.sha && !current?.content) {
    throw new HttpError(404, "File not found.");
  }
  const buffer = current.content ? decodeBase64(current.content) : await getBlob(current.sha);
  const index = await readIndex();
  const meta = index.files[rel] || {};
  return {
    path: rel,
    bot: meta.bot || "repo",
    uploadedAt: meta.uploadedAt || null,
    size: buffer.length,
    contentType: meta.contentType || contentTypeFor(rel, buffer),
    sha256: meta.sha256 || null,
    gitRevision: (meta.gitRevision || current.sha || "").slice(0, 7) || null,
    github: { synced: true, url: current.html_url || htmlUrl(rel) },
    buffer,
  };
}

export async function writeStoredFile({ rel, bot, buffer, contentType, sha256 }) {
  const uploadedAt = new Date().toISOString();
  const saved = await writeContent(rel, buffer, `upload ${rel}\n\nBot: ${bot}`);
  const record = {
    bot,
    uploadedAt,
    size: buffer.length,
    contentType,
    sha256,
    gitRevision: (saved.commitSha || saved.sha || "").slice(0, 7) || null,
  };
  await saveStamp(rel, record);
  return {
    path: rel,
    ...record,
    github: { synced: true, url: saved.url || htmlUrl(rel) },
  };
}
