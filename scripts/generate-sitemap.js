#!/usr/bin/env node
'use strict';

/**
 * Generates /sitemap.xml into the build output.
 *
 * Sources:
 *   - src/app/seo/public-routes.json  -> the static, indexable website routes
 *     (the same manifest SeoService uses for canonicals + fallback meta).
 *   - blog.1800limo.com WP REST API   -> every published post, as
 *     /blog/{slug} with its real lastmod. Best-effort: if the API is down the
 *     sitemap is still written with the static routes and a warning is logged.
 *
 * Only canonical URLs are emitted: no /home, no query strings, no private
 * areas. Run after `ng build`; see package.json "generate:sitemap".
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'src', 'app', 'seo', 'public-routes.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const SITE_URL = (process.env.SITEMAP_SITE_URL || manifest.siteUrl).replace(/\/+$/, '');
const WP_POSTS_URL = process.env.SITEMAP_WP_POSTS_URL
	|| 'https://blog.1800limo.com/wp-json/wp/v2/posts?status=publish&per_page=100&_fields=slug,modified_gmt';
const OUTPUT_PATH = process.env.SITEMAP_OUTPUT_PATH || path.join(__dirname, '..', 'dist', 'limo1800', 'sitemap.xml');
const FETCH_TIMEOUT_MS = 15000;

function fetchJson(urlStr) {
	return new Promise((resolve, reject) => {
		const client = urlStr.startsWith('https') ? https : http;
		const req = client.get(urlStr, { headers: { 'User-Agent': '1800limo-sitemap-generator' } }, (res) => {
			// WP paginates with X-WP-TotalPages; follow it so >100 posts are covered.
			if (res.statusCode < 200 || res.statusCode >= 300) {
				res.resume();
				reject(new Error(`Request to ${urlStr} failed with status ${res.statusCode}`));
				return;
			}
			let body = '';
			res.on('data', (chunk) => { body += chunk; });
			res.on('end', () => {
				try {
					resolve({ json: JSON.parse(body), totalPages: Number(res.headers['x-wp-totalpages'] || 1) });
				} catch (err) {
					reject(new Error(`Failed to parse JSON from ${urlStr}: ${err.message}`));
				}
			});
		});
		req.setTimeout(FETCH_TIMEOUT_MS, () => req.destroy(new Error(`Request to ${urlStr} timed out`)));
		req.on('error', reject);
	});
}

async function fetchBlogPosts() {
	const posts = [];
	const first = await fetchJson(WP_POSTS_URL);
	posts.push(...first.json);
	for (let page = 2; page <= first.totalPages; page++) {
		const sep = WP_POSTS_URL.includes('?') ? '&' : '?';
		const { json } = await fetchJson(`${WP_POSTS_URL}${sep}page=${page}`);
		posts.push(...json);
	}
	return posts
		.filter((p) => p && typeof p.slug === 'string' && p.slug.length)
		.map((p) => ({
			loc: `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`,
			lastmod: p.modified_gmt ? `${p.modified_gmt.slice(0, 19)}+00:00` : null,
			changefreq: 'monthly',
			priority: 0.6,
		}));
}

function escapeXml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function urlEntry(entry) {
	const lines = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
	if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
	if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
	if (entry.priority !== undefined && entry.priority !== null) lines.push(`    <priority>${Number(entry.priority).toFixed(1)}</priority>`);
	lines.push('  </url>');
	return lines.join('\n');
}

async function main() {
	const staticEntries = manifest.pages.map((page) => ({
		loc: page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`,
		lastmod: null,
		changefreq: page.changefreq,
		priority: page.priority,
	}));

	let blogEntries = [];
	try {
		blogEntries = await fetchBlogPosts();
	} catch (err) {
		console.warn(`sitemap: could not fetch blog posts (${err.message}); continuing with static routes only`);
	}

	const seen = new Set();
	const entries = [...staticEntries, ...blogEntries].filter((e) => {
		if (seen.has(e.loc)) return false;
		seen.add(e.loc);
		return true;
	});

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...entries.map(urlEntry),
		'</urlset>',
		'',
	].join('\n');

	fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
	fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
	console.log(`sitemap.xml written to ${OUTPUT_PATH} (${staticEntries.length} pages + ${blogEntries.length} blog posts)`);
}

main().catch((err) => {
	console.error('Failed to generate sitemap.xml:', err.message);
	process.exit(1);
});
