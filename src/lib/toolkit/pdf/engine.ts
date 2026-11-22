// The pipeline every document type goes through: build a PDF from form data, serialize the
// config embedded in it, and read that config back from a PDF or JSON file. Nothing here is
// specific to a type; types come from the registry.

import type { AnyDocType } from './doctype';
import { DocError } from './errors';
import type { BuiltPdf } from './render';
import { defaultsOf, isObj, sanitize, validateFields, type Data, type Problem } from './schema';
import { loadEmbedded, loadRender } from './lazy';
import { getType } from './types';
import { invoice } from './types/invoice';

export const SCHEMA = 'toolkit.pdf';
export const SCHEMA_VERSION = 1;
export const ATTACHMENT_NAME = 'pdf-config.json';

/** The original standalone invoice tool: same data shape, different envelope. */
const LEGACY_SCHEMA = 'toolkit.invoice';
const LEGACY_VERSION = 1;
const LEGACY_ATTACHMENT_NAME = 'invoice-config.json';

export interface Loaded {
  type: AnyDocType;
  data: Data;
}

export const newDoc = (type: AnyDocType, today: Date = new Date()): Data =>
  defaultsOf(type.fields, today);

/** Clean data for a type from anything: unknown keys dropped, types coerced, defaults filled. */
export const parseDoc = (type: AnyDocType, input: unknown, today: Date = new Date()): Data =>
  sanitize(type.fields, input, today);

/** Problems worth fixing. Fatal ones also stop the PDF from being built. */
export function validateDoc(type: AnyDocType, data: Data): Problem[] {
  return [...validateFields(type.fields, data), ...(type.validate?.(data) ?? [])];
}

/** The JSON that is embedded in every PDF and offered as the JSON export. */
export function serialize(type: AnyDocType, data: Data): string {
  const envelope = {
    schema: SCHEMA,
    version: SCHEMA_VERSION,
    type: type.id,
    data: parseDoc(type, data),
  };
  return JSON.stringify(envelope, null, 2) + '\n';
}

export async function buildPdf(type: AnyDocType, data: Data): Promise<BuiltPdf> {
  const fatal = validateDoc(type, data).find((problem) => problem.fatal);
  if (fatal) throw new DocError(fatal.message);
  const clean = parseDoc(type, data);
  const { renderPdf } = await loadRender();
  return renderPdf(type.layout(clean), {
    name: ATTACHMENT_NAME,
    json: serialize(type, clean),
    description: `${type.label} data: drop this PDF back into the tool to edit it`,
  });
}

/** Turns untrusted JSON (a file, or a PDF's attachment) into a type and its clean data. */
export function parseEnvelope(input: unknown): Loaded {
  if (isObj(input) && input.schema === LEGACY_SCHEMA) {
    if (typeof input.version !== 'number' || input.version > LEGACY_VERSION) {
      throw new DocError('This invoice was made by a newer version of the tool.');
    }
    const legacy = { ...input };
    delete legacy.schema;
    delete legacy.version;
    return { type: invoice, data: parseDoc(invoice, legacy) };
  }
  if (!isObj(input) || input.schema !== SCHEMA) {
    throw new DocError('This is not a file created by this tool.');
  }
  if (typeof input.version !== 'number' || input.version > SCHEMA_VERSION) {
    throw new DocError('This file was made by a newer version of the tool.');
  }
  const type = typeof input.type === 'string' ? getType(input.type) : undefined;
  if (!type) {
    throw new DocError(
      `This file is for a document type this version does not have (${String(input.type)}).`,
    );
  }
  return { type, data: parseDoc(type, input.data) };
}

export function parseJsonText(text: string): Loaded {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DocError('That file is not valid JSON.');
  }
  return parseEnvelope(parsed);
}

/** Reads the embedded config back out of a PDF made by this tool (or the old invoice tool). */
export async function extractPdf(pdfBytes: Uint8Array): Promise<Loaded> {
  const { readAttachment } = await loadEmbedded();
  const found = await readAttachment(pdfBytes, [ATTACHMENT_NAME, LEGACY_ATTACHMENT_NAME]);
  if (!found) {
    throw new DocError(
      'This PDF has no document data. Only PDFs created by this tool can be loaded back.',
    );
  }
  try {
    return parseJsonText(found.text);
  } catch (error) {
    if (error instanceof DocError && error.message === 'That file is not valid JSON.') {
      throw new DocError('The data inside this PDF is damaged.');
    }
    throw error;
  }
}
