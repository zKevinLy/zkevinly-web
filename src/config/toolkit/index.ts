// The Toolkit section (/toolkit): small tools that run entirely in the browser.
// Each tool is a hand-written page at src/pages/toolkit/<slug>.astro; this list drives the
// Toolkit index cards and the tests that keep config and pages in sync.

export interface Tool {
  /** URL slug: the tool lives at /toolkit/<slug>. */
  slug: string;
  title: string;
  description: string;
  tags?: string[];
}

export const toolkit = {
  title: 'Toolkit',
  /** Section root. Also the nav link. */
  path: '/toolkit',
  description: 'Small tools that run entirely in your browser.',
  intro:
    'General-purpose tools I actually use. Everything runs locally on the page: nothing is uploaded, and your documents are never saved to the browser.',

  tools: [
    {
      slug: 'pdf',
      title: 'PDF generator',
      description:
        'Make clean PDFs from a form: invoices, multi-page service logs, or a fully custom document with your own table columns. Each PDF carries its data inside, so you can drop it back in later to edit and regenerate it.',
      tags: ['pdf', 'invoice', 'offline'],
    },
  ],
} satisfies {
  title: string;
  path: string;
  description: string;
  intro: string;
  tools: Tool[];
};

/** Public URL of a tool, e.g. "/toolkit/pdf". */
export const toolHref = (tool: Pick<Tool, 'slug'>): string => `${toolkit.path}/${tool.slug}`;
