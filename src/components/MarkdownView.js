import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveDeskHref } from "../lib/links.js";

function MarkdownLink({ href, children, fromPath }) {
  const resolved = resolveDeskHref(href, fromPath);
  if (resolved.external) {
    return (
      <a href={resolved.href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link href={resolved.href}>{children}</Link>;
}

export function MarkdownView({ source, fromPath = "" }) {
  return (
    <div className="prose report-prose">
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <MarkdownLink href={href} fromPath={fromPath}>
            {children}
          </MarkdownLink>
        ),
        table: ({ children }) => (
          <div className="table-wrap">
            <table className="grid">{children}</table>
          </div>
        ),
        th: ({ children, style }) => (
          <th scope="col" style={style}>
            {children}
          </th>
        ),
        pre: ({ children }) => <pre className="code">{children}</pre>,
      }}
    >
      {String(source || "")}
    </Markdown>
    </div>
  );
}
