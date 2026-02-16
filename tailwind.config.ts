import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        steel: {
          950: "#0f141b",
          900: "#171a21",
          850: "#1b2838",
          800: "#2a475e",
          700: "#37506a",
          600: "#66c0f4",
          300: "#c7d5e0"
        },
        brand: {
          500: "#66c0f4",
          400: "#8fd3ff"
        },
        accent: {
          500: "#66c0f4",
          400: "#8bcdf7"
        }
      },
      boxShadow: {
        panel: "0 14px 36px rgba(5, 8, 12, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
