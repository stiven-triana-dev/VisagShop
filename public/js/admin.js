(() => {
  'use strict';
  const form=document.getElementById('admin-product-form');
  if (!form) return;
  const {attach,rules:r,readImage}=window.VisagValidate;
  const feedback=document.getElementById('admin-feedback');
  const preview=document.getElementById('imagen-preview');
  const fileInput=form.elements.imagen;
  const submit=document.getElementById('guardar-producto');
  const isNew=form.dataset.mode==='new';
  const money=number=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(number);

  // Sprint 7: mismas reglas que valida el servidor (validations/productValidations.js).
  const validator=attach(form,{
    nombre:[r.required('El nombre del producto es obligatorio.'),r.minLength(5,'El nombre debe tener al menos 5 caracteres.'),r.maxLength(120,'El nombre puede tener máximo 120 caracteres.')],
    descripcion:[r.minLength(20,'La descripción debe tener al menos 20 caracteres.'),r.maxLength(1000,'La descripción puede tener máximo 1000 caracteres.')],
    categoria:[r.required('Selecciona una categoría.')],
    precio:[r.integer('El precio debe ser un número entero en pesos, sin puntos ni decimales.')],
    imagen:[r.image({required:isNew})]
  });

  const updatePreview=()=>{
    document.getElementById('preview-nombre').textContent=form.elements.nombre.value||'Nombre de tu nueva prenda';
    const value=form.elements.precio.value;
    document.getElementById('preview-precio').textContent=value!==''&&Number.isFinite(Number(value))?money(Number(value)):'Precio por consultar';
  };
  form.addEventListener('input',updatePreview);
  fileInput.addEventListener('change',()=>{
    const file=fileInput.files[0];
    if (!file || r.image()(file)) return;
    if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);
    const objectUrl=URL.createObjectURL(file);preview.dataset.objectUrl=objectUrl;preview.src=objectUrl;
  });
  if (new URLSearchParams(location.search).has('success')) {
    feedback.className='admin-feedback success';feedback.textContent='Los cambios se guardaron correctamente en el catálogo.';
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!validator.validate()){feedback.className='admin-feedback error';feedback.textContent='Revisa los campos marcados.';return;}
    submit.disabled=true;feedback.className='admin-feedback';feedback.textContent='Guardando producto…';
    try {
      const values=new FormData(form);
      const data={nombre:values.get('nombre'),descripcion:values.get('descripcion'),categoria:values.get('categoria'),precio:values.get('precio'),tallas:values.get('tallas'),colores:values.get('colores')};
      const file=fileInput.files[0];if(file)data.imageData=await readImage(file);
      const id=form.dataset.id;
      const endpoint=isNew?'/products':`/products/${encodeURIComponent(id)}`;
      const response=await fetch(endpoint,{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'same-origin'});
      const result=await response.json().catch(()=>({error:`Error del servidor (${response.status})`}));
      if(!response.ok){validator.showServerErrors(result.errors);throw new Error(result.error||'No se pudo guardar el producto.');}
      if(result.redirect)window.location.assign(result.redirect);
      else {feedback.className='admin-feedback success';feedback.textContent='Producto guardado.';}
    }catch(error){feedback.className='admin-feedback error';feedback.textContent=error.message;}
    finally{submit.disabled=false;}
  });
})();
