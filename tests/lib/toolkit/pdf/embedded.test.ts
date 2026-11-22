import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { extractPdf } from '../../../../src/lib/toolkit/pdf/engine';
import { MAX_ATTACHMENT_BYTES } from '../../../../src/lib/toolkit/pdf/embedded';
import { DocError } from '../../../../src/lib/toolkit/pdf/errors';

const config = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    schema: 'toolkit.pdf',
    version: 1,
    type: 'invoice',
    data: { notes: 'hi' },
    ...extra,
  });

async function pdfWith(bytes: Uint8Array, name = 'pdf-config.json') {
  const doc = await PDFDocument.create();
  doc.addPage();
  await doc.attach(bytes, name, { mimeType: 'application/json' });
  return doc.save();
}

describe('reading the embedded config', () => {
  it('round-trips a normal attachment', async () => {
    const loaded = await extractPdf(await pdfWith(new TextEncoder().encode(config())));
    assert.equal(loaded.type.id, 'invoice');
  });

  it('refuses a decompression bomb quickly, and without allocating the output', async () => {
    // 24 MB of spaces deflates to ~24 KB; the cap must trip long before it is fully inflated.
    const bomb = new Uint8Array(MAX_ATTACHMENT_BYTES * 3).fill(0x20);
    const pdf = await pdfWith(bomb);
    assert.ok(pdf.length < 1_000_000, 'the file itself is tiny');
    const before = process.memoryUsage().rss;
    const started = Date.now();
    await assert.rejects(
      extractPdf(pdf),
      (e) => e instanceof DocError && /damaged/.test(e.message),
    );
    assert.ok(Date.now() - started < 3000, 'rejected promptly');
    assert.ok(
      process.memoryUsage().rss - before < 150 * 1024 * 1024,
      'did not inflate the whole thing',
    );
  });

  it('accepts an attachment right at the size limit', async () => {
    const pad = ' '.repeat(MAX_ATTACHMENT_BYTES - config().length);
    const body = new TextEncoder().encode(config() + pad);
    assert.equal(body.length, MAX_ATTACHMENT_BYTES);
    assert.equal((await extractPdf(await pdfWith(body))).type.id, 'invoice');
  });

  it('refuses anything one byte over', async () => {
    const body = new TextEncoder().encode(
      config() + ' '.repeat(MAX_ATTACHMENT_BYTES - config().length + 1),
    );
    await assert.rejects(extractPdf(await pdfWith(body)), DocError);
  });

  it('refuses stream filters it does not support instead of guessing', async () => {
    const pdf = await PDFDocument.load(await pdfWith(new TextEncoder().encode(config())));
    for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
      const dict = (
        obj as { dict?: { has(n: PDFName): boolean; set(n: PDFName, v: PDFName): void } }
      ).dict;
      if (dict?.has(PDFName.of('Filter'))) dict.set(PDFName.of('Filter'), PDFName.of('LZWDecode'));
    }
    await assert.rejects(extractPdf(await pdf.save()), DocError);
  });

  it('ignores attachments with other names', async () => {
    await assert.rejects(
      extractPdf(await pdfWith(new TextEncoder().encode(config()), 'something-else.json')),
      /no document data/,
    );
  });

  it('survives a name tree whose kids all point back at the same node', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const ctx = doc.context;
    const kid = ctx.obj({});
    const kidRef = ctx.register(kid);
    // 30 kids that are all the same node: a naive walk visits 30^8 of them.
    kid.set(PDFName.of('Kids'), ctx.obj(Array.from({ length: 30 }, () => kidRef)));
    const names = ctx.obj({ EmbeddedFiles: kidRef });
    doc.catalog.set(PDFName.of('Names'), ctx.register(names));
    void PDFString;
    const started = Date.now();
    await assert.rejects(extractPdf(await doc.save()), /no document data/);
    assert.ok(Date.now() - started < 2000, 'the walk is bounded');
  });
});
