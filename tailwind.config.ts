import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 🟢 Asosiy shrift oilasini Jakarta ga almashtiramiz
      fontFamily: {
        sans: ['var(--font-jakarta)', 'sans-serif'],
      },
      // 🟢 Moliya brend palitrasi ("Yashil CRM" dizayn yo'nalishi).
      // line = yashil-kulrang card border; ink = to'q yashil matn.
      colors: {
        brand: {
          page: "#f0f7f3",
          25: "#F6FBF8",
          50: "#F0F8F4",
          100: "#E2F5EB",
          200: "#C7E9D8",
          600: "#0BA360",
          700: "#078A50",
          800: "#0A7A4A",
          ink: "#122B1F",
          line: "#DFEAE3",
        },
      },
    },
  },
  plugins: [],
};
export default config;