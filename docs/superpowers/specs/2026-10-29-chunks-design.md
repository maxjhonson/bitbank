# Chunks: design

Date: 2026-10-29. Status: draft for approval. Builds on the shipped v1 app (see `docs/SPEC.md`).

## Intent

The user writes long bits and splits them into mini jokes so each one keeps its own time, score, tags and performance history. Those mini jokes belong to one topic and usually go on stage together, in order, like a mini set. Sometimes, when time is short, only one or two of them are performed.

Today every joke is dropped into a set one at a time, so the grouping has to be rebuilt in every set. A **chunk** is a named, ordered group of jokes that is dropped into a set as one block. Editing the chunk updates every set that uses it, the same way editing a joke does.

## Goals

- Create and edit chunks from the library.
- Drop a chunk into a set as one draggable card that expands to show its jokes.
- In a set, skip individual jokes of a chunk for that set only, without changing the chunk or breaking the link to it.
- Set totals (time, average score, untested count, weak spots) stay correct with chunks and skips.
- Existing data and old backups keep working.

## Non-goals

- Chunks inside chunks. A chunk holds only jokes.
- Logging performances, tags, status, versions or notes-on-stage against a chunk. Those stay on the jokes.
- Reordering a chunk's jokes inside one set (that is what "Break apart" is for).
- Any change to how single jokes already work in sets.

## Anti-goals (a failure even if it technically works)

- Importing an existing v1 backup fails or loses data.
- Skipping a joke in one set changes the chunk or any other set.
- A joke or chunk disappears from a set silently.
- Set totals count jokes that are skipped.

## Decisions made with the user

- Term: "chunk". (User did not object; "mini set" was their own phrase.)
- Chunks are created **from the library** (a Chunks tab): pick jokes, order them, optionally write a segue line between neighbours. There is no "select jokes and group them" flow.
- In the Set Builder a chunk is one card, dragged as a block. Expanded, it lists its jokes, each with a tick box. **Unticking skips that joke for that set only.** The chunk stays linked and later edits to the chunk still flow into the set.
- The mockup also showed a "Break apart" button; the user liked the mockup. It replaces the chunk in the set with plain joke items (see below).
- Deleting a joke that belongs to a chunk is **blocked**: the app tells the user which chunks contain it and asks them to remove it from those chunks first.

## Data model

```ts
interface Chunk {
  id: string
  title: string
  items: { jokeId: string; segue?: string }[]   // ordered; segue = line spoken after this joke
  notes: string
  createdAt: string
  updatedAt: string
}

type SetItem =
  | { id: string; kind: 'joke';  jokeId: string;  role?: 'opener' | 'closer'; segue?: string }
  | { id: string; kind: 'chunk'; chunkId: string; skippedJokeIds?: string[]; role?: 'opener' | 'closer'; segue?: string }
```

- `ComedySet.items` becomes `SetItem[]`. Existing items have no `kind` and are migrated to `kind: 'joke'`.
- A joke can belong to several chunks and can also be a standalone item in a set.
- `skippedJokeIds` is the per-set skip list. A joke newly added to a chunk is ticked by default in every set. Skip ids that no longer exist in the chunk are ignored and dropped on the next write.

## Rules

- Chunk time = sum of the **ticked** jokes' times (each via the existing `jokeTime`). Chunk score = average of the ticked jokes' scores, ignoring jokes with no score. If no ticked joke has a score the chunk counts as untested, the same as a joke with no score.
- `setTotals` and `weakSpots` treat a chunk item as one item using those values. A chunk with every joke skipped contributes 0:00 and is untested.
- **Delete a joke:** blocked while it is in any chunk. The dialog lists those chunks (linked) and offers no delete button until the list is empty. The existing behavior for sets (confirm, then remove from sets) stays for standalone items.
- **Delete a chunk** (my call): allowed after a confirmation that lists the sets using it, then removed from those sets. This mirrors how deleting a joke already works. The jokes themselves are untouched.
- **Break apart** (my call on the details): replaces the chunk item in that set with plain `kind: 'joke'` items, in chunk order, **only for the jokes that are ticked**. The chunk's segues between ticked jokes are copied onto the joke they follow. A chunk-level `opener` role goes to the first copied joke, `closer` to the last. The chunk item's own set-level segue goes on the last copied joke (it replaces nothing, because the last joke has no chunk segue; see Segues). Not undoable except by re-adding the chunk. The button is disabled when no joke is ticked. If a ticked joke is already a standalone item in the set, it is added anyway, following whatever the Set Builder already does when the same joke is added twice.
- **Segues** (my call): a joke's `segue` in a chunk is spoken after that joke and only if that joke is ticked and a later joke in the chunk is ticked. So the segue on a chunk's last row is not offered in the editor and is ignored if present, and a skipped joke's segue drops out. The chunk item's own set-level `segue` is spoken after the whole chunk, as for a joke item. Stage mode and print use one shared "flatten set into lines" helper.
- **Averages** (my call): a chunk is **one item** for weak spots and for first/last-item exemption, using the chunk's average score. For the set's average score and untested count, each ticked joke counts individually, so a five-joke chunk is not weighted like one joke. Time is the plain sum.
- **Retired jokes** (my call): retiring is not blocked by chunk membership (only delete is). A retired joke stays in its chunks, in time and score, and in stage mode. It shows a "retired" badge in the chunk editor and in the expanded chunk card so the user can untick or remove it. It is not auto-skipped.
- **Chunk contents** (my call): a joke appears at most once in a chunk (the picker enforces it, which is why skips are keyed by joke id). A chunk may be empty or hold one joke; an empty chunk shows "empty", contributes 0:00 and is untested.
- **Dangling references** (my call): consumers tolerate and skip them, as the app already does for set items that point to a missing joke. Importing a backup with a chunk item pointing to a missing joke, or a set item pointing to a missing chunk, does not fail the import.
- Stage mode and the print set list show a chunk's ticked jokes in order, with the segues above. The chunk title appears as a label.

## Screens

- **Library:** new "Chunks" tab beside the joke list. Lists chunks with title, joke count, total time, average score. Create/edit chunk page: title, notes, joke picker (search the library), reorder, segue field per row, "used in" list of sets.
- **Joke editor "Used in":** lists sets that use the joke directly plus chunks that contain it (each linked), and sets that use it via a chunk.
- **Set Builder:** the joke bank (left) gets a Chunks section so a chunk can be added the same way as a joke. In the running order a chunk is a card with a drag handle, title, ticked-joke time and score. Expanding it shows each joke with a tick box and the segue lines. "Break apart" sits inside the expanded card. Mockup: `.superpowers/brainstorm/1937-1793296018/content/chunk-in-set.html` (not committed).
- Strings go in both `src/i18n/en.ts` and `src/i18n/es.ts`.

## Storage and backup

- Dexie: add a `chunks` table (`id, updatedAt`) in a new `db.version(2)`; keep `SCHEMA_V1` as is and add the v2 store map. Set items are nested in the set row, so no index change for sets. The upgrade function rewrites existing set items to `kind: 'joke'`.
- Backup: `SUPPORTED_SCHEMA_VERSION` becomes 2; the export includes `chunks`; `migrations[1]` sets `chunks: []` and adds `kind: 'joke'` to every set item; the zod schema and the counts shown on import gain chunks. Importing v1 and v2 files must both work; importing a v2 file into an older app already shows the existing "newer schema" error.
- `duplicateSet` copies chunk items (including skips) and keeps them linked to the same chunk.

## Constraints

- Match the existing stack and patterns: React, Dexie, zod, CSS modules, vitest, the existing drag-reorder code in `src/features/sets/reorder.ts`, and the a11y test setup.
- The data stays on the user's device; no network.
- Existing tests keep passing. New logic (totals with skips, migration, delete blocking, break apart) is covered by tests.

## Left to the builder

- Exact visual styling and component structure, within the existing design tokens.
- Whether the chunk edit page is a route or a dialog, and the keyboard interaction for reordering jokes in it.
- Whether adding a chunk to a set that already contains one of its jokes as a standalone item shows a warning; follow whatever the Set Builder already does for adding the same joke twice.
- Whether the user can tick all jokes off: yes, a chunk with every joke skipped shows 0:00 (see Rules); only the UI wording is open.
- Naming of new files, functions and i18n keys.
- Updating `docs/SPEC.md` to describe chunks.

## Open assumptions to check

- The milestones in the pasted proposal ("M4 Sets") describe the original build. v1 is already built, so this is a follow-on change on its own branch.
