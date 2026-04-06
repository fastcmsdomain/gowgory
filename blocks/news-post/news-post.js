function isUE() {
  const { classList } = document.documentElement;
  return classList.contains('adobe-ue-edit') || classList.contains('adobe-ue-preview');
}

function extractBlockFields(block) {
  const rows = Array.from(block.children);
  const labelRow = rows[0];
  const pathRow = rows[1];
  const sourceRow = rows[2];
  const fields = {
    backLabel: labelRow?.textContent?.trim() || '',
    backPath: pathRow?.textContent?.trim() || '',
    sourceLabel: sourceRow?.textContent?.trim() || '',
  };
  [labelRow, pathRow, sourceRow].forEach((row) => row?.remove());
  block.textContent = '';
  return fields;
}

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

function renderPlaceholder(block, backLabel, backPath) {
  const backLink = el('a', { href: backPath, class: 'news-post-back' }, backLabel);
  const image = el(
    'div',
    { class: 'news-post-image' },
    el('div', { class: 'news-post-image-placeholder' }, 'Article Image'),
  );
  const meta = el(
    'div',
    { class: 'news-post-meta' },
    el('time', {}, 'January 1, 2025'),
    el('span', { class: 'news-post-meta-separator' }),
    el('span', {}, 'News Source'),
  );
  const title = el('h1', { class: 'news-post-title' }, 'Sample News Article Title for Preview');
  const content = el(
    'div',
    { class: 'news-post-content' },
    el('p', {}, 'This is a placeholder article content shown in Universal Editor preview mode. The actual content will be fetched from the news API when viewed on the published site.'),
  );
  const source = el('a', {
    href: '#',
    class: 'news-post-source',
    target: '_blank',
    rel: 'noopener noreferrer',
  }, 'Read full article at source');

  block.append(backLink, image, meta, title, content, source);
}

function renderFallback(block, backLabel, backPath, sourceLabel, sourceUrl) {
  const actions = el('div', { class: 'news-post-fallback-actions' });
  if (sourceUrl) {
    actions.appendChild(el('a', {
      href: sourceUrl,
      class: 'news-post-source',
      target: '_blank',
      rel: 'noopener noreferrer',
    }, sourceLabel));
  }
  actions.appendChild(el('a', { href: backPath, class: 'news-post-back' }, backLabel));

  const fallback = el(
    'div',
    { class: 'news-post-fallback' },
    el('h2', {}, 'Article preview unavailable'),
    el('p', {}, 'This article is not available for inline preview. You can read it at the original source or go back to the news listing.'),
    actions,
  );
  block.appendChild(fallback);
}

function renderArticle(block, article, backLabel, backPath, sourceLabel) {
  const backLink = el('a', { href: backPath, class: 'news-post-back' }, backLabel);

  const imageContainer = el('div', { class: 'news-post-image' });
  if (article.image) {
    imageContainer.appendChild(
      el('img', { src: article.image, alt: article.title, loading: 'eager' }),
    );
  } else {
    imageContainer.appendChild(
      el('div', { class: 'news-post-image-placeholder' }, 'No image available'),
    );
  }

  const meta = el(
    'div',
    { class: 'news-post-meta' },
    el('time', { datetime: article.publishedAt || '' }, formatDate(article.publishedAt)),
    el('span', { class: 'news-post-meta-separator' }),
    el('span', {}, article.source?.name || 'Unknown source'),
  );

  const title = el('h1', { class: 'news-post-title' }, article.title || '');

  const contentText = article.content || article.description || '';
  const content = el(
    'div',
    { class: 'news-post-content' },
    el('p', {}, contentText),
  );

  const source = el('a', {
    href: article.url,
    class: 'news-post-source',
    target: '_blank',
    rel: 'noopener noreferrer',
  }, sourceLabel);

  block.append(backLink, imageContainer, meta, title, content, source);
}

export default function decorate(block) {
  const fields = extractBlockFields(block);

  const backLabel = fields.backLabel || 'Back to News';
  const backPath = fields.backPath || '/news';
  const sourceLabel = fields.sourceLabel || 'Read full article at source';

  if (isUE()) {
    renderPlaceholder(block, backLabel, backPath);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const sourceUrl = params.get('source');

  if (!sourceUrl) {
    renderFallback(block, backLabel, backPath, sourceLabel, null);
    return;
  }

  let article = null;
  try {
    const stored = sessionStorage.getItem(`news-article-${sourceUrl}`);
    if (stored) article = JSON.parse(stored);
  } catch {
    // sessionStorage unavailable
  }

  if (article) {
    renderArticle(block, article, backLabel, backPath, sourceLabel);
  } else {
    renderFallback(block, backLabel, backPath, sourceLabel, sourceUrl);
  }
}
