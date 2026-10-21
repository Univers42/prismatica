# Media shot list

Every product photo and video on the home page is a slot in
[`src/data/media-shots.ts`](../src/data/media-shots.ts). Until a slot has a file
it renders a wireframe placeholder at the media's final size, so adding the real
file never moves the layout. That file is the source of truth; the table below is
a copy for whoever records the clips (taken 2026-10-20 — if they differ, the `.ts`
file wins).

## What to capture

| id | Kind | Final size | Length | Capture |
| --- | --- | --- | --- | --- |
| `docs` | video | 1600×1000 | 8 s | Open a page, type /, insert a board, then mention a client from the database. |
| `database` | video | 1600×1000 | 8 s | Filter a clients table by status, then open one row as a full page. |
| `board` | video | 1600×1000 | 6 s | Drag two cards from "In progress" to "Done" on the board view. |
| `calendar` | video | 1600×1000 | 6 s | Week view with board deadlines; drag one event to a new day. |
| `mail` | video | 1600×1000 | 8 s | Open an email, choose "Create task", and show the new card on the board. |
| `whiteboard` | video | 1600×1000 | 8 s | Sketch a three-step flow on the whiteboard, then embed it in a page. |
| `mobile` | photo | 900×1600 | — | Phone screenshot (1080×1920) of the home page with tasks, calendar and mail blocks. |
| `tablet` | photo | 1600×1200 | — | Landscape tablet screenshot (2048×1536) of a board view, status bar hidden. |
| `dashboard` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Products overview dashboard, Databases sidebar expanded. |
| `analytics` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Products analytics dashboard, Midnight theme, dark mode. |
| `map` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Products warehouse map view. |
| `timeline` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Projects timeline, month scale, Feb to Aug 2026. |
| `split` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Split right, Tasks board left, Products analytics right. |
| `themes` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Settings, Preferences, colour theme list, dark mode. |
| `crmDeals` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Northwind CRM, Deals, "All deals" table view with its colour rules. |
| `crmCalendar` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Deals, "Next steps" calendar view, month scale. |
| `crmGallery` | photo | 1600×1000 | — | Laptop (1440x900 @2x): Deals, "Big tickets" gallery view, filtered on amount. |

Each app clip appears twice — as a block in the workspace on the hero laptop and
in the app tour — from the same file. `mobile` and `tablet` fill the phone and
tablet screens beside the hero laptop (`mobile` also appears in the app tour).

Record at 1920×1200 or larger in a clean workspace (no real client names or
emails), browser chrome hidden: the site draws its own frame. Clips loop, so end
on a frame close to the first. No audio: clips play muted.

## Convert

Run from the folder holding the recordings. Each command was run on a 1920×1200
test clip on 2026-10-20 and produced the stated codec and size.

```sh
# Video → MP4 (H.264) at 1600×1000, audio stripped
ffmpeg -i board-raw.mov -vf "scale=1600:1000:force_original_aspect_ratio=increase,crop=1600:1000,fps=30" -an -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart board.mp4

# Poster: the first frame, shown before playback and to visitors who turn motion off
ffmpeg -i board.mp4 -frames:v 1 -c:v libwebp -quality 80 board-poster.webp

# Phone screenshot → 900×1600 WebP
ffmpeg -i phone.png -vf "scale=900:1600:force_original_aspect_ratio=increase,crop=900:1600" -c:v libwebp -quality 82 mobile.webp

# Tablet screenshot → 1600×1200 WebP
ffmpeg -i tablet.png -vf "scale=1600:1200:force_original_aspect_ratio=increase,crop=1600:1200" -c:v libwebp -quality 82 tablet.webp
```

The crop keeps the centre: frame the action in the middle of the recording.

## Swap a placeholder for the real file

1. Put the files in `public/assets/` (flat — no sub-folders; the asset allowlist
   rejects nested paths).
2. In `src/data/media-shots.ts`, add `src` (and `poster` for videos) to the shot:

   ```ts
   board: {
   	id: 'board',
   	kind: 'video',
   	// …
   	src: 'board.mp4',
   	poster: 'board-poster.webp',
   },
   ```

3. An image also gets an 800×500 copy, named `<name>-800.webp`, and lists it as
   `srcSmall` (phones must not download the 1600px copy):

   ```sh
   ffmpeg -i shot.png -vf scale=800:500:flags=lanczos -c:v libwebp -quality 80 public/assets/<name>-800.webp
   ffmpeg -i shot.png -vf scale=1600:1000 -c:v libwebp -quality 82 public/assets/<name>.webp
   ```

A slot takes one `src`. Ship the H.264 `.mp4`: it plays in every current browser,
iPhones included. (`.webm` is accepted too, but this list doesn't verify browser
support for it.) File names may use letters, digits, `. _ - ( )` and spaces;
anything else is refused at build time by `safePublicAssetPath`.

## What the slot does with a video

It plays muted and looped only while at least 40% of it is on screen, pauses when
scrolled away, and stays on the poster with native controls when the visitor
prefers reduced motion or pauses animations on the site. It never preloads: an
off-screen clip costs nothing until it is shown.
