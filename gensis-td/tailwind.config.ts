import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Prestige teması — birincil vurgu lacivert, ikincil teal
        brand: {
          DEFAULT: "#1e2a5b", // navy (birincil)
          dark: "#141d40",
          light: "#eef1f8", // yumuşak lacivert ton
        },
        navy: {
          DEFAULT: "#1e2a5b",
          dark: "#141d40",
        },
        teal: {
          DEFAULT: "#0d8b8b", // ikincil aksan
          dark: "#0a6d6d",
          light: "#e6f4f4",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
