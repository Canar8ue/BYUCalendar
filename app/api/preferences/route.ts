import {z} from 'zod';
import {database} from '../../../db';
import {readAccount, authConfiguration} from '../../../lib/auth';
import {isVerifiedBYUUser} from '../../../lib/account-policy.mjs';
import {requireContributor} from '../../../lib/community-store.mjs';
import {readDigestOptIn} from '../../../lib/reminders-server';
import {json, readJSON, requireSameOrigin, errorResponse, RequestError} from '../../../lib/http.mjs';
export const dynamic = 'force-dynamic';
const list = z.array(z.string().max(250));
const preferenceSchema = z.object({saved: list.max(2000), views: z.array(z.object({id: z.string().max(100), name: z.string().trim().min(1).max(60), query: z.string().max(500), tags: list.max(50), categories: list.max(20)}).strict()).max(30)}).strict();

export async function GET(request: Request) {
  try {
    const {user} = await readAccount(request);
    if (!user || !isVerifiedBYUUser(user)) return json({saved: [], views: [], digestOptedIn: false, signedIn: false});
    const db = database();
    const [row, digestOptedIn] = await Promise.all([
      db.prepare('SELECT payload FROM user_preferences WHERE user_id=?').bind(user.id).first<{payload: string}>(),
      readDigestOptIn(user.id),
    ]);
    return json({...row ? JSON.parse(row.payload) : {saved: [], views: []}, digestOptedIn, signedIn: true});
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = requireContributor(await readAccount(request));
    requireSameOrigin(request, authConfiguration().origin);
    const result = preferenceSchema.safeParse(await readJSON(request, 50000));
    if (!result.success) throw new RequestError(400, 'Invalid saved calendar.');
    await database().prepare('INSERT INTO user_preferences(user_id,payload) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload').bind(user.id, JSON.stringify(result.data)).run();
    return json({ok: true});
  } catch (error) { return errorResponse(error); }
}
