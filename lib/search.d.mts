import type {CampusEvent} from '../app/types';
export type SearchIntent={tags:string[];labels:string[];start:string|null;end:string|null;after:number|null;words:string[]};
export function dayKey(date:Date):string;
export function parseSearch(query:string,now?:Date):SearchIntent;
export function matchesEvent(event:CampusEvent,query:string|SearchIntent,categories?:string[],tags?:string[],now?:Date):boolean;
export function exportICS(events:CampusEvent[]):string;
