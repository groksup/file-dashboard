import { headers } from "next/headers";
import Desk from "@/components/Desk";
import { HttpError } from "@/lib/http";
import { listCatalog } from "@/lib/vault";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") || "http";
  const initialFile = typeof params?.file === "string" ? params.file : "";
  const origin = `${proto}://${host}`;
  let catalog = null;
  let setupMessage = "";
  try {
    catalog = await listCatalog();
  } catch (err) {
    setupMessage = err instanceof HttpError ? err.message : "The desk could not reach GitHub.";
  }
  if (!catalog) return <GitHubSetup message={setupMessage} />;
  return <Desk initialCatalog={catalog} initialFile={initialFile} origin={origin} />;
}

function GitHubSetup({ message }) {
  return (
    <main className="gate">
      <section className="gate-card">
        <p className="kicker">Idea Validation Desk</p>
        <h1>Connect GitHub</h1>
        <p>{message}</p>
        <p>
          Uploads are saved in <code>groksup/research-data</code>. On Vercel, or in{" "}
          <code>.env.local</code> for local use, set:
        </p>
        <ul>
          <li>
            <code>GITHUB_TOKEN</code> with read and write access to that repo
          </li>
          <li>
            <code>GITHUB_REPO</code> = <code>groksup/research-data</code>
          </li>
          <li>
            <code>GITHUB_BRANCH</code> = <code>main</code>
          </li>
        </ul>
        <p>Restart or redeploy after saving the token. The token stays on the server.</p>
      </section>
    </main>
  );
}
