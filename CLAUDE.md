# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An EPUB viewer/reader web application for testing books before publication — checking for issues and readability. Personal tool, not a production SaaS.

## Tech Stack

- **Backend:** Express.js (Node 20), Multer for uploads, UUID for filenames
- **Frontend:** Vanilla JavaScript (no TypeScript), Bootstrap 5 (CDN), epub.js + JSZip (CDN)
- **Infrastructure:** Docker with docker-compose
- No build system, no database, no bundler

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server with auto-reload (node --watch)
npm start            # Production server

docker-compose up --build   # Run in Docker
```

The app runs on port 3000 (configurable via `PORT` env var).

## Architecture

- `index.js` — Express server. Serves static files from `public/`, uploaded EPUBs from `uploads/`. Two API routes: `POST /api/upload` (multer) and `DELETE /api/books/:filename`.
- `public/index.html` + `public/js/upload.js` — Landing page with drag-and-drop upload zone and recent books list (localStorage).
- `public/reader.html` + `public/js/reader.js` — EPUB reader page. All rendering is client-side via epub.js. Supports two modes: server-uploaded (via `?url=` param) and client-only (via `?local=1`, re-prompts for file).
- `public/css/styles.css` — Custom styles for drop zone, reader layout, and three themes (light/sepia/dark).

Reader features: TOC sidebar, paginated/scrolled flow, font size control, theme switching, keyboard navigation (arrow keys), reading position persistence (localStorage).

## Key Conventions

- All frontend libraries loaded via CDN — no npm packages for the browser
- Plain `require()` (CommonJS) in Node, vanilla JS in the browser
- User settings (font size, theme, flow mode, reading position) stored in localStorage
- Uploaded files stored in `uploads/` with UUID filenames; directory is gitignored and Docker-volume-mounted
