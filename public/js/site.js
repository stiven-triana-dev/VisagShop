(() => {
  'use strict';
  const CART_KEY = 'visag_carrito';
  const FAVORITES_KEY = 'visag_favoritos';
  const WHATSAPP = 'https://wa.me/message/MWVYODQ6ZZILP1';
  // IMPORTANTE: configura aquí el número de WhatsApp Business de la tienda, con código de país.
  // Ejemplo de formato colombiano (no es un número real): '573001234567'.
  // El enlace corto /message/ anterior no garantiza mensajes personalizados precargados.
  const WHATSAPP_NUMBER = document.querySelector('meta[name="visag-whatsapp-number"]')?.content || ''; // Configurar en Render (WHATSAPP_NUMBER)
  const checkoutWhatsAppURL = message => {
    const phone = WHATSAPP_NUMBER.replace(/\D/g, '');
    if (/^\d{8,15}$/.test(phone)) {
      return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }
    // En ausencia de número, mantenemos el enlace existente, aunque podría ignorar ?text=.
    return `${WHATSAPP}?text=${encodeURIComponent(message)}`;
  };
  const hasDirectWhatsApp = () => /^\d{8,15}$/.test(WHATSAPP_NUMBER.replace(/\D/g, ''));
  const formatMoney = amount => Number(amount).toLocaleString('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0});
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  // Fotos del catálogo (/img/pNNN.jpg): versión WebP liviana en /img/w/ (360 px para tarjetas, 540 px completa).
  const CARD_SIZES = '(max-width:680px) 50vw, (max-width:900px) 33vw, 320px';
  const photoSrcset = (src, sizes = CARD_SIZES) => { const m = /^\/img\/(p\d{3})\.jpg$/.exec(String(src || '')); return m ? ` srcset="/img/w/${m[1]}-360.webp 360w, /img/w/${m[1]}.webp 540w" sizes="${sizes}"` : ''; };
  const stored = (key, fallback) => { try { const data = JSON.parse(localStorage.getItem(key)); return data ?? fallback; } catch { return fallback; } };
  const readCart = () => {
    const values = stored(CART_KEY, []);
    if (!Array.isArray(values)) return [];
    return values.filter(x => x && typeof x.id === 'string' && /^p\d{3,}$/.test(x.id) && typeof x.talla === 'string' && Number.isInteger(x.cant) && x.cant >= 1)
      .map(x => ({id:x.id, talla:x.talla.slice(0,50), cant:Math.min(99,x.cant)}));
  };
  const saveCart = items => { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); return true; } catch { notify('No se pudo guardar el carrito en este navegador.'); return false; } };
  const readFavorites = () => {
    const values = stored(FAVORITES_KEY, []);
    return new Set(Array.isArray(values) ? values.filter(x => typeof x === 'string' && /^p\d{3,}$/.test(x)) : []);
  };
  const saveFavorites = favorites => { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch { notify('No se pudieron guardar tus favoritos.'); } };
  let noticeTimer;
  function notify(message) {
    const el = document.querySelector('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('visible'), 3600);
  }
  function updateBadge() {
    const count = readCart().reduce((total, item) => total + item.cant, 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = count > 99 ? '99+' : String(count);
      el.hidden = !count;
    });
  }
  const loadProducts = () => fetch('/api/products', {cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
    return response.json();
  }).then(products => {
    if (!Array.isArray(products)) throw new Error('Catálogo inválido.');
    return products;
  });
  window.Visag = {formatMoney,escapeHTML,photoSrcset,readCart,saveCart,readFavorites,saveFavorites,notify,updateBadge,loadProducts,WHATSAPP,checkoutWhatsAppURL,hasDirectWhatsApp};
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-main');
  if (menu && nav) {
    function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Abrir menú');nav.classList.remove('open');}
    menu.addEventListener('click', () => {
      const expanded = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!expanded));
      menu.setAttribute('aria-label', expanded ? 'Abrir menú' : 'Cerrar menú');
      nav.classList.toggle('open', !expanded);
    });
    nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 680) closeMenu(); });
  }
  document.querySelectorAll('#cerrar-sesion, #cerrar-sesion-mobile').forEach(button=>button.addEventListener('click',async () => {
    try {const r=await fetch('/api/account/logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw Error();location.assign('/login');}
    catch {notify('No se pudo cerrar sesión. Inténtalo nuevamente.');}
  }));
  updateBadge();
  window.addEventListener('storage', updateBadge);
})();
