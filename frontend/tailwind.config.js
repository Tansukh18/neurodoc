/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                neuro: {
                    dark: "#0F172A",     // Deep Navy Background
                    primary: "#6366F1",  // Indigo Brand Color
                    accent: "#8B5CF6",   // Violet Accent
                    glass: "rgba(255, 255, 255, 0.1)", // Glassmorphism
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}