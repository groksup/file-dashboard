import Link from "next/link";
import { notFound } from "next/navigation";
import { CsvView } from "@/components/CsvView";
import { JsonView } from "@/components/JsonView";
import { MarkdownView } from "@/components/MarkdownView";
import { QuotesView } from "@/components/QuotesView";
import { HttpError } from "@/lib/http";
import { contentTypeFor, normalizeRepoPath } from "@/lib/paths";
import {
  formatScore,
  ideaIdFrom,
  parseScores,
  reportTitle,
  scoreRows,
  verdictOf,
} from "@/lib/scores";
import { listCatalog, readUpload } from "@/lib/vault";

export const dynamic = "force-dynamic";

const IDEA = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/;
const TABS = [
  { id: "report", label: "Report" },
  { id: "evidence", label: "Evidence" },
  { id: "quotes", label: "Quotes" },
  { id: "files", label: "Files" },
];

async function readOptional(rel) {
  try {
    const file = await readUpload(rel);
    return file.buffer.toString("utf8");
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return "";
    throw err;
  }
}

function ideaFile(slug, rel) {
  if (typeof rel !== "string" || !rel.trim()) return "";
  let full = "";
  try {
    full = normalizeRepoPath(`ideas/${slug}/${rel.trim().replace(/^\/+/, "")}`);
  } catch {
    return "";
  }
  if (!full.startsWith(`ideas/${slug}/`)) return "";
  return full;
}

function tabHref(slug, id) {
  if (id === "report") return `/ideas/${slug}`;
  return `/ideas/${slug}?tab=${id}`;
}

function fileHref(slug, rel) {
  if (rel === "report.md" || rel === "report") return `/ideas/${slug}`;
  if (rel === "evidence.csv") return `/ideas/${slug}?tab=evidence`;
  if (rel === "quotes.csv") return `/ideas/${slug}?tab=quotes`;
  return `/ideas/${slug}?tab=files&file=${encodeURIComponent(rel)}`;
}

export default async function IdeaPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  if (!IDEA.test(slug)) notFound();

  const tabQuery = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const fileQuery = Array.isArray(query.file) ? query.file[0] : query.file;
  const tab = TABS.some((item) => item.id === tabQuery) ? tabQuery : "report";
  const selected = tab === "files" ? ideaFile(slug, fileQuery || "") : "";

  let catalog;
  try {
    catalog = await listCatalog(`ideas/${slug}`);
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "The desk could not reach GitHub.";
    return (
      <main className="gate">
        <section className="gate-card">
          <p className="kicker">Idea Validation Desk</p>
          <h1>Connect GitHub</h1>
          <p>{message}</p>
        </section>
      </main>
    );
  }
  if (!catalog.count) notFound();

  const files = catalog.files || [];
  const [reportText, scoresText, evidenceText, quotesText, selectedText] = await Promise.all([
    readOptional(`ideas/${slug}/report.md`).then((text) => text || readOptional(`ideas/${slug}/report`)),
    readOptional(`ideas/${slug}/scores.json`),
    tab === "evidence" ? readOptional(`ideas/${slug}/evidence.csv`) : Promise.resolve(""),
    tab === "quotes" ? readOptional(`ideas/${slug}/quotes.csv`) : Promise.resolve(""),
    selected ? readOptional(selected) : Promise.resolve(""),
  ]);

  const scores = parseScores(scoresText);
  const verdict = verdictOf(scores);
  const rows = scoreRows(scores);
  const title = reportTitle(reportText, slug);
  const reportBody = reportText.replace(/^#\s+.+\n+/, "");
  const rawPath =
    selected ||
    (tab === "evidence"
      ? `ideas/${slug}/evidence.csv`
      : tab === "quotes"
        ? `ideas/${slug}/quotes.csv`
        : `ideas/${slug}/report.md`);
  const ideaId = ideaIdFrom(slug, scores);
  const prefix = `ideas/${slug}/`;
  const listed = files
    .map((file) => ({ ...file, rel: file.path.slice(prefix.length) }))
    .filter((file) => !["report.md", "report", "evidence.csv", "quotes.csv"].includes(file.rel))
    .sort((a, b) => a.rel.localeCompare(b.rel));

  return (
    <div className="desk report-page">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="mark">IV</span>
          <span>
            <span className="kicker">Research files</span>
            <strong className="brand-name">Idea Validation Desk</strong>
          </span>
        </Link>
        <div className="top-actions">
          <span className="chip">{catalog.github?.repo || "GitHub"}</span>
          <a className="btn" href={`/api/files/raw?path=${encodeURIComponent(rawPath)}`}>
            View raw
          </a>
        </div>
      </header>
      <main className="report">
        <header className="report-hero">
          <p className="kicker">{ideaId}</p>
          <h1>{title}</h1>
          <div className="verdict-row">
            <span className={`verdict ${verdict.tone}`}>{verdict.label}</span>
            {verdict.total != null ? (
              <p className="score-total">
                <strong>{formatScore(verdict.total)}</strong>
                <span>/ 5{verdict.percent != null ? ` · ${verdict.percent}%` : ""}</span>
              </p>
            ) : null}
            {verdict.shortConfidence ? (
              <span className="chip">Confidence {verdict.shortConfidence}</span>
            ) : null}
          </div>
          {verdict.detail ? <p className="lede">{verdict.detail}</p> : null}
          {verdict.confidence && verdict.confidence !== verdict.shortConfidence ? (
            <p className="hint">{verdict.confidence}</p>
          ) : null}
          {scores?.score_status ? (
            <p className="meta-line">
              <span>{scores.score_status}</span>
              {scores.scored_by ? <span>{scores.scored_by}</span> : null}
              {scores.scored_on ? <span>{scores.scored_on}</span> : null}
            </p>
          ) : null}
        </header>

        {rows.length ? (
          <section className="score-card" aria-label="Scores">
            <h2>Scores</h2>
            <ul className="score-bars">
              {rows.map((row) => (
                <li key={row.key}>
                  <div className="score-label">
                    <span>{row.key}</span>
                    <strong>{row.score}</strong>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(row.score, 5)) * 20}%` }} />
                  </div>
                  <p>
                    {Number.isFinite(row.weight) ? `Weight ${row.weight}` : ""}
                    {row.note ? `${Number.isFinite(row.weight) ? " · " : ""}${row.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="tabs" aria-label="Report sections">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={tabHref(slug, item.id)}
              className={tab === item.id ? "btn primary" : "btn"}
              aria-current={tab === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {tab === "report" ? (
          reportText ? (
            <MarkdownView source={reportBody} fromPath={`${prefix}report.md`} />
          ) : (
            <p className="empty">This idea has no report.md yet.</p>
          )
        ) : null}

        {tab === "evidence" ? (
          evidenceText ? (
            <CsvView text={evidenceText} />
          ) : (
            <p className="empty">This idea has no evidence.csv yet.</p>
          )
        ) : null}

        {tab === "quotes" ? (
          quotesText ? (
            <QuotesView text={quotesText} />
          ) : (
            <p className="empty">This idea has no quotes.csv yet.</p>
          )
        ) : null}

        {tab === "files" ? (
          <section className="file-pane">
            <ul className="file-index">
              {listed.map((file) => (
                <li key={file.path}>
                  <Link href={fileHref(slug, file.rel)} aria-current={selected === file.path ? "page" : undefined}>
                    {file.rel}
                  </Link>
                </li>
              ))}
            </ul>
            {selected ? (
              <div>
                <div className="toolbar">
                  <a className="btn" href={`/api/files/raw?path=${encodeURIComponent(selected)}`}>
                    View raw
                  </a>
                  <a
                    className="btn"
                    href={`/api/files/raw?path=${encodeURIComponent(selected)}&download=1`}
                  >
                    Download
                  </a>
                </div>
                <FileBody path={selected} text={selectedText} />
              </div>
            ) : (
              <p className="hint">Choose a file to read it here.</p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function FileBody({ path, text }) {
  if (!text) return <p className="empty">That file is empty or missing.</p>;
  const contentType = contentTypeFor(path, Buffer.from(text));
  if (contentType === "text/csv") return <CsvView text={text} />;
  if (contentType === "text/tab-separated-values") return <CsvView text={text} delimiter={"\t"} />;
  if (contentType === "application/json") return <JsonView source={text} />;
  if (contentType === "text/plain" && path.split("/").pop()?.includes(".")) {
    return <pre className="code source">{text}</pre>;
  }
  if (contentType === "text/markdown" || contentType === "text/plain") {
    return <MarkdownView source={text} fromPath={path} />;
  }
  return (
    <p className="empty">
      This file does not have a formatted preview.{" "}
      <a href={`/api/files/raw?path=${encodeURIComponent(path)}&download=1`}>Download it</a>.
    </p>
  );
}
