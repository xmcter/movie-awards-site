/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: "#0a0a0b",
          card: "#141416",
          elevated: "#1c1c1f",
          border: "#2a2a2e",
          gold: "#c9a227",
          "gold-light": "#e8c547",
          muted: "#8a8a93",
          text: "#f4f4f5",
          accent: "#d4a574",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
        display: [
          '"Noto Serif SC"',
          '"Songti SC"',
          "Georgia",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};
