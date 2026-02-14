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
          950: "#071522",
          900: "#0c2338",
          850: "#12304a",
          800: "#173c5c",
          700: "#2a5d87",
          600: "#4b86b6",
          300: "#d9e9f8"
        },
        brand: {
          500: "#f4c542",
          400: "#f8d978"
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
