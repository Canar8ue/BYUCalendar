'use client';
import {useEffect, useState} from 'react';
import {ShieldCheck, LogOut, Plus, Flag} from 'lucide-react';
import AccountShell from '../account-shell';
import {postJSON, useAccount, getJSON} from '../account-client';

export default function AccountPage() {
  const {account, error: accountError} = useAccount();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState({loaded: false, optedIn: false, busy: false});
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
    getJSON<{digestOptedIn?: boolean}>('/api/preferences', 15000)
      .then(data => { if (active) setDigest({loaded: true, optedIn: Boolean(data.digestOptedIn), busy: false}); })
      .catch(() => { if (active) setDigest({loaded: true, optedIn: false, busy: false}); });
    return () => { active = false; };
  }, [account?.user]);
  async function toggleDigest(optedIn: boolean) {
    setDigest(current => ({...current, busy: true}));
    try {
      await postJSON('/api/preferences/digest', {optedIn}, 15000);
      setDigest({loaded: true, optedIn, busy: false});
    } catch (err) {
      setDigest(current => ({...current, busy: false}));
      setError(err instanceof Error ? err.message : 'Could not update the email digest setting.');
    }
  }
  const [deleting, setDeleting] = useState(false), [confirmText, setConfirmText] = useState('');
  async function deleteAccount() {
    setBusy(true);
    try {
      await postJSON('/api/account/delete', {confirm: confirmText}, 20000);
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account.');
      setBusy(false);
    }
  }
  return <AccountShell><section className="account-card account-single"><span className="account-icon"><ShieldCheck size={28}/></span><div className="eyebrow">YOUR ACCOUNT</div><h1>Made for <span>you.</span></h1>
    {(accountError || error) && <p className="form-error" role="alert">{accountError || error}</p>}
    {!account && !accountError && <p role="status">Loading your account…</p>}
    {account?.user ? <><p className="account-email">{account.user.email}</p><span className="community-badge">{account.permissions.addListings ? 'Verified BYU email' : 'Email verification required'}</span><p className="account-description">Your saved events and filters belong to this account. Verified members can publish listings, add tags, and report issues.</p><div className="account-actions"><a className="primary-button" href="/listings/new"><Plus size={16}/> Add a listing</a>{account.permissions.reviewReports && <a className="outline-button" href="/moderation"><Flag size={16}/> Review reports</a>}<button className="outline-button" disabled={busy} onClick={signOut}><LogOut size={16}/> {busy ? 'Signing out…' : 'Sign out'}</button></div>
      <div className="account-digest">
        <div className="eyebrow">DAILY EMAIL DIGEST</div>
        <p className="account-description">Once a morning between 7:00 and 10:00 AM Mountain Time, we email a summary of the events you saved for that day. It is off until you turn it on, and you can turn it off here or from any digest email.</p>
        <button className="outline-button" disabled={!digest.loaded || digest.busy} onClick={() => toggleDigest(!digest.optedIn)}>{digest.optedIn ? 'Turn off the daily digest' : 'Turn on the daily digest'}</button>
        {digest.loaded && digest.optedIn && <span className="community-badge">On</span>}
        {!digest.loaded && <p className="account-description" role="status">Checking your digest setting…</p>}
      </div>
      <div className="account-digest">
        <div className="eyebrow">DELETE YOUR ACCOUNT</div>
        <p className="account-description">Permanently deletes your account and everything it owns on our servers: saved events and filters, digest setting, picks profile, and the listings, tags, and reports you published. This cannot be undone. Type DELETE to confirm.</p>
        {!deleting ? (
          <button className="outline-button" onClick={() => setDeleting(true)}>Delete my account…</button>
        ) : (
          <div className="account-actions">
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm account deletion" style={{padding:'10px 12px',borderRadius:8,border:'1px solid var(--line,#d8dce2)',minWidth:140}}/>
            <button className="outline-button" disabled={busy || confirmText !== 'DELETE'} onClick={deleteAccount}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
            <button className="outline-button" disabled={busy} onClick={() => {setDeleting(false); setConfirmText('');}}>Cancel</button>
          </div>
        )}
      </div></> : account && <><p className="account-description">Sign in with your BYU email to save events and contribute.</p><a className="primary-button" href="/signin?returnTo=/account">Sign in</a></>}
  </section></AccountShell>;
}
