// Run after building: node --test tests/worker.integration.mjs
// The real production Worker runs against an isolated, disposable D1 database.
// Resend is intercepted here; no messages are sent to any real inbox.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {Miniflare} from 'miniflare';

let mf, db, memberCookie, reviewerCookie, eventId;
const origin = 'http://localhost:8790';
const codes = new Map(); let ip = 1;
const sent = [];
const inboundSecret = 'whsec_' + Buffer.from('integration-inbound-secret').toString('base64');
before(async () => {
  mf = new Miniflare({
    modules: ['index.js', ...readdirSync('dist/server', {recursive: true}).filter(path => path !== 'index.js' && /\.m?js$/.test(path))].map(path => ({type: 'ESModule', path: 'dist/server/' + path.replaceAll('\\', '/')})),
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'], assets: {directory: 'dist/client', routerConfig: {has_user_worker: true}},
    bindings: {BETTER_AUTH_SECRET: 'isolated-worker-test-secret-not-for-production-123456789', BETTER_AUTH_URL: origin, RESEND_API_KEY: 'test-intercepted-no-network', AUTH_EMAIL_FROM: 'BYU Calendar <signin@auth.byucalendar.com>', RESEND_INBOUND_SECRET: inboundSecret, CALENDAR_ADMIN_EMAILS: 'reviewer@byu.edu'},
    outboundService: async request => {
      if (new URL(request.url).hostname === 'api.resend.com') {
        if (request.method === 'GET') return Response.json({text: 'Please delete my data from the calendar. Thanks, Citizen', html: '<p>Please delete my data.</p>'});
        const body = await request.json();
        if (body.to[0] === 'delivery-error@byu.edu') return Response.json({error: 'test failure'}, {status: 503});
        const code = body.text?.match(/code is (\d{6})/)?.[1];
        if (code) codes.set(body.to[0], code); else sent.push(body);
        return Response.json({id: 'test-email'});
      }
      return new Response('External requests disabled in integration tests.', {status: 503});
    },
  });
  db = await mf.getD1Database('DB');
  for (const file of ['0000_pink_scarlet_spider.sql', '0001_byu_accounts_community.sql', '0002_moderator_inbox.sql']) {
    const statements = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', '').split(';').map(s => s.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
});
after(async () => { await mf?.dispose(); });

test('the refresh endpoint rejects cross-site refresh posts', async () => {
  const blocked = await request('/api/refresh', null, '', {origin: 'https://evil.example', 'sec-fetch-site': 'cross-site'});
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).error, 'Origin mismatch');
  for (const headers of [
    {origin: 'https://untrusted.localhost', 'sec-fetch-site': 'same-site'},
    {origin: 'https://evil.example', 'sec-fetch-site': 'same-origin'},
    {origin: 'null'}, {origin: 'invalid origin'},
  ]) assert.equal((await request('/api/refresh', null, '', headers)).status, 403);
});

test('the built Worker applies browser security headers without blocking its campus iframe', async () => {
  for (const path of ['/', '/signin', '/account', '/api/account']) {
    const response = await request(path, null, '', {}, 'GET');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', path);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/, path);
    assert.match(response.headers.get('content-security-policy'), /object-src 'none'/, path);
  }
});

test('the built Worker invalidates pending signup verification after password recovery', async () => {
  const email = 'recovered-signup@byu.edu';
  assert.equal((await request('/api/auth/sign-up/email', {name: 'Recovery Test', email, password: 'first-password-123'})).status, 200);
  const staleOTP = codes.get(email);
  await db.prepare("DELETE FROM action_limits WHERE key LIKE 'email-minute:%'").run();
  assert.equal((await request('/api/auth/email-otp/request-password-reset', {email})).status, 200);
  assert.equal((await request('/api/auth/email-otp/reset-password', {email, otp: codes.get(email), password: 'new-password-123'})).status, 200);
  const stale = await request('/api/auth/email-otp/verify-email', {email, otp: staleOTP});
  assert.notEqual(stale.status, 200);
  assert.ok(!stale.headers.getSetCookie().some(value => value.includes('session_token=')));
  assert.equal((await request('/api/auth/sign-in/email', {email, password: 'new-password-123'})).status, 200);
});

function request(path, body, cookie = '', headers = {}, method = 'POST', rawBody) {
  return mf.dispatchFetch(origin + path, {method, headers: {origin, cookie, 'Content-Type': 'application/json', 'x-real-ip': `198.51.100.${ip++}`, ...headers}, ...(method === 'GET' && !rawBody ? {} : {body: rawBody ?? JSON.stringify(body)})});
}
async function login(email, password = 'worker-test-pass-123') {
  // Sign-up emails the verification code itself (the worker allows one send
  // per address per minute, so no second send happens here).
  const up = await request('/api/auth/sign-up/email', {name: 'Worker Test', email, password});
  assert.equal(up.status, 200, await up.text());
  const verified = await request('/api/auth/email-otp/verify-email', {email, otp: codes.get(email)});
  assert.equal(verified.status, 200, await verified.clone().text());
  assert.match(verified.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(verified.headers.get('set-cookie'), /SameSite=Lax/i);
  return verified.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}

test('the built Worker serves pages and enforces BYU permissions at every HTTP endpoint', async () => {
  for (const path of ['/', '/signin', '/account', '/listings/new', '/moderation']) assert.equal((await request(path, null, '', {}, 'GET')).status, 200, path);
  const signedOut = await (await request('/api/account', null, '', {}, 'GET')).json();
  assert.equal(signedOut.user, null); assert.equal(signedOut.permissions.addListings, false);
  for (const path of ['/api/listings', '/api/listings/tags', '/api/listings/reports']) {
    assert.equal((await request(path, {}, '', {'x-legacy-user-id': 'fake', 'x-legacy-user-email': 'fake@byu.edu'})).status, 401);
  }
  memberCookie = await login('member@student.byu.edu');
  reviewerCookie = await login('reviewer@byu.edu');
  const account = await (await request('/api/account', null, memberCookie, {}, 'GET')).json();
  assert.equal(account.permissions.addListings, true); assert.equal(account.permissions.reviewReports, false);
  assert.equal((await request('/api/moderation/reports', null, memberCookie, {}, 'GET')).status, 403);
  assert.equal((await request('/api/auth/sign-in/email-otp', {email: 'member@student.byu.edu', otp: '123456'})).status, 404);
  assert.equal((await request('/api/auth/sign-in/email', {email: 'member@student.byu.edu', password: 'wrong-password'})).status, 401);
  // A password account exists but its email was never verified: no session.
  const unverified = await request('/api/auth/sign-up/email', {name: 'Unverified', email: 'unverified@student.byu.edu', password: 'worker-test-pass-123'});
  assert.equal(unverified.status, 200, await unverified.text());
  assert.equal((await request('/api/auth/sign-in/email', {email: 'unverified@student.byu.edu', password: 'worker-test-pass-123'})).status, 403);
  // Delivery failures surface instead of claiming a code was sent.
  assert.equal((await request('/api/auth/sign-up/email', {name: 'Failing', email: 'delivery-error@byu.edu', password: 'worker-test-pass-123'})).status, 503);
});

test('the built Worker publishes a listing and tags, stores private reports, and isolates bookmarks', async () => {
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const input = {submissionId: crypto.randomUUID(), title: 'Integration campus gathering', organizer: 'Test club', description: 'Students meet to share ideas and learn together.', category: 'Campus life', location: 'WSC 201', url: 'https://clubs.byu.edu/', allDay: false, start: day + 'T18:00', end: ''};
  assert.equal((await request('/api/listings', input, memberCookie, {origin: 'https://evil.example'})).status, 403);
  const published = await request('/api/listings', input, memberCookie);
  assert.equal(published.status, 201, await published.clone().text());
  eventId = (await published.json()).event.id;
  const tag = await request('/api/listings/tags', {eventId, tag: 'IS', note: 'An Information Systems community event.'}, memberCookie);
  assert.equal(tag.status, 200, await tag.text());
  const report = await request('/api/listings/reports', {eventId, reason: 'Incorrect details', details: 'Private test report for a corrected room.'}, memberCookie);
  assert.equal(report.status, 200, await report.text());
  const calendar = await (await request('/api/events', null, '', {}, 'GET')).json();
  const event = calendar.events.find(e => e.id === eventId);
  assert.equal(event.community, true); assert.ok(event.tags.includes('IS'));
  assert.ok(!JSON.stringify(calendar).includes('Private test report'));
  assert.ok(!JSON.stringify(calendar).includes('member@student.byu.edu'));
  const saved = await request('/api/preferences', {saved: [eventId], views: []}, memberCookie, {}, 'PUT');
  assert.equal(saved.status, 200, await saved.text());
  assert.deepEqual((await (await request('/api/preferences', null, memberCookie, {}, 'GET')).json()).saved, [eventId]);
  assert.deepEqual((await (await request('/api/preferences', null, reviewerCookie, {}, 'GET')).json()).saved, []);
  const review = await (await request('/api/moderation/reports', null, reviewerCookie, {}, 'GET')).json();
  assert.equal(review.reports.length, 1);
  assert.equal((await request('/api/moderation/reports', {id: review.reports[0].id, action: 'hide'}, reviewerCookie)).status, 200);
  assert.ok(!(await (await request('/api/events', null, '', {}, 'GET')).json()).events.some(e => e.id === eventId));
  await request('/api/auth/sign-out', {}, memberCookie);
  assert.equal((await request('/api/listings', input, memberCookie)).status, 401);
});

test('the served single-event ICS hands off to native calendar apps', async () => {
  const calendar = await (await request('/api/events', null, '', {}, 'GET')).json();
  const event = calendar.events.find(e => e.end && !e.allDay);
  assert.ok(event, 'expected a timed event in the merged calendar');
  const served = await request('/api/events/ics?id=' + encodeURIComponent(event.id), null, '', {}, 'GET');
  assert.equal(served.status, 200);
  assert.match(served.headers.get('content-type'), /text\/calendar/);
  assert.match(served.headers.get('content-disposition'), /inline/);
  const body = await served.text();
  assert.match(body, /BEGIN:VCALENDAR/);
  assert.match(body, new RegExp('UID:' + event.id));
  assert.equal((await request('/api/events/ics?id=does-not-exist', null, '', {}, 'GET')).status, 404);
  assert.equal((await request('/api/events/ics', null, '', {}, 'GET')).status, 404);
});

test('the built Worker resets passwords through emailed codes and revokes old sessions', async () => {
  const email = 'resetter@student.byu.edu';
  const oldCookie = await login(email);
  // The real per-address send limit allows one email per minute; clear the
  // quota row so the reset code can be sent right after the sign-up code.
  await db.prepare("DELETE FROM action_limits WHERE key LIKE 'email-minute:%'").run();
  assert.equal((await request('/api/auth/email-otp/request-password-reset', {email})).status, 200);
  const reset = await request('/api/auth/email-otp/reset-password', {email, otp: codes.get(email), password: 'worker-test-pass-456'});
  assert.equal(reset.status, 200, await reset.text());
  const revoked = await (await request('/api/account', null, oldCookie, {}, 'GET')).json();
  assert.equal(revoked.user, null);
  assert.equal((await request('/api/auth/sign-in/email', {email, password: 'worker-test-pass-123'})).status, 401);
  assert.equal((await request('/api/auth/sign-in/email', {email, password: 'worker-test-pass-456'})).status, 200);
});

test('the built Worker receives privacy mail through the signed webhook and lets moderators reply', async () => {
  const inbox = 'privacy@byucalendar.com';
  const payloadData = {email_id: 'inbound-test-1', from: 'citizen@example.com', to: [inbox], subject: 'Privacy request', message_id: '<msg-1@example.com>', created_at: new Date().toISOString()};
  function signedWebhook(data, secret = inboundSecret) {
    const body = JSON.stringify({type: 'email.received', created_at: new Date().toISOString(), data});
    const id = 'msg_' + Math.random().toString(36).slice(2), timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signature = 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
    return request('/api/emails/inbound', null, '', {'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature, 'Content-Type': 'application/json'}, 'POST', body);
  }
  assert.equal((await request('/api/emails', null, '', {}, 'GET')).status, 401, 'inbox list requires sign-in');
  assert.equal((await request('/api/emails/inbound', {type: 'email.received', data: payloadData})).status, 401, 'unsigned webhook posts are rejected');
  assert.equal((await signedWebhook(payloadData, 'whsec_' + Buffer.from('wrong-secret').toString('base64'))).status, 401, 'wrong-secret webhook posts are rejected');
  memberCookie = memberCookie || await login('member@student.byu.edu');
  reviewerCookie = reviewerCookie || await login('reviewer@byu.edu');
  // An earlier test signs the shared member session out, so use a fresh
  // non-moderator account for the permission checks here.
  const inboxerCookie = await login('inboxer@student.byu.edu');
  assert.equal((await request('/api/emails', null, inboxerCookie, {}, 'GET')).status, 403, 'non-moderators cannot list the inbox');
  const stored = await signedWebhook(payloadData);
  assert.equal(stored.status, 200, await stored.clone().text());
  assert.equal((await stored.json()).received, true);
  assert.equal((await signedWebhook(payloadData)).status, 200, 'at-least-once replay succeeds');
  const skipped = await signedWebhook({...payloadData, email_id: 'inbound-test-2', to: ['other@byucalendar.com']});
  assert.deepEqual(await skipped.json(), {received: false}, 'mail for other addresses is acknowledged but not stored');
  const list = await (await request('/api/emails', null, reviewerCookie, {}, 'GET')).json();
  assert.equal(list.configured, true);
  assert.equal(list.inboxAddress, inbox);
  assert.equal(list.emails.length, 1, 'replays and other-recipient mail are not duplicated');
  const message = list.emails[0];
  assert.equal(message.fromAddress, 'citizen@example.com');
  assert.match(message.bodyText, /delete my data/);
  assert.equal(message.readAt, null);
  assert.equal((await request('/api/emails/reply', {id: message.id, body: 'Working on it.'}, inboxerCookie)).status, 403, 'non-moderators cannot reply');
  const reply = await request('/api/emails/reply', {id: message.id, body: '  We removed your data. Sorry for the trouble.  '}, reviewerCookie);
  assert.equal(reply.status, 200, await reply.clone().text());
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to[0], 'citizen@example.com');
  assert.match(sent[0].from, /privacy@byucalendar\.com/);
  assert.equal(sent[0].subject, 'Re: Privacy request');
  assert.equal(sent[0].headers['In-Reply-To'], '<msg-1@example.com>');
  assert.match(sent[0].text, /We removed your data/);
  assert.equal((await request('/api/emails/reply', {id: 'missing-id', body: 'hi'}, reviewerCookie)).status, 404);
  assert.equal((await request('/api/emails/read', {id: message.id}, reviewerCookie)).status, 200);
  const after = await (await request('/api/emails', null, reviewerCookie, {}, 'GET')).json();
  assert.equal(after.emails.length, 1);
  assert.ok(after.emails[0].readAt, 'read marker stored');
  assert.ok(after.emails[0].repliedAt, 'replied marker stored');
  assert.equal(after.emails[0].replies.length, 1);
  assert.equal(after.emails[0].replies[0].sentBy, 'reviewer@byu.edu');
  assert.match(after.emails[0].replies[0].bodyText, /We removed your data/);
});

test('the built Worker lets authors update and delete only their own listings', async () => {
  const authorCookie = await login('editor@student.byu.edu');
  const otherCookie = await login('other@student.byu.edu');
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const input = {submissionId: crypto.randomUUID(), title: 'Editable campus gathering', organizer: 'Editor club', description: 'Students meet to share ideas and learn together.', category: 'Campus life', location: 'WSC 202', url: 'https://clubs.byu.edu/', allDay: false, start: day + 'T18:00', end: ''};
  const created = await request('/api/listings', input, authorCookie);
  const createdBody = await created.json();
  assert.equal(created.status, 201, JSON.stringify(createdBody));
  const id = createdBody.event.id;

  assert.equal((await request('/api/listings/mine', null, '', {}, 'GET')).status, 401);
  const mine = await (await request('/api/listings/mine', null, authorCookie, {}, 'GET')).json();
  assert.ok(mine.listings.some(e => e.id === id));
  assert.ok(!(await (await request('/api/listings/mine', null, otherCookie, {}, 'GET')).json()).listings.some(e => e.id === id));

  const fields = {id, title: 'Edited campus gathering', organizer: 'Editor club', description: 'Students meet to share ideas and learn together. Now with updates.', category: 'Campus life', location: 'WSC 203', url: 'https://clubs.byu.edu/', start: day + 'T18:00', end: '', allDay: false};
  assert.equal((await request('/api/listings/update', fields, otherCookie)).status, 403);
  const update = await request('/api/listings/update', fields, authorCookie);
  assert.equal(update.status, 200, await update.text());
  const calendar = await (await request('/api/events', null, '', {}, 'GET')).json();
  const edited = calendar.events.find(e => e.id === id);
  assert.equal(edited.title, 'Edited campus gathering');
  assert.equal(edited.location, 'WSC 203');

  assert.equal((await request('/api/listings/delete', {id}, otherCookie)).status, 403);
  assert.equal((await request('/api/listings/delete', {id}, authorCookie)).status, 200);
  assert.ok(!((await (await request('/api/events', null, '', {}, 'GET')).json()).events.some(e => e.id === id)));
  assert.ok(!(await (await request('/api/listings/mine', null, authorCookie, {}, 'GET')).json()).listings.some(e => e.id === id));
});
