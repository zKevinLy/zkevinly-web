// Reads a named file attachment out of a PDF. Writing goes through renderPdf (doc.attach).

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from 'pdf-lib';
import { DocError } from './errors';

/** The most an attachment may inflate to. Real configs are a few hundred KB at most. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** Most dictionaries visited while walking the name tree (a crafted shared-kids tree is exponential). */
const MAX_TREE_NODES = 2000;

/** Inflates `bytes` but gives up as soon as the output passes `limit` (a decompression bomb). */
async function inflateCapped(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** The decoded bytes of an embedded file stream: stored as-is, or Flate with a size cap. */
async function streamBytes(stream: PDFRawStream): Promise<Uint8Array> {
  const filter = stream.dict.lookup(PDFName.of('Filter'));
  const raw = stream.getContents();
  if (filter === undefined) {
    if (raw.length > MAX_ATTACHMENT_BYTES) throw new Error('too large');
    return raw;
  }
  const only =
    filter instanceof PDFName
      ? filter
      : filter instanceof PDFArray && filter.size() === 1
        ? filter.lookup(0)
        : null;
  if (!(only instanceof PDFName) || only.asString() !== '/FlateDecode') {
    throw new Error('unsupported filter');
  }
  return inflateCapped(raw, MAX_ATTACHMENT_BYTES);
}

function* embeddedFiles(
  node: PDFDict,
  depth = 0,
  budget = { left: MAX_TREE_NODES },
): Generator<[string, PDFDict]> {
  if (depth > 8 || budget.left-- <= 0) return;
  const names = node.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (names) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      const key = names.lookup(i);
      const spec = names.lookupMaybe(i + 1, PDFDict);
      if (spec && (key instanceof PDFString || key instanceof PDFHexString)) {
        yield [key.decodeText(), spec];
      }
    }
  }
  const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
  if (kids) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookupMaybe(i, PDFDict);
      if (kid) yield* embeddedFiles(kid, depth + 1, budget);
    }
  }
}

/**
 * The text of the first attachment whose name is in `names` (tried in that order), or null
 * when the PDF has none of them. Throws DocError when the file is not a readable PDF.
 */
export async function readAttachment(
  pdfBytes: Uint8Array,
  names: readonly string[],
): Promise<{ name: string; text: string } | null> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  } catch {
    throw new DocError('That file could not be read as a PDF.');
  }
  const tree = doc.catalog
    .lookupMaybe(PDFName.of('Names'), PDFDict)
    ?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  if (!tree) return null;

  const found = new Map<string, PDFDict>();
  for (const [name, spec] of embeddedFiles(tree)) if (!found.has(name)) found.set(name, spec);

  for (const wanted of names) {
    const spec = found.get(wanted);
    const stream = spec?.lookupMaybe(PDFName.of('EF'), PDFDict)?.lookup(PDFName.of('F'));
    if (!(stream instanceof PDFRawStream)) continue;
    try {
      return { name: wanted, text: new TextDecoder().decode(await streamBytes(stream)) };
    } catch {
      throw new DocError('The data inside this PDF is damaged.');
    }
  }
  return null;
}
