import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Title, Meta } from '@angular/platform-browser';
import { BlogPost } from './blog.data';
import { BlogService, BlogCategory } from './blog.service';

const PER_PAGE = 12;

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {

  allPosts: BlogPost[] = [];
  recentPosts: BlogPost[] = [];
  featuredArticles: BlogPost[] = [];
  latestArticles: BlogPost[] = [];
  categories: BlogCategory[] = [{ name: 'All Posts', count: 0, id: 'all', active: true }];
  loading = true;

  searchText: string = '';
  suggestions: { title: string; excerpt: string }[] = [];
  searchChips: string[] = [];
  showSuggestions: boolean = false;
  sortOrder: string = 'newest';

  currentPage = 1;
  totalPages = 0;
  totalPosts = 0;

  private activeCategoryId: string = 'all';
  private postsSub?: Subscription;

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private blogService: BlogService
  ) { }

  ngOnInit(): void {
    const title = 'Blog | 1-800-LIMO.COM';
    const description = 'Expert tips, industry news, and inspiring stories from the world of premium transportation';

    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: description });

    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: '1-800-LIMO.COM' });

    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });

    this.loadPosts();

    this.blogService.getCategories().subscribe(cats => {
      const total = cats.reduce((sum, c) => sum + c.count, 0);
      this.categories = [
        { name: 'All Posts', count: total, id: 'all', active: true },
        ...cats
      ];
    });
  }

  get noResults(): boolean {
    return !this.loading && this.featuredArticles.length === 0 && this.latestArticles.length === 0;
  }

  get suggestedPosts(): BlogPost[] {
    return this.recentPosts.slice(0, 3);
  }

  get pageNumbers(): (number | null)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    // First, last, and a window around the current page; null renders as an ellipsis
    const pages: (number | null)[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push(null);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(null);
    pages.push(total);
    return pages;
  }

  getExcerpt(htmlContent: string): string {
    if (!htmlContent) return '';
  
    const tmp = document.createElement('DIV');
    tmp.innerHTML = htmlContent;
    const text = (tmp.textContent || tmp.innerText || '').trim();

    if (text.length <= 150) return text;
    const slice = text.substring(0, 150);
    const lastSpace = slice.lastIndexOf(' ');
    return (lastSpace > 0 ? slice.substring(0, lastSpace) : slice) + '...';
  }

  onTab(category: BlogCategory): void {
    this.activeCategoryId = category.id;
    this.categories = this.categories.map(cat => ({
      ...cat,
      active: cat.id === category.id
    }));
    this.loadPosts(1);
  }

  onSearchInput() {
    if (!this.searchText.trim()) {
      this.suggestions = [];
      this.showSuggestions = false;
      return;
    }

    const query = this.searchText.toLowerCase().trim();
    const seen = new Set<string>();
    const matched: { title: string; excerpt: string }[] = [];

    for (const p of this.allPosts) {
      if (seen.has(p.title)) continue;
      const titleMatch = p.title.toLowerCase().includes(query);
      const contentMatch = p.content && p.content.toLowerCase().includes(query);
      const tagMatch = p.tags && p.tags.some(t => t.toLowerCase().includes(query));
      const categoryMatch = p.category && p.category.toLowerCase().includes(query);

      if (titleMatch || contentMatch || tagMatch || categoryMatch) {
        seen.add(p.title);
        matched.push({ title: p.title, excerpt: this.getSnippet(p.content, query) });
        if (matched.length === 5) break;
      }
    }

    this.suggestions = matched;
    this.showSuggestions = this.suggestions.length > 0;
  }

  private getSnippet(html: string, query: string): string {
    if (!html) return '';
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    const text = (tmp.textContent || tmp.innerText || '').trim();
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text.substring(0, 30) + '...';
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 60);
    return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
  }

  selectSuggestion(suggestion: { title: string; excerpt: string }) {
    this.searchText = suggestion.title;
    this.showSuggestions = false;
    this.executeSearch();
  }

  executeSearch() {
    const trimmed = this.searchText.trim();
    if (trimmed && !this.searchChips.includes(trimmed)) {
      this.searchChips.push(trimmed);
    }
    this.searchText = '';
    this.showSuggestions = false;
    this.loadPosts(1);
  }

  removeChip(chip: string) {
    this.searchChips = this.searchChips.filter(c => c !== chip);
    this.loadPosts(1);
  }

  setSortOrder(order: string) {
    this.sortOrder = order;
    this.loadPosts(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.loadPosts(page);
    document.querySelector('.category-filters-container')?.scrollIntoView({ behavior: 'smooth' });
  }

  loadPosts(page: number = this.currentPage) {
    this.currentPage = page;
    this.loading = true;

    const activeCategory = this.categories.find(c => c.id === this.activeCategoryId);
    const search = this.searchChips.join(' ').trim();

    this.postsSub?.unsubscribe();
    this.postsSub = this.blogService.getPostsPage({
      page,
      perPage: PER_PAGE,
      categoryId: activeCategory?.wpId,
      search: search || undefined,
      order: this.sortOrder === 'oldest' ? 'asc' : 'desc'
    }).subscribe({
      next: res => {
        this.allPosts = res.posts;
        this.totalPosts = res.total;
        this.totalPages = res.totalPages;
        if (!this.recentPosts.length && !search && this.activeCategoryId === 'all') {
          this.recentPosts = res.posts;
        }
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    // Keep the "read these instead" fallback populated when the first query is filtered
    if (!this.recentPosts.length && (search || this.activeCategoryId !== 'all')) {
      this.blogService.getPostsPage({ page: 1, perPage: PER_PAGE }).subscribe(res => this.recentPosts = res.posts);
    }
  }

  applyFilter() {
    // Category, search and sort are applied server-side; featured only on the first page
    const featuredCount = this.currentPage === 1 && this.sortOrder === 'newest' ? 2 : 0;
    this.featuredArticles = this.allPosts.slice(0, featuredCount);
    this.latestArticles = this.allPosts.slice(featuredCount);
  }
}
