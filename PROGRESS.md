# AP/AR Dashboards + Fillout Integration — Progress

_Updated on each meaningful change. Read this first to see what's built, what's left, and what's unverified. See [RULES.md](RULES.md) for durable conventions (admin-always-full-power, secrets handling, deploy gotchas) — that file doesn't change per-update the way this one does._

## Target

Replace the client-portal's Google Forms/Sheets-based AP (payable/expense) and AR (receivable) workflows with:
- Fillout-hosted forms (Google Forms couldn't support file uploads without forcing sign-in — see git history for that investigation).
- Submissions synced into Firestore automatically.
- Two per-client dashboards (Payable/Expense, Receivable) rendered as an editable, sheet-like grid inside the existing client portal.
- Three roles editing the same rows with field-level permission: **Client** (their own approval status only), **Bookkeeper** (new role — accounting fields, AP scheduling, bookkeeper/Plooto status; assigned to specific clients by admin), **Admin** (everything).
- An **AP calendar** per client (bulk-generated recurring run dates) that transactions get assigned to via dropdown.
- Connecting a client's Fillout form to a dashboard is a **frontend admin action** (paste form ID, click Connect) — not a code change or manual Fillout dashboard step. Dashboards/forms are connected one at a time, only when enabled for that client — there's no requirement to connect all of a client's forms up front.

## Status

- [x] **Task 1** — Data model: `bookkeeper` role + `assignedClientIds`, `ApCalendar`, `dashboardsEnabled`, `TransactionRow`/`FormSchema` types (`client-portal/lib/types.ts`)
- [x] **Task 2** — Firestore rules: `apTransactions`/`arTransactions`/`formSchemas`/`filloutFormMappings` read-scoped by role, writes blocked at the rules layer (Admin SDK only)
- [x] **Task 3** — Bookkeeper role: `/admin/bookkeepers` (create + assign clients), `/bookkeeper` dashboard + client view, `BookkeeperProtectedRoute`
- [x] **Task 5** — Fillout connectivity:
  - Admin-configurable mapping (`filloutFormMappings`), connect/disconnect via `/api/admin/fillout/connect-form|disconnect-form` (calls Fillout's webhook create/delete API)
  - "AP/AR Dashboards" section on each client's edit page — enable toggle + Connect/Disconnect per dashboard type
  - `functions/src/filloutSync.ts` + `filloutWebhook` (real-time ingestion) / `scheduledFilloutReconcile` (4-hourly REST backfill) in `functions/src/index.ts`
- [x] **Task 7** — Field-scoped write endpoint: `/api/transactions/write-field`, ownership map in `lib/transactionFieldOwnership.ts` (shared with the not-yet-built grid UI so client/server never drift), AP-date validated server-side
- [x] **Task 4** — AP calendar: pure date-generation logic in `lib/apCalendar.ts` (weekly/biweekly/monthly, skip/extra dates, merge-never-drops-existing), admin UI on the client edit page (`ApCalendarEditor`) — verified via direct script run, matches the server-side effective-dates computation in `write-field/route.ts`
- [x] **Task 6** — Transaction grid: `components/dashboard/TransactionGrid.tsx` (live `onSnapshot` reads, optimistic per-cell writes via task 7's endpoint, field editability driven by `canWriteField()` so UI and server can't drift), `components/dashboard/AttachmentPreview.tsx` (chip list + modal preview — plain `<img>`/`<iframe>` works directly since Fillout files are public S3 URLs, not Google Drive, so none of the earlier Google embedding restrictions apply). Wired into `ClientPortalView` as "Payable / Expense" and "Receivables" tabs, shown per client based on `dashboardsEnabled`. Superseded by tasks 8–11 below (fixed manual/status fields replaced with a fully admin-defined schema) — no real data was ever written to the old fixed fields (`vendorName`/`amount`/etc.), so no migration was needed.
- [x] **Task 8** — Dynamic field config: `ExtraFieldDef`/`DashboardFieldConfig` types, `TransactionRow`'s fixed manual/status fields (`vendorName`, `amount`, `hst`, `amountExclHst`, `invoiceDate`, `bookkeeperStatus`, `plootoStatus`, `clientStatus`) replaced with an open `extraFields: Record<string, unknown>` map. `apRunDate`/`attachmentLinks` stay structural (tied to the AP calendar / file-link features specifically, not admin-definable). New `dashboardFieldConfigs` collection — admin can write directly (no external side effect like the Fillout mapping has), scoped read for client/bookkeeper/admin.
- [x] **Task 9** — Admin UI: `DashboardFieldsEditor` on the client edit page (per dashboard type, shown once enabled) — add/edit/remove field defs: label, category (manual/status, organizational only), type (text/number/date/dropdown/checkbox), dropdown options, editable-by (client/staff).
- [x] **Task 10** — `write-field/route.ts` now branches on `extraFields.<id>` vs the old static whitelist: for extra fields, it fetches that client+dashboard's `DashboardFieldConfig` server-side, finds the field def by id, and authorizes via `canWriteExtraField()` — never trusting the request for which role owns a field. Structural fields (`apRunDate`, `attachmentLinks`, `formAnswers.*`) still resolve via the static `lib/transactionFieldOwnership.ts` whitelist.
- [x] **Task 11** — `TransactionGrid` renders columns from `DashboardFieldConfig` (ordered, typed per-field editor: text/number/date/dropdown/checkbox) instead of hardcoded columns. New `DashboardPanel.tsx` adds **Submissions / Dashboard** sub-tabs inside each Payable/Receivable tab — Submissions is the grid; Dashboard is a placeholder ("coming soon," to be designed later per explicit request).

## Ops setup

- [x] `FILLOUT_API_KEY` set — Firebase Secret Manager + `client-portal/.env.local` (2026-07-20)
- [x] `FILLOUT_WEBHOOK_SECRET` generated + set — Firebase Secret Manager + `client-portal/.env.local` (2026-07-20)
- [x] `functions` deployed (2026-07-20) — `filloutWebhook` and `scheduledFilloutReconcile` created; `scheduledClickupSync`/`triggerClickupSync` updated (unrelated to this build, redeployed as part of the same codebase)
- [x] `filloutWebhook` URL: `https://us-central1-symplfinance-client-portal.cloudfunctions.net/filloutWebhook`
- [x] `firestore.rules` deployed for real (2026-07-20) — previously only `--dry-run` validated, never released; caused "Missing or insufficient permissions" on any new collection (`filloutFormMappings` etc.) until fixed
- [ ] Paste the `filloutWebhook` URL into **Admin → Settings → Fillout Integration** (not yet done — needs a real admin login)
- [ ] Per client, per dashboard: enable + Connect a Fillout form — done individually via the frontend as each dashboard goes live, not a batch setup step

## Confirmed working end-to-end (2026-07-19/20)

- EEA's Payable/Expense form (Fillout ID `3hXM1dPEQpus`) connected via the admin UI, first live test submissions ingested successfully into `apTransactions`, `formSchemas` auto-populated with all 8 question columns with correct labels.
- Fillout's real webhook payload is a **bare submission object** (not wrapped in `{ submission: {...} }`) — the defensive `req.body?.submission ?? req.body` fallback in `filloutWebhook` correctly handles this.
- File-upload question `type` is literally `"FileUpload"`; `value` is an array of `{ url, filename }` objects — `extractAttachmentLinks()`'s heuristic matches this correctly.

### Bug found and fixed: secrets set via a shell pipe carried a trailing newline

`grep ... | cut ... | firebase functions:secrets:set --data-file -` preserves the pipe's own line-ending, so both `FILLOUT_API_KEY` and `FILLOUT_WEBHOOK_SECRET` were stored in Secret Manager with an extra trailing `\n` baked into the value — invisible in terminal output, but it meant the deployed function's secret never matched the clean value used elsewhere (e.g. the URL registered with Fillout at connect-form time), so every real webhook delivery was silently rejected with `401 Unauthorized`. Diagnosed by comparing byte-length of `firebase functions:secrets:set` output vs `.env.local`'s value (50 bytes vs 49). Fixed by resetting both secrets via `printf '%s' "$VAL" | firebase functions:secrets:set ...` (command substitution strips trailing newlines; a raw pipe does not) and redeploying. Confirmed fixed via a direct manual POST to the deployed function, then backfilled the two real submissions that were lost during the bug window.

**Lesson for later secret rotations:** always set secrets via `printf '%s' "$VALUE" | firebase functions:secrets:set NAME --data-file -`, never a raw `grep`/`cat` pipe.

### Bug found and fixed: admin's portal view respected client-facing enable toggles (2026-07-20)

`ClientPortalView`'s tab visibility (`Forms`, `Payable / Expense`, `Receivables`) was gated by `formsEnabled`/`dashboardsEnabled` for every viewer, including admin — meaning if a client's dashboard wasn't toggled on yet, admin lost the tab too when using "View Portal." Fixed by bypassing all enable-toggle gating when `profile.role === "admin"`. Codified as a standing rule in [RULES.md](RULES.md): admin must always have full visibility and write power over everything a client or bookkeeper can see/do, never gated by a toggle meant for their own view.

### Policy reversal: form-submitted fields are now immutable for everyone, including admin (2026-07-20)

Originally, `formAnswers.*` (the raw Fillout submission data — GL code, project/class, etc.) was bookkeeper/admin-editable, on the reasoning that bookkeepers sometimes need to correct a miscoded GL code post-submission. Explicitly reversed per direct instruction: form fields must stay an immutable record of what was actually submitted, for every role including admin, when viewed from the client/bookkeeper views (and admin's mimicked view of them). `getFieldOwner("formAnswers.x")` now always returns `null`, so `write-field/route.ts` rejects any edit attempt (400) and the grid renders those cells as plain text regardless of role. Corrections now go through an admin-defined `extraFields` column (e.g. add a "Corrected GL Code" field via `DashboardFieldsEditor`) rather than overwriting the original answer. Codified in [RULES.md](RULES.md).

### Bug found and fixed: connecting a Fillout form didn't guarantee the dashboard was actually enabled (2026-07-20)

EEA's Payable/Expense form was connected (mapping existed, webhook working) but `clients/901814705836.dashboardsEnabled` was still `{}` in Firestore — the "enabled" toggle only ever persisted through the page's batched "Save changes" button, decoupled from the immediate, already-persisted Connect/Disconnect actions. Toggle it on, connect the form, navigate away without clicking Save, and the connection survives but the enable flag silently doesn't. Fixed by making the toggle persist immediately (`setClientDashboardEnabled()` in `lib/firestore.ts`, dot-notation update so it only touches that one dashboard type's flag) instead of deferring to the batch save. Manually corrected EEA's existing data (`dashboardsEnabled.payable` set to `true` directly) since the connection was already real.

### Two admin-UI cleanups (2026-07-20)

- **Dropdown options for admin-defined fields**: was a single comma-separated text input, easy to miss as "the way to add an option." Replaced with a proper `DropdownOptionsEditor` — text input + "+ Add option" button + a removable chip list, same pattern as the AP calendar's date list.
- **Column widths**: the "Client/Staff" editable-by select was `sm:col-span-1` in a 12-column grid — clipped its own text. Rebalanced once the options editor moved to its own full-width row below (label 3 / category 3 / type 3 / editable-by 2 / remove 1 = 12), plus a `min-w-[92px]` floor on the select.

### Policy reversal: AP Run Date is no longer an automatic column — it's an opt-in field type (2026-07-20)

Originally `apRunDate` was a fixed structural column every Payable/Receivable grid got automatically, validated against the client's `ApCalendar` by literal field name (`field === "apRunDate"`). Reversed per direct instruction: admin now adds an AP-run-date column explicitly, the same way as any other manual field, by choosing `type: "apDate"` in `DashboardFieldsEditor` — nothing shows up unless admin opts in. Implementation: `apRunDate` removed entirely from `TransactionRow` (no longer a fixed property — its value now lives at `extraFields.<fieldId>` like everything else); `ExtraFieldType` gained `"apDate"`; the grid renders an `apDate` field as a dropdown sourced from `effectiveApDates()` instead of admin-typed options; `write-field/route.ts`'s calendar validation now triggers off the resolved field definition's `type === "apDate"` rather than a field-name match. No data migration needed — nothing had ever written to `apRunDate` in practice.

### Transaction grid overhaul: Google Sheets–like editing, column filters, bulk row apply (2026-07-20)

`TransactionGrid.tsx` reworked significantly beyond task 11's version:
- **Checkbox latency fix**: `EditableCheckbox` now holds its own local `checked` state that flips the instant it's clicked, independent of the parent grid's optimistic-override re-render — was perceptibly laggy before since it was fully controlled by state that only updated after the override propagated through the whole grid.
- **Sheet-style visuals**: flat bordered grid (every cell has a border, gray row-number column on the left) instead of the rounded-card look.
- **Keyboard navigation**: click a cell to select it (text/number/date fields also start editing immediately, same as before); arrow keys move the active cell when not mid-edit; typing a character on a selected-but-not-editing cell starts editing and replaces the value; `Enter`/`F2` start editing without clearing; `Enter` commits and moves down a row; `Tab`/`Shift+Tab` commit and move right/left; `Escape` cancels without committing. Checkboxes toggle via `Space`/`Enter` when selected via keyboard. Dropdowns/checkboxes stay "live" controls — only text-like fields get the select-then-edit distinction.
  - **Focus-loss bug fixed**: committing/canceling an edit unmounts the `<input>`, which reverts DOM focus to `document.body` — arrow keys would then fall through to the browser's default page-scroll instead of being caught by the grid's `onKeyDown`. Fixed with an effect that reclaims focus on the grid container whenever `editing` goes false.
  - **Auto-scroll**: a `cellRefs` map + effect keyed on `activeCell` calls `scrollIntoView({block: "nearest", inline: "nearest"})` so keyboard navigation scrolls the grid (both directions) as the active cell moves off-screen.
- **Per-column filters**: a filter icon in each header cell opens a popover with a search box and a checklist of that column's distinct values (including a `(Blanks)` sentinel for empty/missing) — same shape as Sheets' column filter. Checkbox columns show `Checked`/`Unchecked` as their two filterable values. Filters apply live (no separate Apply step); the value list is computed from the full unfiltered dataset, not cross-filtered against other active column filters, to keep the state model simple. Not available on the read-only Attachments column.
- **Bulk apply to multiple rows**: a selection checkbox column (+ header select-all, scoped to currently-visible/filtered rows) plus a toolbar that appears once ≥1 row is selected — pick any column the current role can write, enter/select a value, "Apply to N rows" writes it to every selected row via the same per-cell commit path (so it goes through the normal field-ownership/write-field route, nothing bypasses `lib/transactionFieldOwnership.ts`).

### Hydration warning fixed: browser extension attributes on `<body>` (2026-07-20)

Reported error ("A tree hydrated but some attributes of the server rendered HTML didn't match...") was `data-new-gr-c-s-check-loaded`/`data-gr-ext-installed` — Grammarly's browser extension injecting attributes into `<body>` before React hydrates, not an actual app bug. Fixed with `suppressHydrationWarning` on `<body>` in [app/layout.tsx](client-portal/app/layout.tsx). This only suppresses the warning for that one element's attribute mismatches (the standard fix for this specific, extremely common false positive) — it does not hide real hydration bugs elsewhere in the tree.

## Open verification items

- `getClientsByIds()` uses a Firestore `where(documentId(), "in", [...])` query against per-path-segment security rules (bookkeeper's assigned clients) — a well-established pattern, but not yet exercised against real data.
- The dynamic field config (tasks 8–11) hasn't been click-tested either — add a field via `DashboardFieldsEditor` on EEA's expense dashboard, confirm it renders correctly in the grid with the right type/options, and that write permission actually matches what was configured (client field only editable by a client login, staff field only by bookkeeper/admin).
- Existing `apTransactions` docs (the EEA test submissions ingested earlier) are unaffected by the schema change — the ingestion function never wrote to the old fixed fields (`vendorName` etc.), so there's no migration needed; they'll just show no data in any `extraFields` columns until admin defines some.

## Key architectural decisions (why, not just what)

- **Flat `apTransactions`/`arTransactions` collections with a `clientId` field**, not `clients/{clientId}/apTransactions` subcollections — because the Bookkeeper dashboard needs to list rows across multiple assigned clients in one `where clientId in [...]` query, which is awkward as a Firestore collection-group query.
- **Reads are direct Firestore `onSnapshot`, writes go through a Next.js API route** — not because writes need "saving," but so the write can be validated server-side (role + field ownership) while still feeling instant: the UI updates optimistically and fires the write immediately per cell change, no save button.
- **Fillout ingestion identity comes from the registered webhook URL's `?formId=` query param and a lookup in `filloutFormMappings`**, never from the payload body — so a spoofed/leaked payload can't get attributed to the wrong client.
- **Form-sourced fields are stored as an open `formAnswers: { [questionId]: value }` map**, not fixed top-level fields — so a form question being added/edited later needs no migration; the ingestion function auto-appends new question ids to a per-form schema doc.
