const FILTERS = [
  { label: 'AI', query: 'AI' },
  { label: 'Robotics', query: 'robotics' },
  { label: 'Technology', query: 'technology' },
  { label: 'Innovation', query: 'innovation' },
];

const DEFAULTS = {
  heading: 'Recent News',
  buttonLabel: 'Read article',
  language: 'en',
  country: 'us',
  pageSize: 4,
  maxPages: 4,
};

const LOCAL_PROXY_ORIGIN = 'http://127.0.0.1:8787';

function normalizeKey(text = '') {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
}

function getTextContent(element) {
  return element?.textContent?.trim() || '';
}

function readConfig(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  return rows.reduce((config, row) => {
    const columns = [...row.children];
    if (columns.length < 2) return config;

    const key = normalizeKey(getTextContent(columns[0]));
    const value = getTextContent(columns[1]);
    if (!key || !value) return config;

    config[key] = value;
    return config;
  }, {});
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createArticleLink(url, label, className) {
  const link = createElement('a', className, label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function getApiOrigin() {
  if (window.location.hostname === 'localhost') {
    return LOCAL_PROXY_ORIGIN;
  }

  return window.location.origin;
}

function buildApiUrl(config, filter, page) {
  const url = new URL('/api/news', getApiOrigin());
  url.searchParams.set('topic', filter.query);
  url.searchParams.set('lang', config.language);
  url.searchParams.set('max', config.pageSize);
  url.searchParams.set('page', page);

  if (config.country) {
    url.searchParams.set('country', config.country);
  }

  return url.toString();
}

function buildCard(article, buttonLabel, fallbackLabel) {
  const card = createElement('article', 'news-card');
  const media = createElement('div', 'news-card-media');
  const body = createElement('div', 'news-card-body');
  const title = createElement('h3', 'news-card-title');
  const description = createElement(
    'p',
    'news-card-description',
    article.description || 'No description is available for this article yet.',
  );

  if (article.image) {
    const mediaLink = createArticleLink(article.url, '', 'news-card-media-link');
    const image = document.createElement('img');
    image.src = article.image;
    image.alt = article.title || fallbackLabel;
    image.loading = 'lazy';
    mediaLink.append(image);
    media.append(mediaLink);
  } else {
    media.append(createElement('div', 'news-card-placeholder', fallbackLabel));
  }

  const titleLink = createArticleLink(article.url, article.title || 'Untitled article', 'news-card-title-link');
  title.append(titleLink);

  const button = createArticleLink(article.url, buttonLabel, 'btn news-card-button');

  body.append(title, description, button);
  card.append(media, body);
  return card;
}

function updateLoadMoreButton(button, pagesLoaded) {
  button.hidden = pagesLoaded >= DEFAULTS.maxPages;
}

function renderMessage(container, message, modifier = '') {
  container.replaceChildren(createElement('p', `news-message ${modifier}`.trim(), message));
}

async function fetchArticles(state, config, filter, page) {
  const cacheKey = `${filter.query}:${page}`;
  if (state.cache.has(cacheKey)) {
    return state.cache.get(cacheKey);
  }

  const response = await fetch(buildApiUrl(config, filter, page));
  if (!response.ok) {
    throw new Error(`Failed to load ${filter.label} news (${response.status})`);
  }

  const payload = await response.json();
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  state.cache.set(cacheKey, articles);
  return articles;
}

async function renderFilter(state, config, filter, { append = false } = {}) {
  const session = state.sessions.get(filter.query) || {
    page: 0,
    articles: [],
  };
  const nextPage = append ? session.page + 1 : 1;

  state.grid.setAttribute('aria-busy', 'true');
  if (!append) {
    state.grid.replaceChildren();
  }

  try {
    const articles = await fetchArticles(state, config, filter, nextPage);
    const nextArticles = append ? [...session.articles, ...articles] : articles;
    const nextSession = { page: nextPage, articles: nextArticles };
    state.sessions.set(filter.query, nextSession);
    state.activeFilter = filter.query;

    if (!nextArticles.length) {
      renderMessage(state.grid, `No articles found for ${filter.label}.`, 'is-empty');
      state.loadMore.hidden = true;
      return;
    }

    const cards = articles.map((article) => buildCard(article, config.buttonLabel, filter.label));
    if (append) {
      state.grid.append(...cards);
    } else {
      state.grid.replaceChildren(...cards);
    }

    updateLoadMoreButton(state.loadMore, nextSession.page);
  } catch (error) {
    renderMessage(state.grid, error.message, 'is-error');
    state.loadMore.hidden = true;
  } finally {
    state.grid.removeAttribute('aria-busy');
  }
}

function createFilterButton(filter, isActive) {
  const button = createElement('button', 'news-filter', filter.label);
  button.type = 'button';
  button.dataset.filter = filter.query;
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');

  if (isActive) {
    button.classList.add('is-active');
  }

  return button;
}

/**
 * Decorate the news block.
 * @param {Element} block The news block element
 */
export default async function decorate(block) {
  const authoredConfig = readConfig(block);
  const config = {
    heading: authoredConfig.heading || DEFAULTS.heading,
    buttonLabel: authoredConfig['button-label'] || DEFAULTS.buttonLabel,
    language: authoredConfig.language || DEFAULTS.language,
    country: authoredConfig.country || DEFAULTS.country,
    pageSize: DEFAULTS.pageSize,
  };

  const header = createElement('div', 'news-header');
  const title = createElement('h2', 'news-heading', config.heading);
  const filters = createElement('div', 'news-filters');
  const grid = createElement('div', 'news-grid');
  const controls = createElement('div', 'news-controls');
  const loadMore = createElement('button', 'btn news-load-more', 'Load more');
  const defaultFilter = FILTERS[0];

  filters.setAttribute('role', 'toolbar');
  filters.setAttribute('aria-label', 'News categories');
  grid.setAttribute('aria-live', 'polite');
  loadMore.type = 'button';

  header.append(title);
  FILTERS.forEach((filter) => {
    filters.append(createFilterButton(filter, filter.query === defaultFilter.query));
  });
  controls.append(loadMore);
  block.replaceChildren(header, filters, grid, controls);

  const state = {
    activeFilter: defaultFilter.query,
    cache: new Map(),
    sessions: new Map(),
    grid,
    loadMore,
  };

  filters.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button || button.dataset.filter === state.activeFilter) return;

    const nextFilter = FILTERS.find((filter) => filter.query === button.dataset.filter);
    if (!nextFilter) return;

    filters.querySelectorAll('button[data-filter]').forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle('is-active', isActive);
      filterButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    await renderFilter(state, config, nextFilter);
  });

  loadMore.addEventListener('click', async () => {
    const activeFilter = FILTERS.find((filter) => filter.query === state.activeFilter);
    if (!activeFilter) return;
    await renderFilter(state, config, activeFilter, { append: true });
  });

  await renderFilter(state, config, defaultFilter);
}
