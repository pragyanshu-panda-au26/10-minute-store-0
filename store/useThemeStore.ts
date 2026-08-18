import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",

  setTheme: (theme: Theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      localStorage.setItem("satyug_theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  },

  toggleTheme: () => {
    const nextTheme = get().theme === "light" ? "dark" : "light";
    get().setTheme(nextTheme);
  },

  initTheme: () => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("satyug_theme") as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        get().setTheme(savedTheme);
      } else {
        // System preference default
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        get().setTheme(prefersDark ? "dark" : "light");
      }
    }
  },
}));
