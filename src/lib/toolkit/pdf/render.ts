// Draws a Layout (layout.ts) to a vector PDF. This is the only module that talks to
// pdf-lib to draw; it knows block kinds, wrapping and pagination, and nothing about the
// document types that produce the blocks. Runs in the browser (and Node for tests).

import {
  AFRelationship,
  PDFDocument,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import QRCode from 'qrcode';
import { DocError } from './errors';
import type {
  Align,
  Block,
  ColumnsBlock,
  FactsBlock,
  Layout,
  TableBlock,
  TextBlock,
  TextLine,
  TitleBlock,
  TotalsBlock,
} from './layout';

const PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792] } as const;
const MARGIN = 48;
const FOOTER_SPACE = 28;
const COLUMN_GAP = 10;
/** Stops a crafted file from producing an endless document. */
const MAX_PAGES = 200;

const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.42, 0.42, 0.48);
const RULE = rgb(0.86, 0.86, 0.89);

export interface Attachment {
  name: string;
  json: string;
  description: string;
}

export interface BuiltPdf {
  bytes: Uint8Array;
  /** Things that did not render exactly as typed (unsupported characters, QR too large...). */
  warnings: string[];
}

function hexColor(hex: string): Color {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function renderPdf(layout: Layout, attachment?: Attachment): Promise<BuiltPdf> {
  const warnings: string[] = [];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  // Standard PDF fonts only cover Latin-1 (WinAnsi). Anything else becomes "?" and is
  // reported, rather than letting pdf-lib throw halfway through the document.
  const supported = new Set(regular.getCharacterSet());
  const lossy = new Set<string>();
  const clean = (value: string): string => {
    let out = '';
    for (const ch of value.replace(/[\u00a0\u2007\u2009\u202f]/g, ' ').replace(/\t/g, '  ')) {
      const code = ch.codePointAt(0) ?? 0;
      if (ch === '\n') out += ch;
      else if (code < 32 || code === 127) continue;
      else if (supported.has(code)) out += ch;
      else {
        lossy.add(ch);
        out += '?';
      }
    }
    return out;
  };
  /** Single-line text: newlines become spaces. */
  const flat = (value: string): string => clean(value).replaceAll('\n', ' ');

  const [pageW, pageH] = PAGE_SIZES[layout.pageSize];
  const contentW = pageW - MARGIN * 2;
  const right = pageW - MARGIN;
  const bottom = MARGIN + FOOTER_SPACE;
  const accent = hexColor(layout.accent);

  const pages: PDFPage[] = [];
  let page: PDFPage;
  /** Top of the next thing to draw, measured up from the bottom edge. */
  let y = 0;
  let hasContent = false;

  const newPage = () => {
    if (pages.length >= MAX_PAGES)
      throw new DocError(
        `This document is longer than ${MAX_PAGES} pages. Split it into smaller documents.`,
      );
    page = doc.addPage([pageW, pageH]);
    pages.push(page);
    y = pageH - MARGIN;
    hasContent = false;
  };
  newPage();

  /** Starts a new page when `height` does not fit, unless the page is still empty. */
  const ensure = (height: number) => {
    if (hasContent && y - height < bottom) newPage();
  };

  const width = (value: string, font: PDFFont, size: number) =>
    font.widthOfTextAtSize(flat(value), size);

  /** Draws one line of text whose top edge is at `top`. */
  const draw = (
    value: string,
    x: number,
    top: number,
    font: PDFFont,
    size: number,
    color: Color = INK,
  ) => {
    const line = flat(value);
    if (line.trim()) page.drawText(line, { x, y: top - size * 0.82, font, size, color });
  };

  const drawAligned = (
    value: string,
    x: number,
    w: number,
    align: Align,
    top: number,
    font: PDFFont,
    size: number,
    color: Color = INK,
  ) => {
    const used = width(value, font, size);
    const at = align === 'right' ? x + w - used : align === 'center' ? x + (w - used) / 2 : x;
    draw(value, at, top, font, size, color);
  };

  /** Word-wraps text to a width; breaks over-long words by character. */
  const wrap = (value: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of clean(value).split('\n')) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of paragraph.split(' ')) {
        const attempt = current ? `${current} ${word}` : word;
        if (width(attempt, font, size) <= maxWidth) {
          current = attempt;
          continue;
        }
        if (current) lines.push(current);
        current = '';
        let rest = word;
        while (width(rest, font, size) > maxWidth && rest.length > 1) {
          // Binary search for the longest prefix that fits. A linear scan here made one
          // 10,000-character word (e.g. from a crafted file) freeze the tab for ~40 seconds.
          let lo = 1;
          let hi = rest.length - 1;
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (width(rest.slice(0, mid), font, size) <= maxWidth) lo = mid;
            else hi = mid - 1;
          }
          lines.push(rest.slice(0, lo));
          rest = rest.slice(lo);
        }
        current = rest;
      }
      lines.push(current);
    }
    return lines;
  };

  const rule = (at: number, thickness: number, color: Color, from = MARGIN, to = right) =>
    page.drawLine({ start: { x: from, y: at }, end: { x: to, y: at }, thickness, color });

  const heading = (value: string, x: number, top: number) => draw(value, x, top, bold, 8, MUTED);

  // ---- Blocks -------------------------------------------------------------------------------

  const title = (block: TitleBlock) => {
    const size = block.size ?? 26;
    const meta = block.meta ?? [];
    const metaW = meta.reduce(
      (max, [label, value]) =>
        Math.max(max, width(label, regular, 9.5) + width(value, bold, 9.5) + 8),
      0,
    );
    const leftW = meta.length > 0 ? contentW - metaW - 24 : contentW;
    const kicker = block.kicker?.trim() ? flat(block.kicker) : '';
    const titleLines = wrap(block.title, bold, size, leftW);
    const subtitleLines = block.subtitle?.trim() ? wrap(block.subtitle, regular, 10, leftW) : [];
    const leftH =
      (kicker ? 16 : 0) +
      titleLines.length * size * 1.2 +
      (subtitleLines.length > 0 ? 4 + subtitleLines.length * 13 : 0);
    const height = Math.max(leftH, meta.length * 14, 36);
    ensure(height + 18);
    hasContent = true;

    let at = y;
    if (kicker) {
      heading(kicker, MARGIN, at);
      at -= 16;
    }
    for (const line of titleLines) {
      draw(line, MARGIN, at, bold, size, accent);
      at -= size * 1.2;
    }
    if (subtitleLines.length > 0) {
      at -= 4;
      for (const line of subtitleLines) {
        draw(line, MARGIN, at, regular, 10, MUTED);
        at -= 13;
      }
    }
    meta.forEach(([label, value], i) => {
      const top = y - i * 14;
      draw(value, right - width(value, bold, 9.5), top, bold, 9.5);
      draw(
        label,
        right - width(value, bold, 9.5) - 8 - width(label, regular, 9.5),
        top,
        regular,
        9.5,
        MUTED,
      );
    });
    y -= height + 18;
  };

  const lineStyle = (line: TextLine) =>
    line.style === 'strong'
      ? { font: bold, size: 11, color: INK, leading: 14 }
      : { font: regular, size: 9.5, color: line.style === 'plain' ? INK : MUTED, leading: 12.5 };

  const columns = (block: ColumnsBlock) => {
    const count = block.columns.length;
    if (count === 0) return;
    const gap = 24;
    const colW = (contentW - gap * (count - 1)) / count;
    const prepared = block.columns.map((column) => ({
      heading: column.heading,
      lines: column.lines
        .filter((line) => line.text.trim())
        .flatMap((line) => {
          const style = lineStyle(line);
          return wrap(line.text, style.font, style.size, colW).map((text) => ({ text, line }));
        }),
    }));
    const heights = prepared.map(
      (column) =>
        (column.heading ? 15 : 0) +
        column.lines.reduce((sum, { line }) => sum + lineStyle(line).leading, 0),
    );
    const height = Math.max(...heights);
    ensure(height + 22);
    hasContent = true;
    prepared.forEach((column, index) => {
      const x = MARGIN + index * (colW + gap);
      let at = y;
      if (column.heading) {
        heading(column.heading, x, at);
        at -= 15;
      }
      for (const { text, line } of column.lines) {
        const style = lineStyle(line);
        draw(text, x, at, style.font, style.size, style.color);
        at -= style.leading;
      }
    });
    y -= height + 22;
  };

  const facts = (block: FactsBlock) => {
    if (block.items.length === 0) return;
    const perRow = Math.min(6, Math.max(1, block.perRow ?? 3));
    const gap = 16;
    const cellW = (contentW - gap * (perRow - 1)) / perRow;
    if (block.heading) {
      ensure(15 + 32);
      hasContent = true;
      heading(block.heading, MARGIN, y);
      y -= 15;
    }
    for (let start = 0; start < block.items.length; start += perRow) {
      const row = block.items.slice(start, start + perRow);
      const values = row.map(([, value]) => wrap(value || '-', bold, 10, cellW));
      const height = 12 + Math.max(...values.map((v) => v.length)) * 13 + 6;
      ensure(height);
      hasContent = true;
      row.forEach(([label], index) => {
        const x = MARGIN + index * (cellW + gap);
        draw(label, x, y, regular, 8, MUTED);
        values[index].forEach((line, i) => draw(line, x, y - 12 - i * 13, bold, 10));
      });
      y -= height;
    }
    y -= 8;
  };

  const table = (block: TableBlock) => {
    const cols = block.columns;
    if (cols.length === 0) return;
    const fixed = cols.reduce((sum, c) => sum + (c.width ?? 0), 0);
    const weights = cols.reduce((sum, c) => sum + (c.width === undefined ? (c.weight ?? 1) : 0), 0);
    const flexW = contentW - fixed - COLUMN_GAP * (cols.length - 1);
    const widths = cols.map((c) =>
      c.width !== undefined ? c.width : Math.max(24, (flexW * (c.weight ?? 1)) / weights),
    );
    const xs = widths.map(
      (_, i) => MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0) + COLUMN_GAP * i,
    );
    const align = (i: number): Align => cols[i].align ?? 'left';

    const header = () => {
      cols.forEach((c, i) =>
        drawAligned(c.label.toUpperCase(), xs[i], widths[i], align(i), y, bold, 8, MUTED),
      );
      rule(y - 14, 1.2, accent);
      y -= 22;
    };

    if (block.heading) {
      ensure(15 + 22 + 25);
      hasContent = true;
      heading(block.heading, MARGIN, y);
      y -= 16;
    }
    ensure(22 + 25);
    hasContent = true;
    header();

    for (const row of block.rows) {
      const cells = cols.map((c, i) => wrap(row[i] ?? '', c.bold ? bold : regular, 10, widths[i]));
      const lines = Math.max(1, ...cells.map((c) => c.length));
      const height = lines * 13 + 12;
      if (y - height < bottom) {
        newPage();
        hasContent = true;
        header();
      }
      cells.forEach((cell, i) =>
        cell.forEach((line, li) =>
          drawAligned(
            line,
            xs[i],
            widths[i],
            align(i),
            y - 6 - li * 13,
            cols[i].bold ? bold : regular,
            10,
          ),
        ),
      );
      y -= height;
      rule(y, 0.5, RULE);
    }

    const footer = block.footer;
    if (footer && footer.some((cell) => cell.trim())) {
      if (y - 26 < bottom) {
        newPage();
        hasContent = true;
        header();
      }
      rule(y, 1.2, accent);
      footer.forEach((cell, i) => {
        if (i < cols.length) drawAligned(cell, xs[i], widths[i], align(i), y - 7, bold, 10);
      });
      y -= 26;
    }
    y -= 14;
  };

  const totals = (block: TotalsBlock) => {
    const left = right - 230;
    ensure(block.rows.length * 17 + (block.grand ? 40 : 6));
    hasContent = true;
    for (const [label, value] of block.rows) {
      draw(label, left, y, regular, 10, MUTED);
      draw(value, right - width(value, regular, 10), y, regular, 10);
      y -= 17;
    }
    if (block.grand) {
      const [label, value] = block.grand;
      rule(y - 2, 1.2, accent, left, right);
      y -= 9;
      draw(label, left, y, bold, 12);
      draw(value, right - width(value, bold, 14), y - 1, bold, 14, accent);
      y -= 28;
    }
    y -= 14;
  };

  const drawQr = (payload: string, caption: string | undefined, top: number) => {
    const qrSize = 96;
    try {
      const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
      const count = qr.modules.size;
      const quiet = 2; // modules of white around the code
      const cell = qrSize / (count + quiet * 2);
      const qx = right - qrSize;
      const qy = top - 4 - qrSize;
      page.drawRectangle({ x: qx, y: qy, width: qrSize, height: qrSize, color: rgb(1, 1, 1) });
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (!qr.modules.get(row, col)) continue;
          page.drawRectangle({
            x: qx + (col + quiet) * cell,
            y: qy + qrSize - (row + quiet + 1) * cell,
            width: cell + 0.15, // hairline overlap hides seams in some viewers
            height: cell + 0.15,
            color: INK,
          });
        }
      }
      if (caption?.trim()) {
        draw(caption, right - width(caption, regular, 8.5), qy - 4, regular, 8.5, MUTED);
      }
    } catch {
      warnings.push('The QR code was skipped: the payload is too long to encode.');
    }
  };

  const textBlock = (block: TextBlock) => {
    const font = block.mono ? mono : regular;
    const size = block.mono ? 9 : 9.5;
    const leading = block.mono ? 12 : 12.5;
    const color = block.muted ? MUTED : INK;
    const qrPayload = block.qr?.payload.trim() ?? '';
    const qrSize = 96;
    const textW = qrPayload ? contentW - qrSize - 24 : contentW;
    const lines = block.text.trim() ? wrap(block.text, font, size, textW) : [];
    const headH = block.heading ? 16 : 0;

    if (qrPayload) {
      const height = Math.max(qrSize + 24, headH + 2 + lines.length * leading);
      ensure(height);
      hasContent = true;
      if (block.heading) heading(block.heading, MARGIN, y);
      lines.forEach((line, i) => draw(line, MARGIN, y - headH - i * leading, font, size, color));
      drawQr(qrPayload, block.qr?.caption, y);
      y -= height + 16;
      return;
    }
    if (lines.length === 0) return;
    ensure(headH + leading * 2);
    hasContent = true;
    if (block.heading) {
      heading(block.heading, MARGIN, y);
      y -= headH;
    }
    for (const line of lines) {
      ensure(leading);
      draw(line, MARGIN, y, font, size, color);
      y -= leading;
    }
    y -= 14;
  };

  const run = (block: Block) => {
    switch (block.kind) {
      case 'title':
        return title(block);
      case 'columns':
        return columns(block);
      case 'facts':
        return facts(block);
      case 'table':
        return table(block);
      case 'totals':
        return totals(block);
      case 'text':
        return textBlock(block);
      case 'spacer':
        y -= block.height;
        return;
      case 'pageBreak':
        if (hasContent) newPage();
        return;
    }
  };
  for (const block of layout.blocks) run(block);

  // ---- Footer on every page ---------------------------------------------------------------
  pages.forEach((p, index) => {
    let label = flat(
      layout.footer
        .replaceAll('{page}', String(index + 1))
        .replaceAll('{pages}', String(pages.length)),
    );
    while (label.length > 1 && regular.widthOfTextAtSize(label, 8) > contentW) {
      label = `${label.slice(0, -4)}...`;
    }
    p.drawText(label, {
      x: (pageW - regular.widthOfTextAtSize(label, 8)) / 2,
      y: MARGIN - 20,
      font: regular,
      size: 8,
      color: MUTED,
    });
  });

  // ---- Metadata and the embedded config -----------------------------------------------------
  if (attachment) {
    await doc.attach(new TextEncoder().encode(attachment.json), attachment.name, {
      mimeType: 'application/json',
      description: attachment.description,
      afRelationship: AFRelationship.Data,
      creationDate: new Date(),
      modificationDate: new Date(),
    });
  }
  doc.setTitle(layout.title);
  doc.setAuthor(layout.author);
  if (layout.subject) doc.setSubject(layout.subject);
  doc.setCreator('toolkit pdf generator');
  doc.setProducer('toolkit (pdf-lib)');

  if (lossy.size > 0) {
    warnings.push(
      `Some characters can't be drawn with the built-in PDF font and were replaced with "?": ${[...lossy].slice(0, 12).join(' ')}`,
    );
  }
  return { bytes: await doc.save(), warnings };
}
