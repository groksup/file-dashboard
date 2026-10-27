export function parseCsv(input, delimiter = ",") {
  const text = String(input).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every((value) => value === "")) {
    rows.pop();
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((entry) => entry.length));
  const padded = rows.map((entry) => {
    const next = entry.slice();
    while (next.length < width) next.push("");
    return next;
  });
  return { headers: padded[0], rows: padded.slice(1) };
}
