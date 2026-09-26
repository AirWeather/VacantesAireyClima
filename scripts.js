/* ============================================================
   AIRE Y CLIMA ESPECIALIZADO
   Formulario de Postulación — Lógica del Cliente
   Responsabilidad única: gestionar el comportamiento del form
   ============================================================ */

(function () {
  'use strict';

  // ============================================================
  //  ⚙️  CONFIGURACIÓN
  // ============================================================

  /**
   * URL de la API de Google Apps Script.
   * Es el endpoint que recibe los datos del formulario y los
   * escribe en el Google Sheet.
   */
const URL_API = 'https://script.google.com/macros/s/AKfycbxIcZpyBEE_1PiW6xzaX9O1YOpmKHjT8KzDc4M4GhvfSUdXqMKriqABzPRl2eIcadIo/exec';
  /**
   * Tiempo máximo (ms) que esperamos antes de mostrar error de red.
   * Como no podemos leer la respuesta por CORS, usamos un timeout.
   */
  const TIMEOUT_MS = 15000;


  // ============================================================
  //  REFERENCIAS DEL DOM (se cargan en init)
  // ============================================================
  let form, seccionFormulario, seccionExito;
  let btnEnviar, btnNuevaSolicitud;
  let mensajeGlobal, anioSpan;


  // ============================================================
  //  REGLAS DE VALIDACIÓN POR CAMPO
  // ============================================================
  const REGLAS = {
    nombre: {
      requerido: true,
      minLength: 3,
      maxLength: 100,
      mensaje: 'Ingresa tu nombre completo (mínimo 3 caracteres).'
    },
    edad: {
      requerido: true,
      tipo: 'numero',
      min: 18,
      max: 70,
      mensaje: 'La edad debe estar entre 18 y 70 años.'
    },
    telefono: {
      requerido: true,
      patron: /^\d{10}$/,
      mensaje: 'El teléfono debe tener exactamente 10 dígitos.'
    },
    domicilio: {
      requerido: true,
      maxLength: 200,
      mensaje: 'Ingresa tu domicilio completo.'
    },
    correo: {
      requerido: true,
      patron: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      mensaje: 'Ingresa un correo electrónico válido.'
    },
    puesto: {
      requerido: true,
      mensaje: 'Selecciona el puesto al que aplicas.'
    },
    escolaridad: {
      requerido: true,
      mensaje: 'Selecciona tu nivel de escolaridad.'
    },
    experiencia: {
      requerido: true,
      tipo: 'numero',
      min: 0,
      max: 60,
      mensaje: 'Los años de experiencia deben estar entre 0 y 60.'
    },
    pretension: {
      requerido: true,
      tipo: 'numero',
      min: 1,
      mensaje: 'La pretensión económica debe ser mayor a 0.'
    },
    traslado: {
      requerido: true,
      mensaje: 'Selecciona tu tiempo de traslado.'
    },
    empleo1: {
      requerido: true,
      maxLength: 150,
      mensaje: 'Indica al menos un empleo anterior.'
    },
    empleo2: {
      requerido: false,
      maxLength: 150,
      mensaje: ''
    },
    empleo3: {
      requerido: false,
      maxLength: 150,
      mensaje: ''
    }
  };


  // ============================================================
  //  INICIALIZACIÓN
  // ============================================================
  function init() {
    // Cachear referencias del DOM
    form               = document.getElementById('formulario-vacante');
    seccionFormulario  = document.getElementById('seccion-formulario');
    seccionExito       = document.getElementById('seccion-exito');
    btnEnviar          = document.getElementById('btn-enviar');
    btnNuevaSolicitud  = document.getElementById('btn-nueva-solicitud');
    mensajeGlobal      = document.getElementById('mensaje-global');
    anioSpan           = document.getElementById('anio');

    if (!form) return;   // Seguridad: si no existe el form, no hacemos nada

    // Actualizar año del footer
    if (anioSpan) {
      anioSpan.textContent = new Date().getFullYear();
    }

    // Enlazar eventos
    form.addEventListener('submit', manejarSubmit);
    form.addEventListener('input', manejarInput);       // Validación en vivo
    form.addEventListener('blur', manejarBlur, true);   // Validación al salir del campo
    btnNuevaSolicitud.addEventListener('click', resetFormulario);
  }


  // ============================================================
  //  MANEJADORES DE EVENTOS
  // ============================================================

  /** Submit del formulario */
  function manejarSubmit(evento) {
    evento.preventDefault();

    // Ocultar mensaje global previo
    ocultarMensajeGlobal();

    // Validar todos los campos
    const errores = validarFormulario();

    if (errores.length > 0) {
      // Enfocar el primer campo con error
      const primerError = form.querySelector('.campo.con-error input, .campo.con-error select');
      if (primerError) primerError.focus();
      return;
    }

    // Enviar al backend
    enviarFormulario();
  }

  /** Validación en vivo mientras el usuario escribe */
  function manejarInput(evento) {
    const campo = evento.target;
    if (!campo.name) return;

    const contenedor = campo.closest('.campo');
    if (contenedor && contenedor.classList.contains('con-error')) {
      validarCampo(campo.name);
    }
  }

  /** Validación al salir del campo (blur) */
  function manejarBlur(evento) {
    const campo = evento.target;
    if (!campo.name) return;
    validarCampo(campo.name);
  }


  // ============================================================
  //  VALIDACIÓN
  // ============================================================

  function validarFormulario() {
    const errores = [];

    Object.keys(REGLAS).forEach(function (nombreCampo) {
      if (!validarCampo(nombreCampo)) {
        errores.push(nombreCampo);
      }
    });

    return errores;
  }

  function validarCampo(nombreCampo) {
    const regla = REGLAS[nombreCampo];
    const input = form.elements[nombreCampo];

    if (!regla || !input) return true;

    const valor = String(input.value || '').trim();
    let error = '';

    // 1. Requerido
    if (regla.requerido && valor === '') {
      error = regla.mensaje || 'Este campo es obligatorio.';
    }
    // 2. Solo validar el resto si hay valor
    else if (valor !== '') {

      if (regla.minLength && valor.length < regla.minLength) {
        error = regla.mensaje;
      }

      if (!error && regla.maxLength && valor.length > regla.maxLength) {
        error = `Máximo ${regla.maxLength} caracteres.`;
      }

      if (!error && regla.patron && !regla.patron.test(valor)) {
        error = regla.mensaje;
      }

      if (!error && regla.tipo === 'numero') {
        const num = Number(valor);
        if (isNaN(num)) {
          error = regla.mensaje;
        } else if (regla.min !== undefined && num < regla.min) {
          error = regla.mensaje;
        } else if (regla.max !== undefined && num > regla.max) {
          error = regla.mensaje;
        }
      }
    }

    // Actualizar UI
    if (error) {
      mostrarError(nombreCampo, error);
      return false;
    } else {
      limpiarError(nombreCampo);
      return true;
    }
  }

  function mostrarError(nombreCampo, mensaje) {
    const input = form.elements[nombreCampo];
    if (!input) return;

    const contenedor = input.closest('.campo');
    const errorSpan = form.querySelector(`[data-error-de="${nombreCampo}"]`);

    if (contenedor) contenedor.classList.add('con-error');
    if (errorSpan) errorSpan.textContent = mensaje;
  }

  function limpiarError(nombreCampo) {
    const input = form.elements[nombreCampo];
    if (!input) return;

    const contenedor = input.closest('.campo');
    const errorSpan = form.querySelector(`[data-error-de="${nombreCampo}"]`);

    if (contenedor) contenedor.classList.remove('con-error');
    if (errorSpan) errorSpan.textContent = '';
  }

  function limpiarTodosLosErrores() {
    Object.keys(REGLAS).forEach(limpiarError);
    ocultarMensajeGlobal();
  }


  // ============================================================
  //  RECOLECCIÓN DE DATOS
  // ============================================================

  function recolectarDatos() {
    return {
      nombre:      form.elements.nombre.value.trim(),
      edad:        form.elements.edad.value.trim(),
      domicilio:   form.elements.domicilio.value.trim(),
      telefono:    form.elements.telefono.value.trim(),
      correo:      form.elements.correo.value.trim(),
      puesto:      form.elements.puesto.value,
      escolaridad: form.elements.escolaridad.value,
      experiencia: form.elements.experiencia.value.trim(),
      pretension:  form.elements.pretension.value.trim(),
      empleo1:     form.elements.empleo1.value.trim(),
      empleo2:     form.elements.empleo2.value.trim(),
      empleo3:     form.elements.empleo3.value.trim(),
      traslado:    form.elements.traslado.value
    };
  }


  // ============================================================
  //  ENVÍO AL BACKEND — fetch + Apps Script API
  // ============================================================
  function enviarFormulario() {
    const datos = recolectarDatos();

    // Estado de carga
    activarEstadoCargando();

    // Timeout de seguridad
    const timeoutId = setTimeout(function () {
      desactivarEstadoCargando();
      mostrarMensajeGlobal(
        'El servidor está tardando más de lo esperado. Revisa tu conexión e inténtalo de nuevo.'
      );
    }, TIMEOUT_MS);

    // Petición al backend
    fetch(URL_API, {
      method: 'POST',
      mode: 'no-cors',                                  // ⚠️ CORS de Apps Script
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'      // Apps Script no acepta application/json en preflight
      },
      body: JSON.stringify(datos)
    })
      .then(function () {
        // ✅ No podemos leer la respuesta por CORS.
        // Si el fetch no tiró error, asumimos éxito.
        clearTimeout(timeoutId);
        desactivarEstadoCargando();
        manejarExito();
      })
      .catch(function (error) {
        clearTimeout(timeoutId);
        desactivarEstadoCargando();
        manejarFallo(error);
      });
  }

  /** Respuesta exitosa (optimista por CORS) */
  function manejarExito() {
    mostrarExito();
  }

  /** Fallo técnico (red, servidor inaccesible, etc.) */
  function manejarFallo(error) {
    console.error('Error al enviar:', error);
    mostrarMensajeGlobal(
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
    );
  }


  // ============================================================
  //  ESTADOS DE UI
  // ============================================================

  function activarEstadoCargando() {
    btnEnviar.disabled = true;

    const texto = btnEnviar.querySelector('.texto-btn');
    const spinner = btnEnviar.querySelector('.spinner');

    if (texto) texto.textContent = 'Enviando...';
    if (spinner) spinner.hidden = false;
  }

  function desactivarEstadoCargando() {
    btnEnviar.disabled = false;

    const texto = btnEnviar.querySelector('.texto-btn');
    const spinner = btnEnviar.querySelector('.spinner');

    if (texto) texto.textContent = 'Enviar solicitud';
    if (spinner) spinner.hidden = true;
  }

  function mostrarMensajeGlobal(mensaje) {
    if (!mensajeGlobal) return;
    mensajeGlobal.textContent = mensaje;
    mensajeGlobal.hidden = false;
    mensajeGlobal.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ocultarMensajeGlobal() {
    if (!mensajeGlobal) return;
    mensajeGlobal.hidden = true;
    mensajeGlobal.textContent = '';
  }


  // ============================================================
  //  TOGGLE: FORMULARIO ↔ ÉXITO
  // ============================================================

  function mostrarExito() {
    seccionFormulario.hidden = true;
    seccionExito.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetFormulario() {
    form.reset();
    limpiarTodosLosErrores();

    seccionExito.hidden = true;
    seccionFormulario.hidden = false;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const primerInput = form.querySelector('input, select');
    if (primerInput) primerInput.focus();
  }


  // ============================================================
  //  ARRANQUE
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

})();