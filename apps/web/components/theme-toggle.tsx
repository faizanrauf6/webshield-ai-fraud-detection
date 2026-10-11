'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let manual: string | null = null;
    try {
      manual = localStorage.getItem('webshield-theme');
    } catch {
      // The switch still works when browser storage is blocked.
    }
    function apply(theme: string) {
      document.documentElement.dataset.theme = theme;
      setDark(theme === 'dark');
    }
    apply(manual === 'light' || manual === 'dark' ? manual : media.matches ? 'dark' : 'light');
    function followDevice(event: MediaQueryListEvent) {
      if (manual !== 'light' && manual !== 'dark') apply(event.matches ? 'dark' : 'light');
    }
    function followStorage(event: StorageEvent) {
      if (event.key !== 'webshield-theme' && event.key !== null) return;
      manual = event.newValue;
      apply(manual === 'light' || manual === 'dark' ? manual : media.matches ? 'dark' : 'light');
    }
    // A local event also preserves manual selection when storage cannot be written.
    function chooseManually() {
      manual = document.documentElement.dataset.theme ?? 'light';
      apply(manual);
    }
    media.addEventListener('change', followDevice);
    window.addEventListener('storage', followStorage);
    window.addEventListener('webshield-theme-change', chooseManually);
    return () => {
      media.removeEventListener('change', followDevice);
      window.removeEventListener('storage', followStorage);
      window.removeEventListener('webshield-theme-change', chooseManually);
    };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('webshield-theme', next);
    } catch {
      // Apply the preference for this session even if persistence is unavailable.
    }
    window.dispatchEvent(new Event('webshield-theme-change'));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Dark mode"
      aria-pressed={dark}
      title="Switch between light and dark mode"
      onClick={toggle}
    >
      <Moon className="theme-moon" size={19} aria-hidden="true" />
      <Sun className="theme-sun" size={19} aria-hidden="true" />
      <span className="theme-toggle-label">Theme</span>
    </button>
  );
}
