// Loads the heavy PDF code (pdf-lib and the QR encoder) the first time a PDF is built or read,
// not when the page opens: about 190 KB gzipped less JavaScript up front.
//
// This file is left out of the coverage report (see `test:ci`): the tests go through these two
// lines whenever they build or read a PDF, but V8 cannot attribute a dynamic import() to its
// line, so it would show up as a gap that no test can close.

export const loadRender = () => import('./render');
export const loadEmbedded = () => import('./embedded');
