# Bit Bank — Product & Technical Spec

Oct 26, 2026 · @Max

## Overview

Bit Bank is a local-first React web app where a stand-up comedian writes jokes as independent units and assembles them into timed sets. It replaces writing routines in Google Docs, where a joke copied into three sets becomes three diverging copies.

**Goals**

- Each joke exists once; sets reference jokes by id, so an edit shows up everywhere.
- Every joke carries time, score, tags and status, derived from logged performances where possible.
- Build a set against a target length and see total time, average score and weak spots.
- The comedian never loses material: persistent storage, one-click JSON export and import, and backup reminders.

**Non-goals for v1**

- No accounts, no server, no cloud sync (planned for v2, see Future work).
- No collaboration or sharing.
- No native mobile app; the web app must work well on a phone browser.

**How to use this spec with Claude Code**

Export this doc as Markdown and save it as `SPEC.md` in an empty folder. Then ask Claude Code to build one milestone at a time, for example: "Read SPEC.md and implement Milestone 1. Run the tests before you finish." Each milestone has acceptance criteria Claude Code can check against.

## Tech stack and structure

Use Vite + React + TypeScript, with Dexie over IndexedDB as the only data store in v1.

| Concern | Choice | Why |
| --- | --- | --- |
| Build | Vite, React 18+, TypeScript strict | Fast dev loop, typed data model |
| Routing | React Router | `/`, `/jokes/:id`, `/chunks/:id`, `/sets`, `/sets/:id`, `/sets/:id/stage`, `/notebook`, `/settings` |
| Storage | Dexie (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) | Reactive queries, versioned schema migrations |
| Validation | Zod | Validates imported backup files before writing anything |
| Drag and drop | dnd-kit (`@dnd-kit/sortable`) | Accessible keyboard reordering of set items |
| Styling | CSS Modules or Tailwind with the tokens below | Either is fine; pick one and stay consistent |
| IDs | `crypto.randomUUID()` | No dependency, stable across export and import |
| Tests | Vitest + React Testing Library + `fake-indexeddb` | Data layer tested without a browser |
| Offline | `vite-plugin-pwa` | Installable; works with no signal at a venue |

Suggested folder layout:

```
src/
  db/          schema.ts, db.ts (Dexie), migrations
  domain/      types.ts, derive.ts (time/score math), chunks.ts (chunk math), time.ts (mm:ss helpers)
  backup/      export.ts, import.ts, schema.zod.ts, reminders.ts
  features/
    library/   JokeList, JokeCard, Filters
    chunks/    ChunkListView, ChunkEditorPage, DeleteChunkDialog
    joke/      JokeEditor, PerformanceLog, RehearsalTimer
    sets/      SetList, SetBuilder, JokeBank, StageMode
    notebook/  IdeaInbox
    settings/  SettingsPage (storage status, export, import)
  ui/          Button, Chip, Tag, StatusBadge, Toast
  styles/      tokens.css
```

Keep all database access in `src/db` and `src/backup`. Components never call IndexedDB directly; this keeps v2 cloud sync a contained change.

## Data model

Six stored entities: Joke, Performance, Set, Idea, Settings and Chunk (Chunk was added after v1, see Chunks). Times are stored as integer seconds and shown as `m:ss`. Every record has `id`, `createdAt` and `updatedAt` (ISO strings); `updatedAt` drives import merging.

```ts
type JokeStatus = 'draft' | 'working' | 'tight' | 'retired';

interface Joke {
  id: string;
  title: string;
  premise: string;
  setup: string;
  punchline: string;
  tagLines: { id: string; text: string; kind: 'tag' | 'act-out' }[];
  notes: string;              // private notes
  status: JokeStatus;
  tags: string[];             // lowercase, no '#', e.g. 'family'
  manualTimeSec?: number;     // optional override
  manualScore?: number;       // 0–10, used until a performance is logged
  versions: { savedAt: string; setup: string; punchline: string }[];
  createdAt: string; updatedAt: string;
}

interface Performance {
  id: string;
  jokeId: string;
  date: string;               // YYYY-MM-DD
  venue: string;
  durationSec?: number;
  score: number;              // 0–10, one decimal
  note?: string;
  createdAt: string; updatedAt: string;
}

interface ComedySet {
  id: string;
  name: string;
  date?: string;
  venue?: string;
  targetSec: number;          // e.g. 900 for 15:00
  bufferSec: number;          // segues and crowd work, default 60
  items: SetItem[];           // jokes and chunks, in running order
  createdAt: string; updatedAt: string;
}

type SetItem =
  | { id: string; kind: 'joke'; jokeId: string; role?: 'opener' | 'closer'; segue?: string }
  | { id: string; kind: 'chunk'; chunkId: string; skippedJokeIds?: string[]; role?: 'opener' | 'closer'; segue?: string };

interface Chunk {
  id: string;
  title: string;
  items: { jokeId: string; segue?: string }[];  // ordered; segue is spoken after that joke
  notes: string;
  createdAt: string; updatedAt: string;
}

interface Idea { id: string; text: string; createdAt: string; updatedAt: string; promotedJokeId?: string }

interface Settings {
  id: 'settings';
  wordsPerMinute: number;     // default 150, for time estimates
  lastExportAt?: string;
  backupReminderDays: number; // default 7
}
```

Dexie schema v1 (indexes only; other fields are stored but not indexed):

```ts
db.version(1).stores({
  jokes: 'id, status, *tags, updatedAt',
  performances: 'id, jokeId, date',
  sets: 'id, date, updatedAt',
  ideas: 'id, createdAt',
  settings: 'id',
});
// Chunks (post-v1): adds one table. The upgrade rewrites set items to kind: 'joke'.
db.version(2).stores({ /* v1 stores */ chunks: 'id, updatedAt' });
```

**Derived values** (computed in `domain/derive.ts`, never stored):

| Value | Rule |
| --- | --- |
| Joke time | `manualTimeSec` if set; else average `durationSec` of performances that have one; else word count of setup + punchline + tag lines ÷ `wordsPerMinute` |
| Time source label | "measured", "manual" or "estimated", shown next to the time |
| Joke score | Average of the last 5 performance scores, one decimal; else `manualScore`; else none (shown as "–") |
| Score trend | Average of last 5 minus average of the 5 before, when at least 6 exist |
| Runs | Count of performances |
| Used in | Sets whose items contain the joke id directly, chunks that contain it, and sets that use it through a chunk |
| Set total | Sum of item times (a chunk item counts its ticked jokes) + `bufferSec` |
| Set average score | Mean of scored jokes in the set; each ticked joke of a chunk counts individually |
| Weak spot | A scored joke, or a chunk with a score, in a middle slot whose score is 1.5 or more below the set average |

Deleting a joke that sets use must show which sets will lose it and require confirmation. Deleting a joke also deletes its performances. Deleting a joke that belongs to a chunk is blocked (see Chunks).

## Screens and features

Six screens, matching the Bit Bank mockup: Library, Joke Editor, Set Builder, Stage mode, Notebook and Settings. A left sidebar holds navigation, joke and set counts, and pinned tags; on phones it collapses into a top bar.

### Joke Library (`/`)

- Header shows joke count, total material time and stage-tested time.
- Grid of cards: status badge, time, title, premise (2-line clamp), tags, score, runs, "In N sets".
- Search across title, premise, setup, punchline and tags (case-insensitive, debounced 150 ms).
- Filters (combinable): status chips with counts, score ≥ 7, under 1 min, not in any set, tag.
- Sort: score, time, last updated, title.
- "New joke" creates a draft and opens the editor with the title focused.

- A "Chunks" tab beside the joke list (`/?view=chunks`) lists chunks with title, joke count, total time and average score, and a "New chunk" button that opens the chunk editor.

### Joke Editor (`/jokes/:id`)

- Fields: title, premise, setup, punchline (highlighted block), tag lines and act-outs (add, edit, reorder, delete), private notes.
- Autosave 800 ms after typing stops; show "Saved" with relative time.
- A version snapshot is saved when setup or punchline changes and the last snapshot is more than 1 hour old. Keep the last 20; any version can be restored.
- Side panel: time with its source label, score with trend, status selector, tags with autocomplete from existing tags, "Used in" links (sets using the joke directly, chunks containing it, and sets using it via a chunk), performance log.
- Performance log: add date, venue, optional duration, score 0–10. Edit and delete entries.
- Rehearsal timer: start/stop; on stop, offer to save the duration as a performance with venue "Rehearsal" or discard it. Rehearsals do not count toward score.
- "Add to set" opens a picker of existing sets plus "New set".

### Set Builder (`/sets/:id`)

- Header: name, date, venue, total vs target as `12:20 of 15:00`, remaining time, a progress bar split into jokes and buffer. Over target turns the bar and remaining time to a warning colour.
- Running order: drag to reorder (mouse, touch and keyboard), slot number, title, tags, time, score, opener/closer badge, optional segue line under each item, remove button.
- Joke bank panel: search plus a default filter of "fits in the remaining time and not in this set"; "+" appends to the end. A Chunks section lists chunks the same way; adding one appends a chunk item.
- A chunk item is one draggable card with title, ticked-joke time and score. Expanded, it lists its jokes with a tick box each and the segue lines. Unticking skips that joke in this set only; the chunk and other sets are unchanged. "Break apart" (inside the expanded card, disabled when nothing is ticked) replaces the chunk with plain joke items.
- Stats: average score, joke count, untested count, weak-spot hint text.
- Actions: duplicate set, print set list (print stylesheet: big titles only), open Stage mode.

### Stage mode (`/sets/:id/stage`)

- Full-screen, high contrast, phone-first. Shows one trigger line per joke (title in large type), segues in small type, a chunk's ticked jokes in order under the chunk title as a label, and an elapsed clock with start/pause.
- Uses the Screen Wake Lock API where supported, so the phone does not sleep.
- No editing controls.

### Chunk Editor (`/chunks/:id`)

- Fields: title, notes, an ordered joke list (add from a searchable picker, reorder, remove), a segue field per row, and a "Used in" list of sets. A joke appears at most once in a chunk. A chunk may be empty or hold one joke.
- Retired jokes stay in the chunk and show a "retired" badge. The segue on the last row is not offered.
- Deleting a chunk asks for confirmation listing the sets that use it, then removes it from them. The jokes are untouched.

### Notebook (`/notebook`)

- Quick-capture input that saves on Enter, newest first.
- "Promote" turns an idea into a draft joke with the idea text as its premise and marks the idea promoted.

### Settings (`/settings`)

Storage status, export, import, words-per-minute and backup reminder interval. Specified in Data safety, next.

## Data safety: storage, export and import

The browser's IndexedDB is a cache, not a backup. v1 protects material with persistent storage, full JSON export, validated import and backup reminders.

### Persistent storage

- On first launch, and from a button in Settings, call `navigator.storage.persist()`.
- Settings shows the result ("Protected from automatic cleanup" or "Not protected"), plus `navigator.storage.estimate()` usage.
- If not protected, show a one-line explanation: on Safari, add the app to the Home Screen; in every browser, clearing site data still deletes everything, so export regularly.

### Export

- "Export backup" in Settings and in the sidebar footer downloads `bitbank-backup-YYYY-MM-DD-HHmm.json`.
- The file holds every table. It is human-readable JSON (2-space indent).
- On success, set `Settings.lastExportAt` and show a toast with the joke and set counts.
- Also offer "Export as Markdown": one `.md` file with every joke (title as heading, premise, setup, punchline, tag lines, tags, status, time, score) and every set as a numbered running order. This is a readable archive and can be pasted back into Docs. It cannot be imported.

Backup file format, version 2 (version 1 files have no `chunks` and set items without `kind`):

```json
{
  "app": "bitbank",
  "schemaVersion": 2,
  "exportedAt": "2026-10-26T21:30:00.000Z",
  "counts": { "jokes": 142, "performances": 388, "sets": 9, "ideas": 31, "chunks": 6 },
  "data": {
    "jokes": [],
    "performances": [],
    "sets": [],
    "ideas": [],
    "chunks": [],
    "settings": {}
  }
}
```

### Import

1. "Import backup" accepts a `.json` file (file picker and drag-and-drop onto Settings).
2. Parse and validate with the Zod schema. Reject with a clear message if `app` is not `bitbank`, `schemaVersion` is newer than the app supports, or any record fails validation (show the first 5 errors with table and index). Nothing is written on failure.
3. Older `schemaVersion` files are upgraded in memory by migration functions before validation. The v1 to v2 migration adds `kind: 'joke'` to every set item and an empty `chunks` table, so v1 and v2 files both import.
4. Show a preview: counts in the file, and for each table how many records are new, newer than local, older than local or identical.
5. The user picks a mode:
   - **Merge (default):** add new records; for ids that exist in both, keep the one with the later `updatedAt`. Nothing local is deleted.
   - **Replace all:** wipe every table, then write the file. Requires typing `REPLACE` to confirm. An automatic export of the current data downloads first.
6. Write in a single Dexie transaction across all tables, so a failure leaves the database unchanged.
7. After import, check references: remove performances and chunk entries that point to missing jokes, and set items that point to a missing joke or chunk, and report how many were removed. A dangling reference never makes the import fail.
8. Show a result toast with counts added, updated and skipped.

### Backup reminders

- If there is no export yet, or `lastExportAt` is older than `backupReminderDays` (default 7), and there have been changes since then, show a dismissible banner: "Last backup 12 days ago · Export now".
- Dismissing hides it for 24 hours.
- Sidebar footer always shows "Last backup: \<relative time>" or "Never backed up".

## Chunks (post-v1)

Chunks were added after v1 shipped, on their own branch; they are not part of Milestones M1 to M6. Design: `docs/superpowers/specs/2026-10-29-chunks-design.md`.

A chunk is a named, ordered group of jokes, dropped into a set as one block. Editing a chunk updates every set that uses it. A joke can be in several chunks and can also be a standalone set item.

- **Time and score:** chunk time is the sum of the ticked jokes' times. Chunk score is the average of the ticked jokes' scores, ignoring unscored jokes; with none scored the chunk is untested. A chunk with every joke skipped, or an empty chunk, is 0:00 and untested.
- **Skips:** `skippedJokeIds` on a set's chunk item is the per-set skip list. A joke newly added to a chunk is ticked by default everywhere. Skip ids no longer in the chunk are ignored and pruned when the chunk or the skip list is written.
- **Segues:** a joke's segue in a chunk is spoken after that joke only if it is ticked and a later joke in the chunk is ticked. The chunk item's own segue is spoken after the whole chunk. Stage mode and print share one helper (`features/sets/stageLines.ts`) that flattens a set into lines.
- **Averages:** for weak spots and the first/last-item exemption a chunk is one item using the chunk's average score. For the set average score and untested count each ticked joke counts individually. Time is the plain sum.
- **Delete rules:** deleting a joke is blocked while it is in any chunk; the dialog links those chunks and offers no delete button until they are gone. Deleting a chunk is allowed after confirmation and removes it from sets. Retiring a joke is never blocked; it stays in its chunks and shows a "retired" badge.
- **Break apart:** replaces the chunk item with `kind: 'joke'` items for the ticked jokes, in chunk order, skipping jokes already standalone in the set. Spoken segues move onto the joke they follow, the chunk item's segue goes on the last copied joke, and an opener or closer role goes to the first or last copied joke.
- **Duplicate set:** copies chunk items with their skips and keeps them linked to the same chunk.
- **Dangling references:** consumers skip chunk entries that point to a missing joke and set items that point to a missing chunk.

## Design tokens

Dark "comedy club" theme with one amber spotlight accent, taken from the mockup. Put these in `styles/tokens.css` as CSS custom properties.

```css
:root {
  --bg: #16151A;          /* page */
  --surface: #1E1D23;     /* cards, sidebar */
  --surface-2: #2C2A33;   /* chips, active nav, dividers */
  --border: #3A3842;
  --text: #F3F1EC;
  --text-2: #C9C7CF;
  --text-muted: #A8A6B0;
  --accent: #F2B33D;      /* primary buttons, scores, progress */
  --accent-soft: #3A2F17; /* punchline block, selected chip */
  --accent-text: #FFD27A;
  --status-tight-bg: #1F3A2C;   --status-tight-fg: #8FE0B0;
  --status-working-bg: #3A2F17; --status-working-fg: #FFD27A;
  --status-draft-bg: #2C2A33;   --status-draft-fg: #C9C7CF;
  --status-retired-bg: #3A1F22; --status-retired-fg: #F2A3A8;
  --radius-sm: 8px; --radius: 12px; --radius-lg: 14px;
  --font-display: 'Bricolage Grotesque', sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace; /* times and scores */
}
```

- Times and scores always use the mono font so columns line up.
- Touch targets are at least 44 px; body text contrast at least 4.5:1.
- Every control is a real `<button>`, `<a>` or `<input>` with a label; icon-only buttons get `aria-label`.
- Layouts work down to 360 px wide: sidebar collapses, side panels stack under the main column.

## Build milestones

Build in six milestones (chunks came afterwards, see Chunks). Backup ships in Milestone 2, before any real material goes in. Each milestone ends with passing tests and a working app.

**M1 · Foundation and jokes**

- [ ] Vite + React + TS project, router, tokens, sidebar layout
- [ ] Dexie schema v1 and typed data access functions
- [ ] Library: list, search, status filters, sort, New joke
- [ ] Joke Editor: all fields, autosave, status, tags

* Done when: a joke created, edited and reloaded keeps every field; search finds it by punchline text.

**M2 · Data safety**

- [ ] `navigator.storage.persist()` request and status in Settings
- [ ] JSON export, Markdown export
- [ ] Import with Zod validation, preview, merge and replace modes, single transaction
- [ ] Backup reminder banner and "Last backup" footer

* Done when: export → clear site data → import restores identical data (deep-equal test); an invalid file writes nothing.

**M3 · Performances and derived values**

- [ ] Performance log CRUD and rehearsal timer
- [ ] `derive.ts` time, score, trend, runs with unit tests
- [ ] Cards and editor show derived values and time source labels

* Done when: unit tests cover each rule in the derived values table.

**M4 · Sets**

- [ ] Set list, create, rename, duplicate, delete
- [ ] Set Builder with dnd-kit reordering, roles, segues, joke bank, totals, weak-spot hint
- [ ] "Add to set" from the editor; "Used in" links

* Done when: reordering by keyboard works; total time updates when a joke's time changes.

**M5 · Stage mode, Notebook, print**

- [ ] Stage mode with clock and wake lock
- [ ] Notebook capture and promote
- [ ] Print stylesheet for set lists

**M6 · PWA and polish**

- [ ] Installable PWA, offline after first load
- [ ] Phone layouts at 360 px, accessibility pass, empty states

## Testing, open questions and future work

**Tests that must exist**

- `derive.ts`: every rule in the derived values table, including empty and single-performance cases.
- Backup round trip: seed data → export → wipe → import → deep-equal.
- Import merge: newer local record kept, newer file record wins, new records added, nothing deleted.
- Import rejection: wrong `app`, future `schemaVersion`, malformed record → database unchanged.
- Dangling references cleaned after import, including chunk entries and chunk set items.
- Chunks: totals with skips, v1 to v2 backup migration, joke delete blocking, break apart.
- Set totals and weak-spot detection.

**Open questions**

- [ ] Score scale: 0–10 with one decimal, or a 1–5 laugh rating converted to 10? 1 to 5
- [ ] Should rehearsal durations count toward measured time, or only real shows? I can set the time manually
- [ ] Import from existing Google Docs: split pasted text into jokes on each heading (v1 or later)? later
- [ ] App language: English only, or Spanish too? both

**Future work (v2)**

- Cloud sync (Supabase or Firebase) with IndexedDB kept as the offline cache; `updatedAt` merge rules carry over.
- Optional automatic weekly backup to a Google Drive folder.
- Audio recording per performance with a laugh-marker timeline.
- Stats over time: score trend per joke, most-used jokes, material by tag.
