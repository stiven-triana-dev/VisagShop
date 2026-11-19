(() => {
  'use strict';
  const { readFavorites, saveFavorites, notify } = window.Visag;
  const favorites = readFavorites();
  function update() {
    document.querySelectorAll('[data-favorite]').forEach((b) => {
      const active = favorites.has(b.dataset.favorite);
      b.textContent = active ? '♥' : '♡';
      b.setAttribute('aria-pressed', String(active));
      b.setAttribute('aria-label', active ? 'Quitar de favoritos' : 'Añadir a favoritos');
    });
  }
  document.querySelector('.sprint4-grid')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-favorite]');
    if (!b) return;
    const id = b.dataset.favorite;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites(favorites);
    update();
    notify(favorites.has(id) ? 'Guardado en favoritos.' : 'Eliminado de favoritos.');
  });
  update();
})();
