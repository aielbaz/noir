# Handoff: Noir marketing site (noir.aielbaz.com)

> Paste this file into Claude Code at the root of the Noir site repo, with the `assets/` and `reference/` folders from this package next to it.

## 1. Task

Rebuild the Noir landing page and privacy page as a static **Astro** site to match the approved design.

- Routes stay exactly as they are: `/` and `/privacy`.
- **Astro, plain CSS, no UI framework, no client JS** except what Astro needs. Every interaction in this design is CSS or native HTML (`<details>`).
- All screenshots go through **`astro:assets`** (`<Image />`), output WebP, with responsive widths.
- **Don't invent claims.** No ratings, reviews, user counts or release dates. Copy in this file is final unless marked `[PLACEHOLDER]` or listed in section 11.

The approved design is in `reference/Landing.html` and `reference/Privacy.html`. They are design-tool exports with inline styles. Treat them as the visual source of truth, not as code to copy: rebuild them as clean Astro components with classes and tokens. Image paths in them are `/_blob/<id>`; section 9 maps each id to a file in `assets/`.

## 2. What Noir is (context for judgement calls)

Noir is an IPTV player app for LG webOS TVs. The user signs in with their own Xtream Codes subscription; Noir plays their live channels, movies and shows and ships no content of its own. It's minimal, fast and built for the TV remote. Tagline: **"Lights off. Noir on."**

**Audience for the site: non-technical people.** Keep jargon out of the main copy. "Xtream Codes", "HLS/MP4/MKV" and "webOS" appear only where someone would look for them (FAQ, metadata, closing section).

The site is **coming soon**: there is no download link and no sign-up form.

## 3. Suggested structure

```
src/
  layouts/Base.astro        # <html>, head meta, font, global.css, skip link
  pages/index.astro
  pages/privacy.astro
  components/
    SiteHeader.astro
    SiteFooter.astro
    TvFrame.astro           # dark bezel around a full screenshot
    Crop.astro              # zoomed detail of a screenshot (see 7.3)
    PlayerTile.astro
    DetailCard.astro
    Faq.astro
  styles/global.css         # tokens + base + motion
  assets/screens/*.png      # from assets/screens
public/
  favicon.svg / icons       # from assets/brand
```

Font: self-host Figtree with `@fontsource-variable/figtree` (no Google Fonts request). Fallback `system-ui, sans-serif`.

## 4. Design tokens

Put these on `:root` in `global.css` and use the names everywhere.

### Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page background |
| `--surface` | `#f5f5f7` | Grey bands, detail cards |
| `--surface-2` | `#e8e8ed` | Disabled store button |
| `--text` | `#1d1d1f` | Headings, body, primary button bg |
| `--muted` | `#6e6e73` | Secondary text, nav links, "Lights off." / "on." in the h1 |
| `--on-dark` | `#ffffff` | Text on the black button / step 3 circle |
| `--hairline` | `rgba(0,0,0,.10)` | FAQ dividers, footer line, crop outline on the player bar |
| `--hairline-soft` | `rgba(0,0,0,.06)` | Card and tile outlines (inset) |
| `--crop-outline` | `rgba(0,0,0,.08)` | Outline around images inside detail cards |
| `--bezel` | `#111316` | TV frame around screenshots |
| `--accent` | `#1a98ff` | **Focus rings only.** Not used for text (fails contrast on white). |
| `--icon-ink` | `#050607` | "noir" text inside the white app icon |

Contrast: `--muted` on `--bg` is about 5:1 and on `--surface` about 4.6:1, both AA for body text.

### Type (Figtree)

| Token | Size | Weight | Tracking | Line height | Use |
|---|---|---|---|---|---|
| `--fs-hero` | `clamp(48px, 7vw, 88px)` | 700 | -0.045em | 1 | h1 only |
| `--fs-h2` | `clamp(36px, 4.4vw, 56px)` | 700 | -0.04em | 1.05 | Every section title |
| `--fs-card` | `26px` | 700 | -0.025em | 1.15 | Player tile and detail card titles |
| `--fs-tile-figure` | `clamp(40px, 4vw, 56px)`; wide tile `clamp(56px, 7vw, 96px)`; speed tile `clamp(48px, 5vw, 72px)` | 700 | -0.05em | 1 | Big glyph in player tiles |
| `--fs-faq` | `19px` | 600 | 0 | 1.3 | FAQ questions |
| `--fs-body` | `17px` | 400 | 0 | 1.6 | Paragraphs, button labels |
| `--fs-small-title` | `17px` | 700 | 0 | 1.3 | Captions under the fan, setup steps |
| `--fs-caption` | `15px` | 400 | 0 | 1.55 | Caption text, nav |
| `--fs-eyebrow` | `15px` | 600 | 0.08em, uppercase | 1.2 | Hero eyebrow |
| `--fs-legal` | `13px` | 400 | 0 | 1.6 | Footer disclaimer |

The wordmark "noir" is always lowercase Figtree 600-650, tracking -0.03em. In the h1, "noir" is `--text` at weight 650; "Lights off." and "on." are `--muted`.

**Hierarchy rule:** the h1 is the only text at hero size, and every section title is h2 at the same size. Don't add new sizes.

### Space and shape

| Token | Value |
|---|---|
| `--container` | `1240px` max width, `24px` inline padding |
| `--section-y` | `clamp(100px, 12vw, 180px)` top and bottom padding for normal sections |
| `--band-y` | `clamp(110px, 13vw, 190px)` for the grey player band |
| `--radius-card` | `28px` (player tiles, detail cards) |
| `--radius-crop` | `18px` (images inside detail cards), `22px` (player control bar) |
| `--radius-tv` | `clamp(10px, 1.4vw, 20px)` outer, image inside `clamp(5px, .7vw, 9px)` |
| `--radius-pill` | `999px` |
| `--shadow-tv` | `0 40px 90px -30px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.06)` |
| `--shadow-icon` | `0 0 0 1px rgba(0,0,0,.08), 0 24px 60px -20px rgba(0,0,0,.3)` |

## 5. Page: `/` (top to bottom)

Everything is centre-aligned except where noted. Section titles sit `18px` above their subline; the visual block below starts `clamp(48px, 6vw, 72px)` after the subline.

### 5.1 Header
- Left: wordmark link "noir" (28px, `--text`) → `#top`, `aria-label="Noir home"`.
- Right nav (15px, `--muted`, gap 32px): **Experience** → `#ui`, **Player** → `#player`, **Details** → `#details`, **FAQ** → `#faq`, **Privacy** → `/privacy`.
- Not sticky. Under 900px the nav links are hidden (wordmark only).

### 5.2 Hero `#top`
- Eyebrow: **For LG smart TVs**
- h1: **Lights off. noir on.** (one line on desktop; see the colour rule in 4)
- Subline (max 520px): **A calm, fast way to watch your TV subscription. Sign in with the login you already have, and press play.**
- Buttons (gap 14px 28px, wrap):
  - Primary pill: **See the player** → `#player`. 48px min height, 26px side padding, `--text` bg, `--on-dark` label, 17px/600.
  - Text link: **Learn more →** → `#ui`, 17px/500, `--text`.
- Image: `TvFrame` with `home-rows.png`, max width 1080px, `clamp(56px, 7vw, 88px)` below the buttons. **No fade or mask on it.** Load eagerly with `fetchpriority="high"`; it's the LCP image.

### 5.3 Experience `#ui`
- h2: **The experience you always wanted.**
- Subline (max 560px): **Live TV, movies and shows, easy to browse and search. Calm, dark and simple to use.**
- **Fan of three TVs** (max width 1180px, `flex`, centred, items start):
  - Left `TvFrame` `movies.png`: width 38%, `margin-right: -5%`, `margin-top: 7%`, z-index 1.
  - Centre `TvFrame` `series-list.png`: width 44%, z-index 2 (in front).
  - Right `TvFrame` `live-tv.png`: width 38%, `margin-left: -5%`, `margin-top: 7%`, z-index 1.
- Three captions below (max 1000px, 3 columns, gap 32px, 56px above). Title `--fs-small-title`, text `--fs-caption` `--muted`:
  1. **Made for your remote:** Everything works with the arrow buttons and OK. Pointing with the Magic Remote works too.
  2. **Fast with big libraries:** Noir remembers your lists, so even very large ones open and scroll smoothly.
  3. **A banner that waits:** New titles rotate on Home, and pause while you move through the menu.

### 5.4 Player `#player` (the centrepiece; the only grey band)
- Background: `linear-gradient(180deg, var(--bg) 0%, var(--surface) 18%, var(--surface) 82%, var(--bg) 100%)`. Soft edges, no hard lines.
- h2: **A player that works.**
- Subline: **Everything you reach for while watching, one press away.**
- **Control bar crop** (see 7.3): `player.png`, frame `aspect-ratio: 1920 / 420`, max width 1080px, radius 22px, outline `--hairline` plus `--shadow-tv`. Image at `width: 100%`, `left: 0`, `top: -158%` (shows the bottom strip: file size, title, time, end time, skip, pause, speed, CC).
- **Tiles** under it: grid of 3 columns, gap 16px, 16px below the bar, text left-aligned. Each tile: `--bg` background, `--radius-card`, inset `--hairline-soft`, padding `clamp(28px, 3vw, 40px)`, column flex with `justify-content: space-between`, gap 40px. The figure on top is decorative (`aria-hidden="true"`), the h3 and text sit at the bottom.

| # | Span | Min height | Figure | Title | Text |
|---|---|---|---|---|---|
| 1 | 2 columns | 300px | `›››` (2nd at 55% opacity, 3rd at 30%) | **Skip ahead, fast.** | Hold the button to skip forward. The longer you hold, the faster it goes. |
| 2 | 1 | 300px | `1.5×` | **Your speed.** | Watch faster or slower, and keep your favourite as the default. |
| 3 | 1 | 260px | `−1:17` (real minus sign U+2212) | **Time left, or time in.** | Switch the clock between time watched and time left. |
| 4 | 1 | 260px | `Ends 10:42` | **Know when it ends.** | The finish time, in your local time. |
| 5 | 1 | 260px | `3.22 GB` | **Know the size.** | See how big the video is, right in the player. |

### 5.5 Details `#details`
- h2: **The little things.**
- Subline: **Small touches that make an evening of watching easier.**
- Grid of 3 columns, gap 20px, text left-aligned, **6 cards** in two rows. Card: `--surface` background, `--radius-card`, inset `--hairline-soft`, **12px padding**. Inside it: the image frame (`aspect-ratio: 4/3`, radius 18px, outline `--crop-outline`, background `--bezel`), then the text block with padding `24px 16px 20px` and gap 10px. Title `--fs-card`, text `--fs-body` `--muted`.

| # | Image (Crop, see 7.3) | width / left / top | Title | Text |
|---|---|---|---|---|
| 1 | `home-rows.png` | 200% / -12% / 0 | **Never lose your place.** | Progress is saved while you watch, with minutes left on every card. |
| 2 | `series-details.png` | 200% / -12% / -22% | **Binge, hands free.** | Autoplay starts the next episode, and an Up next card shows what’s coming. |
| 3 | `settings.png` | 200% / -10% / -75% | **Make it yours.** | Choose what’s on your Home screen, how lists are sorted, your playback speed and more. |
| 4 | `movie-details.png` | 220% / -10% / -48% | **Save it for later.** | Hold OK on any title to add it to My list. |
| 5 | `movies.png` | 200% / -100% / 0 | **Find it fast.** | Search and sort every list, across Live TV, movies and shows. |
| 6 | No screenshot. A white panel (`--bg`, same frame) with the word **Audio** at `--fs-tile-figure` and three pills below it: **Track 1** (filled `--text`, `--on-dark` label), **Track 2**, **Track 3** (outlined `rgba(0,0,0,.15)`). Pills 14px/600, padding 7px 14px, gap 8px. The whole panel is `aria-hidden`. | — | **Your language.** | When a video has more than one audio track, switch between them as you watch. |

Card 6 is a typographic stand-in because there's no screenshot of the audio menu. If one is added to `assets/screens`, use it as a Crop instead.

### 5.6 Setup `#setup`
- h2: **Three steps to the sofa.**
- Subline: **All you need is an LG smart TV and the login from your TV subscription.**
- `<ol>` of 3 steps (max 1000px, 3 columns, gap 40px 32px). Each step: 48px circle with the number (17px/700), then h3 `--fs-small-title`, then text `--fs-caption` `--muted` (max 280px). Circles 1 and 2 are outlined (`inset 0 0 0 1px rgba(0,0,0,.2)`); circle 3 is filled `--text` with an `--on-dark` number. Circles are `aria-hidden` (the `<ol>` already numbers the steps).
  1. **Install Noir:** From the app store on your LG TV, once it’s available.
  2. **Sign in:** Type in the login details your provider gave you.
  3. **Lights off:** Your channels, movies and shows are ready to watch.

### 5.7 FAQ `#faq`
- h2: **Questions.**
- List max width 760px. Each item is a native `<details>` with a `<summary>`: 24px vertical padding, question `--fs-faq`, and a "+" on the right (26px, weight 300, `--muted`, `aria-hidden`) that rotates 45° to "×" when open. Answer `--fs-body` `--muted`, max 640px, 24px below. Dividers: `--hairline` above each item and below the last.
- Hide the default marker (`list-style: none` and `::-webkit-details-marker { display: none }`).

| Question | Answer |
|---|---|
| Does Noir include channels or movies? | No. Noir is the app you watch with. The channels and movies come from your own TV subscription, which you sign in to. |
| What kind of subscription do I need? | One that gives you an Xtream Codes login: a server address, a username and a password. Your provider can tell you if you’re not sure. |
| Which TVs does it work on? | LG smart TVs running webOS `[SUPPORTED VERSIONS]`. |
| Is Noir free? | `[PRICE]` |
| Is my login safe? | Your sign-in details are stored on your TV and used only to connect to the server you enter. There’s no Noir account and no Noir server. Signing out clears everything. |
| Will my videos play? | Noir plays the common streaming and video formats (HLS, MP4 and MKV). Subtitles built into MKV files may not show, depending on the TV. |
| Does it work with the Magic Remote? | Yes. You can point and click, and scroll with the wheel. The regular arrow buttons work everywhere too. |

Optional: add `FAQPage` JSON-LD for these questions once the placeholders are filled.

### 5.8 Coming soon `#get`
- Background: `linear-gradient(180deg, var(--bg) 0%, var(--surface) 55%, var(--bg) 100%)`.
- Padding `clamp(90px, 11vw, 160px)` top, `clamp(110px, 13vw, 190px)` bottom, gap 24px.
- App icon: 112×112px white tile, radius 26px, `--shadow-icon`, "noir" 36px/600 in `--icon-ink`, `aria-hidden`. Use `assets/brand/noir-icon-130.svg`, or rebuild it in HTML/CSS.
- h2: **Coming to LG webOS.**
- Text (max 520px): **Noir doesn’t come with channels or movies. You watch with the TV subscription you already have.**
- **Disabled store button**: a real `<button type="button" disabled>`. 64px min height, radius 16px, `--surface-2` background, inset `--hairline-soft`, `--muted` text, `cursor: not-allowed`. Contents: a 28px stroked TV icon (rect plus stand line, stroke 1.6, `currentColor`, `aria-hidden`), then two lines: "Coming soon to" (12px/500) and "LG webOS" (19px/700). **Don't use LG's logo.** When the app is live, this becomes a link to the store listing.
- **No "notify me" link or email form.** It was deliberately removed.

### 5.9 Footer
- Top line: `linear-gradient(90deg, transparent, var(--hairline), transparent)`, 1px, so the line fades out at both ends.
- Left: wordmark "noir" 22px. Right (max 560px): link **Privacy policy** → `/privacy` (14px), then the disclaimer at `--fs-legal` `--muted`:
  > Noir is a media player and does not provide any content. You are responsible for the content you access with it. LG and webOS are trademarks of LG Electronics Inc. © 2026 Noir

## 6. Page: `/privacy`

Same header pattern, but the right side is a single link **← Back to home** → `/`. Main column max 720px. Same tokens and white theme. Copy is final apart from the placeholders:

- h1 **Privacy** (`clamp(44px, 6vw, 72px)`), then "Last updated `[DATE]`", then lead text (20-24px/500): *Noir has no account, no ads and no tracking. It doesn’t collect personal data about you.*
- Sections, each with a hairline above and 32px top padding, an h2 at 24px/700 and body at 17px/1.7 `--muted`:
  - **What stays on your TV:** To work, Noir saves your login, your settings, My list, what you’ve watched and your channel lists on your TV. None of it is sent to us. Noir has no server of its own.
  - **Your provider:** Noir connects straight to your TV subscription provider. Noir doesn’t supply any channels or movies. Your provider’s own terms and privacy policy cover what they show you and any data they handle.
  - **What Noir doesn’t do:** a bulleted list: No tracking of what you do · No advertising · No sale or sharing of your data.
  - **Removing your data:** Sign out in Settings to clear everything Noir has stored on your TV. Uninstalling the app removes it too.
  - **Contact:** Questions about this policy: `[CONTACT EMAIL]` (mailto link).
- Footer: "© 2026 Noir" plus "Noir is a media player and does not provide any content. LG and webOS are trademarks of LG Electronics Inc."

## 7. Components

### 7.1 `TvFrame`
Props: `src` (imported image), `alt`, `priority?`, `sizes`.
- Wrapper: `--bezel` background, `--radius-tv`, padding `clamp(5px, .8vw, 11px)`, `--shadow-tv`.
- A small "LED" bar: `::after`, 28×2px, `rgba(255,255,255,.18)`, centred at the bottom inside the bezel.
- Image: `aspect-ratio: 16/9`, `object-fit: cover`, inner radius.

### 7.2 Screenshots
All screenshots are 1920×1080. Use `<Image widths={[640, 1080, 1600, 1920]} format="webp" sizes=...>`. Suggested `sizes`:
- Hero: `(max-width: 1128px) 100vw, 1080px`
- Fan centre: `(max-width: 900px) 100vw, 520px`; fan sides: `(max-width: 900px) 100vw, 450px`
- Crops (rendered at 2-2.2× the frame width): `(max-width: 900px) 200vw, 760px`

### 7.3 `Crop` (zoomed detail)
The image is absolutely positioned inside a frame with `overflow: hidden`, so you see a zoomed part of the screenshot.
- Props: `src`, `alt`, `aspect` (default `4/3`), `width` (% of frame width), `left`, `top` (% of the frame's own width and height respectively).
- CSS: frame `position: relative; overflow: hidden; background: var(--bezel)`; image `position: absolute; max-width: none; width: <width>; left: <left>; top: <top>; height: auto;`.
- The values in 5.4 and 5.5 were placed by eye. **Check each crop in the browser** and nudge it so the named detail (focus ring, Up next tag, settings rows, Play/My list buttons, search field) is clearly in frame.

### 7.4 Breakpoints

| Width | Changes |
|---|---|
| > 900px | Layout as described above. |
| ≤ 900px | Nav links hidden. Fan stacks vertically (each TV 100% wide, no overlap, 20px gap). Caption rows, detail cards and setup steps go to 1 column. Player tiles go to 2 columns, with the wide tile spanning both. |
| ≤ 560px | Player tiles go to 1 column. |

No horizontal scroll at any width. Check at 360px.

## 8. Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Hero eyebrow, h1, subline, buttons, image | Page load | Fade up from `translateY(24px)` and opacity 0 | 900ms, delays 0 / 80 / 160 / 240 / 320ms | `cubic-bezier(.2,.7,.2,1)` |
| Section titles, sublines, visuals, cards (`.reveal`) | Scroll into view | Same fade-up, with `animation-timeline: view(); animation-range: entry 0% cover 28%` | Scroll-linked | linear |
| FAQ "+" | Open / close | Rotate 0° to 45° | 250ms | ease |

- Wrap the scroll reveal in `@supports (animation-timeline: view())`. Browsers without it show content statically. Don't use a JS fallback.
- `@media (prefers-reduced-motion: reduce)` turns all of these off.
- Content must never be invisible if the animation doesn't run (keep `animation-fill-mode: both` only inside the `@supports` block).

## 9. Assets (in this package)

`assets/screens/` holds the original PNGs, 1920×1080. The reference HTML uses blob ids; here's the map:

| File | Blob id in `reference/*.html` | Used in |
|---|---|---|
| `home-rows.png` | `9bcb87133753e4116da5675330e85d82` | Hero, detail card 1 |
| `movies.png` | `80aeebc38a3be9bc0dff4473da795c61` | Fan left, detail card 5 |
| `series-list.png` | `9d9154160ad92684e6513981d457281c` | Fan centre |
| `live-tv.png` | `ded3fe98c08fd5f76c3ad8fb04dc7674` | Fan right |
| `player.png` | `f011744d601e3acc40114865a463f59c` | Player control bar |
| `series-details.png` | `79b48862f65a90f0ffb49e90eafa0329` | Detail card 2 |
| `settings.png` | `53f7b8e6291b3e50458e33f36a0b1da8` | Detail card 3 |
| `movie-details.png` | `bfa7c27fc71a05e39c09510a8d2e2e29` | Detail card 4 |
| `home-hero.png` | `7a1e64a77b3906060d05cf3eaba84a09` | Not used now (old hero) |

`assets/brand/` contains the app icon (black "noir" on white) at 80 and 130px as SVG and PNG, the outlined wordmark as SVG in ink and white, and the splash. Use the 130 SVG for the favicon and apple-touch icon (generate PNG sizes from it).

## 10. Head and metadata

- `/`: title **Noir — IPTV player for LG webOS TVs**; description *A calm, fast IPTV player for LG webOS TVs. Sign in with your own Xtream Codes subscription. Coming soon.* "IPTV" stays in the metadata for search, even though the visible copy avoids it.
- `/privacy`: title **Privacy — Noir**.
- `lang="en"`, `theme-color` `#ffffff`, canonical URLs on `https://noir.aielbaz.com`.
- Open Graph and Twitter card: `og:image` is `[TODO]`. Make a 1200×630 image (white background, the hero TV frame, "Lights off. noir on.") or ask the owner.

## 11. Placeholders and things to confirm with the owner

Leave these visibly bracketed in the build until confirmed:

- `[SUPPORTED VERSIONS]`: which webOS versions Noir supports (FAQ).
- `[PRICE]`: free or paid (FAQ).
- `[CONTACT EMAIL]`: privacy page contact.
- `[DATE]`: privacy "Last updated".
- `og:image`: not designed yet.

Copy to double-check against the app before launch:

- "Hold the button to skip forward" (tile 1). This assumes seeking speeds up while the button is **held**, not on repeated presses.
- `1.5×` (tile 2). This must be one of the app's real speed options.
- Detail card 3's image shows the playback settings rows. Confirm the settings it implies exist.
- Footer trademark sentence: "LG and webOS are trademarks of LG Electronics Inc."

## 12. Accessibility checklist

- One `h1` per page. Each section has one `h2`, cards and tiles use `h3`. Section `id`s match the nav anchors.
- Skip link to `<main>` at the top of `Base.astro`.
- Every screenshot has the descriptive `alt` from the reference files. Decorative glyphs, the tile figures, the step circles, the Audio panel and the app icon tile are `aria-hidden="true"`.
- Visible focus on **every** link, button and `summary`: `outline: 2px solid var(--accent); outline-offset: 4px`. Use `:focus-visible`.
- The disabled store button uses the native `disabled` attribute, so it's skipped by Tab.
- FAQ uses native `<details>/<summary>`, which handles keyboard and screen-reader behaviour.
- Touch targets are at least 44px (the primary button is 48px).
- Contrast meets AA (see 4). `--accent` is never used for text.

## 13. Done when

- [ ] `/` and `/privacy` match `reference/*.html` at 1440px, and nothing overflows horizontally at 360px.
- [ ] Every image goes through `astro:assets`, and the hero is eager with `fetchpriority="high"`.
- [ ] No client-side JS shipped (check the build output).
- [ ] Lighthouse: Accessibility 100 and Best Practices ≥ 95; Performance ≥ 90 on mobile.
- [ ] Reduced motion disables all animation.
- [ ] Every crop shows its named detail clearly.
- [ ] Placeholders from section 11 are still visible (not silently filled in).
