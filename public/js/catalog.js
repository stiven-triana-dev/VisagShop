(() => {
  'use strict';
  const { formatMoney, escapeHTML, photoSrcset, readFavorites, saveFavorites, loadProducts, notify } =
    window.Visag;
  const grid = document.getElementById('productos');
  const count = document.getElementById('resultados');
  const more = document.getElementById('mas');
  const empty = document.getElementById('sin-resultados');
  const search = document.getElementById('buscar');
  const order = document.getElementById('ordenar');
  const onlyPrice = document.getElementById('solo-precio');
  const onlyFavorites = document.getElementById('solo-favoritos');
  const filters = [...document.querySelectorAll('[data-cat]')];
  const favorites = readFavorites();
  const PAGE_SIZE = 12;
  let products = [];
  let category = 'Todos';
  let shown = PAGE_SIZE;
  const normalized = (text) =>
    String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  function filterProducts() {
    const q = normalized(search.value.trim());
    const result = products.filter((p) => {
      if (category !== 'Todos' && p.categoria !== category) return false;
      if (
        q &&
        !normalized(
          `${p.nombre} ${p.categoria} ${(p.tallas || []).join(' ')} ${(p.colores || []).join(' ')} ${p.descripcion || ''}`,
        ).includes(q)
      )
        return false;
      if (onlyPrice.checked && !Number.isFinite(p.precio)) return false;
      if (onlyFavorites.getAttribute('aria-pressed') === 'true' && !favorites.has(p.id)) return false;
      return true;
    });
    if (order.value === 'nombre') result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (order.value === 'menor' || order.value === 'mayor') {
      const sign = order.value === 'menor' ? 1 : -1;
      result.sort((a, b) => {
        if (!Number.isFinite(a.precio)) return Number.isFinite(b.precio) ? 1 : 0;
        if (!Number.isFinite(b.precio)) return -1;
        return sign * (a.precio - b.precio);
      });
    }
    return result;
  }
  function card(p, index) {
    const href = `/products/${encodeURIComponent(p.id)}`;
    const liked = favorites.has(p.id);
    const hasPrice = Number.isFinite(p.precio);
    const sizes = Array.isArray(p.tallas) ? p.tallas.join(' · ') : '';
    return `<article class="product-card">
       <div class="product-media"><a href="${href}" aria-label="Ver ${escapeHTML(p.nombre)}"><img src="${escapeHTML(p.imagen)}"${photoSrcset(p.imagen)} alt="${escapeHTML(p.nombre)}" loading="${index < 4 ? 'eager' : 'lazy'}" width="360" height="450"></a>
         <span class="product-tag">${hasPrice ? 'DISPONIBLE EN CATÁLOGO' : 'PRECIO POR CONFIRMAR'}</span>
         <button type="button" class="heart-btn" data-favorite="${escapeHTML(p.id)}" aria-pressed="${liked}" aria-label="${liked ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${escapeHTML(p.nombre)}">${liked ? '♥' : '♡'}</button>
       </div>
       <div class="product-caption"><span class="product-meta">${escapeHTML(p.categoria)}</span><h3 class="product-title"><a href="${href}">${escapeHTML(p.nombre)}</a></h3>
       <div class="product-bottom"><span class="product-price ${hasPrice ? '' : 'no-price'}">${hasPrice ? formatMoney(p.precio) : 'Precio por consultar'}</span><a href="${href}" class="product-arrow" aria-label="Ver ${escapeHTML(p.nombre)}">VER PRENDA <span aria-hidden="true">↗</span></a></div>
       <p class="product-sizes">${sizes ? 'Tallas: ' + escapeHTML(sizes) : 'Consultar tallas'}</p></div>
     </article>`;
  }
  function render() {
    const filtered = filterProducts();
    grid.innerHTML = filtered.slice(0, shown).map(card).join('');
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'producto encontrado' : 'productos encontrados'}`;
    more.hidden = shown >= filtered.length;
    empty.hidden = filtered.length !== 0;
  }
  function setCategory(next) {
    category = next;
    shown = PAGE_SIZE;
    filters.forEach((button) => {
      const active = button.dataset.cat === next;
      button.classList.toggle('activo', active);
      button.setAttribute('aria-pressed', String(active));
    });
    render();
  }
  filters.forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.cat)));
  [search, order, onlyPrice].forEach((input) =>
    input.addEventListener(input === search ? 'input' : 'change', () => {
      shown = PAGE_SIZE;
      render();
    }),
  );
  onlyFavorites.addEventListener('click', () => {
    const next = onlyFavorites.getAttribute('aria-pressed') !== 'true';
    onlyFavorites.setAttribute('aria-pressed', String(next));
    shown = PAGE_SIZE;
    render();
  });
  more.addEventListener('click', () => {
    shown += PAGE_SIZE;
    render();
  });
  grid.addEventListener('click', (e) => {
    const button = e.target.closest('[data-favorite]');
    if (!button) return;
    const id = button.dataset.favorite;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites(favorites);
    render();
    notify(favorites.has(id) ? 'Guardado en tus favoritos.' : 'Eliminado de favoritos.');
  });
  document.querySelectorAll('[data-go-category]').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setCategory(link.dataset.goCategory);
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', '#catalogo');
    }),
  );
  document.getElementById('limpiar').addEventListener('click', () => {
    search.value = '';
    order.value = 'destacados';
    onlyPrice.checked = false;
    onlyFavorites.setAttribute('aria-pressed', 'false');
    setCategory('Todos');
  });
  loadProducts()
    .then((result) => {
      products = result;
      render();
      const total = document.querySelector('.catalog-index');
      if (total) total.innerHTML = `${products.length} <small>REFERENCIAS</small>`;
    })
    .catch(() => {
      count.textContent = 'No pudimos cargar el catálogo.';
      grid.innerHTML = '<p>Comprueba tu conexión o recarga la página para volver a intentarlo.</p>';
      more.hidden = true;
    });
})();
