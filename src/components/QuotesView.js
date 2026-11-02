"use client";

import { useMemo, useState } from "react";
import { parseCsv } from "../lib/csv.js";
import { CsvView } from "./CsvView";

function column(headers, name) {
  return headers.findIndex((header) => header.trim().toLowerCase() === name);
}

function cell(row, index) {
  if (index < 0) return "";
  return row[index] || "";
}

export function QuotesView({ text = "" }) {
  const parsed = useMemo(() => parseCsv(text), [text]);
  const quoteIndex = column(parsed.headers, "quote");
  const [filter, setFilter] = useState("");
  const [asTable, setAsTable] = useState(false);

  if (quoteIndex < 0) return <CsvView text={text} />;

  const urlIndex = column(parsed.headers, "url");
  const dateIndex = column(parsed.headers, "date");
  const platformIndex = column(parsed.headers, "platform");
  const toolIndex = column(parsed.headers, "tool");
  const tagIndex = column(parsed.headers, "pain_tag");
  const needle = filter.trim().toLowerCase();
  const rows = needle
    ? parsed.rows.filter((row) => row.join("\n").toLowerCase().includes(needle))
    : parsed.rows;

  return (
    <div className="quotes">
      <div className="csv-bar">
        <p>
          {rows.length} {rows.length === 1 ? "quote" : "quotes"}
        </p>
        <div className="top-actions">
          <button type="button" className="btn" onClick={() => setAsTable((value) => !value)}>
            {asTable ? "Cards" : "Table"}
          </button>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search quotes"
            aria-label="Search quotes"
          />
        </div>
      </div>
      {asTable ? (
        <CsvView text={text} />
      ) : rows.length === 0 ? (
        <p className="empty">No quotes match that search.</p>
      ) : (
        <ul className="quote-list">
          {rows.map((row, index) => {
            const url = cell(row, urlIndex);
            const meta = [cell(row, toolIndex), cell(row, platformIndex), cell(row, dateIndex)]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={`${cell(row, 0)}-${index}`} className="quote-card">
                <blockquote>{cell(row, quoteIndex)}</blockquote>
                <p className="meta-line">
                  {meta ? <span>{meta}</span> : null}
                  {cell(row, tagIndex) ? <span>{cell(row, tagIndex)}</span> : null}
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
