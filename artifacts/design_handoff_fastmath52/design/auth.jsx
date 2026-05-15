// FastMath24 — Login + user pill + user-switch menu
// Loads after React + Babel + store.js. Components published on window.

const { useState, useEffect, useRef } = React;

function Avatar({ name, size = 32 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  // Deterministic accent from name
  const palette = ['#0000FF', '#1212E6', '#0A0AB8', '#FF7A59', '#FFD24A', '#0E8A5F', '#7A5AE0', '#C8102E'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const bg = palette[Math.abs(h) % palette.length];
  return (
    <span
      className="fm-avatar"
      style={{
        width: size, height: size, background: bg,
        fontSize: Math.round(size * 0.46),
      }}
    >{initial}</span>
  );
}

function LoginScreen({ onContinue }) {
  const existingUsers = FM24Store.getUsers();
  const [mode, setMode] = useState(existingUsers.length > 0 ? 'pick' : 'new');
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (mode === 'new' && inputRef.current) inputRef.current.focus();
  }, [mode]);

  function submitNew(e) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const u = FM24Store.createUser(trimmed);
    if (u) onContinue();
  }

  function pickUser(id) {
    FM24Store.setCurrentUser(id);
    onContinue();
  }

  return (
    <div className="fm-login-overlay">
      <div className="fm-login-bg" />
      <div className="fm-login-card">
        <div className="fm-login-mark">
          <span className="fm-brand-mark fm-brand-mark-lg">⚡</span>
        </div>
        <h1 className="fm-login-title">FastMath<span style={{ color: 'var(--alpha-blue)' }}>52</span></h1>
        <p className="fm-login-sub">
          {mode === 'pick' ? "Who's playing?" : "Pick a name to save your times."}
        </p>

        {mode === 'pick' && (
          <>
            <div className="fm-user-list">
              {existingUsers.map(u => (
                <button key={u.id} className="fm-user-row" onClick={() => pickUser(u.id)}>
                  <Avatar name={u.name} size={36} />
                  <span className="fm-user-row-name">{u.name}</span>
                  <span className="fm-user-row-arrow">→</span>
                </button>
              ))}
            </div>
            <button className="fm-btn fm-btn-ghost fm-login-new" onClick={() => { setName(''); setMode('new'); }}>
              + New player
            </button>
          </>
        )}

        {mode === 'new' && (
          <form className="fm-login-form" onSubmit={submitNew}>
            <input
              ref={inputRef}
              className="fm-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="fm-btn fm-btn-primary" type="submit" disabled={!name.trim()}>
              Start playing
              <span className="fm-btn-key">↵</span>
            </button>
            {existingUsers.length > 0 && (
              <button type="button" className="fm-link" onClick={() => setMode('pick')}>
                ← Back to player list
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function UserPill({ user, onOpenMenu }) {
  return (
    <button className="fm-user-pill" onClick={onOpenMenu} aria-label="User menu">
      <Avatar name={user.name} size={26} />
      <span className="fm-user-pill-name">{user.name}</span>
      <span className="fm-user-pill-chev">▾</span>
    </button>
  );
}

function UserMenu({ user, onClose, onSwitch, onSignOut }) {
  // Close on outside click / escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onClick(e) {
      if (!e.target.closest('.fm-user-menu') && !e.target.closest('.fm-user-pill')) onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [onClose]);

  return (
    <div className="fm-user-menu">
      <div className="fm-um-head">
        <Avatar name={user.name} size={32} />
        <div className="fm-um-meta">
          <div className="fm-um-name">{user.name}</div>
          <div className="fm-um-sub">Signed in</div>
        </div>
      </div>
      <div className="fm-um-actions">
        <button className="fm-um-item" onClick={() => { onSwitch(); onClose(); }}>
          <span className="fm-um-ico">⇄</span>
          <span>Switch player</span>
        </button>
        <button className="fm-um-item" onClick={() => { onSignOut(); onClose(); }}>
          <span className="fm-um-ico">⏏</span>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Avatar, LoginScreen, UserPill, UserMenu });
