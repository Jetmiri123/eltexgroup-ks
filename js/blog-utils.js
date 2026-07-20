(function (window) {
  let cache = null;

  function normalizePost(raw) {
    return {
      id: raw.id,
      slug: raw.slug,
      title: raw.title,
      excerpt: raw.excerpt || '',
      content: raw.content || '',
      image: raw.image || '',
      date: raw.date || '',
      category: raw.category || 'B2B Artikuj',
    };
  }

  async function loadPosts() {
    if (cache) return cache;
    const res = await fetch('/data/live-posts.json');
    if (!res.ok) throw new Error('Posts not found');
    const data = await res.json();
    cache = data.map(normalizePost);
    return cache;
  }

  function findPost(posts, { slug, id } = {}) {
    if (slug) return posts.find((p) => p.slug === slug);
    if (id) return posts.find((p) => String(p.id) === String(id));
    return null;
  }

  function blogUrl(post) {
    return '/blog/' + encodeURIComponent(post.slug);
  }

  function getBlogParams(location) {
    const loc = location || window.location;
    const params = new URLSearchParams(loc.search);
    if (params.get('slug') || params.get('id')) {
      return { slug: params.get('slug'), id: params.get('id') };
    }
    const match = loc.pathname.match(/\/blog(?:-post)?(?:\.html)?\/([^/?#]+)/);
    if (match) {
      return { slug: decodeURIComponent(match[1]) };
    }
    return { slug: params.get('slug'), id: params.get('id') };
  }

  window.EltexBlog = {
    loadPosts,
    findPost,
    blogUrl,
    getBlogParams,
  };
})(window);
