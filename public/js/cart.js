(() => {
  'use strict';
  const {formatMoney, escapeHTML, readCart, saveCart, updateBadge, loadProducts, notify, checkoutWhatsAppURL, hasDirectWhatsApp, WHATSAPP} = window.Visag;
  const itemsEl = document.getElementById('lineas');
  const summaryEl = document.getElementById('resumen');
  const countEl = document.getElementById('cantidad-articulos');
  const form = document.getElementById('checkout-form');
  const confirmBtn = document.getElementById('confirmar-pedido');
  const sheetBtn = document.getElementById('ficha-fotos');
  const modal = document.getElementById('checkout-message-modal');
  const messageEl = document.getElementById('mensaje-whatsapp');
  const copyBtn = document.getElementById('copiar-pedido');
  const openWa = document.getElementById('abrir-wa');
  const billingEl = document.getElementById('billing-fields');
  let products = [];
  let lastFocus = null;

  function getLines() {
    const catalog = new Map(products.map(p => [p.id, p]));
    return readCart().map(item => ({item, p:catalog.get(item.id)})).filter(row => row.p);
  }
  function calc(lines) {
    return {
      subtotal:lines.reduce((sum, {p,item}) => sum + (Number.isFinite(p.precio) ? p.precio*item.cant : 0), 0),
      unpriced:lines.some(({p}) => !Number.isFinite(p.precio)),
      count:lines.reduce((sum, {item}) => sum+item.cant, 0)
    };
  }
  function payment() {return form.elements['medio-pago'].value || 'contraentrega';}
  function paymentLabel() {
    if (payment() === 'nequi') return 'Pago anticipado con Nequi (datos oficiales por confirmar)';
    if (payment() === 'tarjeta') return 'Pago anticipado con tarjeta (enlace seguro por confirmar)';
    return 'Pago contraentrega (sujeto a cobertura)';
  }
  function paymentShipping() {return payment() === 'contraentrega' ? 'Por confirmar' : 'Gratis*';}
  function render() {
    const lines=getLines(), totals=calc(lines);
    countEl.textContent = `(${totals.count})`;
    const hasItems = !!lines.length;
    confirmBtn.disabled = !hasItems;
    sheetBtn.disabled = !hasItems;
    if (!hasItems) {
      itemsEl.innerHTML = `<div class="checkout-empty"><div class="checkout-empty-icon">◇</div><h3>Tu carrito está vacío.</h3><p>Descubre prendas nuevas y vuelve a finalizar tu pedido.</p><a href="/#catalogo">EXPLORAR CATÁLOGO ↗</a></div>`;
      summaryEl.innerHTML = '';
      return;
    }
    itemsEl.innerHTML = lines.map(({p,item},i) => `
      <article class="checkout-product">
        <a class="checkout-product-pic" href="/products/${encodeURIComponent(p.id)}" aria-label="Ver ${escapeHTML(p.nombre)}">
          <img src="${escapeHTML(p.imagen)}" width="74" height="85" alt="${escapeHTML(p.nombre)}"><span class="checkout-product-count">${item.cant}</span>
        </a>
        <div class="checkout-product-info">
          <a href="/products/${encodeURIComponent(p.id)}">${escapeHTML(p.nombre)}</a>
          <span>Ref. ${escapeHTML(p.id.toUpperCase())} · ${item.talla ? `Talla ${escapeHTML(item.talla)}` : 'Talla única / por confirmar'}</span>
          <div class="qty-inline">
            <button type="button" data-qty="${i}" data-step="-1" aria-label="Restar una unidad de ${escapeHTML(p.nombre)}">−</button>
            <output aria-label="Cantidad">${item.cant}</output>
            <button type="button" data-qty="${i}" data-step="1" aria-label="Añadir una unidad de ${escapeHTML(p.nombre)}">+</button>
          </div>
        </div>
        <div class="checkout-product-right"><strong>${Number.isFinite(p.precio) ? formatMoney(p.precio * item.cant) : 'Por consultar'}</strong><button type="button" class="checkout-remove" data-remove="${i}" aria-label="Eliminar ${escapeHTML(p.nombre)}">Eliminar</button></div>
      </article>`).join('');
    const total=totals.unpriced ? 'Por confirmar' : formatMoney(totals.subtotal);
    summaryEl.innerHTML = `
      <div class="checkout-total-line"><span>Subtotal (${totals.count} ${totals.count===1?'artículo':'artículos'})</span><span>${formatMoney(totals.subtotal)}</span></div>
      <div class="checkout-total-line muted"><span>Envío</span><span>${paymentShipping()}</span></div>
      <div class="checkout-total-line checkout-total-final"><span>Total estimado</span><strong><small>COP</small>${total}</strong></div>
      <p class="checkout-total-hint">${payment()==='contraentrega'?'El costo de envío se confirma según destino y cobertura.':'*Promoción de envío gratis en pagos anticipados, sujeta a condiciones y cobertura.'}</p>
      ${totals.unpriced ? '<p class="checkout-total-warning">Hay productos sin precio publicado. VisagShop confirmará el valor final.</p>' : ''}`;
  }

  function data() {return new FormData(form);}
  function field(fd, key) {return String(fd.get(key) || '').trim();}
  function photoURL(src) {
    if (location.protocol !== 'https:' || ['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname)) return '';
    return new URL(src, location.origin).href;
  }
  function orderMessage(lines, totals, saved) {
    const fd=data();
    const entries=lines.map(({p,item},i) => {
      const photo=photoURL(p.imagen);
      return `${i+1}. *${p.nombre}*\n   Ref: ${p.id.toUpperCase()}\n   Talla: ${item.talla||'Por confirmar'}\n   Cantidad: ${item.cant}\n   Valor: ${Number.isFinite(p.precio)?formatMoney(p.precio*item.cant):'Por confirmar'}${photo ? '\n   Foto: '+photo : ''}`;
    });
    const contact = [
      `Nombre: ${field(fd,'nombre')} ${field(fd,'apellidos')}`,
      `Teléfono: ${field(fd,'celular')}`,
      ...(field(fd,'documento') ? [`Documento (informado por el cliente): ${field(fd,'documento')}`] : []),
      ...(field(fd,'email') ? [`Correo: ${field(fd,'email')}`] : []),
      `País: Colombia`,
      `Departamento: ${field(fd,'departamento')}`,
      `Ciudad: ${field(fd,'ciudad')}`,
      `Dirección: ${field(fd,'direccion')}`,
      ...(field(fd,'complemento') ? [`Complemento: ${field(fd,'complemento')}`] : []),
      ...(field(fd,'postal') ? [`Código postal: ${field(fd,'postal')}`] : []),
    ];
    const billing=field(fd,'facturacion')==='diferente' ?
      `Dirección de facturación: ${field(fd,'fact_direccion')}, ${field(fd,'fact_ciudad')}, ${field(fd,'fact_departamento')}` :
      'Dirección de facturación: misma dirección de entrega';
    return `*SOLICITUD DE PEDIDO · VISAGSHOP*${saved ? `\n*Pedido N.º ${saved.code}*` : ''}\n\n*PRENDAS*\n${entries.join('\n\n')}\n\n*DATOS DE ENTREGA*\n${contact.join('\n')}\n\n*FORMA DE PAGO*\n${paymentLabel()}\n${billing}\n\n*RESUMEN*\nProductos: ${formatMoney(totals.subtotal)}${totals.unpriced?' (faltan precios por confirmar)':''}\nEnvío: ${payment()==='contraentrega'?'Por confirmar según destino':'Gratis, sujeto a cobertura y condiciones'}\nTotal estimado: ${totals.unpriced?'Por confirmar':formatMoney(totals.subtotal)}${payment()==='contraentrega'?' + envío':''}\n\nHola, quiero confirmar disponibilidad, costo final y pasos para completar este pedido. Gracias.`;
  }

  itemsEl.addEventListener('click', e => {
    const button=e.target.closest('button[data-qty],button[data-remove]');
    if (!button) return;
    const cart=getLines().map(({item}) => ({...item}));
    const index=Number(button.dataset.qty ?? button.dataset.remove);
    if (!Number.isInteger(index) || !cart[index]) return;
    if (button.hasAttribute('data-remove')) cart.splice(index, 1);
    else cart[index].cant=Math.max(1, Math.min(99, cart[index].cant+Number(button.dataset.step)));
    if (saveCart(cart)) {updateBadge();render();}
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'medio-pago') render();
    if (e.target.name === 'facturacion') {
      const show=e.target.value === 'diferente';
      billingEl.hidden=!show;
      billingEl.querySelectorAll('input').forEach(input => {input.required=show;});
    }
  });
  function modalShow(message) {
    lastFocus=document.activeElement;
    messageEl.value=message;
    openWa.href=WHATSAPP;
    modal.hidden=false;
    document.body.style.overflow='hidden';
    copyBtn.focus();
  }
  function modalHide() {modal.hidden=true;document.body.style.overflow='';lastFocus?.focus();}
  modal.addEventListener('click', e=>{if(e.target.closest('[data-close-modal]'))modalHide();});
  document.addEventListener('keydown', e=>{
    if(modal.hidden)return;
    if(e.key==='Escape')modalHide();
    if(e.key==='Tab'){
      const tabbables=[...modal.querySelectorAll('button,a,textarea')].filter(el=>!el.disabled);
      const first=tabbables[0],last=tabbables[tabbables.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  copyBtn.addEventListener('click', async()=>{
    try {await navigator.clipboard.writeText(messageEl.value);notify('Pedido copiado. Pégalo en el chat de VisagShop.');}
    catch {messageEl.focus();messageEl.select();notify('Selecciona y copia el texto para pegarlo en WhatsApp.');}
  });
  // Guarda el pedido en la tienda (POST /api/orders). Los precios los calcula el servidor.
  const errors=window.VisagValidate?.attach(form,{});
  async function saveOrder() {
    const body={};
    for (const [key,value] of data().entries()) if (typeof value==='string') body[key]=value;
    body.items=getLines().map(({item}) => ({id:item.id, talla:item.talla, cant:item.cant}));
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({}));
    if (response.status===400) {const error=new Error(result.error||'Revisa los datos del pedido.');error.fields=result.errors;error.invalid=true;throw error;}
    if (!response.ok) throw new Error(result.error||'No pudimos registrar el pedido.');
    return result;
  }
  function showSaved(saved, waUrl) {
    itemsEl.innerHTML = `<div class="checkout-empty order-saved" role="status">
      <div class="checkout-empty-icon">✓</div>
      <h3>Pedido ${escapeHTML(saved.code)} registrado.</h3>
      <p>Lo recibimos en la tienda. Envíanos el mensaje por WhatsApp para confirmar disponibilidad, envío y pago.${saved.mine ? ' También lo verás en <a href="/profile">Mi perfil</a>.' : ''}</p>
      ${waUrl ? `<a href="${escapeHTML(waUrl)}" target="_blank" rel="noopener">ABRIR WHATSAPP ↗</a>` : ''}
      <a href="/#catalogo">SEGUIR COMPRANDO ↗</a>
    </div>`;
    summaryEl.innerHTML = '';
    countEl.textContent='(0)';
    confirmBtn.disabled=true;sheetBtn.disabled=true;
    itemsEl.scrollIntoView({behavior:'smooth',block:'start'});
  }
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const lines=getLines();
    if (!lines.length){notify('Primero añade prendas a tu carrito.');return;}
    if (!form.reportValidity())return;
    // La ventana de WhatsApp se abre ya (en el clic) para que el navegador no la bloquee.
    const direct=hasDirectWhatsApp();
    const popup=direct?window.open('about:blank','_blank'):null;
    if(popup)popup.opener=null;
    const label=confirmBtn.innerHTML;
    confirmBtn.disabled=true;confirmBtn.textContent='REGISTRANDO PEDIDO…';
    let saved=null;
    try {
      saved=await saveOrder();
    } catch (error) {
      if (error.invalid) {
        popup?.close();
        confirmBtn.disabled=false;confirmBtn.innerHTML=label;
        if(!errors?.showServerErrors(error.fields))notify(error.message);
        return;
      }
      // Si la tienda no responde, el pedido igual puede enviarse por WhatsApp.
      notify('No pudimos registrar el pedido en la tienda, pero puedes enviarlo por WhatsApp.');
    }
    confirmBtn.disabled=false;confirmBtn.innerHTML=label;
    const text=orderMessage(lines,calc(lines),saved);
    const url=direct?checkoutWhatsAppURL(text):'';
    if(saved){
      saveCart([]);updateBadge();showSaved(saved,url);
    }
    if(direct){
      if(popup)popup.location.href=url;else window.location.href=url;
      return;
    }
    modalShow(text);
  });

  function wrap(ctx,content,x,y,width,lineHeight,maxLines=2) {
    let line='',count=0;
    for(const word of String(content).split(/\s+/)){
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width>width && line){ctx.fillText(line,x,y+count*lineHeight);count++;line=word;if(count>=maxLines)break;}
      else line=test;
    }
    if(count<maxLines)ctx.fillText(line,x,y+count*lineHeight);
  }
  const loadImage=src => new Promise(resolve=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;
  });
  async function photoSheet() {
    const lines=getLines(), totals=calc(lines);
    if(!lines.length)return;
    const width=900,pad=42,rowH=168, height=300+rowH*lines.length+200;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#faf9f4';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#12191f';ctx.fillRect(0,0,width,18);
    ctx.fillStyle='#e3c900';ctx.fillRect(width-210,0,170,18);
    ctx.fillStyle='#2099e6';ctx.fillRect(width-40,0,40,18);
    const logo=await loadImage('/img/logo-visagshop.png');
    if(logo){ctx.save();ctx.beginPath();ctx.arc(83,86,41,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,42,45,82,82);ctx.restore();}
    ctx.fillStyle='#16191e';ctx.font='bold 40px Arial, sans-serif';ctx.fillText('VISAGSHOP',142,83);
    ctx.fillStyle='#687077';ctx.font='bold 17px Arial, sans-serif';ctx.fillText('FICHA VISUAL DEL PEDIDO',142,115);
    ctx.fillStyle='#7a7c7e';ctx.font='16px Arial, sans-serif';ctx.fillText('PRENDAS · REFERENCIAS · TALLAS · CANTIDADES',pad,177);
    ctx.strokeStyle='#d6d6d0';ctx.beginPath();ctx.moveTo(pad,200);ctx.lineTo(width-pad,200);ctx.stroke();
    const pictures=await Promise.all(lines.map(({p})=>loadImage(p.imagen)));
    lines.forEach(({p,item},i)=>{
      const y=218+i*rowH, pic=pictures[i];
      ctx.fillStyle='#ebe9e2';ctx.fillRect(pad,y,125,142);
      if(pic){const scale=Math.max(125/pic.width,142/pic.height),w=pic.width*scale,h=pic.height*scale;
        ctx.save();ctx.beginPath();ctx.rect(pad,y,125,142);ctx.clip();ctx.drawImage(pic,pad+(125-w)/2,y+(142-h)/2,w,h);ctx.restore();}
      ctx.fillStyle='#172027';ctx.font='bold 24px Arial, sans-serif';wrap(ctx,p.nombre,190,y+32,650,27,2);
      ctx.fillStyle='#50575a';ctx.font='17px Arial, sans-serif';ctx.fillText('REF. '+p.id.toUpperCase()+'  /  TALLA '+(item.talla||'POR CONFIRMAR'),190,y+90);
      ctx.fillText('CANT. '+item.cant+'  /  '+(Number.isFinite(p.precio)?formatMoney(p.precio*item.cant):'PRECIO POR CONFIRMAR'),190,y+121);
    });
    const y=218+lines.length*rowH+14;
    ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(width-pad,y);ctx.stroke();
    ctx.fillStyle='#192027';ctx.font='bold 21px Arial, sans-serif';ctx.fillText('PAGO: '+paymentLabel().toUpperCase(),pad,y+42);
    ctx.font='bold 25px Arial, sans-serif';ctx.fillText('PRODUCTOS: '+(totals.unpriced?'POR CONFIRMAR':formatMoney(totals.subtotal)),pad,y+92);
    ctx.fillStyle='#6f7578';ctx.font='16px Arial, sans-serif';ctx.fillText('Disponibilidad, valor final y envío sujetos a confirmación con la tienda.',pad,y+137);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('No fue posible generar la imagen');
    const file=new File([blob],'VisagShop_Pedido_Con_Fotos.png',{type:'image/png'});
    if(navigator.share && navigator.canShare?.({files:[file]})){
      try {await navigator.share({files:[file],title:'Ficha visual de mi pedido VisagShop'});return;}
      catch(error){if(error.name==='AbortError')return;}
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='VisagShop_Pedido_Con_Fotos.png';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    notify('Ficha descargada. Puedes adjuntarla a tu mensaje de WhatsApp.');
  }
  sheetBtn.addEventListener('click',async()=>{
    if(sheetBtn.disabled)return;
    sheetBtn.disabled=true;
    const saved=sheetBtn.innerHTML;
    sheetBtn.textContent='PREPARANDO FICHA...';
    try{await photoSheet();}catch(error){console.error(error);notify('No se pudo crear la ficha. Inténtalo nuevamente.');}
    finally {sheetBtn.innerHTML=saved;sheetBtn.disabled=!getLines().length;}
  });
  loadProducts().then(list=>{products=list;render();}).catch(error=>{
    console.error(error);
    itemsEl.innerHTML='<p>No pudimos cargar los productos. Actualiza la página e inténtalo de nuevo.</p>';
    confirmBtn.disabled=true;sheetBtn.disabled=true;
  });
})();
