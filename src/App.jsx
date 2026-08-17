import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './AuthScreen';
import JobTracker from './JobTracker';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F1115', color: '#8B93A1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif', fontSize: 14
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return <JobTracker user={user} onSignOut={() => signOut(auth)} />;
}
