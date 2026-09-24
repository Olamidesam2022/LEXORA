import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const transitionTimeoutRef = useRef<number>();
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      return saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "light";
    } catch {
      return "light";
    }
  });
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      const currentTheme =
        saved === "light" || saved === "dark" || saved === "system"
          ? saved
          : "light";

      return currentTheme === "dark"
        || (currentTheme === "system"
          && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const applyTheme = (newTheme: Theme) => {
    const html = document.documentElement;
    let isDarkMode = false;

    if (newTheme === "dark") {
      isDarkMode = true;
    } else if (newTheme === "light") {
      isDarkMode = false;
    } else {
      // system
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      isDarkMode = systemDark;
    }

    window.clearTimeout(transitionTimeoutRef.current);
    html.classList.add("theme-transitioning");
    window.requestAnimationFrame(() => {
      html.classList.toggle("dark", isDarkMode);
      html.style.colorScheme = isDarkMode ? "dark" : "light";
    });

    setIsDark(isDarkMode);
    transitionTimeoutRef.current = window.setTimeout(() => {
      html.classList.remove("theme-transitioning");
    }, 190);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
