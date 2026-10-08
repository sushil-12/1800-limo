#!/usr/bin/env node
'use strict';

/**
 * Writes a .br and a .gz copy next to every compressible static file in the
 * build output, so Apache can serve them as-is (see "Pre-compressed assets" in
 * src/.htaccess) instead of gzipping the 6 MB main bundle on every request.
 *
 * Usage: node scripts/precompress.js [dir]   (default: dist/limo1800)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'limo1800'));
// index.html is left out on purpose: SPA routes are internal rewrites to it and
// it is small enough for mod_deflate.
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.svg', '.json']);
const MIN_BYTES = 1024;

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// .well-known files must be served byte-for-byte to Apple/Google.
			return entry.name === '.well-known' ? [] : walk(full);
		}
		return EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [full] : [];
	});
}

function main() {
	if (!fs.existsSync(ROOT)) {
		console.error(`[precompress] ${ROOT} does not exist - run the build first.`);
		process.exit(1);
	}

	let before = 0;
	let afterBr = 0;
	let count = 0;

	for (const file of walk(ROOT)) {
		const source = fs.readFileSync(file);
		if (source.length < MIN_BYTES) {
			continue;
		}

		const br = zlib.brotliCompressSync(source, {
			params: {
				[zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
				[zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
			},
		});
		const gz = zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });

		// Only keep a variant that is actually smaller than the original.
		if (br.length < source.length) {
			fs.writeFileSync(`${file}.br`, br);
		}
		if (gz.length < source.length) {
			fs.writeFileSync(`${file}.gz`, gz);
		}

		before += source.length;
		afterBr += Math.min(br.length, source.length);
		count++;
	}

	const mb = (n) => (n / 1024 / 1024).toFixed(2);
	console.log(`[precompress] ${count} files: ${mb(before)} MB -> ${mb(afterBr)} MB (brotli)`);
}

main();
