import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeId = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeId;
  isDark: boolean;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
});

/** Safely read matchMedia — returns false in sandboxed/SSR environments */
function prefersColorSchemeDark(): boolean {
  try {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Resolves 'system' → actual 'light' | 'dark' */
function resolveTheme(theme: ThemeId): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return prefersColorSchemeDark() ? 'dark' : 'light';
}

/** Safely read localStorage — returns null in restricted environments */
function safeGetStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Safely write localStorage */
function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

/** Applies data-theme attribute to <html> */
function applyToDOM(resolved: 'light' | 'dark') {
  try {
    const root = document.documentElement;
    root.style.transition = 'background-color 0.35s ease, color 0.35s ease';
    if (resolved === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  } catch { /* ignore in sandboxed envs */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(
    () => (safeGetStorage('hibrain_theme') as ThemeId) || 'light'
  );

  const [isDark, setIsDark] = useState<boolean>(
    () => resolveTheme((safeGetStorage('hibrain_theme') as ThemeId) || 'light') === 'dark'
  );

  const applyTheme = useCallback((t: ThemeId) => {
    const resolved = resolveTheme(t);
    applyToDOM(resolved);
    setIsDark(resolved === 'dark');
  }, []);

  // Apply theme on mount + when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listen to OS preference changes when in 'system' mode
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  const setTheme = useCallback((t: ThemeId) => {
    safeSetStorage('hibrain_theme', t);
    setThemeState(t);
    applyTheme(t);
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
