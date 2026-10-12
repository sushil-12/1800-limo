import { Component, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { BlogPost } from './blog.data';
import { BlogService, BlogCategory } from './blog.service';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {

  allPosts: BlogPost[] = [];
  featuredArticles: BlogPost[] = [];
  latestArticles: BlogPost[] = [];
  categories: BlogCategory[] = [{ name: 'All Posts', count: 0, id: 'all', active: true }];
  loading = true;

  searchText: string = '';
  suggestions: { title: string; excerpt: string }[] = [];
  searchChips: string[] = [];
  showSuggestions: boolean = false;
  sortOrder: string = 'newest';

  private activeCategoryId: string = 'all';

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

    this.blogService.getPosts().subscribe({
      next: posts => {
        this.allPosts = posts;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

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
    return this.allPosts.slice(0, 3);
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
    this.applyFilter();
  }

  onSearchInput() {
    if (!this.searchText.trim()) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.applyFilter();
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
    this.applyFilter();
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
    this.applyFilter();
  }

  removeChip(chip: string) {
    this.searchChips = this.searchChips.filter(c => c !== chip);
    this.applyFilter();
  }

  setSortOrder(order: string) {
    this.sortOrder = order;
    this.applyFilter();
  }

  applyFilter() {
    let filtered = [...this.allPosts];

    if (this.activeCategoryId !== 'all') {
      const activeCategory = this.categories.find(c => c.id === this.activeCategoryId);
      if (activeCategory) {
        filtered = filtered.filter(p => p.category === activeCategory.name);
      }
    }

    const chips = this.searchChips.map(c => c.toLowerCase());
    const currentSearch = this.searchText.trim().toLowerCase();
    const searchTerms = [...chips];
    if (currentSearch) searchTerms.push(currentSearch);

    if (searchTerms.length > 0) {
      filtered = filtered.filter(post =>
        searchTerms.some(term =>
          post.title.toLowerCase().includes(term) ||
          (post.content && post.content.toLowerCase().includes(term)) ||
          (post.tags && post.tags.some(t => t.toLowerCase().includes(term))) ||
          (post.category && post.category.toLowerCase().includes(term))
        )
      );
    }

    this.featuredArticles = filtered.slice(0, 2);

    let latest = filtered.slice(2);
    if (this.sortOrder === 'oldest') {
      latest = [...latest].reverse();
    }
    this.latestArticles = latest;
  }
}
