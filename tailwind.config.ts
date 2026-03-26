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
          600: "#1a9fff",
          500: "#66c0f4",
          400: "#8fd3ff"
        },
        accent: {
          500: "#66c0f4",
          400: "#8bcdf7"
        },
        // Semantic surface tokens
        surface: {
          page:    "#171a21", // html/body background
          header:  "#171d25", // sticky header / footer bar background
          card:    "#1d2633", // detail panel cards & inputs (parts-explorer)
          modal:   "#202833", // wizard/modal input backgrounds
          raised:  "#2b313d", // elevated modal panels
          hover:   "#3f4a5b", // hover state background
          nav:     "#25272d", // sidebar nav button background
          sidebar: "#24282f", // sidebar panel background
          btn:     "#3a4659", // secondary/toggle button background
          "btn-hover": "#4a5970", // secondary button hover
        },
        // Semantic border tokens
        rim: {
          DEFAULT: "#31465f", // standard border (parts-explorer)
          soft:    "#3f4a5b", // modal/wizard borders
          light:   "#5f7a9a", // lighter divider borders
          btn:     "#435266", // secondary button border
          brand:   "#1a9fff", // focus & active accent border
          "brand-dark": "#2f6eb6", // primary brand button border (darker)
        },
        // Semantic text tokens
        ink: {
          DEFAULT: "#d6e4f2", // primary content text
          alt:     "#dcdedf", // primary text in wizard/modal world
          label:   "#9aa8b8", // uppercase tracking labels
          muted:   "#9fb0c2", // secondary body text
          dim:     "#8f98a0", // de-emphasised / placeholder text
          brand:   "#1a9fff", // accent / interactive text
          bright:  "#cae4fb", // high-contrast accent text
          link:    "#7cc5ff", // light blue link/action text on dark buttons
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
