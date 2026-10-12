import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, throwError } from 'rxjs';
import { map, catchError, switchMap, shareReplay } from 'rxjs/operators';
import { BlogPost, BlogComment } from './blog.data';

const WP_API = 'https://blog.1800limo.com/wp-json/wp/v2';
const WP_CUSTOM_API = 'https://blog.1800limo.com/wp-json/custom/v1';

export interface WpStyleHandle {
    handle: string;
    src: string;
    ver: string;
    media: string;
    before: string;
    after: string;
}

export interface WpStyles {
    links: string[];
    items: WpStyleHandle[];
}
const PLACEHOLDER_IMG = 'assets/images/placeholder.jpg';

interface WpRendered { rendered: string; }
interface WpPost {
   id: number;
   slug: string;
   date: string;
   title: WpRendered;
   content: WpRendered;
   excerpt: WpRendered;
   featured_media: number;
   author: number;
   categories: number[];
   tags: number[];
   _embedded?: {
      author?: Array<{ name: string; description?: string; avatar_urls?: { [key: string]: string } }>;
      'wp:featuredmedia'?: Array<{ source_url?: string; media_details?: any }>;
      'wp:term'?: Array<Array<{ taxonomy: string; name: string; slug: string }>>;
   };
}

interface WpComment {
   id: number;
   author_name: string;
   date: string;
   content: WpRendered;
   author_avatar_urls?: { [key: string]: string };
}

export interface BlogCategory {
   id: string;
   name: string;
   count: number;
   active: boolean;
}

export interface NewComment {
   post: number;
   author_name: string;
   author_email: string;
   content: string;
}

@Injectable({ providedIn: 'root' })
export class BlogService {

   constructor(private http: HttpClient) { }

   // In-memory caches so repeat navigations within a session don't re-hit the
   // slow WP origin (posts with `_embed` and the custom styles endpoint have
   // been measured at 10-115s server-side due to unindexed/uncached queries).
   private homePostsCache$?: Observable<BlogPost[]>;
   private allPostsCache$?: Observable<BlogPost[]>;
   private categoriesCache$?: Observable<BlogCategory[]>;
   private blockStylesCache$?: Observable<WpStyles>;
   private postBySlugCache = new Map<string, Observable<BlogPost | undefined>>();

   getBlockStyles(): Observable<WpStyles> {
      if (!this.blockStylesCache$) {
         this.blockStylesCache$ = this.http
            .get<WpStyles>(`${WP_CUSTOM_API}/styles`)
            .pipe(
               shareReplay(1),
               catchError(() => {
                  this.blockStylesCache$ = undefined;
                  return of({ links: [], items: [] });
               })
            );
      }
      return this.blockStylesCache$;
   }

   getPosts(): Observable<BlogPost[]> {
      if (!this.allPostsCache$) {
         this.allPostsCache$ = this.http
            .get<WpPost[]>(`${WP_API}/posts?per_page=30`)
            .pipe(
               switchMap(posts => this.hydratePosts(posts)),
               shareReplay(1),
               catchError(err => {
                  this.allPostsCache$ = undefined;
                  return throwError(() => err);
               })
            );
      }
      return this.allPostsCache$;
   }

   getHomePosts(): Observable<BlogPost[]> {
      if (!this.homePostsCache$) {
         this.homePostsCache$ = this.http
            .get<WpPost[]>(`${WP_API}/posts?per_page=10`)
            .pipe(
               switchMap(posts => this.hydratePosts(posts)),
               shareReplay(1),
               catchError(err => {
                  this.homePostsCache$ = undefined;
                  return throwError(() => err);
               })
            );
      }
      return this.homePostsCache$;
   }

   getPostBySlug(slug: string): Observable<BlogPost | undefined> {
      if (!this.postBySlugCache.has(slug)) {
         const post$ = this.http
            .get<WpPost[]>(`${WP_API}/posts?slug=${encodeURIComponent(slug)}&_embed`)
            .pipe(
               map(posts => posts.length ? this.mapPost(posts[0]) : undefined),
               shareReplay(1),
               catchError(err => {
                  this.postBySlugCache.delete(slug);
                  return throwError(() => err);
               })
            );
         this.postBySlugCache.set(slug, post$);
      }
      return this.postBySlugCache.get(slug)!;
   }

   getCategories(): Observable<BlogCategory[]> {
      if (!this.categoriesCache$) {
         this.categoriesCache$ = this.http
            .get<Array<{ id: number; name: string; slug: string; count: number }>>(
               `${WP_API}/categories?per_page=30&hide_empty=true`
            )
            .pipe(
               map(cats => cats.map(c => ({
                  id: c.slug,
                  name: c.name,
                  count: c.count,
                  active: false
               }))),
               shareReplay(1),
               catchError(() => {
                  this.categoriesCache$ = undefined;
                  return of([]);
               })
            );
      }
      return this.categoriesCache$;
   }

   /**
    * Resolves featured image / author / category / tag names for a batch of
    * posts via a handful of bulk `include=` lookups instead of WP's `_embed`,
    * which forces one DB round-trip per post per relation on the origin server.
    */
   private hydratePosts(posts: WpPost[]): Observable<BlogPost[]> {
      if (!posts.length) return of([]);

      const uniq = (ids: Array<number | undefined>) =>
         Array.from(new Set(ids.filter((id): id is number => !!id)));

      const mediaIds = uniq(posts.map(p => p.featured_media));
      const authorIds = uniq(posts.map(p => p.author));
      const categoryIds = uniq(posts.flatMap(p => p.categories || []));
      const tagIds = uniq(posts.flatMap(p => p.tags || []));

      const media$ = mediaIds.length
         ? this.http.get<Array<{ id: number; source_url: string }>>(
              `${WP_API}/media?include=${mediaIds.join(',')}&per_page=30&_fields=id,source_url`
           ).pipe(catchError(() => of([])))
         : of([]);
      const authors$ = authorIds.length
         ? this.http.get<Array<{ id: number; name: string; description?: string; avatar_urls?: { [key: string]: string } }>>(
              `${WP_API}/users?include=${authorIds.join(',')}&per_page=30&_fields=id,name,description,avatar_urls`
           ).pipe(catchError(() => of([])))
         : of([]);
      const categories$ = categoryIds.length
         ? this.http.get<Array<{ id: number; name: string }>>(
              `${WP_API}/categories?include=${categoryIds.join(',')}&per_page=30&_fields=id,name`
           ).pipe(catchError(() => of([])))
         : of([]);
      const tags$ = tagIds.length
         ? this.http.get<Array<{ id: number; name: string }>>(
              `${WP_API}/tags?include=${tagIds.join(',')}&per_page=30&_fields=id,name`
           ).pipe(catchError(() => of([])))
         : of([]);

      return forkJoin([media$, authors$, categories$, tags$]).pipe(
         map(([media, authors, categories, tags]) => posts.map(p => this.mapPost(p, {
            mediaMap: new Map(media.map(m => [m.id, m.source_url])),
            authorMap: new Map(authors.map(a => [a.id, a])),
            categoryMap: new Map(categories.map(c => [c.id, c.name])),
            tagMap: new Map(tags.map(t => [t.id, t.name]))
         })))
      );
   }

   getComments(postId: number): Observable<BlogComment[]> {
      return this.http
         .get<WpComment[]>(`${WP_API}/comments?post=${postId}&per_page=30&order=desc&orderby=date`)
         .pipe(
            map(comments => comments.map(c => this.mapComment(c))),
            catchError(() => of([]))
         );
   }

   postComment(payload: NewComment): Observable<BlogComment> {
      return this.http
         .post<WpComment>(`${WP_API}/comments`, payload)
         .pipe(map(c => this.mapComment(c)));
   }

   private mapPost(p: WpPost, hydration?: {
      mediaMap: Map<number, string>;
      authorMap: Map<number, { name: string; description?: string; avatar_urls?: { [key: string]: string } }>;
      categoryMap: Map<number, string>;
      tagMap: Map<number, string>;
   }): BlogPost {
      const emb = p._embedded || {};
      const author = hydration ? hydration.authorMap.get(p.author) : emb.author?.[0];
      const imageUrl = hydration ? hydration.mediaMap.get(p.featured_media) : emb['wp:featuredmedia']?.[0]?.source_url;

      let categoryName: string;
      let tagNames: string[];
      if (hydration) {
         categoryName = (p.categories || []).map(id => hydration.categoryMap.get(id)).find(Boolean) || 'General';
         tagNames = (p.tags || [])
            .map(id => hydration.tagMap.get(id))
            .filter((name): name is string => !!name)
            .map(name => `#${name.replace(/\s+/g, '')}`);
      } else {
         const terms = emb['wp:term'] || [];
         categoryName = terms.flat().find(t => t.taxonomy === 'category')?.name || 'General';
         tagNames = terms.flat()
            .filter(t => t.taxonomy === 'post_tag')
            .map(t => `#${t.name.replace(/\s+/g, '')}`);
      }

      const authorName = author?.name || 'Editorial Team';
      const avatar = author?.avatar_urls?.['96'] || author?.avatar_urls?.['48'];

      return {
         id: p.slug,
         wpId: p.id,
         title: this.decodeHtml(p.title.rendered),
         category: this.decodeHtml(categoryName),
         date: this.formatDate(p.date),
         readTime: this.estimateReadTime(p.content.rendered),
         author: {
            name: authorName,
            image: avatar,
            initials: avatar ? undefined : this.initialsFromName(authorName),
            bio: author?.description || ''
         },
         image: imageUrl || PLACEHOLDER_IMG,
         tags: tagNames,
         content: p.content.rendered
      };
   }

   private mapComment(c: WpComment): BlogComment {
      const avatar = c.author_avatar_urls?.['96'] || c.author_avatar_urls?.['48'];
      return {
         id: c.id,
         authorName: c.author_name || 'Anonymous',
         authorInitials: this.initialsFromName(c.author_name || 'Anonymous'),
         authorAvatar: avatar,
         date: this.formatDate(c.date),
         contentHtml: c.content?.rendered || ''
      };
   }

   private formatDate(iso: string): string {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
   }

   private estimateReadTime(html: string): string {
      const text = html.replace(/<[^>]+>/g, ' ').trim();
      const words = text ? text.split(/\s+/).length : 0;
      const minutes = Math.max(1, Math.round(words / 200));
      return `${minutes} min read`;
   }

   private initialsFromName(name: string): string {
      return name
         .split(/\s+/)
         .filter(Boolean)
         .slice(0, 2)
         .map(n => n[0].toUpperCase())
         .join('');
   }

   private decodeHtml(html: string): string {
      const txt = document.createElement('textarea');
      txt.innerHTML = html;
      return txt.value;
   }
}
