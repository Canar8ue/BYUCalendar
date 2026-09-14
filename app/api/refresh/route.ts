import {refreshCalendar} from '../../../lib/calendar-server';
export const dynamic='force-dynamic';
export async function POST(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin mismatch'},{status:403});try{const force=new URL(request.url).searchParams.get('force')==='1';return Response.json(await refreshCalendar(force));}catch(error){console.error(error);return Response.json({error:'Refresh is temporarily unavailable. Your saved event listings are still available.'},{status:503});}}
