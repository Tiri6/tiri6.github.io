import type { CollectionEntry } from 'astro:content';

/**
 * Filtra gli articoli mostrando solo quelli già pubblicati (publishedAt <= ora attuale)
 * Se publishedAt non è presente, l'articolo è nascosto
 */
export function filterPublished(articles: CollectionEntry<'news'>[]): CollectionEntry<'news'>[] {
  const now = new Date();
  return articles.filter(article => {
    // Se publishedAt non esiste, nascondi l'articolo
    if (!article.data.publishedAt) {
      return false;
    }
    // Mostra solo se publishedAt <= ora attuale
    return new Date(article.data.publishedAt) <= now;
  });
}

/**
 * Ordina gli articoli per data di pubblicazione (più recenti prima)
 */
export function sortByPublished(
  articles: CollectionEntry<'news'>[]
): CollectionEntry<'news'>[] {
  return articles.sort((a, b) => {
    const dateA = a.data.publishedAt ? new Date(a.data.publishedAt).getTime() : 0;
    const dateB = b.data.publishedAt ? new Date(b.data.publishedAt).getTime() : 0;
    return dateB - dateA; // Discendente
  });
}

/**
 * Articoli featured (sticky): taccuino e editoriali che rimangono in primo piano
 * Restituisce: articoli featured + ultimi articoli ordinati per data
 */
export function orderWithFeatured(
  articles: CollectionEntry<'news'>[]
): CollectionEntry<'news'>[] {
  const featured = articles.filter(a => a.data.featured);
  const normal = articles.filter(a => !a.data.featured);

  return [
    ...sortByPublished(featured),
    ...sortByPublished(normal),
  ];
}

/**
 * Conta quanti articoli sono schedulati per oggi (usa data locale del server)
 */
export function countTodayArticles(articles: CollectionEntry<'news'>[]): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return articles.filter(article => {
    if (!article.data.publishedAt) return false;
    const pubDate = new Date(article.data.publishedAt);
    return pubDate >= today && pubDate < tomorrow;
  }).length;
}
