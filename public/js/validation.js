// Sprint 7 · Validaciones del front-end (JavaScript propio, sin librerías).
// Mismas reglas que el servidor (validations/rules.js). Muestra un mensaje debajo
// de cada campo, marca el campo con aria-invalid y lleva el foco al primer error.
(() => {
  'use strict';
  const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_IMAGE = 3 * 1024 * 1024;
  const valueOf = input => (input.type === 'file' ? input.files[0] || null : input.value.trim());

  const rules = {
    required: message => value => (value ? null : message),
    minLength: (min, message) => value => (!value || value.length >= min ? null : message),
    maxLength: (max, message) => value => (!value || value.length <= max ? null : message),
    email: message => value => (!value || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : message),
    pattern: (regex, message) => value => (!value || regex.test(value) ? null : message),
    integer: message => value => (!value || /^\d{1,9}$/.test(value) ? null : message),
    sameAs: (other, message) => (value, form) => (value === form.elements[other].value.trim() ? null : message),
    differentFrom: (other, message) => (value, form) => (!value || value !== form.elements[other].value.trim() ? null : message),
    password: () => value => {
      if (!value) return 'La contraseña es obligatoria.';
      if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (!/[a-z]/.test(value)) return 'Incluye al menos una letra minúscula.';
      if (!/[A-Z]/.test(value)) return 'Incluye al menos una letra mayúscula.';
      if (!/[0-9]/.test(value)) return 'Incluye al menos un número.';
      if (!/[^A-Za-z0-9]/.test(value)) return 'Incluye al menos un carácter especial (por ejemplo ! # $ % * -).';
      return null;
    },
    image: ({required = false} = {}) => file => {
      if (!file) return required ? 'Selecciona una imagen.' : null;
      if (!IMAGE_TYPES.includes(file.type)) return 'La imagen debe ser JPG, JPEG, PNG, GIF o WebP.';
      if (file.size > MAX_IMAGE) return 'La imagen debe pesar 3 MB o menos.';
      return null;
    }
  };

  function messageFor(input) {
    const id = `${input.form.id || 'form'}-${input.name}-error`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('small');
      el.id = id;
      el.className = 'field-error';
      el.setAttribute('aria-live', 'polite');
      const label = input.closest('label');
      if (label) label.appendChild(el); else input.insertAdjacentElement('afterend', el);
      const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (!described.includes(id)) input.setAttribute('aria-describedby', [...described, id].join(' '));
    }
    return el;
  }

  function setError(input, message) {
    const el = messageFor(input);
    el.textContent = message || '';
    el.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function attach(form, fieldRules) {
    form.noValidate = true; // usamos nuestros mensajes en lugar de los del navegador
    const touched = new Set();

    const check = name => {
      const input = form.elements[name];
      if (!input) return true;
      const value = valueOf(input);
      for (const rule of fieldRules[name]) {
        const message = rule(value, form, input);
        if (message) { setError(input, message); return false; }
      }
      setError(input, null);
      return true;
    };

    for (const name of Object.keys(fieldRules)) {
      const input = form.elements[name];
      if (!input) continue;
      input.addEventListener('blur', () => { touched.add(name); check(name); });
      input.addEventListener(input.type === 'file' || input.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (touched.has(name) || input.getAttribute('aria-invalid')) check(name);
        // Revalida la confirmación si cambia la contraseña original.
        for (const other of Object.keys(fieldRules)) if (other !== name && touched.has(other) && form.elements[other]?.dataset.matches === name) check(other);
      });
    }

    return {
      validate() {
        let firstInvalid = null;
        for (const name of Object.keys(fieldRules)) {
          touched.add(name);
          if (!check(name) && !firstInvalid) firstInvalid = form.elements[name];
        }
        if (firstInvalid) firstInvalid.focus();
        return !firstInvalid;
      },
      // Errores que devuelve el servidor (express-validator): {campo: mensaje}
      showServerErrors(errors) {
        let first = null;
        for (const [name, message] of Object.entries(errors || {})) {
          let input = form.elements[name === 'imageData' ? (form.querySelector('input[type=file]')?.name || name) : name];
          if (input && !(input instanceof Element)) input = input[0]; // grupo de radios: primer botón
          if (!input) continue;
          setError(input, message);
          if (!first) first = input;
        }
        first?.focus();
        return Boolean(first);
      },
      clear() { for (const name of Object.keys(fieldRules)) if (form.elements[name]) setError(form.elements[name], null); }
    };
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No fue posible leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  window.VisagValidate = {attach, rules, readImage};
})();
