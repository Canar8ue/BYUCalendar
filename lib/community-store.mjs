import {addCommunityData, parseListing, parseListingEdit, parseTag, parseReport, parseReview} from './community.mjs';
import {isVerifiedBYUUser} from './account-policy.mjs';
import {RequestError} from './http.mjs';

export async function consumeQuota(db, key, max, seconds, now = Date.now()) {
  // An atomic conditional upsert prevents concurrent requests from exceeding the quota.
  const row = await db.prepare(`INSERT INTO action_limits(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at<=? OR count<? RETURNING count`).bind(key, now + seconds * 1000, now, now, now, max).first();
  return Boolean(row);
}

export async function communityCalendar(db, events) {
  const [listings, tags, moderation] = await Promise.all([
    db.prepare('SELECT payload FROM community_listings').all(),
    db.prepare('SELECT id,event_id,tag,note FROM community_tags ORDER BY created_at').all(),
    db.prepare('SELECT event_id FROM listing_moderation WHERE hidden=1').all(),
  ]);
  return addCommunityData(events, listings.results.map(row => JSON.parse(row.payload)), tags.results, moderation.results.map(row => row.event_id));
}

export function requireContributor(account) {
  if (!account.user) throw new RequestError(401, 'Sign in with your BYU email to contribute.');
  if (!isVerifiedBYUUser(account.user)) throw new RequestError(403, 'Verify your BYU email before contributing.');
  return account.user;
}

async function quota(db, userId, kind, max) {
  if (!await consumeQuota(db, `${kind}:${userId}`, max, 86400)) throw new RequestError(429, 'You have reached today’s limit for this action. Please try again tomorrow.');
  await db.prepare('DELETE FROM action_limits WHERE expires_at<?').bind(Date.now() - 86400000).run();
}

export async function publishListing(db, account, input) {
  const user = requireContributor(account), event = parseListing(input);
  const previous = await db.prepare('SELECT user_id,payload FROM community_listings WHERE id=?').bind(event.id).first();
  if (previous) {
    if (previous.user_id !== user.id) throw new RequestError(409, 'This submission ID has already been used.');
    return JSON.parse(previous.payload);
  }
  await quota(db, user.id, 'listings', 10);
  await db.prepare('INSERT INTO community_listings(id,user_id,payload,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(event.id, user.id, JSON.stringify(event), new Date().toISOString()).run();
  return event;
}

// Resolves an id to the signed-in author's own listing row, or fails closed.
async function ownListing(db, account, id) {
  const user = requireContributor(account);
  if (typeof id !== 'string' || !id || id.length > 250) throw new RequestError(400, 'Check your submission.');
  const row = await db.prepare('SELECT id,user_id FROM community_listings WHERE id=?').bind(id).first();
  if (!row) throw new RequestError(404, 'This listing is no longer available.');
  if (row.user_id !== user.id) throw new RequestError(403, 'You can only change listings you submitted.');
  return {user, id: row.id};
}

export async function updateListing(db, account, input) {
  const data = parseListingEdit(input);
  const {user, id} = await ownListing(db, account, data.id);
  // Re-run full listing validation and classification under the original id,
  // so the event keeps its identity (tags/reports/moderation stay attached).
  const submissionId = id.startsWith('community:') ? id.slice('community:'.length) : '';
  const fields = {...data};
  delete fields.id;
  const event = parseListing({...fields, submissionId});
  await quota(db, user.id, 'listing-edits', 30);
  await db.prepare('UPDATE community_listings SET payload=? WHERE id=? AND user_id=?').bind(JSON.stringify(event), id, user.id).run();
  return event;
}

export async function deleteListing(db, account, input) {
  const {id, user} = await ownListing(db, account, input?.id);
  // D1 batches are atomic. Recheck ownership inside every delete in case the
  // original row was deleted and its public submission ID reused meanwhile.
  const results = await db.batch([
    ...['community_tags', 'listing_reports', 'listing_moderation'].map(table =>
      db.prepare(`DELETE FROM ${table} WHERE event_id=? AND EXISTS (SELECT 1 FROM community_listings WHERE id=? AND user_id=?)`).bind(id, id, user.id)),
    db.prepare('DELETE FROM community_listings WHERE id=? AND user_id=?').bind(id, user.id),
  ]);
  if (!results.at(-1).meta.changes) throw new RequestError(409, 'This listing changed. Reload the calendar before trying again.');
  return {ok: true};
}

export async function readMyListings(db, account) {
  const user = requireContributor(account);
  const {results} = await db.prepare('SELECT payload FROM community_listings WHERE user_id=? ORDER BY created_at').bind(user.id).all();
  return results.map(row => JSON.parse(row.payload));
}

export async function publishTag(db, account, input, findEvent) {
  const user = requireContributor(account), data = parseTag(input);
  const event = await findEvent(data.eventId);
  if (!event) throw new RequestError(404, 'This listing is no longer available.');
  if (event.tags.includes(data.tag)) return {alreadyAdded: true};
  await quota(db, user.id, 'tags', 50);
  await db.prepare('INSERT INTO community_tags(id,event_id,tag,note,user_id,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(event_id,tag) DO NOTHING')
    .bind(crypto.randomUUID(), data.eventId, data.tag, data.note, user.id, new Date().toISOString()).run();
  return {alreadyAdded: false};
}

export async function submitReport(db, account, input, findEvent) {
  const user = requireContributor(account), data = parseReport(input);
  const event = await findEvent(data.eventId);
  if (!event) throw new RequestError(404, 'This listing is no longer available.');
  const existing = await db.prepare('SELECT id FROM listing_reports WHERE event_id=? AND user_id=?').bind(data.eventId, user.id).first();
  if (existing) return {id: existing.id, alreadyReported: true};
  await quota(db, user.id, 'reports', 20);
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO listing_reports(id,event_id,user_id,reason,details,event_snapshot,status,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(event_id,user_id) DO NOTHING')
    .bind(id, data.eventId, user.id, data.reason, data.details, JSON.stringify(event), 'open', new Date().toISOString()).run();
  return {id, alreadyReported: false};
}

function requireReviewer(account) {
  const user = requireContributor(account);
  if (!account.permissions.reviewReports) throw new RequestError(403, 'Report review is available to calendar administrators.');
  return user;
}

export async function readReports(db, account) {
  requireReviewer(account);
  const {results} = await db.prepare(`SELECT r.*,COALESCE(m.hidden,0) AS hidden FROM listing_reports r
    LEFT JOIN listing_moderation m ON m.event_id=r.event_id
    ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`).all();
  return results.map(row => ({id: row.id, eventId: row.event_id, reason: row.reason, details: row.details, status: row.status, createdAt: row.created_at, hidden: Boolean(row.hidden), event: JSON.parse(row.event_snapshot)}));
}

export async function reviewReport(db, account, input) {
  const user = requireReviewer(account), data = parseReview(input);
  const report = await db.prepare('SELECT event_id FROM listing_reports WHERE id=?').bind(data.id).first();
  if (!report) throw new RequestError(404, 'Report not found.');
  const now = new Date().toISOString();
  const statements = [db.prepare('UPDATE listing_reports SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?').bind(data.action === 'dismiss' ? 'dismissed' : 'resolved', now, user.id, data.id)];
  if (data.action === 'hide' || data.action === 'restore') statements.push(db.prepare(`INSERT INTO listing_moderation(event_id,hidden,reviewed_by,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(event_id) DO UPDATE SET hidden=excluded.hidden,reviewed_by=excluded.reviewed_by,updated_at=excluded.updated_at`).bind(report.event_id, data.action === 'hide' ? 1 : 0, user.id, now));
  if (data.action === 'clear-tags') statements.push(db.prepare('DELETE FROM community_tags WHERE event_id=?').bind(report.event_id));
  await db.batch(statements);
  return {ok: true};
}
