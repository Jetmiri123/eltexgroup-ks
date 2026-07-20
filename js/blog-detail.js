(function () {
  const { loadPosts, findPost, blogUrl, getBlogParams } = window.EltexBlog;
  const params = getBlogParams();

  const notFound = document.getElementById('blog-not-found');
  const detail = document.getElementById('blog-detail');
  const relatedList = document.getElementById('blog-related-list');

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('sq-AL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  }

  function renderRelated(all, current) {
    const related = all.filter((p) => p.slug !== current.slug).slice(0, 2);
    if (!related.length) {
      document.querySelector('.blog-related-section').hidden = true;
      return;
    }

    relatedList.innerHTML = related
      .map(
        (post) => `
      <div role="listitem" class="collection-item-3">
        <a href="${blogUrl(post)}" class="link-block w-inline-block">
          <div class="blog_materials">
            <img src="${post.image}" loading="lazy" alt="" class="main_image_blog">
            <div class="category_name"><div class="xs-text gray">${post.category}</div></div>
          </div>
          <h2 class="small-text">${post.title}</h2>
        </a>
      </div>`
      )
      .join('');
  }

  function fixContentLinks(html) {
    return html
      .replace(/href="\/kontakt\/?"/gi, 'href="contact-us.html"')
      .replace(/href="https:\/\/eltexgroup-ks\.com\/kontakt\/?"/gi, 'href="contact-us.html"')
      .replace(/href="https:\/\/eltexgroup-ks\.com\/\?page_id=2197"/gi, 'href="contact-us.html"')
      .replace(/href="https:\/\/eltexgroup-ks\.com\/pse-[^"]+"/gi, (match) => {
        const slug = match.match(/pse-[^"/]+/)?.[0];
        return slug ? `href="/blog/${slug}"` : match;
      });
  }

  function renderPost(post, all) {
    document.title = post.title + ' — Eltex Group';

    const meta = document.querySelector('meta[name="description"]');
    if (meta && post.excerpt) {
      meta.setAttribute('content', post.excerpt.slice(0, 160));
    }

    document.getElementById('blog-category').textContent = post.category;
    document.getElementById('blog-title').textContent = post.title;
    document.getElementById('blog-date').textContent = formatDate(post.date);
    document.getElementById('blog-image').src = post.image;
    document.getElementById('blog-image').alt = post.title;
    document.getElementById('blog-content').innerHTML = fixContentLinks(post.content);

    renderRelated(all, post);
    notFound.hidden = true;
    detail.hidden = false;
  }

  loadPosts()
    .then((all) => {
      const post = findPost(all, params);

      if (!post) {
        notFound.hidden = false;
        detail.hidden = true;
        return;
      }

      renderPost(post, all);
    })
    .catch(() => {
      notFound.hidden = false;
      detail.hidden = true;
    });
})();
