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

The side preview is the browser's own PDF viewer in an iframe, loaded from a `blob:` URL, so nothing
leaves the page. The viewer's built-in Download button saves under a browser-chosen name; the
tool's **Download PDF** button (and Ctrl/Cmd+S) uses the document's file name. A preview service
worker that served a named URL was removed: Chrome and Edge re-request that URL when you press the
viewer's Download, which bypasses the worker and saved the site's HTML as `<name>.htm`.
`removeLegacyPreviewWorker()` in `ui/app.ts` unregisters the old worker for returning visitors.

## What the browser remembers

Documents: nothing. The only other things the Toolkit layout can store come from the shared site
chrome, not from this tool: the theme choice (`localStorage`, key `theme`) and the last site
search (`sessionStorage`, cleared with the tab).

## Limits

Text fields cap at 10,000 characters, lists and tables at 500 rows, custom sheets at 12 columns,
uploads at 25 MB and the PDF at 200 pages. These keep a crafted file from freezing the tab.
