const HTML_ALIASES = {
  '/index.html': '/',
  '/produkt.html': '/produkte',
  '/blog-post.html': '/blogs',
  '/admin/index.html': '/admin',
};

const SLUG_REDIRECTS = {
  '/blog/pse-te-zgjidhni-eltexgrop-ks-per-nevojat-tuaja-b2b-te-pajisjeve-elektrike':
    '/blog/pse-te-zgjidhni-eltexgrop-rks-per-nevojat-tuaja-b2b-te-pajisjeve-elektrike',
};

export function getCleanUrlRedirect(pathname) {
  if (!pathname) return null;

  if (SLUG_REDIRECTS[pathname]) {
    return SLUG_REDIRECTS[pathname];
  }

  if (pathname === '/produkt' || pathname === '/produkt/') {
    return '/produkte';
  }

  if (pathname === '/admin/') {
    return '/admin';
  }

  if (HTML_ALIASES[pathname]) {
    return HTML_ALIASES[pathname];
  }

  if (pathname.endsWith('/index.html')) {
    const base = pathname.slice(0, -'/index.html'.length);
    return base || '/';
  }

  if (pathname.endsWith('.html')) {
    if (pathname.startsWith('/admin/')) return null;
    const clean = pathname.slice(0, -5);
    return clean || '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return null;
}

export function redirectResponse(request, targetPath, status = 301) {
  const url = new URL(request.url);
  const target = new URL(targetPath, url.origin);
  target.search = url.search;
  return Response.redirect(target.toString(), status);
}
