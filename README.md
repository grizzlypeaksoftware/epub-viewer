# EPUB Viewer

A sleek, browser-based EPUB reader built for authors and publishers to test books before publication. Upload an EPUB file, and instantly read it with a full-featured reader — complete with table of contents, themes, font controls, and a built-in book analysis tool.

![Landing Page](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Drag & drop upload** — drop an EPUB file or click to browse
- **Paginated reading** — real page-turn navigation with arrow keys and buttons
- **Table of contents** — collapsible sidebar with nested chapter support
- **Three reading themes** — Light, Sepia, and Dark mode
- **Font size control** — adjustable from 60% to 200%
- **Reading modes** — paginated (like a real book) or continuous scroll
- **Book analysis tool** — readability scores (Flesch-Kincaid, Gunning Fog), word frequency, chapter balance visualization, long sentence detection, dialogue ratio
- **Reading position memory** — picks up where you left off
- **Recent books list** — quickly reopen previously uploaded books
- **Client-only mode** — open EPUBs without uploading to the server
- **Book metadata display** — title, author, publisher, language, publication date
- **Responsive design** — works on desktop and mobile
- **Docker ready** — one command to deploy

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Docker

```bash
docker-compose up --build
```

## Tech Stack

- **Backend:** Node.js, Express, Multer
- **Frontend:** Vanilla JavaScript, Bootstrap 5, epub.js
- **Infrastructure:** Docker with docker-compose

No build step. No TypeScript. No bundler. Just simple, fast JavaScript.

## Project Structure

```
epub-viewer/
  index.js              Express server
  public/
    index.html           Landing page (upload)
    reader.html          EPUB reader page
    css/styles.css       Custom styles & themes
    js/
      upload.js          Drag-drop & file upload
      reader.js          epub.js integration & controls
      analysis.js        Book analysis engine
  Dockerfile
  docker-compose.yml
```

## How It Works

1. **Upload** an EPUB file via drag-and-drop or file picker
2. The server stores it and redirects to the reader
3. **epub.js** renders the book client-side in a paginated view
4. Navigate with arrow keys, TOC sidebar, or prev/next buttons
5. Open the **analysis panel** to get readability scores, word frequency, chapter balance, and more

## Analysis Tool

The built-in analysis engine scans your entire book and reports:

| Metric | Description |
|--------|-------------|
| Flesch Reading Ease | 0-100 score (higher = easier to read) |
| Flesch-Kincaid Grade | US grade level needed to understand the text |
| Gunning Fog Index | Years of education needed |
| Dialogue Ratio | Percentage of text that is dialogue |
| Chapter Balance | Visual bar chart of chapter lengths |
| Word Frequency | Top 20 most-used words (excluding stop words) |
| Long Sentences | Flags sentences over 40 words |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | - | Set to `production` for Docker |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

**Shane Larson**
