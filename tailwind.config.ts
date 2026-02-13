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
          950: "#0a0f14",
          900: "#111821",
          850: "#141d27",
          800: "#1b2430",
          700: "#2b394a",
          600: "#3b4d63",
          300: "#b6c4d8"
        },
        brand: {
          500: "#f0ad2c",
          400: "#f7c860"
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
