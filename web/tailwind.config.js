/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        secondary: "#4355b9",
        error: "#ba1a1a",
        background: "#fdf8f8",
        surface: "#fdf8f8",
        "on-surface": "#1c1b1b",
        "on-surface-variant": "#444748",
        "on-primary": "#ffffff",
        "on-secondary": "#ffffff",
        "surface-container-low": "#f7f3f2",
        "surface-container": "#f1edec",
        "outline-variant": "#c4c7c7",
        outline: "#747878",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
      },
      fontFamily: {
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
