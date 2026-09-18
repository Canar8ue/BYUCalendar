'use client';
import {useState} from 'react';
import {ShieldCheck, LogOut, Plus, Flag} from 'lucide-react';
import AccountShell from '../account-shell';
import {postJSON, useAccount} from '../account-client';

export default function AccountPage() {
  const {account, error: accountError} = useAccount();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    // A full navigation discards the previous account's client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    try { await postJSON('/api/auth/sign-out', {}); window.location.assign('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out.'); setBusy(false); }
  }
  return <AccountShell><section className="account-card account-single"><span className="account-icon"><ShieldCheck size={28}/></span><div className="eyebrow">YOUR ACCOUNT</div><h1>Made for <span>you.</span></h1>
    {(accountError || error) && <p className="form-error" role="alert">{accountError || error}</p>}
    {!account && !accountError && <p role="status">Loading your account…</p>}
    {account?.user ? <><p className="account-email">{account.user.email}</p><span className="community-badge">{account.permissions.addListings ? 'Verified BYU email' : 'Email verification required'}</span><p className="account-description">Your saved events and filters belong to this account. Verified members can publish listings, add tags, and report issues.</p><div className="account-actions"><a className="primary-button" href="/listings/new"><Plus size={16}/> Add a listing</a>{account.permissions.reviewReports && <a className="outline-button" href="/moderation"><Flag size={16}/> Review reports</a>}<button className="outline-button" disabled={busy} onClick={signOut}><LogOut size={16}/> {busy ? 'Signing out…' : 'Sign out'}</button></div></> : account && <><p className="account-description">Sign in with your BYU email to save events and contribute.</p><a className="primary-button" href="/signin?returnTo=/account">Sign in</a></>}
  </section></AccountShell>;
}
