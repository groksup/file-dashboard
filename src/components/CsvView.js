"use client";

import { useMemo, useState } from "react";
import { parseCsv } from "../lib/csv.js";

const PREVIEW_LIMIT = 400;

export function CsvView({ text = "", delimiter = ",", headers, rows }) {
  const parsed = useMemo(() => {
    if (headers) return { headers, rows: rows || [] };
    return parseCsv(text, delimiter);
  }, [delimiter, headers, rows, text]);
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const filtered = needle
    ? parsed.rows.filter((row) => row.join("\n").toLowerCase().includes(needle))
    : parsed.rows;
  const visible = filtered.slice(0, PREVIEW_LIMIT);

  if (parsed.headers.length === 0) {
    return <p className="empty">This file has no rows.</p>;
  }

  return (
    <div className="csv">
      <div className="csv-bar">
        <p>
          {filtered.length} {filtered.length === 1 ? "row" : "rows"}
          {parsed.headers.length ? ` · ${parsed.headers.length} columns` : ""}
        </p>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter rows"
          aria-label="Filter rows"
        />
      </div>
      {filtered.length > PREVIEW_LIMIT ? (
        <p className="hint">
          Showing the first {PREVIEW_LIMIT} rows. Download the file for the rest.
        </p>
      ) : null}
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {parsed.headers.map((header, index) => (
                <th key={`${header}-${index}`} scope="col">
                  {header || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={parsed.headers.length}>No rows match that filter.</td>
              </tr>
            ) : (
              visible.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {parsed.headers.map((header, cellIndex) => (
                    <td key={`${header}-${cellIndex}`}>{row[cellIndex]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
