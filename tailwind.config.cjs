module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {},
  },
  //prefix: 'lwt-',
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
