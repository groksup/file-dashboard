function inline(text) {
  const pattern =
    /(`[^`]+`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  const nodes = [];
  let last = 0;
  let match = pattern.exec(text);
  let key = 0;
  while (match) {
    if (match.index > last) {
      nodes.push(<span key={key}>{text.slice(last, match.index)}</span>);
      key += 1;
    }
    if (match[1]) {
      nodes.push(<code key={key}>{match[1].slice(1, -1)}</code>);
    } else if (match[2]) {
      nodes.push(<strong key={key}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={key}>{match[5]}</em>);
    } else if (match[6]) {
      nodes.push(
        <a key={key} href={match[8]} target="_blank" rel="noreferrer">
          {match[7]}
        </a>,
      );
    }
    key += 1;
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) nodes.push(<span key={key}>{text.slice(last)}</span>);
  return nodes;
}

function splitRow(line) {
  const cells = line.split("|").map((cell) => cell.trim());
  if (line.trim().startsWith("|")) cells.shift();
  if (line.trim().endsWith("|")) cells.pop();
  return cells;
}

function isSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || "");
}

function isSpecial(line, next) {
  if (!line || !line.trim()) return true;
  if (line.startsWith("```")) return true;
  if (/^#{1,4}\s+/.test(line)) return true;
  if (line.startsWith(">")) return true;
  if (/^\s*[-*]\s+/.test(line)) return true;
  if (/^\s*\d+[.)]\s+/.test(line)) return true;
  if (/^(-{3,}|\*{3,})$/.test(line.trim())) return true;
  if (line.includes("|") && isSeparator(next)) return true;
  return false;
}

export function MarkdownView({ source }) {
  const lines = String(source).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={key} className="code">
          {lang ? <span className="lang">{lang}</span> : null}
          <code>{code.join("\n")}</code>
        </pre>,
      );
      key += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key} />);
      key += 1;
      index += 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length}`;
      blocks.push(<Tag key={key}>{inline(heading[2])}</Tag>);
      key += 1;
      index += 1;
      continue;
    }
    if (line.startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={key}>{inline(quote.join(" "))}</blockquote>);
      key += 1;
      continue;
    }
    if (line.includes("|") && isSeparator(lines[index + 1])) {
      const header = splitRow(line);
      index += 2;
      const body = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        body.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={key} className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={`${cell}-${cellIndex}`} scope="col">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>{inline(row[cellIndex] || "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      key += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={key}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item)}</li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={key}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item)}</li>
          ))}
        </ol>,
      );
      key += 1;
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isSpecial(lines[index], lines[index + 1])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
    key += 1;
  }

  return <article className="prose">{blocks}</article>;
}
