import { getPage, savePage } from '../../_lib/page-api.js';
export const onRequestGet=context=>getPage(context);
export const onRequestPut=context=>savePage(context,false);
