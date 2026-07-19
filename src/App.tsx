import { useEffect, useState } from 'react';
import Login from './screens/Login';
import Home from './screens/Home';
import VirtualKeys from './screens/VirtualKeys';
import Activity from './screens/Activity';
import EntryPin from './screens/EntryPin';
import Account from './screens/Account';
import Messages from './screens/Messages';
import IncomingCall from './screens/IncomingCall';
import { getToken, api, type ResidentMe } from './api/client';
import './styles.css';

type View = 'home' | 'virtual-keys' | 'activity' | 'entry-pin' | 'account' | 'messages';

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = still checking
  const [view, setView] = useState<View>('home');
  const [me, setMe] = useState<ResidentMe | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((token) => setLoggedIn(!!token));
  }, []);

  async function refreshMe() {
    try {
      const result = await api.getMe();
      setMe(result);
      setMeError(null);
    } catch (err) {
      setMeError(err instanceof Error ? err.message : 'Failed to load account');
    }
  }

  useEffect(() => {
    if (loggedIn) refreshMe();
  }, [loggedIn]);

  if (loggedIn === null) {
    return <div className="screen center"><p className="muted">Loading…</p></div>;
  }

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }

  function handleLoggedOut() {
    setLoggedIn(false);
    setMe(null);
    setView('home');
  }

  return (
    <>
      {view === 'home' && (
        <Home
          me={me}
          error={meError}
          onLoggedOut={handleLoggedOut}
          onOpenVirtualKeys={() => setView('virtual-keys')}
          onOpenMessages={() => setView('messages')}
          onOpenEntryPin={() => setView('entry-pin')}
          onOpenAccount={() => setView('account')}
        />
      )}
      {view === 'virtual-keys' && <VirtualKeys onBack={() => setView('home')} />}
      {view === 'activity' && <Activity onBack={() => setView('account')} />}
      {view === 'messages' && <Messages onBack={() => setView('home')} />}
      {view === 'entry-pin' && me && (
        <EntryPin me={me} onBack={() => setView('home')} onUpdated={refreshMe} />
      )}
      {view === 'account' && me && (
        <Account
          me={me}
          onBack={() => setView('home')}
          onLoggedOut={handleLoggedOut}
          onOpenEntryPin={() => setView('entry-pin')}
          onOpenActivity={() => setView('activity')}
          onUpdated={refreshMe}
        />
      )}
      <IncomingCall residentId={me?.id ?? null} />
    </>
  );
}
