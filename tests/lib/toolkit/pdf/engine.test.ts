import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  ATTACHMENT_NAME,
  SCHEMA,
  SCHEMA_VERSION,
  buildPdf,
  extractPdf,
  newDoc,
  parseDoc,
  parseEnvelope,
  parseJsonText,
  serialize,
  validateDoc,
} from '../../../../src/lib/toolkit/pdf/engine';
import { DocError } from '../../../../src/lib/toolkit/pdf/errors';
import { docTypes, getType } from '../../../../src/lib/toolkit/pdf/types';

for (const t of docTypes) {
  test(`${t.id}: the PDF embeds its config and it round-trips exactly`, async () => {
    const data = parseDoc(t, t.example);
    const { bytes, warnings } = await buildPdf(t, data);
    assert.deepEqual(warnings, []);
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
    const loaded = await extractPdf(bytes);
    assert.equal(loaded.type.id, t.id);
    assert.deepEqual(loaded.data, data);
  });
}

test('the JSON export and the PDF attachment are the same envelope', () => {
  const t = getType('invoice')!;
  const json = JSON.parse(serialize(t, newDoc(t)));
  assert.equal(json.schema, SCHEMA);
  assert.equal(json.version, SCHEMA_VERSION);
  assert.equal(json.type, 'invoice');
  assert.deepEqual(parseJsonText(serialize(t, newDoc(t))).data, parseDoc(t, json.data));
  assert.equal(ATTACHMENT_NAME, 'pdf-config.json');
});

test('PDFs made by the old invoice tool still load as invoices', async () => {
  const t = getType('invoice')!;
  const legacy = {
    schema: 'toolkit.invoice',
    version: 1,
    number: 'OLD-7',
    currency: 'eur',
    items: [{ description: 'Work', quantity: '2', unitPrice: '10.50' }],
  };
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await pdf.attach(new TextEncoder().encode(JSON.stringify(legacy)), 'invoice-config.json', {
    mimeType: 'application/json',
  });
  const loaded = await extractPdf(await pdf.save());
  assert.equal(loaded.type, t);
  assert.equal(loaded.data.number, 'OLD-7');
  assert.equal(loaded.data.currency, 'EUR');
  assert.deepEqual(loaded.data.items, [{ description: 'Work', quantity: '2', unitPrice: '10.50' }]);
  assert.equal('schema' in loaded.data, false);
});

test('envelopes from other tools, newer versions and unknown types are rejected clearly', () => {
  assert.throws(() => parseEnvelope({ hello: 'world' }), DocError);
  assert.throws(() => parseEnvelope(null), DocError);
  assert.throws(
    () => parseEnvelope({ schema: SCHEMA, version: SCHEMA_VERSION + 1, type: 'invoice' }),
    /newer/,
  );
  assert.throws(() => parseEnvelope({ schema: SCHEMA, version: 1, type: 'nope' }), /does not have/);
  assert.throws(() => parseEnvelope({ schema: 'toolkit.invoice', version: 2 }), /newer/);
  assert.throws(() => parseJsonText('{not json'), /not valid JSON/);
});

test('a PDF not made by this tool is rejected with a clear message', async () => {
  const other = await PDFDocument.create();
  other.addPage();
  await assert.rejects(extractPdf(await other.save()), /no document data/);
  await assert.rejects(extractPdf(new TextEncoder().encode('not a pdf')), DocError);
});

test('a tampered attachment is rejected, not trusted', async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  await doc.attach(new TextEncoder().encode('{"schema":"something.else"}'), ATTACHMENT_NAME, {
    mimeType: 'application/json',
  });
  await assert.rejects(extractPdf(await doc.save()), DocError);
  const broken = await PDFDocument.create();
  broken.addPage();
  await broken.attach(new TextEncoder().encode('{oops'), ATTACHMENT_NAME, {
    mimeType: 'application/json',
  });
  await assert.rejects(extractPdf(await broken.save()), /damaged/);
});

test('an invalid currency stops the build with the reason', async () => {
  const t = getType('invoice')!;
  const data = newDoc(t);
  data.currency = 'EU';
  await assert.rejects(buildPdf(t, data), /3-letter/);
  assert.equal(
    validateDoc(t, data).some((p) => p.fatal),
    true,
  );
});
