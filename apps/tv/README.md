# Noir

A Netflix/Prime Video-style IPTV player built with React, designed for LG webOS TVs.
Supports Xtream Codes API (the format with server URL + username + password).

---

## Features

- **Xtream Codes** authentication (server URL + username + password)
- **Live TV** — category filtering, channel grid, live badge
- **Movies** — poster grid, category filtering, sort by name/rating/year
- **Series** — browse series, tap to see episode list, play episodes
- **Search** — searches across all content at once
- **Video player** — HLS.js playback, controls, seek bar for VOD, fullscreen
- **Hero banner** — auto-rotating featured content on home screen
- Dark cinematic UI inspired by Prime Video / Netflix
- Remembers your login between sessions

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install   # from the repo root
```

### 2. Run in browser (development)

```bash
pnpm tv:dev   # from the repo root
```

Open http://localhost:5173 — enter your Xtream server URL, username, and password.

### 3. Build for production

```bash
pnpm tv:build
```

This outputs a `dist/` folder with your web app.

---

## Deploying to LG webOS TV

### Step 1 — Install LG webOS CLI

Download the webOS TV SDK from:
https://webostv.developer.lge.com/sdk/installation/

This gives you the `ares` command-line tools.

### Step 2 — Enable Developer Mode on your TV

1. On your LG TV, go to **LG Content Store**
2. Search for **"Developer Mode"** and install the app
3. Open the Developer Mode app → click **Dev Mode Status → ON**
4. Click **Key Server → ON**
5. TV will reboot

### Step 3 — Set up your device

```bash
# Add your TV (find the IP in TV Settings > Network)
ares-setup-device

# Or manually:
ares-setup-device --add myTV --info "{\"host\":\"192.168.1.X\",\"port\":9922,\"username\":\"prisoner\"}"
```

### Step 4 — Package and deploy

```bash
# Build and package as .ipk (output: apps/tv/build/)
pnpm tv:package

# Install to your TV
ares-install --device myTV apps/tv/build/com.aielbaz.noir_<version>_all.ipk

# Launch it
ares-launch --device myTV com.aielbaz.noir
```

---

## Remote Control Navigation

webOS uses D-pad navigation. The app uses the `.focusable` class + CSS focus styles for TV remote support.

For a production app, add **Norigin Spatial Navigation**:
```bash
pnpm --filter noir-tv add @noriginmedia/norigin-spatial-navigation
```

Then wrap your focusable components — see https://github.com/NoriginMedia/Norigin-Spatial-Navigation

---

## Tech Stack

- **React 18** — UI framework
- **hls.js** — HLS stream playback
- **Vite** — build tool
- **Xtream Codes API** — authentication and content

---

## Project Structure

```
src/
  utils/xtream.js        — Xtream Codes API calls
  context/AppContext.jsx — Global state (auth, now playing, navigation)
  components/
    Sidebar.jsx          — Left navigation
    ContentCard.jsx      — Poster card with hover play
    ContentRow.jsx       — Horizontal scrollable row
    VideoPlayer.jsx      — HLS video player
  pages/
    LoginPage.jsx        — Xtream credentials form
    HomePage.jsx         — Hero + mixed content rows
    LivePage.jsx         — Live TV grid
    MoviesPage.jsx       — Movies grid
    SeriesPage.jsx       — Series + episode detail
    SearchPage.jsx       — Search across all content
```