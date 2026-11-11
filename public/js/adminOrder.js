(() => {
  'use strict';
  // Cambia el estado de un pedido desde su detalle en el panel.
  const form = document.getElementById('order-status-form');
  if (!form) return;
  const feedback = document.getElementById('order-feedback');
  const badge = document.getElementById('order-status-badge');
  const errors = window.VisagValidate.attach(form, {
    adminNote: [window.VisagValidate.rules.maxLength(500, 'La nota puede tener máximo 500 caracteres.')]
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!errors.validate()) return;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    feedback.className = 'admin-feedback';
    feedback.textContent = 'Guardando…';
    try {
      const response = await fetch(`/admin/api/orders/${form.dataset.number}`, {
        method: 'PUT', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: form.elements.status.value, adminNote: form.elements.adminNote.value})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { errors.showServerErrors(result.errors); throw new Error(result.error || 'No se pudo guardar.'); }
      badge.textContent = result.statusLabel;
      badge.className = `order-status order-status-${result.status}`;
      feedback.className = 'admin-feedback success';
      feedback.textContent = result.message;
      document.getElementById('order-updated').textContent = 'ahora';
    } catch (error) {
      feedback.className = 'admin-feedback error';
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
