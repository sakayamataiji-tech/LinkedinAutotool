import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a5ff",
          500: "#3282ff",
          600: "#1a61f5",
          700: "#154ce1",
          800: "#183fb6",
          900: "#1a398f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
