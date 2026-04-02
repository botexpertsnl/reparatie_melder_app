import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1020",
        foreground: "#e6ecff",
        muted: "#1a2340",
        accent: "#6d7dff"
      }
    }
  },
  plugins: []
};

export default config;
