# PDF generator

A config-driven PDF maker. A **document type** describes its data once; everything else is
generic.

```
types/*.ts      one file per type: fields + layout()      <- the only thing you write
schema.ts       field DSL; derives defaults, sanitizing, validation
layout.ts       the block IR a type compiles to (title, columns, facts, table, totals, text...)
render.ts       draws any Layout with pdf-lib: wrapping, pagination, QR, footer
engine.ts       build PDF, embed/read the config, load PDF or JSON files
ui/form.ts      renders `fields` into the page; ui/app.ts wires the page
```

## Add a type

1. Create `types/<id>.ts` with `defineDocType({ id, label, description, fields, layout, filename })`.
   - `fields`: groups, scalar fields, `table` (fixed columns), `list` (repeatable cards),
     `sheet` (user-defined columns), `summary` (live totals card).
   - `layout(data)`: return `{ pageSize, accent, title, author, footer, blocks }`. `data` is
     already sanitized, so every key exists and has the right type.
   - Optional: `live()` for computed cells/totals, `validate()`, `example`.
2. Add it to `docTypes` in `types/index.ts`. The page, switcher, JSON/PDF round trip and tests
   pick it up; add a case to `tests/lib/toolkit/pdf/types.test.ts` for its layout.

## Stored format

Every PDF carries `pdf-config.json`: `{ schema: "toolkit.pdf", version, type, data }`.
Renaming a field or changing its meaning needs a `version` bump and a migration in
`parseEnvelope`. Adding a field does not: missing keys get their defaults. PDFs from the old
standalone invoice tool (`invoice-config.json`, `toolkit.invoice`) still load as invoices.

## Preview and file names

Every type has the same first field, "File name" (`filename` in the data, from `fileNameField()` in `types/common.ts`).
The download and the preview use `data.filename` (made filename-safe by `slug()`). New documents start
with a visible default in the field; if it is cleared, each type falls back to `invoice`, `service-log`
or `document`. Document content such as the invoice
number, footer text or title never changes the file name.

The side preview is the browser's own PDF viewer in an iframe. Viewers name a saved file after
the URL, so `public/toolkit/pdf-preview-sw.js` (a service worker scoped to
`/toolkit/pdf/preview/`) serves each preview at `/toolkit/pdf/preview/<document-name>.pdf`.
The bytes are posted to the worker and kept only in its memory: nothing goes to the Cache API,
IndexedDB or disk. Each tab uses its own random preview id (so tabs never see each other's
documents), tells the worker to forget its previews on `pagehide`, and anything left behind is
dropped after 10 minutes. If service workers are unavailable the preview falls back to a
`blob:` URL (it still works; the viewer just saves it under a random name).

The worker's _registration_ is the one thing the browser remembers between visits (it contains
no document data). To remove even that, delete the worker and its code in `ui/app.ts`: the
preview then always uses `blob:` URLs, and the Download button still names the file correctly.

## What the browser remembers

Documents: nothing. The only other things the Toolkit layout can store come from the shared site
chrome, not from this tool: the theme choice (`localStorage`, key `theme`) and the last site
search (`sessionStorage`, cleared with the tab).

## Limits

Text fields cap at 10,000 characters, lists and tables at 500 rows, custom sheets at 12 columns,
uploads at 25 MB and the PDF at 200 pages. These keep a crafted file from freezing the tab.
