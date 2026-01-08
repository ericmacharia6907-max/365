import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Flame,
  BookOpen,
  Sparkles,
  Feather,
  Sun,
  Moon,
  CloudSun,
  Search,
  X,
  Award,
  Smile,
  Meh,
  Frown,
  Zap,
  Star,
  Check,
  Palette,
  BarChart3,
  PenTool,
  User,
  LogOut,
  LogIn,
  Lock,
  Download,
  Upload,
  Edit3,
  Trash2,
} from 'lucide-react';

/* =========================================================
   Storage utilities (per-user)
========================================================= */

const STORAGE_KEY_PREFIX = 'journal_entries_pro_';
const SETTINGS_KEY_PREFIX = 'journal_settings_';
const USERS_KEY = 'journal_users_pro';
const CURRENT_USER_KEY = 'journal_current_user_pro';

const loadEntries = (username) => {
  if (!username) return {};
  try {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + username);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveEntries = (username, entries) => {
  if (!username) return;
  localStorage.setItem(STORAGE_KEY_PREFIX + username, JSON.stringify(entries));
};

const loadSettings = (username) => {
  if (!username) return { theme: 'light', colorScheme: 'gold' };
  try {
    const data = localStorage.getItem(SETTINGS_KEY_PREFIX + username);
    return data ? JSON.parse(data) : { theme: 'light', colorScheme: 'gold' };
  } catch {
    return { theme: 'light', colorScheme: 'gold' };
  }
};

const saveSettings = (username, settings) => {
  if (!username) return;
  localStorage.setItem(SETTINGS_KEY_PREFIX + username, JSON.stringify(settings));
};

const loadUsers = () => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const loadCurrentUser = () => {
  try {
    return localStorage.getItem(CURRENT_USER_KEY);
  } catch {
    return null;
  }
};

const saveCurrentUserName = (username) => {
  localStorage.setItem(CURRENT_USER_KEY, username);
};

const clearCurrentUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

/* =========================================================
   Crypto helpers (avoid plaintext passwords in localStorage)
========================================================= */

const cryptoAvailable = typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const constantTimeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
};

const deriveVerifierBytes = async (password, saltBytes, iterations) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits); // 32 bytes
};

/* =========================================================
   Helpers (DATES: use local date keys to avoid timezone bugs)
========================================================= */

const getLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getTodayKey = () => getLocalDateKey();

const parseDateKeyLocal = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};

const startOfTodayLocal = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateLong = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: Sun, emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', icon: CloudSun, emoji: '🌤️' };
  return { text: 'Good evening', icon: Moon, emoji: '🌙' };
};

const calculateStreak = (entries) => {
  let streak = 0;
  const today = startOfTodayLocal();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateKey = getLocalDateKey(checkDate);

    if (entries[dateKey]) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
};

const prompts = [
  'What made you smile today?',
  "One thing you're grateful for...",
  'A small victory from today...',
  "What's on your mind right now?",
  'Describe today in one sentence...',
  'What did you learn today?',
  'A moment worth remembering...',
  'What inspired you today?',
  'How are you feeling right now?',
  "What's something you're looking forward to?",
];

const getRandomPrompt = () => prompts[Math.floor(Math.random() * prompts.length)];

const moods = [
  { id: 'amazing', icon: Star, label: 'Amazing', color: '#fbbf24', gradient: 'from-yellow-400 to-orange-500' },
  { id: 'happy', icon: Smile, label: 'Happy', color: '#34d399', gradient: 'from-green-400 to-emerald-500' },
  { id: 'neutral', icon: Meh, label: 'Okay', color: '#60a5fa', gradient: 'from-blue-400 to-indigo-500' },
  { id: 'sad', icon: Frown, label: 'Sad', color: '#a78bfa', gradient: 'from-purple-400 to-violet-500' },
  { id: 'stressed', icon: Zap, label: 'Stressed', color: '#f87171', gradient: 'from-red-400 to-rose-500' },
];

const colorSchemes = {
  gold: {
    accent: '#c4a574',
    accentLight: '#e8dcc8',
    accentDark: '#a8895c',
    gradient: 'linear-gradient(135deg, #c4a574, #a8895c)',
  },
  rose: {
    accent: '#e879a9',
    accentLight: '#fce7f3',
    accentDark: '#be185d',
    gradient: 'linear-gradient(135deg, #f472b6, #be185d)',
  },
  ocean: {
    accent: '#38bdf8',
    accentLight: '#e0f2fe',
    accentDark: '#0284c7',
    gradient: 'linear-gradient(135deg, #38bdf8, #0284c7)',
  },
  forest: {
    accent: '#4ade80',
    accentLight: '#dcfce7',
    accentDark: '#16a34a',
    gradient: 'linear-gradient(135deg, #4ade80, #16a34a)',
  },
  lavender: {
    accent: '#a78bfa',
    accentLight: '#ede9fe',
    accentDark: '#7c3aed',
    gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
  },
  sunset: {
    accent: '#fb923c',
    accentLight: '#ffedd5',
    accentDark: '#ea580c',
    gradient: 'linear-gradient(135deg, #fb923c, #ea580c)',
  },
};

/* =========================================================
   Confetti
========================================================= */

const Confetti = ({ active }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'][Math.floor(Math.random() * 5)],
        size: 8 + Math.random() * 8,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);
      const t = setTimeout(() => setParticles([]), 4000);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!particles.length) return null;

  return (
    <div className="confetti-container">
      {particles.map((p) => {
        const style = {
          left: `${p.x}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          backgroundColor: p.color,
          width: p.size,
          height: p.size,
          transform: `rotate(${p.rotation}deg)`,
        };
        return <div key={p.id} className="confetti-particle" style={style} />;
      })}
    </div>
  );
};

/* =========================================================
   Animated background
========================================================= */

const AnimatedBackground = () => (
  <div className="animated-bg">
    <div className="gradient-orb orb-1" />
    <div className="gradient-orb orb-2" />
    <div className="gradient-orb orb-3" />
    <div className="noise-overlay" />
  </div>
);

/* =========================================================
   Theme toggle
========================================================= */

const ThemeToggle = ({ theme, setTheme }) => {
  const next = theme === 'light' ? 'dark' : 'light';
  const LabelIcon = theme === 'dark' ? Moon : Sun;

  return (
    <button onClick={() => setTheme(next)} className="theme-toggle" aria-label="Toggle theme" title="Theme" type="button">
      <span className="theme-toggle-label">
        <LabelIcon size={18} />
        <span>Theme</span>
      </span>

      <div className={`toggle-track ${theme === 'dark' ? 'dark' : ''}`}>
        <div className={`toggle-thumb ${theme === 'dark' ? 'dark' : ''}`}>
          {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
        </div>
        <div className="toggle-icons">
          <Sun size={12} className="sun-icon" />
          <Moon size={12} className="moon-icon" />
        </div>
      </div>
    </button>
  );
};

/* =========================================================
   Color scheme picker (with icon + label)
========================================================= */

const ColorSchemePicker = ({ currentScheme, setColorScheme, isOpen, setIsOpen }) => {
  return (
    <div className="color-picker-container">
      <button
        className="color-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Change color scheme"
        type="button"
        title="Color"
      >
        <Palette size={18} />
        <span className="color-trigger-label">Color</span>
      </button>

      {isOpen && (
        <div className="color-picker-dropdown">
          <div className="color-picker-header">
            <span>Choose Theme</span>
            <button onClick={() => setIsOpen(false)} aria-label="Close theme chooser" type="button">
              <X size={16} />
            </button>
          </div>
          <div className="color-options">
            {Object.entries(colorSchemes).map(([name, scheme]) => (
              <button
                key={name}
                className={`color-option ${currentScheme === name ? 'active' : ''}`}
                onClick={() => {
                  setColorScheme(name);
                  setIsOpen(false);
                }}
                style={{ background: scheme.gradient }}
                aria-label={`Set color scheme ${name}`}
                type="button"
              >
                {currentScheme === name && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   Search modal (clicking a result navigates)
========================================================= */

const SearchModal = ({ entries, isOpen, setIsOpen, onNavigate }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setIsOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return Object.entries(entries)
      .filter(([_, entry]) => {
        const text = typeof entry === 'object' ? entry.text : entry;
        return (text || '').toLowerCase().includes(lowerQuery);
      })
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10);
  }, [query, entries]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)} role="dialog" aria-modal="true" aria-label="Search entries">
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <Search size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your entries..."
            className="search-input"
          />
          <button onClick={() => setIsOpen(false)} className="search-close" aria-label="Close search" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="search-results">
          {query && results.length === 0 && (
            <div className="no-results">
              <p>No entries found</p>
            </div>
          )}
          {results.map(([date, entry]) => {
            const text = typeof entry === 'object' ? entry.text : entry;
            const mood = typeof entry === 'object' ? entry.mood : null;
            const moodData = moods.find((m) => m.id === mood);

            return (
              <button
                key={date}
                type="button"
                className="search-result-item"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.(date);
                }}
                title="Jump to this day"
              >
                <div className="search-result-header">
                  <span className="search-result-date">{formatDate(date)}</span>
                  {moodData && (
                    <span className="search-result-mood" style={{ color: moodData.color }}>
                      <moodData.icon size={14} />
                    </span>
                  )}
                </div>
                <p className="search-result-text">{text}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   Stats modal
========================================================= */

const StatsModal = ({ entries, isOpen, setIsOpen }) => {
  const stats = useMemo(() => {
    const entriesArray = Object.entries(entries);
    const totalEntries = entriesArray.length;
    const totalWords = entriesArray.reduce((acc, [_, entry]) => {
      const text = typeof entry === 'object' ? entry.text : entry;
      return acc + (text ? text.split(/\s+/).filter(Boolean).length : 0);
    }, 0);

    const moodCounts = {};
    entriesArray.forEach(([_, entry]) => {
      if (typeof entry === 'object' && entry.mood) {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      }
    });
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

    const monthlyEntries = {};
    entriesArray.forEach(([date]) => {
      const month = date.substring(0, 7);
      monthlyEntries[month] = (monthlyEntries[month] || 0) + 1;
    });

    const streak = calculateStreak(entries);

    let longestStreak = 0;
    let currentStreak = 0;
    const sortedDates = Object.keys(entries).sort();

    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) currentStreak = 1;
      else {
        const prevDate = parseDateKeyLocal(sortedDates[i - 1]);
        const currDate = parseDateKeyLocal(sortedDates[i]);
        const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    return { totalEntries, totalWords, topMood, monthlyEntries, streak, longestStreak };
  }, [entries]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const topMoodData = stats.topMood ? moods.find((m) => m.id === stats.topMood[0]) : null;

  const monthKeys = Object.keys(stats.monthlyEntries).sort();
  const last6 = monthKeys.slice(-6);
  const maxCount = Math.max(0, ...Object.values(stats.monthlyEntries));

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)} role="dialog" aria-modal="true" aria-label="Statistics">
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-header">
          <h2>
            <BarChart3 size={24} /> Your Journey
          </h2>
          <button onClick={() => setIsOpen(false)} className="modal-close" aria-label="Close statistics" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <BookOpen size={24} />
            </div>
            <div className="stat-value">{stats.totalEntries}</div>
            <div className="stat-label">Total Entries</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <PenTool size={24} />
            </div>
            <div className="stat-value">{stats.totalWords.toLocaleString()}</div>
            <div className="stat-label">Words Written</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Flame size={24} />
            </div>
            <div className="stat-value">{stats.streak}</div>
            <div className="stat-label">Current Streak</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Award size={24} />
            </div>
            <div className="stat-value">{stats.longestStreak}</div>
            <div className="stat-label">Longest Streak</div>
          </div>
        </div>

        {topMoodData && (
          <div className="mood-summary">
            <span>Most common mood:</span>
            <div className="top-mood" style={{ background: `${topMoodData.color}20`, color: topMoodData.color }}>
              <topMoodData.icon size={18} />
              <span>{topMoodData.label}</span>
            </div>
          </div>
        )}

        <div className="stats-chart">
          <h3>Entries Over Time</h3>
          <div className="chart-bars">
            {last6.map((month) => {
              const count = stats.monthlyEntries[month];
              const height = maxCount === 0 ? 0 : (count / maxCount) * 100;
              const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' });

              return (
                <div key={month} className="chart-bar-container">
                  <div className="chart-bar" style={{ height: `${height}%` }}>
                    <span className="chart-bar-value">{count}</span>
                  </div>
                  <span className="chart-bar-label">{monthLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   Auth
========================================================= */

const AuthScreen = ({ onAuthComplete }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) return setError('Please enter a username and password.');
    if (trimmedUsername.length < 3) return setError('Username must be at least 3 characters.');
    if (password.length < 4) return setError('Password must be at least 4 characters.');

    setError('');
    setBusy(true);

    try {
      const users = loadUsers();

      if (mode === 'signup') {
        if (users[trimmedUsername]) {
          setError('That username is already taken.');
          return;
        }

        if (!cryptoAvailable) {
          setError('Secure login is not supported in this browser/environment.');
          return;
        }

        const iterations = 120000;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const verifierBytes = await deriveVerifierBytes(password, salt, iterations);

        users[trimmedUsername] = {
          v: 1,
          createdAt: Date.now(),
          iterations,
          salt: bytesToBase64(salt),
          verifier: bytesToBase64(verifierBytes),
        };

        saveUsers(users);
        onAuthComplete(trimmedUsername, rememberMe);
        return;
      }

      const user = users[trimmedUsername];
      if (!user) {
        setError('Invalid username or password.');
        return;
      }

      if (user?.salt && user?.verifier) {
        if (!cryptoAvailable) {
          setError('Secure login is not supported in this browser/environment.');
          return;
        }
        const iterations = Number(user.iterations) || 120000;
        const saltBytes = base64ToBytes(user.salt);
        const verifierBytes = await deriveVerifierBytes(password, saltBytes, iterations);
        const verifierB64 = bytesToBase64(verifierBytes);

        if (!constantTimeEqual(verifierB64, user.verifier)) {
          setError('Invalid username or password.');
          return;
        }

        onAuthComplete(trimmedUsername, rememberMe);
        return;
      }

      if (typeof user?.password === 'string') {
        if (user.password !== password) {
          setError('Invalid username or password.');
          return;
        }

        if (cryptoAvailable) {
          const iterations = 120000;
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const verifierBytes = await deriveVerifierBytes(password, salt, iterations);

          users[trimmedUsername] = {
            v: 1,
            createdAt: user.createdAt || Date.now(),
            iterations,
            salt: bytesToBase64(salt),
            verifier: bytesToBase64(verifierBytes),
          };
          saveUsers(users);
        }

        onAuthComplete(trimmedUsername, rememberMe);
        return;
      }

      setError('Invalid username or password.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass">
        <div className="auth-header">
          <div className="auth-icon">
            <Feather size={26} />
          </div>
          <div>
            <h1>365 Journal</h1>
            <p>Sign in to keep your one-line memories in this browser.</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
            }}
            disabled={busy}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
            }}
            disabled={busy}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <div className="auth-input-wrapper">
              <User size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex"
                autoComplete="username"
                disabled={busy}
              />
            </div>
          </label>

          <label>
            Password
            <div className="auth-input-wrapper">
              <Lock size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={busy}
              />
            </div>
          </label>

          <label className="remember-row">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={busy} />
            <span>Remember me on this device</span>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {mode === 'login' ? (
              <>
                <LogIn size={18} />
                <span>{busy ? 'Logging in…' : 'Log in'}</span>
              </>
            ) : (
              <>
                <User size={18} />
                <span>{busy ? 'Creating…' : 'Create account'}</span>
              </>
            )}
          </button>
        </form>

        <p className="auth-note">
          Front‑end only: data is stored in this browser&apos;s local storage per username. Passwords are stored as PBKDF2 verifiers (not
          plaintext) when supported.
        </p>
      </div>
    </div>
  );
};

/* =========================================================
   Header
========================================================= */

const Header = ({
  currentView,
  setCurrentView,
  streak,
  totalEntries,
  theme,
  setTheme,
  colorScheme,
  setColorScheme,
  setSearchOpen,
  setStatsOpen,
  currentUser,
  onLogout,
  onExport,
  onImportClick,
}) => {
  const greeting = getGreeting();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const colorPickerRef = useRef(null);

  useEffect(() => {
    if (!colorPickerOpen) return;

    const onPointerDown = (e) => {
      if (!colorPickerRef.current) return;
      if (!colorPickerRef.current.contains(e.target)) setColorPickerOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [colorPickerOpen]);

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-actions left">
          <button className="icon-btn action-btn" onClick={() => setSearchOpen(true)} aria-label="Search entries" type="button" title="Search">
            <Search size={18} />
            <span className="action-btn-label">Search</span>
          </button>

          <button className="icon-btn action-btn" onClick={() => setStatsOpen(true)} aria-label="Your journey" type="button" title="Your journey">
            <BarChart3 size={18} />
            <span className="action-btn-label">Journey</span>
          </button>

          <button className="icon-btn action-btn" onClick={onExport} aria-label="Export backup" type="button" title="Export backup">
            <Download size={18} />
            <span className="action-btn-label">Export</span>
          </button>

          <button className="icon-btn action-btn" onClick={onImportClick} aria-label="Import backup" type="button" title="Import backup">
            <Upload size={18} />
            <span className="action-btn-label">Import</span>
          </button>
        </div>

        <div className="header-actions right">
          {currentUser && (
            <div className="user-chip glass">
              <User size={16} />
              <span>{currentUser}</span>
              <button type="button" className="user-logout-btn" onClick={onLogout} title="Log out" aria-label="Log out">
                <LogOut size={14} />
              </button>
            </div>
          )}

          <div ref={colorPickerRef}>
            <ColorSchemePicker currentScheme={colorScheme} setColorScheme={setColorScheme} isOpen={colorPickerOpen} setIsOpen={setColorPickerOpen} />
          </div>

          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>

      <div className="greeting-badge">
        <span className="greeting-emoji">{greeting.emoji}</span>
        <span>{greeting.text}</span>
      </div>

      <h1 className="title-main">
        <span className="title-number">365</span>
        <span className="title-sparkle">
          <Sparkles size={24} />
        </span>
      </h1>
      <p className="subtitle">One line. One day. One year of memories.</p>

      <div className="stats-row">
        <div className="stat-badge glass">
          <Flame size={18} className="flame-icon" />
          <span className="stat-number">{streak}</span>
          <span className="stat-text">day streak</span>
        </div>
        <div className="stat-badge glass">
          <BookOpen size={18} />
          <span className="stat-number">{totalEntries}</span>
          <span className="stat-text">entries</span>
        </div>
      </div>

      <nav className="nav-container">
        <div className="nav-pills glass">
          {[
            { id: 'today', icon: Feather, label: 'Today' },
            { id: 'calendar', icon: Calendar, label: 'Calendar' },
            { id: 'list', icon: List, label: 'History' },
          ].map((item) => (
            <button key={item.id} onClick={() => setCurrentView(item.id)} className={`nav-pill ${currentView === item.id ? 'active' : ''}`} type="button">
              <item.icon size={18} />
              <span>{item.label}</span>
              {currentView === item.id && <div className="nav-pill-glow" />}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
};

/* =========================================================
   Mood selector
========================================================= */

const MoodSelector = ({ selectedMood, setSelectedMood }) => {
  return (
    <div className="mood-selector">
      <span className="mood-label">How are you feeling?</span>
      <div className="mood-options">
        {moods.map((mood) => (
          <button
            key={mood.id}
            onClick={() => setSelectedMood(mood.id)}
            className={`mood-btn ${selectedMood === mood.id ? 'selected' : ''}`}
            style={{
              '--mood-color': mood.color,
              background: selectedMood === mood.id ? `${mood.color}20` : undefined,
              borderColor: selectedMood === mood.id ? mood.color : undefined,
            }}
            title={mood.label}
            type="button"
          >
            <mood.icon size={20} />
            <span className="mood-btn-label">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* =========================================================
   Entry editor modal + Undo toast
========================================================= */

const EntryEditorModal = ({ isOpen, dateKey, entry, onClose, onSave, onDelete }) => {
  const MAX_CHARS = 280;
  const [text, setText] = useState('');
  const [mood, setMood] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const entryText = entry ? (typeof entry === 'object' ? entry.text : entry) : '';
    const entryMood = entry && typeof entry === 'object' ? entry.mood : null;

    setText(entryText || '');
    setMood(entryMood || null);

    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [isOpen, dateKey, entry]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed || trimmed.length > MAX_CHARS) return;
        onSave?.(dateKey, { text: trimmed, mood });
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, onSave, dateKey, text, mood]);

  if (!isOpen || !dateKey) return null;

  const trimmed = text.trim();
  const remaining = MAX_CHARS - text.length;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit entry">
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-header">
          <div>
            <h2 className="editor-title">
              <Edit3 size={20} /> Edit entry
            </h2>
            <p className="editor-date">{formatDateLong(dateKey)}</p>
          </div>

          <button onClick={onClose} className="modal-close" aria-label="Close editor" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="editor-body">
          <MoodSelector selectedMood={mood} setSelectedMood={setMood} />

          <div className="editor-mood-row">
            <button type="button" className="link-btn" onClick={() => setMood(null)}>
              Clear mood
            </button>
            <span className={`editor-remaining ${remaining <= 40 ? 'warning' : ''} ${remaining === 0 ? 'limit' : ''}`}>{remaining} left</span>
          </div>

          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_CHARS}
            rows={5}
            placeholder="Edit your line..."
          />

          <div className="editor-actions">
            <button
              type="button"
              className="danger-btn"
              onClick={() => {
                onDelete?.(dateKey);
                onClose?.();
              }}
              disabled={!entry}
              title="Delete entry"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>

            <div className="editor-actions-right">
              <button type="button" className="secondary-btn" onClick={onClose}>
                Cancel
              </button>

              <button
                type="button"
                className={`primary-btn ${trimmed ? 'ready' : ''}`}
                disabled={!trimmed}
                onClick={() => {
                  onSave?.(dateKey, { text: trimmed, mood });
                  onClose?.();
                }}
                title="Save (Ctrl/⌘ + Enter)"
              >
                <Check size={18} />
                <span>Save</span>
              </button>
            </div>
          </div>

          <div className="editor-hint">
            Tip: press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>↵</kbd> to save
          </div>
        </div>
      </div>
    </div>
  );
};

const UndoToast = ({ toast, onUndo, onDismiss }) => {
  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-text">Entry deleted</span>
      <button type="button" className="toast-undo" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
};

/* =========================================================
   Entry input (today view)
========================================================= */

const EntryInput = ({ entries, onUpsert, onEditDate, onDeleteDate, showConfetti }) => {
  const [text, setText] = useState('');
  const [mood, setMood] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [prompt] = useState(getRandomPrompt);

  const todayKey = getTodayKey();
  const todayEntry = entries[todayKey];
  const MAX_CHARS = 280;
  const textareaRef = useRef(null);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_CHARS) return;

    const isNew = !entries[todayKey];

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    onUpsert?.(todayKey, { text: trimmed, mood });

    setText('');
    setMood(null);
    setIsSaving(false);

    if (isNew) {
      const simulated = { ...entries, [todayKey]: { text: trimmed, mood, timestamp: Date.now() } };
      const newTotal = Object.keys(simulated).length;
      if (newTotal % 10 === 0 || calculateStreak(simulated) % 7 === 0) showConfetti?.();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (todayEntry) {
    const entryText = typeof todayEntry === 'object' ? todayEntry.text : todayEntry;
    const entryMood = typeof todayEntry === 'object' ? todayEntry.mood : null;
    const moodData = moods.find((m) => m.id === entryMood);

    return (
      <div className="content-container">
        <div className="card glass card-success">
          <div className="success-glow" />

          <div className="success-header">
            <div className="success-icon">
              <Sparkles size={28} />
            </div>
            <div className="success-header-main">
              <div>
                <h3>Today&apos;s reflection</h3>
                <p className="date-label">{formatDateLong(todayKey)}</p>
              </div>

              <div className="success-actions">
                <button className="mini-action-btn" onClick={() => onEditDate?.(todayKey)} aria-label="Edit today’s entry" title="Edit" type="button">
                  <Edit3 size={16} />
                  <span>Edit</span>
                </button>
                <button
                  className="mini-action-btn danger"
                  onClick={() => onDeleteDate?.(todayKey)}
                  aria-label="Delete today’s entry"
                  title="Delete"
                  type="button"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

          {moodData && (
            <div className="entry-mood-display" style={{ background: `${moodData.color}15`, borderColor: `${moodData.color}30` }}>
              <moodData.icon size={18} style={{ color: moodData.color }} />
              <span style={{ color: moodData.color }}>Feeling {moodData.label.toLowerCase()}</span>
            </div>
          )}

          <div className="entry-display">
            <p className="entry-text">{entryText}</p>
          </div>

          <div className="success-footer">
            <div className="success-animation">
              <div className="plant-pot">
                <span className="plant-emoji">🌱</span>
              </div>
            </div>
            <p className="success-message">Beautifully captured</p>
            <p className="success-sub">See you tomorrow for another moment</p>
          </div>
        </div>
      </div>
    );
  }

  const progress = (text.length / MAX_CHARS) * 100;
  const isNearLimit = text.length > MAX_CHARS * 0.8;

  return (
    <div className="content-container">
      <div className="card glass card-input">
        <div className="input-header">
          <div className="input-header-left">
            <div className="feather-icon-wrapper">
              <Feather size={22} />
            </div>
            <div>
              <h3>What&apos;s your line today?</h3>
              <p className="date-label">{formatDateLong(todayKey)}</p>
            </div>
          </div>
        </div>

        <div className="prompt-container">
          <div className="prompt-icon">💭</div>
          <p className="prompt-text">{prompt}</p>
        </div>

        <MoodSelector selectedMood={mood} setSelectedMood={setMood} />

        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start writing your thought..."
            maxLength={MAX_CHARS}
            className="entry-textarea"
            rows={4}
          />

          <div className="textarea-footer">
            <div className="char-progress-wrapper">
              <svg className="char-progress-ring" viewBox="0 0 36 36">
                <circle className="char-progress-bg" cx="18" cy="18" r="16" fill="none" strokeWidth="3" />
                <circle
                  className="char-progress-fill"
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray={`${progress}, 100`}
                  style={{
                    stroke: isNearLimit ? (text.length === MAX_CHARS ? '#ef4444' : '#f59e0b') : undefined,
                  }}
                />
              </svg>
              <span className={`char-count ${isNearLimit ? 'warning' : ''} ${text.length === MAX_CHARS ? 'limit' : ''}`}>{MAX_CHARS - text.length}</span>
            </div>

            <div className="keyboard-hint">
              <kbd>⌘</kbd> + <kbd>↵</kbd> to save
            </div>
          </div>
        </div>

        <div className="input-footer">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isSaving}
            className={`save-button ${isSaving ? 'saving' : ''} ${text.trim() ? 'ready' : ''}`}
            type="button"
          >
            {isSaving ? (
              <div className="saving-spinner" />
            ) : (
              <>
                <span>Capture this moment</span>
                <Sparkles size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   Calendar view
========================================================= */

const CalendarView = ({ entries, onEditDate, jumpTo }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!jumpTo?.dateKey) return;
    const d = parseDateKeyLocal(jumpTo.dateKey);
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(jumpTo.dateKey);
  }, [jumpTo?.id, jumpTo?.dateKey]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const changeMonth = (dir) => {
    setDirection(dir);
    setTimeout(() => {
      setCurrentDate(new Date(year, month + dir, 1));
      setSelectedDate(null);
      setDirection(0);
    }, 150);
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="calendar-day-empty" />);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entries[dateKey];
    const hasEntry = !!entry;
    const isToday = dateKey === getTodayKey();
    const isSelected = selectedDate === dateKey;

    const isFuture = parseDateKeyLocal(dateKey) > startOfTodayLocal();

    const mood = entry && typeof entry === 'object' ? entry.mood : null;
    const moodData = moods.find((m) => m.id === mood);

    days.push(
      <button
        key={day}
        onClick={() => {
          if (isFuture) return;
          setSelectedDate(isSelected ? null : dateKey);
          if (hasEntry) onEditDate?.(dateKey);
        }}
        className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasEntry ? 'has-entry' : ''} ${isFuture ? 'future' : ''}`}
        disabled={isFuture}
        style={moodData && hasEntry ? { '--mood-accent': moodData.color } : {}}
        type="button"
        title={hasEntry ? 'Click to edit entry' : 'Select to preview'}
      >
        <span className="day-number">{day}</span>
        {hasEntry && (
          <>
            <div className="entry-indicator" style={moodData ? { background: moodData.color } : {}} />
            <Edit3 size={12} className="calendar-edit-icon" aria-hidden="true" />
          </>
        )}
      </button>
    );
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const entriesThisMonth = Object.keys(entries).filter((key) => key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;

  const selectedEntry = selectedDate ? entries[selectedDate] : null;
  const selectedText = selectedEntry ? (typeof selectedEntry === 'object' ? selectedEntry.text : selectedEntry) : null;
  const selectedMood = selectedEntry && typeof selectedEntry === 'object' ? selectedEntry.mood : null;
  const selectedMoodData = moods.find((m) => m.id === selectedMood);

  return (
    <div className="content-container">
      <div className="card glass card-calendar">
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)} className="month-nav-btn" aria-label="Previous month" type="button">
            <ChevronLeft size={22} />
          </button>
          <div className="month-info">
            <h2 className="month-title">{monthName}</h2>
            <p className="month-stats">
              <span className="month-count">{entriesThisMonth}</span> entries this month
            </p>
          </div>
          <button onClick={() => changeMonth(1)} className="month-nav-btn" aria-label="Next month" type="button">
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="weekday-row">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
            <div key={dayName} className="weekday-label">
              {dayName}
            </div>
          ))}
        </div>

        <div className={`calendar-grid ${direction !== 0 ? 'sliding' : ''}`}>{days}</div>

        <div className={`entry-preview glass ${selectedDate ? 'visible' : ''}`}>
          {selectedDate && (
            <>
              <div className="preview-header">
                <p className="preview-date">{formatDateLong(selectedDate)}</p>
                {selectedMoodData && (
                  <div className="preview-mood" style={{ color: selectedMoodData.color }}>
                    <selectedMoodData.icon size={16} />
                  </div>
                )}
              </div>
              {selectedText ? <p className="preview-text">{selectedText}</p> : <p className="preview-empty">No entry for this day</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   List view
========================================================= */

const ListView = ({ entries, onEditDate }) => {
  const sortedEntries = useMemo(() => Object.entries(entries).sort((a, b) => b[0].localeCompare(a[0])), [entries]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    sortedEntries.forEach(([date, entry]) => {
      const monthKey = date.substring(0, 7);
      const monthName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = { name: monthName, entries: [] };
      groups[monthKey].entries.push([date, entry]);
    });
    return groups;
  }, [sortedEntries]);

  return (
    <div className="content-container">
      {sortedEntries.length === 0 ? (
        <div className="card glass card-empty">
          <div className="empty-illustration">
            <div className="empty-book">📔</div>
            <div className="empty-sparkles">✨</div>
          </div>
          <h3>Your journal awaits</h3>
          <p>Start capturing moments today. Each line tells a story that future you will treasure.</p>
        </div>
      ) : (
        <div className="list-container">
          {Object.entries(groupedByMonth).map(([monthKey, group]) => (
            <div key={monthKey} className="month-group">
              <div className="month-divider">
                <div className="month-divider-content">
                  <Calendar size={16} />
                  <span>{group.name}</span>
                </div>
                <div className="divider-line" />
                <span className="month-entry-count">{group.entries.length}</span>
              </div>

              <div className="entries-list">
                {group.entries.map(([date, entry], index) => {
                  const text = typeof entry === 'object' ? entry.text : entry;
                  const entryMood = typeof entry === 'object' ? entry.mood : null;
                  const moodData = moods.find((m) => m.id === entryMood);

                  return (
                    <button
                      key={date}
                      className="entry-card glass entry-card-btn"
                      style={{ animationDelay: `${index * 0.05}s`, '--entry-accent': moodData?.color }}
                      type="button"
                      onClick={() => onEditDate?.(date)}
                      title="Click to edit"
                    >
                      <div className="entry-card-left">
                        <div className="entry-date-badge">
                          <span className="entry-day">{new Date(date + 'T00:00:00').getDate()}</span>
                          <span className="entry-weekday">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        </div>
                        {moodData && (
                          <div className="entry-mood-indicator" style={{ background: moodData.color }} title={moodData.label}>
                            <moodData.icon size={12} />
                          </div>
                        )}
                      </div>
                      <p className="entry-content">{text}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* =========================================================
   Import/Export helpers
========================================================= */

const isValidDateKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);

const normalizeImportedEntry = (entry) => {
  if (typeof entry === 'string') return { text: entry, mood: null, timestamp: null };
  if (entry && typeof entry === 'object') {
    const text = typeof entry.text === 'string' ? entry.text : '';
    const mood = typeof entry.mood === 'string' ? entry.mood : null;
    const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : null;
    return { text, mood, timestamp };
  }
  return null;
};

const normalizeImportedEntries = (entriesObj) => {
  if (!entriesObj || typeof entriesObj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(entriesObj)) {
    if (!isValidDateKey(k)) continue;
    const norm = normalizeImportedEntry(v);
    if (!norm || !norm.text) continue;
    out[k] = norm;
  }
  return out;
};

/* =========================================================
   Main App
========================================================= */

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [entries, setEntries] = useState({});
  const [currentView, setCurrentView] = useState('today');
  const [theme, setTheme] = useState('light');
  const [colorScheme, setColorScheme] = useState('gold');
  const [searchOpen, setSearchOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDateKey, setEditorDateKey] = useState(null);

  const [toast, setToast] = useState(null); // { dateKey, entry }
  const toastTimerRef = useRef(null);

  const [calendarJump, setCalendarJump] = useState(null); // { dateKey, id }

  const importInputRef = useRef(null);

  useEffect(() => {
    const storedUser = loadCurrentUser();
    if (storedUser) setCurrentUser(storedUser);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const savedEntries = loadEntries(currentUser);
    setEntries(savedEntries);

    const settings = loadSettings(currentUser);
    setTheme(settings.theme || 'light');
    setColorScheme(settings.colorScheme || 'gold');
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    saveSettings(currentUser, { theme, colorScheme });
  }, [theme, colorScheme, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    saveEntries(currentUser, entries);
  }, [entries, currentUser]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showConfetti = useCallback(() => {
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 100);
  }, []);

  const handleAuthComplete = useCallback((username, remember) => {
    setCurrentUser(username);
    if (remember) saveCurrentUserName(username);
    else clearCurrentUser();
  }, []);

  const handleLogout = useCallback(() => {
    clearCurrentUser();
    setCurrentUser(null);
    setEntries({});
    setSearchOpen(false);
    setStatsOpen(false);
    setEditorOpen(false);
    setEditorDateKey(null);
    setToast(null);
  }, []);

  const openEditor = useCallback((dateKey) => {
    if (!dateKey) return;
    if (parseDateKeyLocal(dateKey) > startOfTodayLocal()) return;
    setEditorDateKey(dateKey);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const upsertEntry = useCallback((dateKey, payload) => {
    const trimmed = (payload?.text || '').trim();
    if (!trimmed) return;

    setEntries((prev) => ({
      ...prev,
      [dateKey]: {
        text: trimmed,
        mood: payload?.mood || null,
        timestamp: Date.now(),
      },
    }));
  }, []);

  const deleteEntry = useCallback((dateKey) => {
    let deleted = null;

    setEntries((prev) => {
      deleted = prev[dateKey];
      if (!deleted) return prev;

      const next = { ...prev };
      delete next[dateKey];
      return next;
    });

    if (!deleted) return;

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ dateKey, entry: deleted });
    toastTimerRef.current = setTimeout(() => setToast(null), 10000);
  }, []);

  const undoDelete = useCallback(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    setEntries((prev) => ({ ...prev, [toast.dateKey]: toast.entry }));
    setToast(null);
  }, [toast]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const navigateToDate = useCallback((dateKey) => {
    setCurrentView('calendar');
    setCalendarJump({ dateKey, id: Date.now() });
  }, []);

  const handleExport = useCallback(() => {
    if (!currentUser) return;

    const payload = {
      app: '365-journal',
      version: 1,
      exportedAt: new Date().toISOString(),
      user: currentUser,
      entries,
      settings: { theme, colorScheme },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `365-journal-${currentUser}-${getTodayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }, [currentUser, entries, theme, colorScheme]);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (e) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        const importedEntries = normalizeImportedEntries(data?.entries);
        const importedCount = Object.keys(importedEntries).length;

        if (!importedCount) {
          window.alert('No valid entries found in this file.');
          return;
        }

        setEntries((prev) => {
          const conflicts = Object.keys(importedEntries).filter((k) => !!prev[k]);
          const ok = conflicts.length
            ? window.confirm(`This import contains ${importedCount} entries and will overwrite ${conflicts.length} existing day(s). Continue?`)
            : true;

          if (!ok) return prev;

          const merged = { ...prev, ...importedEntries };
          saveEntries(currentUser, merged);
          return merged;
        });

        const incomingTheme = data?.settings?.theme;
        const incomingScheme = data?.settings?.colorScheme;

        if (incomingTheme === 'light' || incomingTheme === 'dark') setTheme(incomingTheme);
        if (incomingScheme && colorSchemes[incomingScheme]) setColorScheme(incomingScheme);

        window.alert(`Imported ${importedCount} entries.`);
      } catch {
        window.alert('Import failed. Please choose a valid backup JSON file.');
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
      }
    },
    [currentUser]
  );

  const streak = useMemo(() => calculateStreak(entries), [entries]);
  const totalEntries = Object.keys(entries).length;
  const colors = colorSchemes[colorScheme];

  return (
    <div
      className={`app-wrapper ${theme}`}
      style={{
        '--accent': colors.accent,
        '--accent-light': colors.accentLight,
        '--accent-dark': colors.accentDark,
        '--accent-gradient': colors.gradient,
      }}
    >
      <input ref={importInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />

      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@300;400;500;600;700&display=swap');
:root{--accent:#c4a574;--accent-light:#e8dcc8;--accent-dark:#a8895c;--accent-gradient:linear-gradient(135deg,#c4a574,#a8895c)}
.app-wrapper{--bg-primary:#faf9f7;--bg-secondary:#f5f3f0;--bg-tertiary:#ebe8e4;--bg-card:rgba(255,255,255,.8);--bg-card-solid:#fff;--text-primary:#1a1816;--text-secondary:#4a4744;--text-muted:#8a8580;--border:rgba(0,0,0,.08);--shadow-sm:0 2px 8px rgba(0,0,0,.04);--shadow-md:0 4px 20px rgba(0,0,0,.08);--shadow-lg:0 8px 40px rgba(0,0,0,.12);--glass-bg:rgba(255,255,255,.7);--glass-border:rgba(255,255,255,.5)}
.app-wrapper.dark{--bg-primary:#0f0f10;--bg-secondary:#1a1a1c;--bg-tertiary:#252528;--bg-card:rgba(30,30,34,.8);--bg-card-solid:#1e1e22;--text-primary:#f5f5f4;--text-secondary:#a8a8a6;--text-muted:#6b6b69;--border:rgba(255,255,255,.1);--shadow-sm:0 2px 8px rgba(0,0,0,.3);--shadow-md:0 4px 20px rgba(0,0,0,.4);--shadow-lg:0 8px 40px rgba(0,0,0,.5);--glass-bg:rgba(30,30,34,.7);--glass-border:rgba(255,255,255,.1)}
*{margin:0;padding:0;box-sizing:border-box}
html,body,#root{width:100%;min-height:100vh}
.app-wrapper{min-height:100vh;background:var(--bg-primary);font-family:'Inter',-apple-system,sans-serif;color:var(--text-primary);position:relative;overflow-x:hidden;transition:background .5s ease,color .5s ease}
.animated-bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.gradient-orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.5;animation:floatOrb 25s ease-in-out infinite}
.app-wrapper.dark .gradient-orb{opacity:.3}
.orb-1{width:600px;height:600px;background:var(--accent-light);top:-200px;right:-200px;animation-delay:0s}
.orb-2{width:500px;height:500px;background:var(--accent);bottom:-150px;left:-150px;animation-delay:-8s;opacity:.3}
.orb-3{width:300px;height:300px;background:var(--accent-dark);top:50%;left:50%;animation-delay:-16s;opacity:.2}
.noise-overlay{position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");opacity:.03}
@keyframes floatOrb{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,50px) scale(1.05)}50%{transform:translate(-20px,30px) scale(.95)}75%{transform:translate(40px,-20px) scale(1.02)}}
.confetti-container{position:fixed;inset:0;pointer-events:none;z-index:1000;overflow:hidden}
.confetti-particle{position:absolute;top:-20px;border-radius:2px;animation:confettiFall linear forwards}
@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
.glass{background:var(--glass-bg);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--glass-border)}
.header{max-width:800px;margin:0 auto;padding:24px 20px 32px;position:relative;z-index:10}
.header-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.header-actions{display:flex;align-items:center;gap:8px}

/* Icon buttons */
.icon-btn{width:42px;height:42px;border-radius:12px;border:none;background:var(--glass-bg);backdrop-filter:blur(10px);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease}
.icon-btn:hover{background:var(--accent-light);color:var(--accent-dark);transform:translateY(-2px)}
.icon-btn svg{display:block}

/* action buttons with labels */
.icon-btn.action-btn{width:auto;padding:0 14px;gap:8px;justify-content:flex-start}
.action-btn-label{font-size:.85rem;font-weight:500}

/* Theme toggle */
.theme-toggle{background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:10px}
.theme-toggle-label{display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:.85rem;font-weight:500}
.toggle-track{width:56px;height:30px;background:var(--bg-tertiary);border-radius:15px;position:relative;transition:all .4s cubic-bezier(.4,0,.2,1);overflow:hidden}
.toggle-track.dark{background:#2d3748}
.toggle-thumb{position:absolute;top:3px;left:3px;width:24px;height:24px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#f59e0b;transition:all .4s cubic-bezier(.4,0,.2,1);box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:2}
.toggle-thumb.dark{left:29px;color:#818cf8;background:#1e1e22}
.toggle-icons{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 8px;z-index:1}
.sun-icon{color:#f59e0b;opacity:.5}.moon-icon{color:#818cf8;opacity:.5}

/* Color Picker */
.color-picker-container{position:relative}
.color-picker-trigger{height:42px;width:auto;padding:0 14px;gap:8px;border-radius:12px;border:none;background:var(--accent-gradient);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease}
.color-picker-trigger:hover{transform:translateY(-2px) scale(1.05)}
.color-trigger-label{font-size:.85rem;font-weight:700}
.color-picker-dropdown{position:absolute;top:100%;right:0;margin-top:8px;background:var(--bg-card-solid);border-radius:16px;padding:16px;box-shadow:var(--shadow-lg);z-index:100;min-width:200px;animation:dropdownIn .2s ease}
@keyframes dropdownIn{from{opacity:0;transform:translateY(-10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
.color-picker-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:.85rem;font-weight:600;color:var(--text-secondary)}
.color-picker-header button{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px}
.color-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.color-option{width:100%;aspect-ratio:1;border-radius:12px;border:3px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;transition:all .2s ease}
.color-option:hover{transform:scale(1.1)}
.color-option.active{border-color:var(--text-primary);box-shadow:0 0 0 2px var(--bg-primary)}

/* Greeting */
.greeting-badge{display:inline-flex;align-items:center;gap:8px;background:var(--glass-bg);backdrop-filter:blur(10px);padding:8px 16px;border-radius:24px;font-size:.85rem;font-weight:500;color:var(--text-secondary);margin-bottom:20px;border:1px solid var(--glass-border)}
.greeting-emoji{font-size:1.1rem}

/* Title */
.title-main{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px}
.title-number{font-family:'DM Serif Display',serif;font-size:6rem;font-weight:400;line-height:1;background:var(--accent-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.title-sparkle{color:var(--accent);animation:sparkle 2s ease-in-out infinite}
@keyframes sparkle{0%,100%{transform:scale(1) rotate(0deg);opacity:1}50%{transform:scale(1.2) rotate(10deg);opacity:.8}}
.subtitle{font-size:1.05rem;color:var(--text-muted);font-weight:400;margin-bottom:28px;text-align:center}

/* Stats row */
.stats-row{display:flex;justify-content:center;gap:16px;margin-bottom:28px}
.stat-badge{display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:16px;transition:all .3s ease}
.stat-badge:hover{transform:translateY(-2px)}
.stat-number{font-size:1.25rem;font-weight:700;color:var(--text-primary)}
.stat-text{font-size:.85rem;color:var(--text-muted)}
.flame-icon{color:#f59e0b;animation:flicker 1.5s ease-in-out infinite}
@keyframes flicker{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}

/* Nav */
.nav-container{display:flex;justify-content:center}
.nav-pills{display:inline-flex;padding:6px;border-radius:18px;gap:4px}
.nav-pill{display:flex;align-items:center;gap:8px;padding:12px 24px;border:none;background:transparent;border-radius:14px;font-size:.9rem;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .3s ease;position:relative;overflow:hidden}
.nav-pill:hover{color:var(--text-primary);background:var(--bg-tertiary)}
.nav-pill.active{background:var(--accent-gradient);color:#fff;box-shadow:0 4px 15px rgba(0,0,0,.2)}
.nav-pill-glow{position:absolute;inset:0;background:radial-gradient(circle at center,rgba(255,255,255,.3) 0%,transparent 70%);animation:glowPulse 2s ease-in-out infinite}
@keyframes glowPulse{0%,100%{opacity:0}50%{opacity:1}}

/* Content */
.content-container{max-width:700px;margin:0 auto;padding:0 20px 60px;position:relative;z-index:10}
.card{border-radius:28px;padding:32px;position:relative;overflow:hidden;transition:all .3s ease}
.card:hover{transform:translateY(-2px)}
.card-input{box-shadow:var(--shadow-md)}
.input-header{display:flex;align-items:center;gap:16px;margin-bottom:24px}
.input-header-left{display:flex;align-items:center;gap:16px}
.feather-icon-wrapper{width:48px;height:48px;background:var(--accent-gradient);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff}
.input-header h3{font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--text-primary)}
.date-label{font-size:.85rem;color:var(--text-muted);margin-top:4px}
.prompt-container{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,var(--accent-light),var(--bg-secondary));padding:16px 20px;border-radius:16px;margin-bottom:24px}
.app-wrapper.dark .prompt-container{background:linear-gradient(135deg,rgba(196,165,116,.2),var(--bg-secondary))}
.prompt-icon{font-size:1.5rem}
.prompt-text{font-family:'DM Serif Display',serif;font-size:1.1rem;color:var(--accent-dark);font-style:italic}
.app-wrapper.dark .prompt-text{color:var(--accent)}
.mood-selector{margin-bottom:24px}
.mood-label{display:block;font-size:.85rem;font-weight:500;color:var(--text-secondary);margin-bottom:12px}
.mood-options{display:flex;gap:10px;flex-wrap:wrap}
.mood-btn{display:flex;align-items:center;gap:8px;padding:10px 16px;border:2px solid var(--border);background:var(--bg-secondary);border-radius:12px;cursor:pointer;transition:all .2s ease;color:var(--text-secondary)}
.mood-btn:hover{border-color:var(--mood-color);background:color-mix(in srgb,var(--mood-color) 10%,transparent)}
.mood-btn.selected{border-width:2px}
.mood-btn.selected svg{color:var(--mood-color)}
.mood-btn-label{font-size:.85rem;font-weight:500}
.input-wrapper{position:relative}
.entry-textarea{width:100%;padding:24px;border:2px solid var(--border);border-radius:20px;resize:none;font-family:'DM Serif Display',serif;font-size:1.2rem;line-height:1.8;color:var(--text-primary);background:var(--bg-secondary);transition:all .3s ease}
.entry-textarea:focus{outline:none;border-color:var(--accent);background:var(--bg-card-solid);box-shadow:0 0 0 4px var(--accent-light)}
.app-wrapper.dark .entry-textarea:focus{box-shadow:0 0 0 4px rgba(196,165,116,.2)}
.entry-textarea::placeholder{color:var(--text-muted)}
.textarea-footer{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:0 8px}
.char-progress-wrapper{position:relative;width:40px;height:40px}
.char-progress-ring{width:100%;height:100%;transform:rotate(-90deg)}
.char-progress-bg{stroke:var(--bg-tertiary)}
.char-progress-fill{stroke:var(--accent);stroke-linecap:round;transition:stroke-dasharray .2s ease,stroke .2s ease}
.char-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;color:var(--text-muted)}
.char-count.warning{color:#f59e0b}.char-count.limit{color:#ef4444}
.keyboard-hint{display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--text-muted)}
.keyboard-hint kbd{background:var(--bg-tertiary);padding:4px 8px;border-radius:6px;font-family:inherit;font-size:.7rem}
.input-footer{margin-top:24px}
.save-button{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:18px 32px;background:var(--bg-tertiary);color:var(--text-muted);border:none;border-radius:16px;font-size:1rem;font-weight:600;cursor:not-allowed;transition:all .4s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.save-button.ready{background:var(--accent-gradient);color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(196,165,116,.4)}
.save-button.ready:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(196,165,116,.5)}
.save-button.saving{background:var(--accent)}
.saving-spinner{width:24px;height:24px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.card-success{box-shadow:var(--shadow-md)}
.success-glow{position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#4ade80,var(--accent),#4ade80);background-size:200% 100%;animation:shimmer 3s ease-in-out infinite}
@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.success-header{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.success-icon{width:56px;height:56px;background:linear-gradient(135deg,#4ade80,#22c55e);border-radius:16px;display:flex;align-items:center;justify-content:center;color:#fff;animation:successPop .5s ease}
@keyframes successPop{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.success-header h3{font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--text-primary)}
.success-header-main{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:1}
.success-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.mini-action-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-secondary);padding:8px 12px;border-radius:12px;cursor:pointer;transition:all .2s ease;font-weight:600;font-size:.85rem}
.mini-action-btn:hover{transform:translateY(-1px);box-shadow:var(--shadow-sm)}
.mini-action-btn.danger{color:#ef4444}
.entry-mood-display{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:12px;border:1px solid;font-size:.85rem;font-weight:500;margin-bottom:16px}
.entry-display{background:var(--bg-secondary);padding:28px;border-radius:20px;margin:20px 0;border-left:4px solid var(--accent)}
.entry-text{font-family:'DM Serif Display',serif;font-size:1.25rem;line-height:1.9;color:var(--text-primary)}
.success-footer{text-align:center;padding-top:24px;border-top:1px solid var(--border)}
.plant-emoji{font-size:3rem;display:inline-block;animation:plantGrow 2s ease-in-out infinite}
@keyframes plantGrow{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.1) rotate(3deg)}}
.success-message{font-size:1.1rem;font-weight:600;color:#22c55e;margin-bottom:4px}
.success-sub{font-size:.9rem;color:var(--text-muted)}
.secondary-btn{padding:18px 18px;border-radius:16px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-secondary);font-weight:700;cursor:pointer;transition:all .2s ease}
.secondary-btn:hover{transform:translateY(-1px);box-shadow:var(--shadow-sm)}

/* Calendar */
.calendar-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.month-nav-btn{width:44px;height:44px;border:none;background:var(--bg-secondary);border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);cursor:pointer;transition:all .2s ease}
.month-nav-btn:hover{background:var(--accent-light);color:var(--accent-dark);transform:scale(1.05)}
.month-info{text-align:center}
.month-title{font-family:'DM Serif Display',serif;font-size:1.6rem;color:var(--text-primary)}
.month-stats{font-size:.85rem;color:var(--text-muted);margin-top:4px}
.month-count{font-weight:700;color:var(--accent)}
.weekday-row{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:12px}
.weekday-label{text-align:center;font-size:.75rem;font-weight:600;color:var(--text-muted);padding:8px 0;text-transform:uppercase;letter-spacing:.5px}

/* FIX: avoid rounding overflow + allow edge cells to fit */
.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;transition:opacity .15s ease,transform .15s ease;padding:2px}
.calendar-grid.sliding{opacity:.5;transform:scale(.98)}
.calendar-day-empty{aspect-ratio:1}

/* FIX: prevent clipping inside the calendar card */
.card-calendar{overflow:visible}

.calendar-day{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid transparent;background:var(--bg-secondary);border-radius:14px;cursor:pointer;transition:all .2s ease;position:relative}
.calendar-day:hover:not(.future){border-color:var(--accent);transform:scale(1.05)}
.calendar-day.today{background:var(--accent-light);border-color:var(--accent)}
.app-wrapper.dark .calendar-day.today{background:rgba(196,165,116,.2)}
.calendar-day.today .day-number{color:var(--accent-dark);font-weight:700}
.app-wrapper.dark .calendar-day.today .day-number{color:var(--accent)}
.calendar-day.selected{background:var(--accent-gradient);border-color:transparent;transform:scale(1.08);box-shadow:0 4px 15px rgba(196,165,116,.4)}
.calendar-day.selected .day-number{color:#fff}
.calendar-day.future{opacity:.35;cursor:default}
.day-number{font-size:.95rem;font-weight:500;color:var(--text-primary)}
.entry-indicator{width:6px;height:6px;background:var(--accent);border-radius:50%;margin-top:4px;transition:all .2s ease}
.calendar-day.selected .entry-indicator{background:#fff}
.calendar-edit-icon{position:absolute;top:6px;right:6px;opacity:.6;color:var(--text-muted)}
.calendar-day.selected .calendar-edit-icon{color:#fff;opacity:.85}
.calendar-day.today.has-entry .calendar-edit-icon{color:var(--accent-dark);opacity:.7}
.app-wrapper.dark .calendar-day.today.has-entry .calendar-edit-icon{color:var(--accent);opacity:.85}

/* FIX: on touch devices, disable hover/scale that can "stick" and get clipped */
@media (hover: none) and (pointer: coarse){
  .calendar-day:hover:not(.future){transform:none}
  .calendar-day.selected{transform:none}
  .month-nav-btn:hover{transform:none}
}

.entry-preview{margin-top:28px;padding:24px;border-radius:20px;opacity:0;transform:translateY(15px);transition:all .4s cubic-bezier(.4,0,.2,1);max-height:0;overflow:hidden}
.entry-preview.visible{opacity:1;transform:translateY(0);max-height:300px}
.preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.preview-date{font-size:.9rem;color:var(--text-muted);font-weight:500}
.preview-text{font-family:'DM Serif Display',serif;font-size:1.15rem;line-height:1.8;color:var(--text-primary)}
.preview-empty{color:var(--text-muted);font-style:italic}

/* List */
.list-container{display:flex;flex-direction:column;gap:36px}
.month-group{display:flex;flex-direction:column;gap:16px}
.month-divider{display:flex;align-items:center;gap:16px}
.month-divider-content{display:flex;align-items:center;gap:10px;color:var(--accent)}
.month-divider-content span{font-family:'DM Serif Display',serif;font-size:1.15rem;white-space:nowrap}
.divider-line{flex:1;height:2px;background:linear-gradient(90deg,var(--accent-light),transparent)}
.month-entry-count{font-size:.8rem;font-weight:600;color:var(--text-muted);background:var(--bg-tertiary);padding:4px 10px;border-radius:8px}
.entries-list{display:flex;flex-direction:column;gap:14px}
.entry-card{display:flex;gap:18px;padding:22px;border-radius:20px;animation:entrySlideIn .4s ease forwards;opacity:0;transform:translateY(15px);transition:all .3s ease;border:none;width:100%;text-align:left;appearance:none;-webkit-appearance:none;font:inherit;color:inherit;cursor:pointer}
.entry-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md)}
@keyframes entrySlideIn{to{opacity:1;transform:translateY(0)}}
.entry-card-left{display:flex;flex-direction:column;align-items:center;gap:8px}
.entry-date-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;width:54px;height:54px;background:var(--accent-light);border-radius:14px;flex-shrink:0}
.app-wrapper.dark .entry-date-badge{background:rgba(196,165,116,.2)}
.entry-day{font-weight:700;font-size:1.2rem;color:var(--accent-dark);line-height:1}
.app-wrapper.dark .entry-day{color:var(--accent)}
.entry-weekday{font-size:.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;letter-spacing:.5px}
.entry-mood-indicator{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff}
.entry-content{font-family:'DM Serif Display',serif;font-size:1.1rem;line-height:1.7;color:var(--text-primary);flex:1;align-self:center}

/* Empty */
.card-empty{text-align:center;padding:60px 40px}
.empty-illustration{position:relative;display:inline-block;margin-bottom:20px}
.empty-book{font-size:4rem}
.empty-sparkles{position:absolute;top:-10px;right:-10px;font-size:1.5rem;animation:sparkleFloat 2s ease-in-out infinite}
@keyframes sparkleFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(5px,-5px)}}
.card-empty h3{font-family:'DM Serif Display',serif;font-size:1.6rem;color:var(--text-primary);margin-bottom:12px}
.card-empty p{color:var(--text-muted);font-size:1rem;line-height:1.6;max-width:300px;margin:0 auto}

/* Modals */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding:60px 20px;z-index:1000;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.search-modal{width:100%;max-width:600px;background:var(--bg-card-solid);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-lg);animation:slideUp .3s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.search-header{display:flex;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid var(--border)}
.search-header svg{color:var(--text-muted);flex-shrink:0}
.search-input{flex:1;border:none;background:none;font-size:1.1rem;color:var(--text-primary);outline:none}
.search-input::placeholder{color:var(--text-muted)}
.search-close{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:8px;border-radius:8px;transition:all .2s ease}
.search-close:hover{background:var(--bg-tertiary);color:var(--text-primary)}
.search-results{max-height:400px;overflow-y:auto;padding:16px}
.no-results{text-align:center;padding:40px;color:var(--text-muted)}
.search-result-item{padding:16px;border-radius:16px;margin-bottom:8px;background:var(--bg-secondary);transition:all .2s ease;border:none;width:100%;text-align:left;cursor:pointer;appearance:none;-webkit-appearance:none;font:inherit;color:inherit}
.search-result-item:hover{background:var(--bg-tertiary)}
.search-result-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.search-result-date{font-size:.8rem;color:var(--text-muted);font-weight:500}
.search-result-text{font-family:'DM Serif Display',serif;color:var(--text-primary);line-height:1.6}
.stats-modal{width:100%;max-width:500px;background:var(--bg-card-solid);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-lg);animation:slideUp .3s ease}
.stats-header{display:flex;justify-content:space-between;align-items:center;padding:24px;border-bottom:1px solid var(--border)}
.stats-header h2{display:flex;align-items:center;gap:12px;font-family:'DM Serif Display',serif;font-size:1.4rem;color:var(--text-primary)}
.stats-header h2 svg{color:var(--accent)}
.modal-close{background:none;border:none;color:var(--text-muted);cursor:pointer;padding:8px;border-radius:8px;transition:all .2s ease}
.modal-close:hover{background:var(--bg-tertiary);color:var(--text-primary)}
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:24px}
.stat-card{background:var(--bg-secondary);padding:20px;border-radius:16px;text-align:center}
.stat-card .stat-icon{color:var(--accent);margin-bottom:8px}
.stat-card .stat-value{font-size:2rem;font-weight:700;color:var(--text-primary);line-height:1}
.stat-card .stat-label{font-size:.8rem;color:var(--text-muted);margin-top:4px}
.mood-summary{display:flex;align-items:center;justify-content:center;gap:12px;padding:0 24px 24px;font-size:.9rem;color:var(--text-secondary)}
.top-mood{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:12px;font-weight:600}
.stats-chart{padding:0 24px 24px}
.stats-chart h3{font-size:.9rem;color:var(--text-secondary);margin-bottom:16px;font-weight:500}
.chart-bars{display:flex;align-items:flex-end;gap:12px;height:120px}
.chart-bar-container{flex:1;display:flex;flex-direction:column;align-items:center;height:100%}
.chart-bar{width:100%;background:var(--accent-gradient);border-radius:8px 8px 0 0;display:flex;align-items:flex-start;justify-content:center;min-height:20px;transition:height .5s ease}
.chart-bar-value{font-size:.7rem;font-weight:600;color:#fff;padding-top:4px}
.chart-bar-label{font-size:.7rem;color:var(--text-muted);margin-top:8px}

/* Auth */
.auth-wrapper{min-height:calc(100vh - 80px);display:flex;align-items:center;justify-content:center;padding:40px 16px;position:relative;z-index:10}
.auth-card{max-width:420px;width:100%;padding:28px 24px 24px;border-radius:24px;box-shadow:var(--shadow-md)}
.auth-header{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.auth-icon{width:44px;height:44px;border-radius:14px;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
.auth-header h1{font-family:'DM Serif Display',serif;font-size:1.6rem;color:var(--text-primary)}
.auth-header p{font-size:.9rem;color:var(--text-muted);margin-top:4px}
.auth-tabs{display:flex;gap:8px;background:var(--bg-secondary);padding:4px;border-radius:999px;margin-bottom:20px}
.auth-tab{flex:1;border:none;background:transparent;border-radius:999px;font-size:.9rem;padding:8px 0;cursor:pointer;color:var(--text-muted);font-weight:500;transition:all .2s ease}
.auth-tab.active{background:var(--accent-gradient);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.auth-form{display:flex;flex-direction:column;gap:14px}
.auth-form label{font-size:.8rem;color:var(--text-secondary);display:block}
.auth-input-wrapper{margin-top:4px;display:flex;align-items:center;gap:8px;background:var(--bg-secondary);border-radius:12px;padding:10px 12px;border:1px solid var(--border)}
.auth-input-wrapper input{flex:1;border:none;outline:none;background:transparent;color:var(--text-primary);font-size:.95rem}
.remember-row{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:.8rem;color:var(--text-muted)}
.remember-row input{width:14px;height:14px}
.auth-error{margin-top:2px;font-size:.8rem;color:#ef4444;background:#fee2e2;padding:8px 10px;border-radius:10px}
.app-wrapper.dark .auth-error{background:rgba(248,113,113,.12)}
.auth-submit{margin-top:6px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:12px;border:none;background:var(--accent-gradient);color:#fff;font-weight:600;font-size:.95rem;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.2);transition:all .2s ease}
.auth-submit:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,.25)}
.auth-submit:disabled{opacity:.75;cursor:not-allowed;transform:none}
.auth-note{margin-top:10px;font-size:.75rem;color:var(--text-muted);text-align:center}

/* User chip */
.user-chip{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:var(--glass-bg);border:1px solid var(--glass-border);font-size:.8rem;color:var(--text-secondary)}
.user-chip svg:first-child{color:var(--accent-dark)}
.user-logout-btn{border:none;background:transparent;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:2px;border-radius:999px;transition:all .2s ease}
.user-logout-btn:hover{background:var(--bg-tertiary);color:var(--text-primary)}

/* Editor modal */
.editor-modal{width:100%;max-width:650px;background:var(--bg-card-solid);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-lg);animation:slideUp .3s ease}
.editor-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:24px;border-bottom:1px solid var(--border)}
.editor-title{display:flex;align-items:center;gap:10px;font-family:'DM Serif Display',serif;font-size:1.35rem;color:var(--text-primary)}
.editor-date{font-size:.85rem;color:var(--text-muted);margin-top:6px}
.editor-body{padding:20px 24px 24px}
.editor-textarea{width:100%;padding:18px;border:2px solid var(--border);border-radius:16px;resize:none;font-family:'DM Serif Display',serif;font-size:1.1rem;line-height:1.8;color:var(--text-primary);background:var(--bg-secondary);transition:all .2s ease}
.editor-textarea:focus{outline:none;border-color:var(--accent);background:var(--bg-card-solid);box-shadow:0 0 0 4px var(--accent-light)}
.editor-mood-row{display:flex;align-items:center;justify-content:space-between;margin:-8px 0 12px}
.link-btn{background:none;border:none;padding:6px 2px;cursor:pointer;color:var(--text-muted);font-weight:600}
.link-btn:hover{color:var(--text-primary)}
.editor-remaining{font-size:.8rem;color:var(--text-muted);font-weight:600}
.editor-remaining.warning{color:#f59e0b}
.editor-remaining.limit{color:#ef4444}
.editor-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;flex-wrap:wrap}
.editor-actions-right{display:flex;gap:12px;align-items:center}
.danger-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.08);color:#ef4444;font-weight:800;cursor:pointer}
.danger-btn:disabled{opacity:.5;cursor:not-allowed}
.primary-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;border:none;background:var(--bg-tertiary);color:var(--text-muted);font-weight:800;cursor:not-allowed}
.primary-btn.ready{background:var(--accent-gradient);color:#fff;cursor:pointer}
.editor-hint{margin-top:14px;font-size:.8rem;color:var(--text-muted)}
.editor-hint kbd{background:var(--bg-tertiary);padding:3px 8px;border-radius:6px}

/* Undo toast */
.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2000;background:var(--bg-card-solid);border:1px solid var(--border);box-shadow:var(--shadow-lg);border-radius:999px;padding:10px 12px 10px 14px;display:flex;align-items:center;gap:10px}
.toast-text{color:var(--text-secondary);font-weight:600;font-size:.9rem}
.toast-undo{border:none;background:var(--accent-gradient);color:#fff;font-weight:800;padding:8px 12px;border-radius:999px;cursor:pointer}
.toast-dismiss{border:none;background:transparent;color:var(--text-muted);padding:6px;border-radius:999px;cursor:pointer}
.toast-dismiss:hover{background:var(--bg-tertiary);color:var(--text-primary)}

/* Responsive */
@media (max-width:640px){
  .title-number{font-size:4.5rem}
  .nav-pill span{display:none}
  .nav-pill{padding:14px 18px}
  .card{padding:24px;border-radius:24px}
  .stats-row{flex-direction:column;align-items:center;gap:12px}
  .mood-options{justify-content:center}
  .mood-btn-label{display:none}
  .mood-btn{padding:12px}
  .keyboard-hint{display:none}
  .entry-card{flex-direction:column;align-items:flex-start}
  .entry-card-left{flex-direction:row;width:100%}
  .header-actions{gap:6px}
  .icon-btn{width:38px;height:38px}
  .icon-btn.action-btn{padding:0;width:38px;justify-content:center}
  .action-btn-label{display:none}
  .theme-toggle-label{display:none}
  .auth-card{padding:24px 20px}
  .success-header-main{flex-direction:column;align-items:flex-start}
  .success-actions{justify-content:flex-start}
  .color-trigger-label{display:none}
  .color-picker-trigger{width:38px;padding:0}
}
      `}</style>

      <AnimatedBackground />
      <Confetti active={confettiActive} />

      {currentUser ? (
        <>
          <SearchModal entries={entries} isOpen={searchOpen} setIsOpen={setSearchOpen} onNavigate={navigateToDate} />
          <StatsModal entries={entries} isOpen={statsOpen} setIsOpen={setStatsOpen} />

          <EntryEditorModal
            isOpen={editorOpen}
            dateKey={editorDateKey}
            entry={editorDateKey ? entries[editorDateKey] : null}
            onClose={closeEditor}
            onSave={upsertEntry}
            onDelete={deleteEntry}
          />

          <UndoToast toast={toast} onUndo={undoDelete} onDismiss={dismissToast} />

          <Header
            currentView={currentView}
            setCurrentView={setCurrentView}
            streak={streak}
            totalEntries={totalEntries}
            theme={theme}
            setTheme={setTheme}
            colorScheme={colorScheme}
            setColorScheme={setColorScheme}
            setSearchOpen={setSearchOpen}
            setStatsOpen={setStatsOpen}
            currentUser={currentUser}
            onLogout={handleLogout}
            onExport={handleExport}
            onImportClick={handleImportClick}
          />

          {currentView === 'today' && (
            <EntryInput entries={entries} onUpsert={upsertEntry} onEditDate={openEditor} onDeleteDate={deleteEntry} showConfetti={showConfetti} />
          )}
          {currentView === 'calendar' && <CalendarView entries={entries} onEditDate={openEditor} jumpTo={calendarJump} />}
          {currentView === 'list' && <ListView entries={entries} onEditDate={openEditor} />}
        </>
      ) : (
        <AuthScreen onAuthComplete={handleAuthComplete} />
      )}
    </div>
  );
}