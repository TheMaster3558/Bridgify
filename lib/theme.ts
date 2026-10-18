// Runs before first paint (see app/layout.tsx) so the saved theme never flashes.
export const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export type ThemePreference = "light" | "dark" | "system";

const THEME_EVENT = "themechange";

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (preference === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", preference);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeThemePreference(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
