(() => {
  'use strict';
  const input = document.getElementById('admin-filtro');
  const rows = [...document.querySelectorAll('.admin-table tbody tr')];
  const message = document.getElementById('admin-action-message');
  if (!input) return;
  const refresh = () => {
    const q = input.value.trim().toLocaleLowerCase('es');
    let total = 0;
    rows.forEach((row) => {
      const show = row.isConnected && row.dataset.search.includes(q);
      row.hidden = !show;
      if (show) total++;
    });
    document.getElementById('admin-no-results').hidden = total > 0;
  };
  input.addEventListener('input', refresh);
  document.querySelector('.admin-table tbody')?.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-delete-id]');
    if (!button) return;
    const id = button.dataset.deleteId;
    const name = button.dataset.deleteName;
    if (
      !window.confirm(
        `¿Eliminar definitivamente "${name}" (${id})?\nEsta acción retira la prenda del catálogo y no se puede deshacer.`,
      )
    )
      return;
    button.disabled = true;
    if (message) {
      message.className = 'admin-feedback';
      message.textContent = 'Eliminando producto…';
    }
    try {
      const response = await fetch(`/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No fue posible eliminar la prenda.');
      button.closest('tr').remove();
      const live = [...document.querySelectorAll('.admin-table tbody tr')];
      const stats = document.querySelectorAll('.admin-stats strong');
      if (stats.length === 4) {
        stats[0].textContent = String(live.length);
        stats[1].textContent = String(live.filter((r) => r.dataset.hasPrice === '1').length);
        stats[2].textContent = String(live.filter((r) => r.dataset.hasPrice !== '1').length);
        stats[3].textContent = String(live.filter((r) => r.dataset.hasSizes === '1').length);
      }
      if (message) {
        message.className = 'admin-feedback success';
        message.textContent = `Producto ${id.toUpperCase()} eliminado correctamente.`;
      }
      refresh();
    } catch (err) {
      button.disabled = false;
      if (message) {
        message.className = 'admin-feedback error';
        message.textContent = err.message;
      }
    }
  });
})();
