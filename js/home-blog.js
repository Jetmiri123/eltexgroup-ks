(function () {
  const { loadPosts, blogUrl } = window.EltexBlog;
  const list = document.getElementById('home-blog-list');
  if (!list) return;

  loadPosts()
    .then((posts) => {
      list.innerHTML = posts
        .slice(0, 3)
        .map(
          (post) => `
        <div role="listitem" class="collection-item-2 w-col w-col-4">
          <a data-w-id="9fa67590-aed8-cb63-f789-778c1c2182f6" href="${blogUrl(post)}" class="link-block w-inline-block">
            <div class="blog_materials">
              <img src="${post.image}" loading="eager" alt="" data-w-id="7f6aed11-35bb-1035-ee24-716d70887012" class="main_image_blog">
              <div class="category_name"><div class="xs-text gray">${post.category}</div></div>
            </div>
            <h3 data-w-id="b72937a9-9447-c2a9-a5c8-de30b2c9beb3" class="small-text">${post.title}</h3>
          </a>
        </div>`
        )
        .join('');
    })
    .catch(() => {
      list.innerHTML =
        '<p class="paragraph w-col">Artikujt nuk u ngarkuan. Rifreskoni faqen ose provoni më vonë.</p>';
    });
})();
