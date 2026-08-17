import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from './firebase';

export default function AuthScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!email) { setError('Enter your email above first.'); return; }
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    }
  }

  function friendlyError(code) {
    const map = {
      'auth/invalid-email': 'That email address looks invalid.',
      'auth/user-not-found': 'No account found with that email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/email-already-in-use': 'An account already exists with that email — try signing in instead.',
      'auth/weak-password': 'Password should be at least 6 characters.'
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  return (
    <div className="auth-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');
        .auth-root { min-height: 100vh; background: #0F1115; color: #EDEFF3; display: flex;
          align-items: center; justify-content: center; font-family: 'Inter', sans-serif; padding: 20px; box-sizing: border-box; }
        .auth-card { background: #171B22; border: 1px solid #262B35; border-radius: 14px; padding: 32px; width: 100%; max-width: 380px; }
        .auth-title { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; margin: 0 0 4px 0; }
        .auth-sub { color: #8B93A1; font-size: 13px; margin: 0 0 22px 0; }
        .auth-field { margin-bottom: 12px; }
        .auth-field label { display: block; font-size: 11px; color: #8B93A1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
        .auth-field input { width: 100%; background: #1D222B; border: 1px solid #262B35; color: #EDEFF3;
          padding: 10px 12px; border-radius: 7px; font-size: 14px; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        .auth-field input:focus { outline: none; border-color: #5B8DEF; }
        .auth-submit { width: 100%; background: #5B8DEF; color: #0F1115; border: none; padding: 11px; border-radius: 7px;
          font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        .auth-submit:disabled { opacity: 0.6; cursor: default; }
        .auth-toggle { text-align: center; margin-top: 16px; font-size: 13px; color: #8B93A1; }
        .auth-toggle button { background: none; border: none; color: #5B8DEF; font-size: 13px; cursor: pointer; padding: 0; font-family: 'Inter', sans-serif; }
        .auth-error { background: rgba(240,85,107,0.12); color: #F0556B; font-size: 12.5px; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; }
        .auth-reset { text-align: center; margin-top: 10px; }
        .auth-reset button { background: none; border: none; color: #8B93A1; font-size: 12px; cursor: pointer; text-decoration: underline; font-family: 'Inter', sans-serif; }
      `}</style>
      <div className="auth-card">
        <h1 className="auth-title">Job Search Command Center</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Sign in to sync your applications across devices.' : 'Create an account to get started.'}</p>

        {error && <div className="auth-error">{error}</div>}
        {resetSent && <div className="auth-error" style={{ background: 'rgba(45,212,191,0.12)', color: '#2DD4BF' }}>Password reset email sent — check your inbox.</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="auth-reset">
            <button onClick={handleReset}>Forgot password?</button>
          </div>
        )}

        <div className="auth-toggle">
          {mode === 'signin' ? (
            <>New here? <button onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
