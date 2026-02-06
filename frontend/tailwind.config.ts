import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark investigative theme
        background: "#0a0a0f",
        foreground: "#e5e5e5",
        card: {
          DEFAULT: "#111118",
          foreground: "#e5e5e5",
        },
        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#1e1e2e",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#f59e0b",
          foreground: "#000000",
        },
        muted: {
          DEFAULT: "#18181b",
          foreground: "#71717a",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        border: "#27272a",
        ring: "#3b82f6",
        // Entity type colors
        person: "#ef4444",
        organization: "#22c55e",
        location: "#8b5cf6",
        date: "#06b6d4",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
