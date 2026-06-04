import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-hover": "var(--surface-hover)",
        primary: "var(--primary)",
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)"
        },
        navy: {
          950: "#071226",
          900: "#0a1730",
          850: "#0d1d3b",
          800: "#112347"
        },
        brand: {
          blue: "#2563eb",
          cyan: "#26c6da",
          green: "#45c49f",
          purple: "#8b5cf6",
          red: "#ff4057"
        }
      },
      boxShadow: {
        card: "0 12px 30px rgba(15, 23, 42, 0.08)",
        soft: "0 10px 25px rgba(30, 64, 175, 0.13)"
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
