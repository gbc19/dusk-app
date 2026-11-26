import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { BackendClient } from './client';

export function AccountPanel({ client }: { client: BackendClient }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'signup' | 'recovery'>('signup');
  const [recovering, setRecovering] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('Restoring session…');

  useEffect(() => {
    let alive = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, value) => {
      if (alive) { setSession(value); setAccount(null); if (event === 'SIGNED_OUT') setRecovering(false); }
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (alive) { setSession(error ? null : data.session); setBusy(false); setNotice(error ? 'Session unavailable. Sign in again.' : ''); }
    });
    const resume = () => {
      if (document.visibilityState === 'hidden') client.auth.stopAutoRefresh();
      else { client.auth.startAutoRefresh(); void client.auth.getSession().then(({ error }) => {
        if (alive && error) { setSession(null); setAccount(null); setNotice('Session expired. Sign in again.'); }
      }); }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    resume();
    return () => { alive = false; subscription.unsubscribe(); client.auth.stopAutoRefresh(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, [client]);

  // Keep network calls outside the Auth callback to avoid refresh locks. Validate identity on the server.
  useEffect(() => {
    let alive = true;
    if (session) void (async () => {
      const user = await client.auth.getUser();
      if (user.error || !user.data.user?.email_confirmed_at) {
        if (alive) { setAccount(null); setNotice('Session unavailable. Sign out and sign in again.'); }
        return;
      }
      const result = await client.rpc('ensure_account', {});
      if (alive) {
        setAccount(result.error ? null : result.data);
        if (result.error) setNotice('Account unavailable. Access remains restricted.');
      }
    })();
    return () => { alive = false; };
  }, [client, session?.access_token]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch { setNotice('Unable to complete this request. Check your details or try again later.'); }
    finally { setBusy(false); setPassword(''); setCode(''); }
  }
  function credentials() { if (!email.trim() || !password) throw new Error('Missing credentials'); }
  return <details className="backend-account">
    <summary>Local test account</summary>
    <p>Synthetic accounts only. Browsing does not require an account. No offers can be redeemed.</p>
    <p>Web sessions last for this tab. Android sessions stay in memory and end when the app reloads.</p>
    {session ? <>
      <p>{account ? 'Signed in. Customer account available.' : 'Checking customer account…'}</p>
      <button disabled={busy} onClick={() => void perform(async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        // Pinned SDK removes the local session before attempting server revocation.
        setSession(null); setAccount(null); setRecovering(false);
        if (error) setNotice('Signed out locally. Server revocation could not be confirmed.');
        else setNotice('Signed out.');
      })}>Sign out</button>
    </> : <>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <div className="backend-actions">
        <button disabled={busy} onClick={() => void perform(async () => {
          credentials(); const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw error; setNotice('Signed in.');
        })}>Sign in</button>
        <button disabled={busy} onClick={() => void perform(async () => {
          credentials(); if (password.length < 12) { setNotice('Use at least 12 characters.'); return; }
          const { error } = await client.auth.signUp({ email: email.trim(), password });
          if (error) throw error; setKind('signup'); setNotice('If eligible, a verification code is in local test mail.');
        })}>Register test account</button>
        <button disabled={busy} onClick={() => void perform(async () => {
          if (!email.trim()) throw new Error('Missing email');
          const { error } = await client.auth.resetPasswordForEmail(email.trim());
          if (error) throw error; setKind('recovery'); setNotice('If the account exists, a recovery code is in local test mail.');
        })}>Recover password</button>
      </div>
      <label>Code purpose<select value={kind} onChange={e => setKind(e.target.value as typeof kind)} disabled={busy}>
        <option value="signup">Email verification</option><option value="recovery">Password recovery</option>
      </select></label>
      <label>Email code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} disabled={busy} /></label>
      <button disabled={busy} onClick={() => void perform(async () => {
        if (!/^\d{6,10}$/.test(code)) throw new Error('Invalid code');
        const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code, type: kind });
        if (error) throw error; setRecovering(kind === 'recovery'); setNotice('Email code verified.');
      })}>Verify email code</button>
    </>}
    {recovering && session && <>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
      <button disabled={busy} onClick={() => void perform(async () => {
        if (password.length < 12) { setNotice('Use at least 12 characters.'); return; }
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await client.auth.signOut({ scope: 'local' }); setRecovering(false); setSession(null); setAccount(null);
        setNotice('Password updated. Sign in with your new password.');
      })}>Set new password</button>
    </>}
    <p role="status" aria-live="polite">{busy ? 'Please wait…' : notice}</p>
  </details>;
}
