const ORDER = [
  "market",
  "pain",
  "wtp",
  "gap",
  "demand",
  "feasibility",
  "time",
  "capital",
  "distribution",
  "risk",
];

export function parseScores(text) {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function ideaIdFrom(slug, scores) {
  if (typeof scores?.idea_id === "string" && scores.idea_id.trim()) return scores.idea_id.trim();
  const match = String(slug).match(/^(IV-\d+[a-z]?)/i);
  return match ? match[1] : slug;
}

export function reportTitle(markdown, slug) {
  const heading = String(markdown || "").match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const id = ideaIdFrom(slug, null);
  const rest = String(slug)
    .replace(new RegExp(`^${id}-`, "i"), "")
    .replace(/-/g, " ");
  return rest || slug;
}

export function verdictOf(scores) {
  const status = String(scores?.status || "").trim();
  const detail = String(scores?.verdict_detail || "").trim();
  const lead = `${status} ${detail.split(/[.]/)[0] || ""}`.toLowerCase();
  let tone = "unknown";
  if (lead.includes("no-go") || lead.includes("no go")) tone = "stop";
  else if (lead.includes("conditional")) tone = "hold";
  else if (/\bgo\b/.test(lead)) tone = "go";

  const known = {
    "conditional-go": "Conditional go",
    "no-go": "No-go",
    go: "Go",
  };
  let label = known[status.toLowerCase()] || "";
  if (!label && detail) {
    const sentence = detail.split(".")[0].trim();
    label = sentence.length > 0 && sentence.length <= 48 ? sentence : "";
  }
  if (!label) label = status || "Unscored";

  const total = Number(scores?.weighted_total);
  const percent = Number(scores?.weighted_percent);
  const confidence = String(scores?.confidence || "").trim();
  const shortConfidence = confidence ? confidence.split(":")[0].trim() : "";
  return {
    tone,
    label,
    detail,
    total: Number.isFinite(total) ? total : null,
    percent: Number.isFinite(percent) ? percent : null,
    confidence,
    shortConfidence,
  };
}

export function formatScore(value) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

export function scoreRows(scores) {
  const criteria = scores?.criteria && typeof scores.criteria === "object" ? scores.criteria : {};
  const weights = scores?.weights && typeof scores.weights === "object" ? scores.weights : {};
  const rationale = scores?.rationale && typeof scores.rationale === "object" ? scores.rationale : {};
  const keys = [
    ...ORDER.filter((key) => Object.prototype.hasOwnProperty.call(criteria, key)),
    ...Object.keys(criteria).filter((key) => !ORDER.includes(key)),
  ];
  return keys
    .map((key) => ({
      key,
      score: Number(criteria[key]),
      weight: Number(weights[key]),
      note: typeof rationale[key] === "string" ? rationale[key] : "",
    }))
    .filter((row) => Number.isFinite(row.score));
}
