const ARTICLES_PER_FETCH = 10;
const INITIAL_ROWS = 4;
const COLUMNS = 4;
const INITIAL_CARDS = INITIAL_ROWS * COLUMNS;
const LOCAL_PROXY_ORIGIN = 'http://127.0.0.1:8787';

const CATEGORIES = Object.freeze([
  { label: 'All', query: 'artificial intelligence OR robotics OR marketing' },
  { label: 'AI', query: 'artificial intelligence' },
  { label: 'Adobe', query: 'adobe experience cloud' },
  { label: 'Robotics', query: 'robotics automation' },
  { label: 'Marketing', query: 'digital marketing martech' },
]);

function isUE() {
  const { classList } = document.documentElement;
  return classList.contains('adobe-ue-edit') || classList.contains('adobe-ue-preview');
}

function extractBlockFields(block) {
  const rows = Array.from(block.children);
  const titleRow = rows[0];
  const descRow = rows[1];
  const pathRow = rows[2];
  const fields = {
    title: titleRow?.textContent?.trim() || '',
    description: descRow?.textContent?.trim() || '',
    postPagePath: pathRow?.textContent?.trim() || '',
  };
  [titleRow, descRow, pathRow].forEach((row) => row?.remove());
  block.textContent = '';
  return fields;
}

const cache = new Map();

function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child) {
      element.appendChild(child);
    }
  });
  return element;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function fetchNews(query, page = 1) {
  const cacheKey = `${query}-${page}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = new URL('/api/news', window.location.hostname === 'localhost'
    ? LOCAL_PROXY_ORIGIN
    : window.location.origin);
  url.searchParams.set('query', query);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('max', String(ARTICLES_PER_FETCH));
  url.searchParams.set('page', String(page));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(cacheKey, data.articles || []);
  return data.articles || [];
}

function storeArticle(article) {
  try {
    sessionStorage.setItem(
      `news-article-${article.url}`,
      JSON.stringify(article),
    );
  } catch {
    // sessionStorage may be full or unavailable
  }
}

function createCard(article, postPagePath) {
  const href = new URL(postPagePath, window.location.origin);
  href.searchParams.set('source', article.url);
  href.searchParams.set('title', article.title || '');
  href.searchParams.set('description', article.description || '');
  href.searchParams.set('content', article.content || '');
  href.searchParams.set('image', article.image || '');
  href.searchParams.set('publishedAt', article.publishedAt || '');
  href.searchParams.set('sourceName', article.source?.name || '');

  const imageEl = article.image
    ? el('img', { src: article.image, alt: article.title, loading: 'lazy' })
    : el('span', { class: 'news-card-placeholder' });

  const card = el(
    'li',
    {},
    el(
      'a',
      { href: `${href.pathname}${href.search}`, class: 'news-card-link' },
      el('div', { class: 'news-card-image' }, imageEl),
      el(
        'div',
        { class: 'news-card-body' },
        el('h3', {}, article.title || ''),
        el('time', { datetime: article.publishedAt || '' }, formatDate(article.publishedAt)),
        el('p', {}, article.description || ''),
      ),
    ),
  );

  card.querySelector('a').addEventListener('click', () => storeArticle(article));

  return card;
}

function createSkeletonCards(count) {
  const skeleton = el('div', { class: 'news-listing-skeleton' });
  for (let i = 0; i < count; i += 1) {
    skeleton.appendChild(
      el(
        'div',
        { class: 'news-skeleton-card' },
        el('div', { class: 'news-skeleton-image' }),
        el(
          'div',
          { class: 'news-skeleton-body' },
          el('div', { class: 'news-skeleton-line' }),
          el('div', { class: 'news-skeleton-line' }),
          el('div', { class: 'news-skeleton-line' }),
        ),
      ),
    );
  }
  return skeleton;
}

function createMessage(text, retryFn) {
  const msg = el('div', { class: 'news-listing-message' }, el('p', {}, text));
  if (retryFn) {
    const retryBtn = el('button', { class: 'news-listing-retry' }, 'Try again');
    retryBtn.addEventListener('click', retryFn);
    msg.appendChild(retryBtn);
  }
  return msg;
}

function renderPlaceholder(block, titleText, descriptionText) {
  const header = el(
    'div',
    { class: 'news-listing-header' },
    el('h2', {}, titleText),
    el('p', {}, descriptionText),
  );

  const filters = el('div', { class: 'news-listing-filters' });
  CATEGORIES.forEach((cat, i) => {
    filters.appendChild(
      el('button', { 'aria-pressed': i === 0 ? 'true' : 'false' }, cat.label),
    );
  });

  const grid = el('ul', { class: 'news-listing-grid' });
  for (let i = 0; i < 8; i += 1) {
    grid.appendChild(
      el(
        'li',
        {},
        el(
          'a',
          { href: '#', class: 'news-card-link' },
          el(
            'div',
            { class: 'news-card-image' },
            el('span', { class: 'news-card-placeholder' }),
          ),
          el(
            'div',
            { class: 'news-card-body' },
            el('h3', {}, 'Sample News Article Title'),
            el('time', {}, 'January 1, 2025'),
            el('p', {}, 'This is a placeholder description for the news article card in Universal Editor preview mode.'),
          ),
        ),
      ),
    );
  }

  block.append(header, filters, grid);
}

export default async function decorate(block) {
  const fields = extractBlockFields(block);

  const titleText = fields.title || 'Latest News';
  const descriptionText = fields.description || 'Stay up to date with the latest news in technology and innovation.';
  const postPagePath = fields.postPagePath || '/news/post';

  if (isUE()) {
    renderPlaceholder(block, titleText, descriptionText);
    return;
  }

  // Build header with dynamic category in title
  const categorySpan = el('span', { class: 'news-listing-category' }, CATEGORIES[0].label);
  const titleEl = el('h2', {}, 'Latest ');
  titleEl.appendChild(categorySpan);
  titleEl.appendChild(document.createTextNode(' News'));
  const header = el(
    'div',
    { class: 'news-listing-header' },
    titleEl,
    el('p', {}, descriptionText),
  );

  // Build filter bar
  const filters = el('div', { class: 'news-listing-filters' });
  const grid = el('ul', { class: 'news-listing-grid' });
  const sentinel = el('div', { class: 'news-listing-sentinel' });
  const skeleton = createSkeletonCards(COLUMNS);

  let currentQuery = CATEGORIES[0].query;
  let currentPage = 1;
  let allArticles = [];
  let displayedCount = 0;
  let isLoading = false;
  let hasMore = true;
  let observer;

  function showSpinner() {
    sentinel.innerHTML = '';
    sentinel.appendChild(el('div', { class: 'news-listing-spinner' }));
    sentinel.style.display = '';
  }

  function hideSpinner() {
    sentinel.innerHTML = '';
    sentinel.style.display = 'none';
  }

  function renderBatch() {
    const end = Math.min(displayedCount + INITIAL_CARDS, allArticles.length);
    for (let i = displayedCount; i < end; i += 1) {
      grid.appendChild(createCard(allArticles[i], postPagePath));
    }
    displayedCount = end;

    if (displayedCount >= allArticles.length && !hasMore) {
      hideSpinner();
      if (observer) observer.disconnect();
    }
  }

  async function loadMore() {
    if (isLoading || (!hasMore && displayedCount >= allArticles.length)) return;

    // If we have buffered articles to show, just render them
    if (displayedCount < allArticles.length) {
      renderBatch();
      return;
    }

    if (!hasMore) return;

    isLoading = true;
    showSpinner();

    try {
      const articles = await fetchNews(currentQuery, currentPage);
      if (articles.length === 0) {
        hasMore = false;
        hideSpinner();
        if (observer) observer.disconnect();
        if (allArticles.length === 0) {
          grid.innerHTML = '';
          grid.after(createMessage('No news articles found for this category.'));
        }
      } else {
        allArticles = allArticles.concat(articles);
        currentPage += 1;
        if (articles.length < ARTICLES_PER_FETCH) hasMore = false;
        renderBatch();
      }
    } catch {
      hideSpinner();
      if (allArticles.length === 0) {
        grid.after(createMessage('Unable to load news. Please try again later.', () => {
          block.querySelector('.news-listing-message')?.remove();
          loadMore();
        }));
      }
    } finally {
      isLoading = false;
    }
  }

  function setupObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    if (hasMore || displayedCount < allArticles.length) {
      showSpinner();
      observer.observe(sentinel);
    }
  }

  async function switchCategory(query) {
    currentQuery = query;
    currentPage = 1;
    allArticles = [];
    displayedCount = 0;
    hasMore = true;
    grid.innerHTML = '';
    block.querySelector('.news-listing-message')?.remove();
    if (observer) observer.disconnect();
    await loadMore();
    // Fetch more if needed to fill initial rows
    while (hasMore && allArticles.length < INITIAL_CARDS) {
      // eslint-disable-next-line no-await-in-loop
      await loadMore();
    }
    renderBatch();
    setupObserver();
  }

  // Create filter buttons
  CATEGORIES.forEach((cat, i) => {
    const btn = el('button', { 'aria-pressed': i === 0 ? 'true' : 'false' }, cat.label);
    btn.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      // Animate category text flip
      categorySpan.classList.add('news-listing-category-out');
      setTimeout(() => {
        categorySpan.textContent = cat.label;
        categorySpan.classList.remove('news-listing-category-out');
        categorySpan.classList.add('news-listing-category-in');
        setTimeout(() => categorySpan.classList.remove('news-listing-category-in'), 300);
      }, 300);
      switchCategory(cat.query);
    });
    filters.appendChild(btn);
  });

  block.append(header, filters, skeleton, grid, sentinel);

  // Initial load
  try {
    while (hasMore && allArticles.length < INITIAL_CARDS) {
      isLoading = true;
      // eslint-disable-next-line no-await-in-loop
      const articles = await fetchNews(currentQuery, currentPage);
      if (articles.length === 0) {
        hasMore = false;
      } else {
        allArticles = allArticles.concat(articles);
        currentPage += 1;
        if (articles.length < ARTICLES_PER_FETCH) hasMore = false;
      }
    }
    isLoading = false;
    skeleton.remove();
    renderBatch();

    if (allArticles.length === 0) {
      grid.after(createMessage('No news articles found for this category.'));
    }

    setupObserver();
  } catch {
    isLoading = false;
    skeleton.remove();
    grid.after(createMessage('Unable to load news. Please try again later.', () => {
      block.querySelector('.news-listing-message')?.remove();
      switchCategory(currentQuery);
    }));
  }
}
