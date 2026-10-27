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
| Routing | React Router | `/`, `/jokes/:id`, `/sets`, `/sets/:id`, `/sets/:id/stage`, `/notebook`, `/settings` |
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
  domain/      types.ts, derive.ts (time/score math), time.ts (mm:ss helpers)
  backup/      export.ts, import.ts, schema.zod.ts, reminders.ts
  features/
    library/   JokeList, JokeCard, Filters
    joke/      JokeEditor, PerformanceLog, RehearsalTimer
    sets/      SetList, SetBuilder, JokeBank, StageMode
    notebook/  IdeaInbox
    settings/  SettingsPage (storage status, export, import)
  ui/          Button, Chip, Tag, StatusBadge, Toast
  styles/      tokens.css
```

Keep all database access in `src/db` and `src/backup`. Components never call IndexedDB directly; this keeps v2 cloud sync a contained change.

## Data model

Five stored entities: Joke, Performance, Set, Idea and Settings. Times are stored as integer seconds and shown as `m:ss`. Every record has `id`, `createdAt` and `updatedAt` (ISO strings); `updatedAt` drives import merging.

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
  items: { id: string; jokeId: string; role?: 'opener' | 'closer'; segue?: string }[];
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
```

**Derived values** (computed in `domain/derive.ts`, never stored):

| Value | Rule |
| --- | --- |
| Joke time | `manualTimeSec` if set; else average `durationSec` of performances that have one; else word count of setup + punchline + tag lines ÷ `wordsPerMinute` |
| Time source label | "measured", "manual" or "estimated", shown next to the time |
| Joke score | Average of the last 5 performance scores, one decimal; else `manualScore`; else none (shown as "–") |
| Score trend | Average of last 5 minus average of the 5 before, when at least 6 exist |
| Runs | Count of performances |
| Used in | Sets whose `items` contain the joke id |
| Set total | Sum of item joke times + `bufferSec` |
| Set average score | Mean of scored jokes in the set |
| Weak spot | A scored joke in a middle slot whose score is 1.5 or more below the set average |

Deleting a joke that sets use must show which sets will lose it and require confirmation. Deleting a joke also deletes its performances.

## Screens and features

Six screens, matching the Bit Bank mockup: Library, Joke Editor, Set Builder, Stage mode, Notebook and Settings. A left sidebar holds navigation, joke and set counts, and pinned tags; on phones it collapses into a top bar.

### Joke Library (`/`)

- Header shows joke count, total material time and stage-tested time.
- Grid of cards: status badge, time, title, premise (2-line clamp), tags, score, runs, "In N sets".
- Search across title, premise, setup, punchline and tags (case-insensitive, debounced 150 ms).
- Filters (combinable): status chips with counts, score ≥ 7, under 1 min, not in any set, tag.
- Sort: score, time, last updated, title.
- "New joke" creates a draft and opens the editor with the title focused.

### Joke Editor (`/jokes/:id`)

- Fields: title, premise, setup, punchline (highlighted block), tag lines and act-outs (add, edit, reorder, delete), private notes.
- Autosave 800 ms after typing stops; show "Saved" with relative time.
- A version snapshot is saved when setup or punchline changes and the last snapshot is more than 1 hour old. Keep the last 20; any version can be restored.
- Side panel: time with its source label, score with trend, status selector, tags with autocomplete from existing tags, "Used in" set links, performance log.
- Performance log: add date, venue, optional duration, score 0–10. Edit and delete entries.
- Rehearsal timer: start/stop; on stop, offer to save the duration as a performance with venue "Rehearsal" or discard it. Rehearsals do not count toward score.
- "Add to set" opens a picker of existing sets plus "New set".

### Set Builder (`/sets/:id`)

- Header: name, date, venue, total vs target as `12:20 of 15:00`, remaining time, a progress bar split into jokes and buffer. Over target turns the bar and remaining time to a warning colour.
- Running order: drag to reorder (mouse, touch and keyboard), slot number, title, tags, time, score, opener/closer badge, optional segue line under each item, remove button.
- Joke bank panel: search plus a default filter of "fits in the remaining time and not in this set"; "+" appends to the end.
- Stats: average score, joke count, untested count, weak-spot hint text.
- Actions: duplicate set, print set list (print stylesheet: big titles only), open Stage mode.

### Stage mode (`/sets/:id/stage`)

- Full-screen, high contrast, phone-first. Shows one trigger line per joke (title in large type), segues in small type, and an elapsed clock with start/pause.
- Uses the Screen Wake Lock API where supported, so the phone does not sleep.
- No editing controls.

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

Backup file format, version 1:

```json
{
  "app": "bitbank",
  "schemaVersion": 1,
  "exportedAt": "2026-10-26T21:30:00.000Z",
  "counts": { "jokes": 142, "performances": 388, "sets": 9, "ideas": 31 },
  "data": {
    "jokes": [],
    "performances": [],
    "sets": [],
    "ideas": [],
    "settings": {}
  }
}
```

### Import

1. "Import backup" accepts a `.json` file (file picker and drag-and-drop onto Settings).
2. Parse and validate with the Zod schema. Reject with a clear message if `app` is not `bitbank`, `schemaVersion` is newer than the app supports, or any record fails validation (show the first 5 errors with table and index). Nothing is written on failure.
3. Older `schemaVersion` files are upgraded in memory by migration functions before validation.
4. Show a preview: counts in the file, and for each table how many records are new, newer than local, older than local or identical.
5. The user picks a mode:
   - **Merge (default):** add new records; for ids that exist in both, keep the one with the later `updatedAt`. Nothing local is deleted.
   - **Replace all:** wipe every table, then write the file. Requires typing `REPLACE` to confirm. An automatic export of the current data downloads first.
6. Write in a single Dexie transaction across all tables, so a failure leaves the database unchanged.
7. After import, check references: remove set items and performances that point to missing jokes, and report how many were removed.
8. Show a result toast with counts added, updated and skipped.

### Backup reminders

- If there is no export yet, or `lastExportAt` is older than `backupReminderDays` (default 7), and there have been changes since then, show a dismissible banner: "Last backup 12 days ago · Export now".
- Dismissing hides it for 24 hours.
- Sidebar footer always shows "Last backup: \<relative time>" or "Never backed up".

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

Build in six milestones. Backup ships in Milestone 2, before any real material goes in. Each milestone ends with passing tests and a working app.

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
- Dangling references cleaned after import.
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
