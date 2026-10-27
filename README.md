# Idea Validation Desk

Bots upload research files without a login. People read them in the dashboard, in the same folders as `github.com/groksup/research-data`.

Files are stored in GitHub (`groksup/research-data` by default), not on the server. That is what makes the desk work on Vercel and from another device. Each upload is a commit made with the GitHub Contents API. The commit message contains `Bot: <name>`. The GitHub author is the token's account. The bot name and time are also saved in `.desk/index.json` in that repo.

## Run

```bash
npm install
npm run dev
```

Dashboard: [http://localhost:3000](http://localhost:3000)

## What to give the research bots

Base URL while this server is running locally: `http://localhost:3000`

If you host it somewhere else, keep the paths and change the host.

### Upload

`POST /api/files`

No login. Send the bot name and the repo path with the file.

Multipart, for any file type:

```bash
curl -F "bot=scout" \
  -F "path=ideas/014-market-map/evidence.csv" \
  -F "file=@evidence.csv" \
  http://localhost:3000/api/files
```

JSON, for text files:

```bash
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{"bot":"scout","path":"ideas/014-market-map/brief.md","content":"# Brief"}'
```

Raw bytes. Use this for a JSON file so the body is the file itself:

```bash
curl -X POST http://localhost:3000/api/files \
  -H "X-Bot-Name: scout" \
  -H "X-File-Path: ideas/014-market-map/scores.json" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @scores.json \
  http://localhost:3000/api/files
```

A path that ends in `/` plus a multipart file uses the file's own name.

### Bot stamp

One of these, on every upload:

- form field `bot`
- JSON field `bot`
- header `X-Bot-Name`

The stamp is whatever the bot sends. It is not a password. The dashboard shows that name and the upload time on every file.

### List

`GET /api/files`

One idea:

`GET /api/files?prefix=ideas/014-market-map`

### Read and download

`GET /api/files/raw?path=ideas/014-market-map/brief.md`

Add `&download=1` to download. Response headers `X-Bot-Name` and `X-Uploaded-At` repeat the stamp.

### Paths

```text
INDEX.md
shared/<file>
ideas/<ID>-<slug>/<file>
```

Example folder:

```text
ideas/014-market-map/
  brief.md
  plan.md
  evidence.csv
  quotes.csv
  analysis/
  critique
  pivots
  scores.json
  report
  launch/
```

`brief` and `brief.md` both fill the brief slot. Same for plan, critique, pivots, and report.

### Dashboard

[http://localhost:3000](http://localhost:3000)

Click a markdown file to read it, a CSV to scan the table, or JSON to see the fields. The dashboard lists the files already in the GitHub repo, then anything the bots upload.

## Safeguards

The upload API has no login.

- 4 MB per file, so an upload fits Vercel's request limit
- paths cannot leave `INDEX.md`, `shared/`, and `ideas/<ID>-<slug>/`
- HTML and SVG are downloaded, not opened as a page
- optional `UPLOAD_KEY`: if set, uploads must send header `X-Upload-Key`
- optional `DASHBOARD_PASSWORD`: if set, the reading view asks for it. The API stays open

Keep this server on the network the bots already use. Do not publish the upload URL on the public internet.

## Deploy

Create `.env.local` for this machine, and set the same variables in the Vercel project. The token is required. Without it the desk has nowhere to put files.

```bash
GITHUB_TOKEN=...
GITHUB_REPO=groksup/research-data
GITHUB_BRANCH=main
```

`GITHUB_TOKEN` needs read and write access to the repository contents. For a private repo, a classic personal access token needs the `repo` scope. Do not prefix it with `NEXT_PUBLIC_`.

Vercel will run the Next.js app as-is. Uploads and downloads call GitHub from the server. Redeploy after changing the token.
