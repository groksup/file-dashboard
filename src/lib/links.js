const IDEA = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/;

export function resolveDeskHref(href, fromPath = "") {
  if (!href) return { external: true, href: "#" };
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { external: true, href };
  if (href.startsWith("#")) return { external: true, href };

  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  let raw = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?")[0];
  if (!raw) return { external: true, href };
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep the original path */
  }

  const rooted =
    raw.startsWith("/") ||
    raw.startsWith("ideas/") ||
    raw.startsWith("shared/") ||
    raw === "INDEX.md";
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const parts = rooted ? [] : dir ? dir.split("/") : [];
  if (raw.startsWith("/")) raw = raw.slice(1);
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const path = parts.join("/").replace(/\/$/, "");
  if (!path || path === "INDEX.md") return { external: false, href: `/${hash}` };

  const folder = path.match(/^ideas\/([^/]+)$/);
  if (folder && IDEA.test(folder[1])) {
    return { external: false, href: `/ideas/${folder[1]}${hash}` };
  }

  const file = path.match(/^ideas\/([^/]+)\/(.+)$/);
  if (file && IDEA.test(file[1])) {
    const rel = file[2];
    if (rel === "report.md" || rel === "report") {
      return { external: false, href: `/ideas/${file[1]}${hash}` };
    }
    if (rel === "evidence.csv") {
      return { external: false, href: `/ideas/${file[1]}?tab=evidence${hash}` };
    }
    if (rel === "quotes.csv") {
      return { external: false, href: `/ideas/${file[1]}?tab=quotes${hash}` };
    }
    return {
      external: false,
      href: `/ideas/${file[1]}?tab=files&file=${encodeURIComponent(rel)}${hash}`,
    };
  }

  return { external: false, href: `/?file=${encodeURIComponent(path)}${hash}` };
}
