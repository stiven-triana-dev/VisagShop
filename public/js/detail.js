(() => {
  'use strict';
  const {formatMoney,escapeHTML,photoSrcset,readCart,saveCart,updateBadge,loadProducts,notify,WHATSAPP} = window.Visag;
  const id = new URLSearchParams(location.search).get('id') || (/^\/products\/(p\d+)\/?$/.exec(location.pathname)?.[1] || null);
  const add = document.getElementById('agregar');
  const feedback = document.getElementById('feedback');
  const sizes = document.getElementById('tallas');
  const sizeField = document.getElementById('bloque-tallas');
  add.disabled=true;
  function error(message){
    document.getElementById('nombre').textContent = 'PRODUCTO NO ENCONTRADO';
    document.getElementById('precio').textContent='';
    document.getElementById('categoria').textContent='CATÁLOGO';
    feedback.textContent=message;
    document.getElementById('recomendados').innerHTML='<a class="btn btn-outline-dark" href="/#catalogo">VOLVER AL CATÁLOGO ↗</a>';
  }
  loadProducts().then(list => {
    const p = list.find(item => item.id === id);
    if (!p) {error('Este producto no existe o ya no está publicado.');return;}
    add.disabled=false;
    document.title=`${p.nombre} · VisagShop`;
    document.getElementById('foto').src=p.imagen;
    document.getElementById('foto').alt=p.nombre;
    document.getElementById('nombre').textContent=p.nombre;
    document.getElementById('categoria').textContent=p.categoria.toUpperCase();
    document.getElementById('breadcrumb-product').textContent=p.nombre.toUpperCase();
    document.getElementById('precio').textContent=Number.isFinite(p.precio)?formatMoney(p.precio):'Precio por consultar';
    document.getElementById('wa').href=WHATSAPP;
    if (Array.isArray(p.tallas) && p.tallas.length) {
      sizes.innerHTML=p.tallas.map(t=>`<label><input type="radio" name="talla" value="${escapeHTML(t)}"><span>${escapeHTML(t)}</span></label>`).join('');
      sizes.addEventListener('change', () => {document.getElementById('talla-seleccionada').textContent='· '+sizes.querySelector(':checked').value;feedback.textContent='';});
    } else {
      sizeField.innerHTML='<legend>TALLAS</legend><p class="detail-description">Talla o disponibilidad por confirmar con nuestro asesor.</p>';
    }
    add.addEventListener('click', () => {
      const selected=sizes.querySelector('input:checked');
      if (p.tallas.length && !selected) {feedback.style.color='#a44334';feedback.textContent='Selecciona una talla para continuar.';notify('Primero elige tu talla.');return;}
      const size=selected?selected.value:'';
      const cart=readCart();
      const existing=cart.find(item => item.id===p.id && item.talla===size);
      if (existing && existing.cant>=99) {notify('El máximo es 99 unidades por referencia.');return;}
      if (existing) existing.cant++; else cart.push({id:p.id,talla:size,cant:1});
      if (!saveCart(cart)) return;
      updateBadge();
      feedback.style.color='#218042';
      feedback.innerHTML='✓ Producto añadido. <a href="/productCart" style="text-decoration:underline">Ver carrito →</a>';
      notify('¡Listo! Producto añadido al carrito.');
    });
    const recommendations=list.filter(x => x.id!==p.id && x.categoria===p.categoria).slice(0,4);
    const target=document.getElementById('recomendados');
    target.innerHTML=recommendations.map(item => `<article class="product-card"><div class="product-media"><a href="/products/${encodeURIComponent(item.id)}"><img src="${escapeHTML(item.imagen)}"${photoSrcset(item.imagen)} loading="lazy" width="360" height="450" alt="${escapeHTML(item.nombre)}"></a></div><div class="product-caption"><span class="product-meta">${escapeHTML(item.categoria)}</span><h3 class="product-title"><a href="/products/${encodeURIComponent(item.id)}">${escapeHTML(item.nombre)}</a></h3><span class="product-price">${Number.isFinite(item.precio)?formatMoney(item.precio):'Consultar precio'}</span></div></article>`).join('');
  }).catch(() => error('No pudimos cargar este producto. Inténtalo más tarde.'));
})();
