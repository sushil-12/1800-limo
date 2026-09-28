/** @type {import('tailwindcss').Config} */
module.exports = {
	// Tailwind is only used by the marketing landing pages. Bootstrap 4 is loaded
	// globally with same-named `!important` utilities (px-5, mt-3, ...), so every
	// Tailwind class is prefixed with `tw-` and scoped under a `.tw-scope` wrapper
	// to win over Angular Material / legacy element styles.
	content: ['./src/landing-pages/**/*.{html,ts}'],
	prefix: 'tw-',
	important: '.tw-scope',
	corePlugins: {
		// Preflight would reset global element styles and break the Bootstrap app.
		preflight: false,
		container: false
	},
	theme: {
		extend: {
			fontFamily: {
				poppins: ['Poppins', 'sans-serif']
			},
			colors: {
				brand: {
					orange: '#DE9B3D'
				}
			}
		}
	},
	plugins: []
};
