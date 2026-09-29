import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, ResolveEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import publicRoutes from '../seo/public-routes.json';

interface PublicPage {
	path: string;
	title: string;
	description: string;
}

/**
 * Route-driven SEO tags for the SPA.
 *
 * Every navigation gets:
 *  - a self-referencing `<link rel="canonical">` (query string stripped, `/home`
 *    and the other homepage aliases collapse to `/`),
 *  - `og:url` kept in sync with the canonical,
 *  - `<meta name="robots">`: `noindex, nofollow` for private/app areas, the 404
 *    route and every non-production build; `index, follow` otherwise,
 *  - a fallback `<title>` + meta description from `seo/public-routes.json`.
 *
 * Fallbacks are applied on `ResolveEnd`, which fires *before* the routed
 * component is instantiated, so a component that sets richer tags in
 * `ngOnInit` (about-us, fleet, blog-detail, ...) still wins. Canonical/robots
 * are applied on `NavigationEnd` because no component owns them.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
	private readonly siteUrl: string = publicRoutes.siteUrl.replace(/\/+$/, '');
	private readonly pagesByPath = new Map<string, PublicPage>(
		(publicRoutes.pages as PublicPage[]).map(page => [page.path, page])
	);
	private started = false;

	constructor(
		private router: Router,
		private title: Title,
		private meta: Meta,
		@Inject(DOCUMENT) private document: Document
	) { }

	/** Call once from the root component. Idempotent. */
	init(): void {
		if (this.started) { return; }
		this.started = true;

		this.router.events
			.pipe(filter((e): e is ResolveEnd => e instanceof ResolveEnd))
			.subscribe(e => this.applyFallbackTags(this.canonicalPath(e.urlAfterRedirects)));

		this.router.events
			.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
			.subscribe(e => {
				const path = this.canonicalPath(e.urlAfterRedirects);
				this.setCanonical(path);
				this.setRobots(path, this.isNotFoundRoute(this.router.routerState.snapshot.root));
			});
	}

	/** Absolute canonical URL for the current page, e.g. `https://www.1800limo.com/fleet`. */
	canonicalUrl(path: string): string {
		return this.siteUrl + (path === '/' ? '/' : path);
	}

	/**
	 * Normalises a router URL into the canonical path: no query string, no
	 * fragment, no trailing slash, homepage aliases collapsed to `/`.
	 */
	canonicalPath(url: string): string {
		let path = url.split(/[?#]/)[0] || '/';
		if (path.length > 1) { path = path.replace(/\/+$/, ''); }
		if (!path.startsWith('/')) { path = '/' + path; }
		const aliases = publicRoutes.canonicalAliases as { [key: string]: string };
		return aliases[path] || path;
	}

	isNoindexPath(path: string): boolean {
		return publicRoutes.noindexPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
	}

	private setCanonical(path: string): void {
		const href = this.canonicalUrl(path);
		let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
		if (!link) {
			link = this.document.createElement('link');
			link.setAttribute('rel', 'canonical');
			this.document.head.appendChild(link);
		}
		link.setAttribute('href', href);
		this.meta.updateTag({ property: 'og:url', content: href });
	}

	private setRobots(path: string, isNotFound: boolean): void {
		const noindex = isNotFound || this.isNoindexPath(path) || environment.environmentName !== 'Production';
		this.meta.updateTag({ name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' });
	}

	private applyFallbackTags(path: string): void {
		const page = this.pagesByPath.get(path);
		if (!page) { return; }
		this.title.setTitle(page.title);
		this.meta.updateTag({ name: 'description', content: page.description });
		this.meta.updateTag({ property: 'og:title', content: page.title });
		this.meta.updateTag({ property: 'og:description', content: page.description });
		this.meta.updateTag({ name: 'twitter:title', content: page.title });
		this.meta.updateTag({ name: 'twitter:description', content: page.description });
	}

	/** True when the deepest activated route is the `**` catch-all. */
	private isNotFoundRoute(root: ActivatedRouteSnapshot): boolean {
		let node: ActivatedRouteSnapshot | null = root;
		while (node) {
			if (node.routeConfig && node.routeConfig.path === '**') { return true; }
			node = node.firstChild;
		}
		return false;
	}
}
