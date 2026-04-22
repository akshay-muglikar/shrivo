type Theme = "light" | "dark"

const STORAGE_KEY = "shrivo-theme"

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === "dark" || stored === "light") return stored
  return "light"
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  localStorage.setItem(STORAGE_KEY, theme)
}

export function toggleTheme(): Theme {
  const current = getTheme()
  const next: Theme = current === "dark" ? "light" : "dark"
  applyTheme(next)
  return next
}

// Apply on page load (call once at startup)
export function initTheme() {
  applyTheme(getTheme())
}
