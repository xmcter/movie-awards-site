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
          bg: "var(--rc-bg)",
          card: "var(--rc-card)",
          elevated: "var(--rc-elevated)",
          border: "var(--rc-border)",
          gold: "var(--rc-gold)",
          "gold-light": "var(--rc-gold-light)",
          muted: "var(--rc-muted)",
          text: "var(--rc-text)",
          accent: "var(--rc-accent)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
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
