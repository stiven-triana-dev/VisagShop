'use strict';
const products = require('../models/activeProducts');
const money = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    value,
  );
function pageData(extra = {}) {
  return {
    money,
    pageTitle: 'Administración de productos | VisagShop',
    isAdmin: true,
    pageScript: 'admin.js',
    categories: products.categories,
    ...extra,
  };
}
async function list(req, res) {
  res.render('admin/products', pageData({ products: await products.all(), pageScript: 'adminList.js' }));
}
function newForm(req, res) {
  res.render('admin/productForm', pageData({ product: null, mode: 'new' }));
}
async function editForm(req, res) {
  const product = await products.find(req.params.id);
  if (!product) return res.status(404).render('404', { pageTitle: 'Página no encontrada' });
  res.render('admin/productForm', pageData({ product, mode: 'edit' }));
}
async function remove(req, res) {
  try {
    const deleted = await products.remove(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    return res.json({ ok: true, id: deleted.id, message: 'Producto eliminado del catálogo.' });
  } catch (e) {
    console.error('Eliminar producto:', e.message);
    return res.status(500).json({ ok: false, error: 'No fue posible eliminar el producto.' });
  }
}
async function create(req, res) {
  try {
    const item = await products.create(req.body);
    return res.status(201).json({
      ok: true,
      id: item.id,
      redirect: `/admin/products/${encodeURIComponent(item.id)}/edit?success=created`,
    });
  } catch (e) {
    if (e.code) console.error('Crear producto:', e.message);
    return res
      .status(e.code ? 503 : 400)
      .json({ ok: false, error: e.code ? 'No fue posible guardar el producto.' : e.message });
  }
}
async function update(req, res) {
  try {
    const item = await products.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ ok: false, error: 'Producto no encontrado.' });
    return res.json({
      ok: true,
      id: item.id,
      redirect: `/admin/products/${encodeURIComponent(item.id)}/edit?success=updated`,
    });
  } catch (e) {
    if (e.code) console.error('Editar producto:', e.message);
    return res
      .status(e.code ? 503 : 400)
      .json({ ok: false, error: e.code ? 'No fue posible guardar el producto.' : e.message });
  }
}
module.exports = { list, newForm, editForm, create, update, remove };
