import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Gensis kurumsal renkleri (logodan)
        brand: {
          DEFAULT: "#0d8b8b", // teal
          dark: "#0a6d6d",
          light: "#e6f4f4",
        },
        navy: {
          DEFAULT: "#1e2a5b",
          dark: "#141d40",
        },
        side: "#1e2a5b", // lacivert kenar menü
      },
    },
  },
  plugins: [],
};
export default config;
