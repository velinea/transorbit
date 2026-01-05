# TransOrbit 🌍🛰️

TransOrbit is an AI-assisted subtitle translation and refinement tool focused on quality, consistency, and control.

It is designed for people who care about subtitles:

- media enthusiasts
- archivists
- translators
- perfectionists bothered by almost-good machine translations

TransOrbit is part of the **Orbit** family of media tools.

## ✨ What TransOrbit does

- Translates subtitle files using modern AI models
- Preserves subtitle timing and structure (never merges or shifts lines)
- Provides draft translations and final editable text
- Performs a consistency pass to fix:
  - inconsistent phrasing
  - character names
  - tone drift
  - formality mismatches
- Designed for long-running, unattended use (Docker / Unraid friendly)

## 🧠 Philosophy

TransOrbit is not a one-click black box.

Instead, it follows a professional subtitling workflow:

```
Source subtitles
      ↓
Draft translation (AI)
      ↓
Consistency pass (AI as editor)
      ↓
Human review & edits
```

AI does the heavy lifting.<br/>
You keep the final control.

## 🇫🇮 Language-aware features

TransOrbit includes language-specific intelligence, for example:

#### Finnish address register enforcement

Ensures consistent use of:

- sinä / sä (informal)
- te (formal)
- Prevents mixing forms within a movie
- Enforced during the consistency pass

This solves one of the most common problems in Finnish machine-translated subtitles.

## 🔧 Features

- Draft translation with confidence scores
- Robust consistency pass (safe, chunked, failure-tolerant)
- Per-line suggestions
- SQLite-based persistence
- Job system with progress & logs
- Web-based editor (pure HTML/CSS/JS)
- No frontend frameworks
- No vendor lock-in mindset

## 🐳 Running with Docker

Pull from GHCR

```
docker pull ghcr.io/velinea/transorbit:main
```

Run

```
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/data \
  --name transorbit \
  ghcr.io/velinea/transorbit:main
```

Then open:

http://localhost:3000

## 📁 Data & persistence

All persistent data lives in /data:

- SQLite database
- Projects
- Job logs

This makes TransOrbit safe to restart and easy to back up.

## 📜 Logs & observability

TransOrbit includes a built-in Logs view:

- Job progress
- AI errors
- Consistency warnings
- Debug output

No need to inspect container logs for normal debugging.

## 🧩 Orbit ecosystem

TransOrbit is part of a growing set of tools:

- SubOrbit – subtitle-aware movie discovery
- FFOrbit – ffmpeg-based media processing UI
- SyncOrbit – subtitle synchronization & timing correction
- TransOrbit – subtitle translation & refinement
- OrbitHub (planned) – unified pipeline & UI

Each tool can run **standalone** or as part of a larger workflow.

## 🚧 Project status

- Actively developed
- Stable for real-world testing
- APIs and internals may evolve
- UI intentionally minimal

This project values correctness and reliability over polish.

## 🛠️ Development

#### Requirements

- Node.js 20+
- SQLite
- OpenAI-compatible API key

#### Install (local)

```
cd server
npm install
node src/app.js
```

#### Docker build (local)

```
docker build -t transorbit:test .
docker run -p 3000:3000 -v ./data:/data transorbit:test
```

## ⚠️ Design guarantees

TransOrbit guarantees:

- Subtitle timing is never modified
- Line count is never changed
- AI failures never corrupt data
- Consistency pass is best-effort, not destructive

## 📜 License

[MIT License](<https://github.com/velinea/transorbit/blob/main/LICENSE.md)>)<br/>
You are free to use, modify, and distribute.

## 🙏 A note

TransOrbit exists because “almost good” subtitles are more frustrating than bad ones.

If you care about consistency, tone, and viewer comfort —
this tool is for you.
