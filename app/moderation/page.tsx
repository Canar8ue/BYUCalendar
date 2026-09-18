'use client';
import {useCallback, useEffect, useState} from 'react';
import AccountShell from '../account-shell';
import {postJSON, useAccount} from '../account-client';
import type {ListingReport} from '../types';

export default function ModerationPage() {
  const {account, error: accountError} = useAccount();
  const [reports, setReports] = useState<ListingReport[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch('/api/moderation/reports', {cache: 'no-store'}); if (!r.ok) throw new Error('Reports could not be loaded.'); setReports((await r.json() as {reports: ListingReport[]}).reports); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load reports.'); }
  }, []);
  useEffect(() => {
    if (!account?.permissions.reviewReports) return;
    let active = true;
    fetch('/api/moderation/reports', {cache: 'no-store'})
      .then(async r => { if (!r.ok) throw new Error('Reports could not be loaded.'); return r.json() as Promise<{reports: ListingReport[]}>; })
      .then(data => { if (active) setReports(data.reports); })
      .catch(() => { if (active) setError('Reports could not be loaded.'); });
    return () => { active = false; };
  }, [account]);
  async function review(id: string, action: string) {
    setBusy(true); setError('');
    try { await postJSON('/api/moderation/reports', {id, action}); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not review this report.'); }
    finally { setBusy(false); }
  }
  return <AccountShell><section className="account-card moderation-card"><div className="eyebrow">COMMUNITY CARE</div><h1>Review <span>reports.</span></h1><p className="account-description">Private reports from verified members. Open reports appear first; up to 100 recent reports are shown.</p><p className="moderator-nav"><span className="moderator-nav-current">Review reports</span><span aria-hidden>·</span><a className="text-button" href="/moderation/emails">Message inbox</a></p>{(accountError || error) && <p className="form-error" role="alert">{accountError || error}</p>}{!account && !accountError && <p>Loading your account…</p>}{account && !account.permissions.reviewReports && <p>This page is available to calendar administrators. <a className="text-button" href="/account">View your account</a></p>}{account?.permissions.reviewReports && <>{reports === null ? <p>Loading reports…</p> : !reports.length ? <p>No reports yet.</p> : reports.map(report => <article className="report-card" key={report.id}><div className="report-status"><span className="community-badge">{report.status}</span><small>{new Date(report.createdAt).toLocaleDateString()}{report.hidden && ' · Listing hidden'}</small></div><h2>{report.event.title}</h2><p><b>{report.reason}</b></p><p className="description">{report.details}</p><a className="text-button" href={report.event.url} target="_blank" rel="noreferrer">View original listing ↗</a><div className="account-actions">{report.status === 'open' && <button disabled={busy} className="outline-button" onClick={() => review(report.id, 'dismiss')}>Dismiss report</button>}<button disabled={busy} className="outline-button" onClick={() => review(report.id, report.hidden ? 'restore' : 'hide')}>{report.hidden ? 'Restore listing' : 'Hide listing'}</button><button disabled={busy} className="outline-button" onClick={() => review(report.id, 'clear-tags')}>Remove community tags</button></div></article>)}</>}</section></AccountShell>;
}
