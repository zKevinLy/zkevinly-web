// The registry: every document type the tool can make. Adding a type is one file in this
// folder plus one line here. The order is the order of the type switcher on the page.

import type { AnyDocType } from '../doctype';
import { custom } from './custom';
import { invoice } from './invoice';
import { serviceLog } from './service-log';

export const docTypes: readonly AnyDocType[] = [invoice, serviceLog, custom];

export const DEFAULT_TYPE = invoice.id;

export const getType = (id: string): AnyDocType | undefined => docTypes.find((t) => t.id === id);

/** What the page needs to draw the type switcher, without pulling in the form schemas. */
export const typeList = docTypes.map(({ id, label, description }) => ({ id, label, description }));
