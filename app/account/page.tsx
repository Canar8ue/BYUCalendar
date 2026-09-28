'use client';
import {useEffect, useState} from 'react';
import {ShieldCheck, LogOut, Plus, Flag} from 'lucide-react';
import AccountShell from '../account-shell';
import {postJSON, useAccount, getJSON} from '../account-client';

export default function AccountPage() {
  const {account, error: accountError} = useAccount();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState({loaded: false, optedOut: false, busy: false});
  async function signOut() {
    setBusy(true);
    // A full navigation discards the previous account's client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    try { await postJSON('/api/auth/sign-out', {}); window.location.assign('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out.'); setBusy(false); }
  }
  useEffect(() => {
    if (!account?.user) return;
    let active = true;
    getJSON<{digestOptedOut?: boolean}>('/api/preferences', 15000)
      .then(data => { if (active) setDigest({loaded: true, optedOut: Boolean(data.digestOptedOut), busy: false}); })
      .catch(() => { if (active) setDigest({loaded: true, optedOut: false, busy: false}); });
    return () => { active = false; };
  }, [account?.user]);
  async function toggleDigest(optedOut: boolean) {
    setDigest(current => ({...current, busy: true}));
    try {
      await postJSON('/api/preferences/digest', {optedOut}, 15000);
      setDigest({loaded: true, optedOut, busy: false});
    } catch (err) {
      setDigest(current => ({...current, busy: false}));
      setError(err instanceof Error ? err.message : 'Could not update the email digest setting.');
    }
  }
  return <AccountShell><section className="account-card account-single"><span className="account-icon"><ShieldCheck size={28}/></span><div className="eyebrow">YOUR ACCOUNT</div><h1>Made for <span>you.</span></h1>
    {(accountError || error) && <p className="form-error" role="alert">{accountError || error}</p>}
    {!account && !accountError && <p role="status">Loading your account…</p>}
    {account?.user ? <><p className="account-email">{account.user.email}</p><span className="community-badge">{account.permissions.addListings ? 'Verified BYU email' : 'Email verification required'}</span><p className="account-description">Your saved events and filters belong to this account. Verified members can publish listings, add tags, and report issues.</p><div className="account-actions"><a className="primary-button" href="/listings/new"><Plus size={16}/> Add a listing</a>{account.permissions.reviewReports && <a className="outline-button" href="/moderation"><Flag size={16}/> Review reports</a>}<button className="outline-button" disabled={busy} onClick={signOut}><LogOut size={16}/> {busy ? 'Signing out…' : 'Sign out'}</button></div>
      <div className="account-digest">
        <div className="eyebrow">DAILY EMAIL DIGEST</div>
        <p className="account-description">Once a morning at 7:00 AM Mountain Time, we email a summary of the events you saved for that day. You can turn it off here or from the unsubscribe link in any digest email.</p>
        <button className="outline-button" disabled={!digest.loaded || digest.busy} onClick={() => toggleDigest(!digest.optedOut)}>{digest.optedOut ? 'Turn the daily digest back on' : 'Turn off the daily digest'}</button>
        {!digest.loaded && <p className="account-description" role="status">Checking your digest setting…</p>}
      </div></> : account && <><p className="account-description">Sign in with your BYU email to save events and contribute.</p><a className="primary-button" href="/signin?returnTo=/account">Sign in</a></>}
  </section></AccountShell>;
}
