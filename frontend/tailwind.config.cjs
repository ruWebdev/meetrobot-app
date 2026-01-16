/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            borderRadius: {
                xl: '0.9rem',
            },
        },
    },
    plugins: [],
};
