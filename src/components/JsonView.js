"use client";

import { CsvView } from "./CsvView";

function asTable(data) {
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    data.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    return null;
  }
  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value == null) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    }),
  );
  return { headers, rows };
}

function renderValue(value) {
  if (value == null || typeof value !== "object") return String(value);
  const flat =
    !Array.isArray(value) &&
    Object.values(value).every((item) => item == null || typeof item !== "object");
  if (flat) {
    return (
      <div className="score-row">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="score">
            <strong>{String(item)}</strong>
            <span>{key}</span>
          </div>
        ))}
      </div>
    );
  }
  return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
}

export function JsonView({ source }) {
  let data;
  try {
    data = JSON.parse(source);
  } catch (err) {
    return (
      <div>
        <p className="error">This JSON could not be parsed. {err.message}</p>
        <pre className="code">{source}</pre>
      </div>
    );
  }

  const table = asTable(data);
  const record = data && typeof data === "object" && !Array.isArray(data) ? data : null;

  return (
    <div className="json-view">
      {table ? <CsvView headers={table.headers} rows={table.rows} /> : null}
      {record ? (
        <dl className="facts">
          {Object.entries(record).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{renderValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!table && !record ? <pre className="code">{JSON.stringify(data, null, 2)}</pre> : null}
      <details className="source-fold">
        <summary>JSON source</summary>
        <pre className="code">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}
