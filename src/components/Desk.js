"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CsvView } from "./CsvView";
import { JsonView } from "./JsonView";
import { MarkdownView } from "./MarkdownView";

const SLOTS = [
  { id: "brief", label: "brief", hint: "Prose" },
  { id: "plan", label: "plan", hint: "Prose" },
  { id: "evidence.csv", label: "evidence.csv", hint: "Table" },
  { id: "quotes.csv", label: "quotes.csv", hint: "Table" },
  { id: "analysis", label: "analysis/", hint: "Folder", dir: true },
  { id: "critique", label: "critique", hint: "Prose" },
  { id: "pivots", label: "pivots", hint: "Prose" },
  { id: "scores.json", label: "scores.json", hint: "JSON" },
  { id: "report", label: "report", hint: "Prose" },
  { id: "launch", label: "launch/", hint: "Folder", dir: true },
];

function formatBytes(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  const mb = size / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function formatWhen(iso) {
  if (!iso) return "in the repo";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "in the repo";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function LocalTime({ iso }) {
  if (!iso) return <span>in the repo</span>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatWhen(iso)}
    </time>
  );
}

function initials(bot) {
  const parts = String(bot || "")
    .split(/[\s._@+-]+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}

function Stamp({ bot }) {
  return (
    <div className="stamp" title={`Uploaded by ${bot}`}>
      <strong>{initials(bot)}</strong>
      <span>{bot}</span>
    </div>
  );
}

function rootRank(name) {
  if (name === "INDEX.md") return 0;
  if (name === "shared") return 1;
  if (name === "ideas") return 2;
  return 3;
}

function slotRank(name) {
  const index = SLOTS.findIndex((slot) => name === slot.id || name.startsWith(`${slot.id}.`));
  return index === -1 ? SLOTS.length + 1 : index;
}

function buildTree(files) {
  const root = { name: "", path: "", children: [] };
  const map = new Map([["", root]]);
  for (const file of files) {
    const parts = file.path.split("/");
    let parent = "";
    parts.forEach((part, index) => {
      const nodePath = parts.slice(0, index + 1).join("/");
      if (!map.has(nodePath)) {
        const node = { name: part, path: nodePath, file: null, children: [] };
        map.set(nodePath, node);
        map.get(parent).children.push(node);
      }
      if (index === parts.length - 1) map.get(nodePath).file = file;
      parent = nodePath;
    });
  }
  const sortNodes = (node) => {
    node.children.sort((a, b) => {
      if (node.path === "") {
        const rank = rootRank(a.name) - rootRank(b.name);
        if (rank) return rank;
      }
      if (node.path === "ideas") return b.name.localeCompare(a.name);
      if (/^ideas\/[^/]+$/.test(node.path)) {
        const rank = slotRank(a.name) - slotRank(b.name);
        if (rank) return rank;
      } else {
        const aFolder = a.file ? 1 : 0;
        const bFolder = b.file ? 1 : 0;
        if (aFolder !== bFolder) return aFolder - bFolder;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };
  sortNodes(root);
  return root;
}

function countUnder(files, folder) {
  const prefix = `${folder}/`;
  return files.filter((file) => file.path.startsWith(prefix)).length;
}

function collapsedIdeas(files, openPath) {
  const next = new Set();
  for (const file of files) {
    const parts = file.path.split("/");
    if (parts[0] === "ideas" && parts[1]) next.add(`ideas/${parts[1]}`);
  }
  if (openPath) {
    const parts = openPath.split("/");
    let acc = "";
    for (const part of parts.slice(0, -1)) {
      acc = acc ? `${acc}/${part}` : part;
      next.delete(acc);
    }
  }
  return next;
}

function classify(selection, files) {
  if (!selection) return "home";
  if (files.some((file) => file.path === selection)) return "file";
  if (/^ideas\/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(selection)) return "idea";
  if (
    selection === "ideas" ||
    selection === "shared" ||
    files.some((file) => file.path.startsWith(`${selection}/`))
  ) {
    return "folder";
  }
  return "missing";
}

function claims(filePath, idea, slot) {
  const rest = filePath.slice(idea.length + 1);
  if (slot.dir) return rest === slot.id || rest.startsWith(`${slot.id}/`);
  if (rest === slot.id) return true;
  if (!rest.startsWith(`${slot.id}.`)) return false;
  const extra = rest.slice(slot.id.length + 1);
  return extra.length > 0 && !extra.includes("/") && !extra.includes(".");
}

function viewKind(file) {
  switch (file.contentType) {
    case "text/markdown":
      return "markdown";
    case "text/plain":
      return "text";
    case "text/csv":
      return "csv";
    case "text/tab-separated-values":
      return "tsv";
    case "application/json":
      return "json";
    case "image/png":
    case "image/jpeg":
    case "image/gif":
    case "image/webp":
      return "image";
    case "application/pdf":
      return "pdf";
    default:
      return "binary";
  }
}

function rawHref(filePath, download = false) {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/files/raw?${params.toString()}`;
}

function curlExamples(origin) {
  const base = origin || "http://localhost:3000";
  return [
    {
      title: "Upload a file",
      text: `curl -F "bot=scout" -F "path=ideas/014-market-map/evidence.csv" -F "file=@evidence.csv" ${base}/api/files`,
    },
    {
      title: "Upload markdown as JSON",
      text: `curl -X POST ${base}/api/files -H "Content-Type: application/json" -d '{"bot":"scout","path":"ideas/014-market-map/brief.md","content":"# Brief"}'`,
    },
    {
      title: "Upload bytes with headers",
      text: `curl -X POST ${base}/api/files -H "X-Bot-Name: scout" -H "X-File-Path: ideas/014-market-map/scores.json" -H "Content-Type: application/octet-stream" --data-binary @scores.json`,
    },
    {
      title: "List files",
      text: `curl ${base}/api/files`,
    },
    {
      title: "Read one file",
      text: `curl "${base}/api/files/raw?path=ideas/014-market-map/brief.md"`,
    },
  ];
}

function Tree({ nodes, collapsed, onToggle, selected, onSelect, files }) {
  return (
    <ul className="tree">
      {nodes.map((node) => {
        const folder = node.children.length > 0;
        const closed = collapsed.has(node.path);
        return (
          <li key={node.path}>
            <div className="node-row">
              {folder ? (
                <button
                  type="button"
                  className="chevron"
                  aria-label={closed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                  onClick={() => onToggle(node.path)}
                >
                  {closed ? "▸" : "▾"}
                </button>
              ) : (
                <span className="chevron spacer" aria-hidden="true" />
              )}
              <button
                type="button"
                className="node-label"
                aria-current={selected === node.path ? "true" : undefined}
                onClick={() => onSelect(node.path)}
              >
                <span className="node-name">{node.name}</span>
                <span className="node-meta">
                  {folder ? countUnder(files, node.path) : node.file?.bot}
                </span>
              </button>
            </div>
            {folder && !closed ? (
              <Tree
                nodes={node.children}
                collapsed={collapsed}
                onToggle={onToggle}
                selected={selected}
                onSelect={onSelect}
                files={files}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Viewer({ file, onSelect }) {
  const kind = viewKind(file);
  const textual = ["markdown", "csv", "tsv", "json", "text"].includes(kind);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(textual);
  const [mode, setMode] = useState("preview");
  const [loadedKey, setLoadedKey] = useState("");
  const fileKey = `${file.path}:${file.uploadedAt}`;
  if (loadedKey !== fileKey) {
    setLoadedKey(fileKey);
    setMode("preview");
    setBody("");
    setError("");
    setLoading(textual);
  }

  useEffect(() => {
    if (!textual) return undefined;
    let cancel = false;
    fetch(rawHref(file.path), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not read this file.");
        }
        return res.text();
      })
      .then((text) => {
        if (!cancel) setBody(text);
      })
      .catch((err) => {
        if (!cancel) setError(err.message);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [file.path, file.uploadedAt, textual]);

  const crumbs = file.path.split("/").map((name, index, all) => ({
    name,
    path: all.slice(0, index + 1).join("/"),
  }));

  return (
    <article className="viewer">
      <header className="viewer-head">
        <div>
          <p className="crumbs">
            <button type="button" onClick={() => onSelect(null)}>
              Desk
            </button>
            {crumbs.map((crumb, index) => (
              <span key={crumb.path}>
                <span aria-hidden="true"> / </span>
                <button type="button" onClick={() => onSelect(crumb.path)}>
                  {index === crumbs.length - 1 ? <strong>{crumb.name}</strong> : crumb.name}
                </button>
              </span>
            ))}
          </p>
          <h2>{file.path.split("/").pop()}</h2>
          <p className="meta-line">
            <span>Stamp · {file.bot}</span>
            <span>
              <LocalTime iso={file.uploadedAt} />
            </span>
            <span>{formatBytes(file.size)}</span>
            {file.gitRevision ? <span>git {file.gitRevision}</span> : null}
          </p>
        </div>
        <Stamp bot={file.bot} />
      </header>
      <div className="toolbar">
        {textual ? (
          <>
            <button
              type="button"
              className={mode === "preview" ? "btn primary" : "btn"}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className={mode === "source" ? "btn primary" : "btn"}
              onClick={() => setMode("source")}
            >
              Source
            </button>
          </>
        ) : null}
        <a className="btn" href={rawHref(file.path, true)}>
          Download
        </a>
      </div>
      {file.github?.url ? (
        <p className="hint">
          <a href={file.github.url}>Open on GitHub</a>
        </p>
      ) : null}
      {loading ? <p className="empty">Opening…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error && textual && mode === "source" ? (
        <pre className="code source">{body}</pre>
      ) : null}
      {!loading && !error && textual && mode === "preview" && kind === "markdown" ? (
        <MarkdownView source={body} />
      ) : null}
      {!loading && !error && textual && mode === "preview" && kind === "text" ? (
        <pre className="code source">{body}</pre>
      ) : null}
      {!loading && !error && textual && mode === "preview" && kind === "csv" ? (
        <CsvView text={body} />
      ) : null}
      {!loading && !error && textual && mode === "preview" && kind === "tsv" ? (
        <CsvView text={body} delimiter={"\t"} />
      ) : null}
      {!loading && !error && textual && mode === "preview" && kind === "json" ? (
        <JsonView source={body} />
      ) : null}
      {kind === "image" ? (
        <div className="preview-frame">
          <Image
            src={rawHref(file.path)}
            alt={file.path.split("/").pop() || "Uploaded image"}
            fill
            unoptimized
            sizes="(max-width: 860px) 100vw, 70vw"
          />
        </div>
      ) : null}
      {kind === "pdf" ? (
        <iframe className="pdf-frame" title={file.path} src={rawHref(file.path)} />
      ) : null}
      {kind === "binary" ? (
        <div className="binary">
          <p>This file does not have a preview. Download it to read it locally.</p>
          <p className="meta-line">{file.contentType}</p>
        </div>
      ) : null}
    </article>
  );
}

function IdeaBoard({ idea, files, onSelect, onUpload }) {
  const inside = files.filter((file) => file.path.startsWith(`${idea}/`));
  const claimed = new Set();
  const cards = SLOTS.map((slot) => {
    const matches = inside.filter((file) => claims(file.path, idea, slot));
    matches.forEach((file) => claimed.add(file.path));
    const primary = slot.dir
      ? null
      : matches.find((file) => file.path.endsWith(`/${slot.id}.md`)) ||
        matches.find((file) => file.path.endsWith(`/${slot.id}`)) ||
        matches[0] ||
        null;
    return { slot, matches, primary };
  });
  const extras = inside.filter((file) => !claimed.has(file.path));

  return (
    <section>
      <header className="viewer-head">
        <div>
          <p className="crumbs">
            <button type="button" onClick={() => onSelect(null)}>
              Desk
            </button>
            <span>
              <span aria-hidden="true"> / </span>
              <button type="button" onClick={() => onSelect("ideas")}>
                ideas
              </button>
            </span>
            <span>
              <span aria-hidden="true"> / </span>
              <strong>{idea.split("/")[1]}</strong>
            </span>
          </p>
          <h2>{idea.split("/")[1]}</h2>
          <p className="meta-line">{inside.length} files in this idea</p>
        </div>
        <button type="button" className="btn primary" onClick={() => onUpload(`${idea}/`)}>
          Upload into this idea
        </button>
      </header>
      {idea.endsWith("/000-sample-desk") ? (
        <p className="banner">
          Sample idea, so each slot has something to open. Real bots should upload
          their own <code>ideas/&lt;ID&gt;-&lt;slug&gt;/</code> folder.
        </p>
      ) : null}
      <div className="slot-grid">
        {cards.map(({ slot, matches, primary }) => {
          const filled = slot.dir ? matches.length > 0 : Boolean(primary);
          return (
            <div key={slot.id} className={filled ? "slot" : "slot empty"}>
              <p className="slot-kind">{slot.hint}</p>
              <h3>{slot.label}</h3>
              {slot.dir ? (
                matches.length ? (
                  <ul className="slot-files">
                    {matches.map((file) => (
                      <li key={file.path}>
                        <button type="button" onClick={() => onSelect(file.path)}>
                          {file.path.slice(idea.length + 1)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <button type="button" className="text-btn" onClick={() => onUpload(`${idea}/${slot.id}/`)}>
                    Upload into {slot.label}
                  </button>
                )
              ) : primary ? (
                <button type="button" className="text-btn" onClick={() => onSelect(primary.path)}>
                  {primary.path.split("/").pop()}
                  <span>
                    {primary.bot} · <LocalTime iso={primary.uploadedAt} />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    onUpload(`${idea}/${slot.id.includes(".") ? slot.id : `${slot.id}.md`}`)
                  }
                >
                  Upload {slot.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {extras.length ? (
        <section className="panel">
          <h3>Also in this folder</h3>
          <ul className="recent">
            {extras.map((file) => (
              <li key={file.path}>
                <button type="button" onClick={() => onSelect(file.path)}>
                  <span>{file.path.slice(idea.length + 1)}</span>
                  <span>
                    {file.bot} · <LocalTime iso={file.uploadedAt} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function FolderList({ folder, files, onSelect }) {
  const prefix = `${folder}/`;
  const children = new Map();
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const rest = file.path.slice(prefix.length);
    const name = rest.split("/")[0];
    const childPath = `${folder}/${name}`;
    const entry = children.get(childPath) || { path: childPath, name, file: null, count: 0 };
    if (rest === name) entry.file = file;
    else entry.count += 1;
    children.set(childPath, entry);
  }
  const items = [...children.values()].sort((a, b) =>
    folder === "ideas" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
  );

  return (
    <section>
      <header className="section-head">
        <p className="crumbs">
          <button type="button" onClick={() => onSelect(null)}>
            Desk
          </button>
          <span>
            <span aria-hidden="true"> / </span>
            <strong>{folder}</strong>
          </span>
        </p>
        <h2>{folder}</h2>
      </header>
      <ul className="recent">
        {items.map((item) => (
          <li key={item.path}>
            <button type="button" onClick={() => onSelect(item.path)}>
              <span>{item.name}</span>
              <span>{item.file ? item.file.bot : `${item.count} files`}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Overview({ catalog, files, onSelect, origin }) {
  const ideas = new Set(
    files
      .map((file) => file.path.match(/^ideas\/([^/]+)\//)?.[1])
      .filter(Boolean),
  );
  const bots = new Set(files.map((file) => file.bot));
  const recent = [...files]
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
    .slice(0, 6);
  const examples = curlExamples(origin);

  return (
    <div className="overview">
      <p className="kicker">Research data</p>
      <h2>Files from the validation bots</h2>
      <p className="lede">
        Each bot posts a file with its name. The file lands in the same folders as the
        research repo, and opens here as prose, a table, or JSON.
      </p>
      <dl className="facts">
        <div>
          <dt>This server</dt>
          <dd>
            <code>{origin}</code>
          </dd>
        </div>
        <div>
          <dt>Upload</dt>
          <dd>
            <code>POST /api/files</code>
          </dd>
        </div>
        <div>
          <dt>List</dt>
          <dd>
            <code>GET /api/files</code>
          </dd>
        </div>
        <div>
          <dt>Read or download</dt>
          <dd>
            <code>GET /api/files/raw?path=…</code>
          </dd>
        </div>
        <div>
          <dt>Bot stamp</dt>
          <dd>Field <code>bot</code>, or header <code>X-Bot-Name</code></dd>
        </div>
        <div>
          <dt>File path</dt>
          <dd>Field <code>path</code>, or header <code>X-File-Path</code></dd>
        </div>
        <div>
          <dt>Size limit</dt>
          <dd>{formatBytes(catalog.limits?.maxBytes)} per file. No login on the API.</dd>
        </div>
      </dl>
      <div className="stats">
        <div className="stat">
          <strong>{files.length}</strong>
          <span>files</span>
        </div>
        <div className="stat">
          <strong>{ideas.size}</strong>
          <span>ideas</span>
        </div>
        <div className="stat">
          <strong>{bots.size}</strong>
          <span>stamps</span>
        </div>
      </div>
      <section className="panel">
        <h3>Recent uploads</h3>
        {recent.length === 0 ? (
          <p className="empty">Nothing uploaded yet.</p>
        ) : (
          <ul className="recent">
            {recent.map((file) => (
              <li key={file.path}>
                <button type="button" onClick={() => onSelect(file.path)}>
                  <span>{file.path}</span>
                  <span>
                    {file.bot} · <LocalTime iso={file.uploadedAt} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h3>Calls to give the bots</h3>
        {examples.map((example) => (
          <div key={example.title} className="example">
            <div className="example-head">
              <h4>{example.title}</h4>
              <CopyButton text={example.text} />
            </div>
            <pre className="code">{example.text}</pre>
          </div>
        ))}
        <p className="hint">
          Files are stored in {catalog.github?.repo || "groksup/research-data"} on{" "}
          {catalog.github?.branch || "main"}.
        </p>
      </section>
    </div>
  );
}

function UploadDialog({
  open,
  path,
  setPath,
  bot,
  setBot,
  onClose,
  onUploaded,
  limitLabel,
}) {
  const ref = useRef(null);
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      let response;
      if (mode === "text") {
        response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot, path, content: text }),
        });
      } else {
        const body = new FormData();
        body.set("bot", bot);
        body.set("path", path);
        body.set("file", file);
        response = await fetch("/api/files", { method: "POST", body });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      window.localStorage.setItem("desk-bot", bot);
      setFile(null);
      setText("");
      setFileKey((value) => value + 1);
      onUploaded(data.file);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  const pathReady = path.trim().length > 0 && !path.endsWith("/");
  const canSubmit =
    bot.trim() &&
    pathReady &&
    !pending &&
    (mode === "file" ? file : text.trim());

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      <form className="sheet-card" onSubmit={onSubmit}>
        <div className="example-head">
          <h3>Upload a file</h3>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="hint">Same call the bots use. Limit {limitLabel}. No login.</p>
        <label>
          Bot name
          <input
            value={bot}
            onChange={(event) => setBot(event.target.value)}
            placeholder="scout"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Path in the repo
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="ideas/014-market-map/brief.md"
            autoComplete="off"
            required
          />
        </label>
        <div className="toolbar">
          <button
            type="button"
            className={mode === "file" ? "btn primary" : "btn"}
            onClick={() => setMode("file")}
          >
            File
          </button>
          <button
            type="button"
            className={mode === "text" ? "btn primary" : "btn"}
            onClick={() => setMode("text")}
          >
            Paste text
          </button>
        </div>
        {mode === "file" ? (
          <label>
            File
            <input
              key={fileKey}
              type="file"
              onChange={(event) => {
                const next = event.target.files?.[0] || null;
                setFile(next);
                if (next && path.endsWith("/")) setPath(`${path}${next.name}`);
              }}
            />
          </label>
        ) : (
          <label>
            Text
            <textarea
              rows={8}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="# Brief"
            />
          </label>
        )}
        {path.endsWith("/") ? (
          <p className="hint">Add a file name at the end of the path, or choose a file.</p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={!canSubmit}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
    </dialog>
  );
}

export default function Desk({
  initialCatalog,
  initialFile = "",
  origin = "http://localhost:3000",
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [selected, setSelected] = useState(initialFile || null);
  const [collapsed, setCollapsed] = useState(() =>
    collapsedIdeas(initialCatalog.files || [], initialFile),
  );
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [draftPath, setDraftPath] = useState("");
  const [bot, setBot] = useState("");
  const [notice, setNotice] = useState("");
  const [gate, setGate] = useState(null);
  const files = useMemo(() => catalog.files ?? [], [catalog]);
  const tree = useMemo(() => buildTree(files), [files]);
  const router = useRouter();
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? files.filter(
        (file) =>
          file.path.toLowerCase().includes(needle) ||
          file.bot.toLowerCase().includes(needle),
      )
    : null;
  const selectedFile = files.find((file) => file.path === selected) || null;
  const view = classify(selected, files);

  useEffect(() => {
    const saved = window.localStorage.getItem("desk-bot");
    if (saved) queueMicrotask(() => setBot(saved));
    fetch("/api/session")
      .then((res) => res.json())
      .then(setGate)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/files", { cache: "no-store" });
        const data = await res.json();
        if (!cancel && res.ok) setCatalog(data);
      } catch {
        /* keep the list already on screen */
      }
    };
    const id = window.setInterval(tick, 15000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, []);

  function select(path) {
    setSelected(path || null);
    if (path) {
      setCollapsed((current) => {
        const next = new Set(current);
        const parts = path.split("/");
        let acc = "";
        for (const part of parts.slice(0, -1)) {
          acc = acc ? `${acc}/${part}` : part;
          next.delete(acc);
        }
        return next;
      });
    }
    const url = new URL(window.location.href);
    if (path) url.searchParams.set("file", path);
    else url.searchParams.delete("file");
    window.history.replaceState(null, "", url);
  }

  function toggle(path) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function reload() {
    const res = await fetch("/api/files", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not reload the desk.");
    setCatalog(data);
    return data;
  }

  return (
    <div className="desk">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => select(null)}>
          <span className="mark">IV</span>
          <span>
            <span className="kicker">Research files</span>
            <strong className="brand-name">Idea Validation Desk</strong>
          </span>
        </button>
        <div className="top-actions">
          <span className="chip">{catalog.github?.repo || "GitHub"}</span>
          {gate?.restricted ? (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await fetch("/api/session", { method: "DELETE" });
                router.push("/login");
                router.refresh();
              }}
            >
              Sign out
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={() => setUploadOpen(true)}>
            Upload
          </button>
        </div>
      </header>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="shell">
        <aside className="rail">
          <div className="search-wrap">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search path or bot"
              aria-label="Search path or bot"
            />
          </div>
          {matches ? (
            matches.length === 0 ? (
              <p className="empty">No files match.</p>
            ) : (
              <ul className="tree flat">
                {matches.map((file) => (
                  <li key={file.path}>
                    <button
                      type="button"
                      className="node-label"
                      aria-current={selected === file.path ? "true" : undefined}
                      onClick={() => select(file.path)}
                    >
                      <span className="node-name">{file.path}</span>
                      <span className="node-meta">{file.bot}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <Tree
              nodes={tree.children}
              collapsed={collapsed}
              onToggle={toggle}
              selected={selected}
              onSelect={select}
              files={files}
            />
          )}
          <p className="foot-note">
            Open upload. Paths stay in ideas/, shared/, and INDEX.md.{" "}
            {formatBytes(catalog.limits?.maxBytes)} max.
          </p>
        </aside>
        <main className="main">
          {view === "home" ? (
            <Overview catalog={catalog} files={files} onSelect={select} origin={origin} />
          ) : null}
          {view === "file" && selectedFile ? (
            <Viewer file={selectedFile} onSelect={select} />
          ) : null}
          {view === "idea" ? (
            <IdeaBoard
              idea={selected}
              files={files}
              onSelect={select}
              onUpload={(nextPath) => {
                setDraftPath(nextPath);
                setUploadOpen(true);
              }}
            />
          ) : null}
          {view === "folder" ? (
            <FolderList folder={selected} files={files} onSelect={select} />
          ) : null}
          {view === "missing" ? (
            <div className="overview">
              <h2>No file at this path</h2>
              <p className="lede">{selected}</p>
              <button type="button" className="btn" onClick={() => select(null)}>
                Back to the desk
              </button>
            </div>
          ) : null}
        </main>
      </div>
      <UploadDialog
        open={uploadOpen}
        path={draftPath}
        setPath={setDraftPath}
        bot={bot}
        setBot={setBot}
        limitLabel={formatBytes(catalog.limits?.maxBytes)}
        onClose={() => setUploadOpen(false)}
        onUploaded={async (file) => {
          setUploadOpen(false);
          try {
            await reload();
          } catch {
            /* the next refresh will catch up */
          }
          select(file.path);
          setNotice(`Uploaded ${file.path} · stamped ${file.bot}`);
          window.setTimeout(() => setNotice(""), 4000);
        }}
      />
    </div>
  );
}
