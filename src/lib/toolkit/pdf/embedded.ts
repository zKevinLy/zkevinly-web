// Reads a named file attachment out of a PDF. Writing goes through renderPdf (doc.attach).

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';
import { DocError } from './errors';

function* embeddedFiles(node: PDFDict, depth = 0): Generator<[string, PDFDict]> {
  if (depth > 8) return;
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
      if (kid) yield* embeddedFiles(kid, depth + 1);
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
      return { name: wanted, text: new TextDecoder().decode(decodePDFRawStream(stream).decode()) };
    } catch {
      throw new DocError('The data inside this PDF is damaged.');
    }
  }
  return null;
}
