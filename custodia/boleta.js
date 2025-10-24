import { verificarAccesoSeccion } from "../middlewares/seccionesMiddleware.js";

(() => {
  if (!verificarAccesoSeccion("custodia")) {
    // Si no tiene acceso, el middleware ya redirige automáticamente
    return;
  }

  // ==================================== CONFIGURACIÓN ====================================
  const ENV = window.APP_ENV;
  const BASE_URL = window.BASE_URL;
  const urlLocal = window.URL_LOCAL;

  // URL para pago en efectivo
  const urlPaymentEfectivo = window.URL_PAYMENT_EFECTIVO;

  // --- Servidor principal ---
  const urlUpdate = `${BASE_URL}TerminalCalama/PHP/Boleta/save.php`;
  const urlStore = `${BASE_URL}TerminalCalama/PHP/Custodia/store.php`;
  const urlState = `${BASE_URL}TerminalCalama/PHP/Custodia/reload.php`;
  const urlLoad = `${BASE_URL}TerminalCalama/PHP/Boleta/load.php`;

  // --- URLs locales (impresión y Transbank) ---
  const urlImpresion = `${urlLocal}/api/imprimir`;
  const urlPaymentTarjeta = `${urlLocal}/api/payment`;

  //==================================== HELPERS =======================================
  async function callAPI(datos, url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      return await res.json();
    } catch (err) {
      console.error("callAPI error", err);
      return null;
    }
  }

  async function traerDatos(id) {
    let datos = await fetch(urlLoad, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(id),
    })
      .then((response) => response.json())
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error("Error obteniendo datos: ", error);
      });
    return datos;
  }

  //==================================== PDF CON JSPDF ================================
  async function generarPDFEntrega(datosTicket) {
    return new Promise(async (resolve, reject) => {
      try {
        // Verificar si jsPDF está disponible
        if (typeof jspdf === "undefined" && typeof jsPDF === "undefined") {
          // Cargar jsPDF dinámicamente
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = () => {
            setTimeout(() => crearPDF(), 100);
          };
          script.onerror = () => reject(new Error("No se pudo cargar jsPDF"));
          document.head.appendChild(script);
        } else {
          crearPDF();
        }

        function crearPDF() {
          try {
            // Usar la versión disponible
            const jsPDF = window.jspdf?.jsPDF || window.jsPDF;

            if (!jsPDF) {
              reject(new Error("jsPDF no disponible"));
              return;
            }

            const pdf = new jsPDF({
              orientation: "portrait",
              unit: "mm",
              format: [58, 80],
            });

            // Contenido del ticket de entrega
            let y = 5;

            // Título
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text("COMPROBANTE DE ENTREGA", 29, y, { align: "center" });
            y += 6;

            // Información
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text(
              `Fecha Entrega: ${datosTicket.fechaSalida} ${datosTicket.horaSalida}`,
              3,
              y
            );
            y += 4;
            pdf.text(`Casillero: ${datosTicket.casillero}`, 3, y);
            y += 4;
            pdf.text(`Tiempo Ocupado: ${datosTicket.tiempoOcupado}`, 3, y);
            y += 4;
            pdf.text(`Valor Total: ${datosTicket.valorTotal}`, 3, y);
            y += 4;
            pdf.text(`RUT: ${datosTicket.rut}`, 3, y);
            y += 4;
            pdf.text(
              `Método de Pago: ${datosTicket.metodoPago || "Efectivo"}`,
              3,
              y
            );
            y += 6;
            // Generar barcode en canvas offscreen
            try {
              const canvas = document.createElement("canvas");
              canvas.width = 600;
              canvas.height = 200;

              JsBarcode(canvas, datosTicket.codigoBarras, {
                format: "CODE128",
                displayValue: false,
                width: 2,
                height: 80,
                margin: 10,
              });

              const imageData = canvas.toDataURL("image/png");

              // Añadir la imagen al PDF
              const imgX = 3;
              const imgW = 52;
              const imgH = 16;
              pdf.addImage(imageData, "PNG", imgX, y, imgW, imgH);

              // Avanzar y escribir el texto del código
              y += imgH + 3;
              pdf.setFont("courier", "bold");
              pdf.setFontSize(10);
              pdf.text("CÓDIGO:", 3, y);
              y += 3;
              pdf.text(datosTicket.codigoBarras, 3, y);
            } catch (imgErr) {
              console.warn(
                "No se pudo renderizar imagen del barcode, se añadirá solo texto",
                imgErr
              );
              pdf.setFont("courier", "bold");
              pdf.setFontSize(10);
              pdf.text("CÓDIGO:", 3, y);
              y += 3;
              pdf.text(datosTicket.codigoBarras, 3, y);
            }

            resolve(pdf);
          } catch (error) {
            reject(error);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async function enviarPdfAlServidor(
    pdf,
    filename = "comprobante_entrega.pdf",
    printer = ""
  ) {
    try {
      // Convertir PDF a base64
      const pdfBlob = pdf.output("blob");
      const base64pdf = await blobToBase64NoPrefix(pdfBlob);

      const payload = {
        pdfData: base64pdf,
        printer: printer || undefined,
        filename: filename,
      };

      const res = await fetch(urlImpresion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
      }

      const json = await res.json().catch(() => ({}));
      console.log("Impresión enviada OK:", json);
      return json;
    } catch (err) {
      console.error("Error enviando PDF al servidor:", err);
      throw err;
    }
  }

  function blobToBase64NoPrefix(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  //==================================== FUNCIONES EXISTENTES MODIFICADAS ==============
  const formulario = document.getElementById("formulario");
  const barcodeInput = document.getElementById("barcodeIn");
  const btnConsultar = document.getElementById("btnConsultar");
  const btnLiberarImprimir = document.getElementById("btnLiberarImprimir");

  // ---- Reemplazo automático de '-' por '/' mientras escribe ----
  barcodeInput.addEventListener("input", function (e) {
    const cursorPos = this.selectionStart;
    this.value = this.value.replace(/-/g, "/").replace(/\s+/g, "");
    try {
      this.setSelectionRange(cursorPos, cursorPos);
    } catch (e) {}
  });

  // ---- Manejo de "Consultar Ticket" ----
  btnConsultar.addEventListener("click", function () {
    let barcodeTxt = barcodeInput.value.trim().replace(/-/g, "/");
    if (barcodeTxt === "") {
      alert("Por favor, ingrese un código de barras.");
      return;
    }
    consultarTicket(barcodeTxt);
  });

  let datosPagoActual = null;

  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();

    // proteger botón para evitar doble envío
    if (btnLiberarImprimir.disabled) return;

    // PONER EN ESTADO LOADING INMEDIATAMENTE
    setBtnLiberarLoading(true);

    const id_caja = localStorage.getItem("id_caja");
    if (!id_caja) {
      alert(
        "Por favor, primero debe abrir la caja antes de liberar un casillero."
      );
      // RESTAURAR BOTÓN SI HAY ERROR
      resetBtnLiberar();
      return;
    }

    try {
      // Normalizar barcode: reemplazar '-' por '/'
      const barcodeTxt = formulario.barcodeIn.value.trim().replace(/-/g, "/");

      // Separar ID y RUT (formato esperado: idcustodia/rut)
      const barcodeData = barcodeTxt.split("/");
      if (barcodeData.length !== 2) {
        alert("Código de barras inválido. El formato debe ser: idcustodia/rut");
        return;
      }
      const idIn = barcodeData[0]; // ID de custodia
      const rutIn = barcodeData[1]; // RUT

      // Obtenemos la fecha y hora actual
      const dateAct = new Date();
      const horaStr =
        dateAct.getHours().toString().padStart(2, "0") +
        ":" +
        dateAct.getMinutes().toString().padStart(2, "0") +
        ":" +
        dateAct.getSeconds().toString().padStart(2, "0");
      const fechaStr = dateAct.toISOString().split("T")[0];

      // Llamar a la API para obtener los datos de la custodia
      const result = await traerDatos(idIn);

      if (!result || !result.fecha || !result.hora) {
        throw new Error("Este ticket ya fue procesado o inválido.");
      }

      if (result.estado === "Entregado") {
        throw new Error("El ticket ya ha sido escaneado anteriormente.");
      }

      const dateOld = new Date(result.fecha + "T" + result.hora);
      const diffTime = Math.abs(dateAct - dateOld);
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      const valorBulto = getValorBulto(result.talla);
      if (valorBulto === 0) {
        throw new Error("Error: Talla no válida.");
      }

      let valorTotal;
      if (diffDays <= 1) {
        // Si estuvo 1 día o menos, solo pagó al reservar
        valorTotal = 0;
      } else {
        // Si estuvo más de 1 día, paga la diferencia
        valorTotal = (diffDays - 1) * valorBulto;
      }

      // Actualizar UI
      const filasHTML = `
                <tr>
                    <td>Casillero</td>
                    <td style="text-align:right">${
                      result.posicion || "No especificado"
                    }</td>
                </tr>
                <tr>
                    <td>Fecha de Entrada</td>
                    <td style="text-align:right">${result.fecha} ${
        result.hora
      }</td>
                </tr>
                <tr>
                    <td>Fecha de Salida</td>
                    <td style="text-align:right">${fechaStr} ${horaStr}</td>
                </tr>
                <tr>
                    <td>Tiempo Ocupado</td>
                    <td style="text-align:right">${diffDays} Días</td>
                </tr>
                <tr>
                    <td>Valor por Día</td>
                    <td style="text-align:right">$${valorBulto}</td>
                </tr>
                <tr>
                    <td>Valor Total</td>
                    <td style="text-align:right" id="valorTotal">$${Math.round(
                      valorTotal
                    )}</td>
                </tr>
                <tr>
                    <td>Talla</td>
                    <td style="text-align:right">${
                      result.talla || "No especificado"
                    }</td>
                </tr>
            `;
      document.getElementById("tabla-body").innerHTML = filasHTML;

      // Preparar los datos para actualizar el registro
      datosPagoActual = {
        idIn,
        rutIn,
        result,
        valorTotal: Math.round(valorTotal),
        diffDays,
        fechaStr,
        horaStr,
        id_caja,
        barcodeTxt,
      };

      mostrarModalPago(datosPagoActual);
    } catch (err) {
      console.error(err.message || err);
      alert(
        err.message ||
          "El ticket ya ha sido escaneado anteriormente o es inválido."
      );
      // RESTAURAR BOTÓN SI HAY ERROR
      resetBtnLiberar();
    }
  });

  function mostrarModalPago(datos) {
    // Si el valor total es 0, saltar directamente al proceso de entrega
    if (datos.valorTotal === 0) {
      console.log(
        "Valor total es 0 - saltando proceso de pago directo a entrega"
      );

      // MANTENER EL BOTÓN EN ESTADO LOADING
      // El botón ya está disabled desde el submit, mostramos spinner
      setBtnLiberarLoading(true);

      // Simular un pago exitoso sin procesar pago real
      datos.metodoPago = "reserva_pagada";
      datos.codigoTransaccion = "RESERVA_PREVIA";
      datos.referenciaPago = "Pago realizado al reservar";

      // Ejecutar directamente el proceso de entrega
      completarProcesoEntrega(datos);
      return;
    }

    // (solo se ejecuta si valorTotal > 0)
    // Actualizar resumen en el modal
    document.getElementById(
      "resumenValorTotal"
    ).textContent = `$${datos.valorTotal}`;
    document.getElementById("resumenCasillero").textContent =
      datos.result.posicion || "-";
    document.getElementById(
      "resumenTiempo"
    ).textContent = `${datos.diffDays} Días`;

    // Resetear selección
    document.querySelectorAll(".card-pago-option").forEach((card) => {
      card.classList.remove("selected");
    });
    document.getElementById("btnConfirmarPago").disabled = true;

    // Mostrar modal
    const modalPago = new bootstrap.Modal(document.getElementById("modalPago"));
    modalPago.show();
  }
  function inicializarEventosModal() {
    // Eventos para selección de método de pago
    document.querySelectorAll(".card-pago-option").forEach((card) => {
      card.addEventListener("click", function () {
        // Remover selección anterior
        document.querySelectorAll(".card-pago-option").forEach((c) => {
          c.classList.remove("selected");
        });

        // Agregar selección actual
        this.classList.add("selected");

        // Habilitar botón de confirmar
        document.getElementById("btnConfirmarPago").disabled = false;
      });
    });

    // Evento para confirmar pago
    document
      .getElementById("btnConfirmarPago")
      .addEventListener("click", async function () {
        const btn = this;
        const metodoSeleccionado = document.querySelector(
          ".card-pago-option.selected"
        )?.dataset.metodo;

        if (!metodoSeleccionado) {
          alert("Por favor seleccione un método de pago");
          return;
        }

        // Deshabilitar botón mientras se procesa
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML =
          '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';

        // MANTENER EL BOTÓN PRINCIPAL EN LOADING TAMBIÉN
        // (ya debería estarlo desde el submit, pero por si acaso)
        setBtnLiberarLoading(true);

        try {
          // 1. Procesar pago (efectivo o tarjeta)
          const resultadoPago = await procesarPago(metodoSeleccionado);

          // 2. Si el pago fue exitoso, completar el proceso de entrega
          await completarProcesoEntrega(datosPagoActual);

          // 3. Si todo OK, restaurar UI y cerrar modal
          btn.innerHTML = originalHTML;
          btn.disabled = false;

          const modal = bootstrap.Modal.getInstance(
            document.getElementById("modalPago")
          );
          if (modal) modal.hide();
        } catch (error) {
          console.error("Error procesando/entregando:", error);

          // Mensaje por defecto
          let userMsg = "Error al procesar el pago o generar el comprobante.";

          // Si el error viene del gateway con código conocido
          if (
            error.gatewayCode === "USER_CANCELLED" ||
            (error.message && error.message.toLowerCase().includes("cancel"))
          ) {
            userMsg = "La transacción fue cancelada en el POS.";
          } else if (
            error.message &&
            error.message.toLowerCase().includes("pos")
          ) {
            userMsg =
              "No se pudo comunicar con el POS. Verifique estado/conexión del dispositivo.";
          } else if (error.httpStatus) {
            userMsg = `Error del servidor de pagos (HTTP ${error.httpStatus}).`;
          } else if (error.message) {
            userMsg = error.message;
          }
          alert(userMsg);

          // (Opcional) log adicional con raw para soporte
          if (error.gatewayRaw) console.info("Gateway raw:", error.gatewayRaw);

          // IMPORTANTE: Restaurar estado del botón pero NO continuar con la entrega
          btn.innerHTML = originalHTML;
          btn.disabled = false;
          resetBtnLiberar(); // Restaurar botón principal

          // NO llamar a completarProcesoEntrega() aquí - el casillero debe permanecer bloqueado
        }
      });
  }

  async function procesarPago(metodoPago) {
    if (!datosPagoActual) {
      throw new Error("No hay datos de pago disponibles");
    }

    console.log(`Procesando pago con método: ${metodoPago}`);

    let resultadoPago;
    try {
      if (metodoPago === "efectivo") {
        resultadoPago = await procesarPagoEfectivo(datosPagoActual);
      } else if (metodoPago === "tarjeta") {
        resultadoPago = await procesarPagoTarjeta(datosPagoActual);
      } else {
        throw new Error("Método de pago no válido");
      }

      // Validar que el pago fue exitoso
      if (!resultadoPago || !resultadoPago.success) {
        throw new Error(
          resultadoPago.mensaje || "Error en el procesamiento del pago"
        );
      }

      console.log("Pago procesado exitosamente:", resultadoPago);

      // Agregar información del pago a los datos para el comprobante
      datosPagoActual.metodoPago = resultadoPago.metodo;
      datosPagoActual.codigoTransaccion = resultadoPago.codigoTransaccion;
      datosPagoActual.referenciaPago = resultadoPago.referenciaPago;

      return resultadoPago;
    } catch (error) {
      console.error("Error en procesarPago:", error);

      datosPagoActual = null;

      throw error;
    }
  }

  function generateCode(length = 6) {
    try {
      const array = new Uint32Array(length);
      crypto.getRandomValues(array);

      let code = "";
      for (let i = 0; i < length; i++) {
        code += (array[i] % 10).toString();
      }

      return code;
    } catch (error) {
      console.warn("Crypto no disponible, usando fallback");
      let code = "";
      for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10).toString();
      }
      return code;
    }
  }

  async function procesarPagoEfectivo(datos) {
    console.log("Procesando pago en efectivo:", datos);

    try {
      if (!datos.valorTotal || datos.valorTotal <= 0) {
        throw new Error("Monto inválido para procesar pago en efectivo");
      }

      const payload = {
        nombre: "casilleroCust",
        precio: datos.valorTotal,
      };

      console.log("Enviando pago en efectivo a:", urlPaymentEfectivo);
      console.log("Payload:", payload);

      const response = await fetch(urlPaymentEfectivo, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Respuesta HTTP:", response.status, response.statusText);

      // Leer cuerpo (sea OK o error) intentando parsear JSON
      const textBody = await response.text().catch(() => "");
      let result = null;
      try {
        result = textBody ? JSON.parse(textBody) : null;
      } catch (e) {
        result = null;
      }

      // Si HTTP no OK -> mostrar detalle y lanzar error
      if (!response.ok) {
        let errorDetail = `Error ${response.status}: ${response.statusText}`;
        if (textBody) errorDetail += ` - ${textBody}`;
        throw new Error(`Error del servidor: ${errorDetail}`);
      }

      console.log("Respuesta del servidor (JSON):", result);

      // Ahora tratamos como éxito ambos casos que mencionaste:
      // 1) {"message":"Folio asignado correctamente","folio":3702,"ficticia":false}
      // 2) {"message":"No hay folios disponibles. Se generó una boleta ficticia.","folio":"412-2729","ficticia":true}
      if (result && (result.folio !== undefined || result.message)) {
        // normalizamos valores
        const folio = result.folio ?? null;
        const ficticia = !!result.ficticia;
        const mensaje = result.message || "Pago en efectivo procesado";

        // Guardar datos relevantes en "datos" para el comprobante
        datos.metodoPago = "efectivo";
        datos.folioBoleta = folio;
        datos.ficticia = ficticia;

        return {
          success: true,
          metodo: "efectivo",
          folio,
          ficticia,
          respuestaGateway: result,
          mensaje,
        };
      }

      // Si llegamos aquí, la respuesta tiene formato inesperado -> tratar como error
      throw new Error(
        "Respuesta inesperada del servidor de pagos (formato no válido)"
      );
    } catch (error) {
      console.error("Error completo en pago en efectivo:", error);

      // Mensajes de usuario más amables
      let userMessage = error.message || "Error procesando pago en efectivo";

      if (userMessage.includes("Failed to fetch")) {
        userMessage =
          "Error de conexión con el servidor. Verifique su conexión a internet y que el servidor esté disponible.";
      } else if (userMessage.toLowerCase().includes("cors")) {
        userMessage =
          "Error de configuración del servidor. Contacte al administrador.";
      } else if (userMessage.includes("404")) {
        userMessage = "Servicio no encontrado. Verifique la URL del endpoint.";
      } else if (userMessage.includes("500")) {
        userMessage = "Error interno del servidor. Contacte al administrador.";
      }

      // Lanzar error con mensaje amigable (el controlador catch lo mostrará)
      throw new Error(userMessage);
    }
  }

  async function procesarPagoTarjeta(datos) {
    console.log("Procesando pago con tarjeta:", datos);

    try {
      if (!datos.valorTotal || datos.valorTotal <= 0) {
        throw new Error("Monto inválido para procesar pago con tarjeta");
      }

      const ticketNumber = generateCode(6);
      const payload = {
        amount: datos.valorTotal,
        ticketNumber: ticketNumber,
      };

      console.log("Enviando pago a gateway:", payload);

      const response = await fetch(urlPaymentTarjeta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Leer cuerpo (sea OK o error) intentando parsear JSON
      const textBody = await response.text().catch(() => "");
      let jsonBody = null;
      try {
        jsonBody = textBody ? JSON.parse(textBody) : null;
      } catch (e) {
        jsonBody = null;
      }

      // Si HTTP no OK -> mapear error y lanzar uno amigable
      if (!response.ok) {
        // si tenemos JSON con estructura conocida, usarlo
        if (jsonBody && jsonBody.success === false) {
          const code =
            jsonBody.code || (jsonBody.error && jsonBody.error.code) || null;
          const rawMsg =
            jsonBody.error ||
            jsonBody.message ||
            jsonBody.meta?.rawData?.responseMessage ||
            textBody;
          const friendly =
            code === "USER_CANCELLED" ||
            (rawMsg && rawMsg.toString().toLowerCase().includes("cancel"))
              ? "Transacción cancelada desde el POS."
              : rawMsg && rawMsg.toString().toLowerCase().includes("desconect")
              ? "No se pudo comunicar con el POS (dispositivo desconectado)."
              : `Error en el servidor de pagos: ${rawMsg}`;

          const err = new Error(friendly);
          err.gatewayCode = code || null;
          err.gatewayRaw = jsonBody;
          throw err;
        }

        // fallback: no JSON o formato distinto
        const err = new Error(
          `Error HTTP ${response.status}: ${textBody || response.statusText}`
        );
        err.httpStatus = response.status;
        err.httpBody = textBody;
        throw err;
      }

      // Si llegó OK, parsear JSON si no lo hicimos
      const result = jsonBody || (textBody ? JSON.parse(textBody) : null);
      console.log("Respuesta del gateway de pagos:", result);

      // Si el gateway responde success:false (aunque HTTP 200) manejarlo
      if (result && result.success === false) {
        const code = result.code || null;
        const rawMsg =
          result.error ||
          result.message ||
          result.meta?.rawData?.responseMessage ||
          "Error desconocido desde el gateway";
        const friendly =
          code === "USER_CANCELLED" ||
          (rawMsg && rawMsg.toString().toLowerCase().includes("cancel"))
            ? "Transacción cancelada desde el POS."
            : rawMsg && rawMsg.toString().toLowerCase().includes("desconect")
            ? "No se pudo comunicar con el POS (dispositivo desconectado)."
            : rawMsg;

        const err = new Error(friendly);
        err.gatewayCode = code;
        err.gatewayRaw = result;
        throw err;
      }

      // Respuesta OK y sin success:false -> asumimos pago correcto
      datos.metodoPago = "Tarjeta";
      datos.codigoTransaccion = ticketNumber;
      datos.referenciaPago =
        (result && (result.transactionId || result.reference)) || ticketNumber;

      return {
        success: true,
        metodo: "tarjeta",
        codigoTransaccion: ticketNumber,
        referenciaPago: datos.referenciaPago,
        respuestaGateway: result,
        mensaje: "Pago con tarjeta procesado correctamente",
      };
    } catch (error) {
      console.error("Error en pago con tarjeta:", error);

      // Normalizar mensajes de red
      if (error.message && error.message.includes("Failed to fetch")) {
        throw new Error(
          "Error de conexión con el servidor de pagos. Verifique su conexión."
        );
      }

      // Si ya es un Error creado arriba (con friendly message) lo re-lanzamos tal cual
      if (
        error.gatewayCode ||
        error.httpStatus ||
        /Transacción cancelada|POS/.test(error.message)
      ) {
        throw error;
      }

      // Fallback genérico
      throw new Error(error.message || "Error procesando pago con tarjeta");
    }
  }

  async function completarProcesoEntrega(datos) {
    const {
      idIn,
      rutIn,
      result,
      valorTotal,
      fechaStr,
      horaStr,
      id_caja,
      barcodeTxt,
    } = datos;

    try {
      // 1️⃣ Actualizar el registro en la base de datos (se hace primero)
      const datosUpdate = {
        id: idIn,
        estado: "Entregado",
        hora: horaStr,
        fecha: fechaStr,
        valor: valorTotal,
        rut: rutIn,
        id_caja: id_caja,
        medio_pago: datos.metodoPago || "reserva_pagada",
      };

      await callAPI(datosUpdate, urlUpdate);
      console.log("✅ Registro actualizado correctamente.");

      // 2️⃣ Liberar el casillero (aunque la impresión falle)
      const casilla = result.posicion;
      try {
        if (casilla) {
          await cargarEstado(casilla);
          console.log(`🟢 Casillero ${casilla} liberado correctamente.`);
        }
      } catch (error) {
        console.warn(`⚠️ No se pudo liberar el casillero ${casilla}:`, error);
      }

      // 3️⃣ Intentar generar e imprimir el PDF
      const datosTicket = {
        fechaSalida: fechaStr,
        horaSalida: horaStr,
        casillero: result.posicion,
        tiempoOcupado: `${datos.diffDays} Días`,
        valorTotal: `$${valorTotal}`,
        rut: rutIn,
        metodoPago: datos.metodoPago || "reserva_pagada",
        codigoTransaccion: datos.codigoTransaccion || "RESERVA_PREVIA",
        referenciaPago: datos.referenciaPago || "Pago al reservar",
        codigoBarras: barcodeTxt,
      };

      try {
        console.log("🖨️ Generando PDF de entrega...", datosTicket);
        const pdf = await generarPDFEntrega(datosTicket);
        const filename = `entrega_${result.posicion}_${fechaStr}.pdf`;
        await enviarPdfAlServidor(pdf, filename, "");
        console.log("✅ PDF enviado correctamente a la impresora.");
      } catch (error) {
        console.error("⚠️ Error generando o enviando el PDF:", error);
        alert(
          "La entrega se completó, pero ocurrió un error al imprimir el comprobante."
        );
      }

      // 4️⃣ Mensaje diferente según si fue pago o entrega directa
      const mensajeExito =
        datos.valorTotal === 0
          ? `✅ Casillero liberado exitosamente. No se requiere pago adicional (reserva ya pagada).`
          : datos.metodoPago === "tarjeta"
          ? `✅ Pago con tarjeta procesado exitosamente. El casillero ha sido liberado.`
          : `✅ Pago en efectivo procesado exitosamente. El casillero ha sido liberado.`;

      alert(mensajeExito);
    } catch (error) {
      console.error("❌ Error en el proceso de entrega:", error);
      alert(
        "Hubo un error en el proceso de entrega. Contacte al administrador."
      );
    } finally {
      // SIEMPRE RESTAURAR EL BOTÓN AL FINAL, INCLUSO SI HAY ERROR
      clearPaymentUI();
    }
  }

  async function cargarEstado(casilla) {
    try {
      let response = await fetch(urlState);
      let data = await response.json();

      if (!data || data.length === 0) {
        console.error("No se encontró información de estado.");
        return;
      }

      let estadoLista = JSON.parse(data[0].estado || "[]");

      const index = estadoLista.indexOf(casilla);
      if (index > -1) {
        estadoLista.splice(index, 1);
      } else {
        console.warn(`Casillero ${casilla} no estaba bloqueado.`);
      }

      const dateAct = new Date();
      const horaStr =
        dateAct.getHours().toString().padStart(2, "0") +
        ":" +
        dateAct.getMinutes().toString().padStart(2, "0") +
        ":" +
        dateAct.getSeconds().toString().padStart(2, "0");
      const fechaStr = dateAct.toISOString().split("T")[0];

      const datos = {
        estado: JSON.stringify(estadoLista),
        hora: horaStr,
        fecha: fechaStr,
      };

      await callAPI(datos, urlStore);
      console.log(`Estado actualizado: Casillero ${casilla} desbloqueado.`);
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      throw error;
    }
  }

  const consultarTicket = (barcodeTxt) => {
    const barcodeData = barcodeTxt.split("/");
    if (barcodeData.length !== 2) {
      alert("Código de barras inválido.");
      return;
    }
    const idIn = barcodeData[0];
    const rutIn = barcodeData[1];

    const dateAct = new Date();
    const horaStr =
      dateAct.getHours().toString().padStart(2, "0") +
      ":" +
      dateAct.getMinutes().toString().padStart(2, "0") +
      ":" +
      dateAct.getSeconds().toString().padStart(2, "0");
    const fechaStr = dateAct.toISOString().split("T")[0];

    traerDatos(idIn)
      .then((result) => {
        if (!result || !result.fecha || !result.hora) {
          throw new Error(
            "El ticket ya ha sido escaneado anteriormente o es inválido."
          );
        }

        if (result.estado === "Entregado") {
          throw new Error("El ticket ya ha sido marcado como entregado.");
        }

        const dateOld = new Date(result.fecha + "T" + result.hora);
        const diffTime = Math.abs(dateAct - dateOld);
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

        const valorBulto = getValorBulto(result.talla);
        if (valorBulto === 0) {
          throw new Error("Error: Talla no válida.");
        }

        // Restar 1 día como en el formulario principal
        let valorTotal;
        if (diffDays <= 1) {
          valorTotal = 0;
        } else {
          valorTotal = (diffDays - 1) * valorBulto;
        }

        const filasHTML = `
              <tr>
                  <td>Casillero</td>
                  <td style="text-align:right">${
                    result.posicion || "No especificado"
                  }</td>
              </tr>
              <tr>
                  <td>Fecha de Entrada</td>
                  <td style="text-align:right">${result.fecha} ${
          result.hora
        }</td>
              </tr>
              <tr>
                  <td>Fecha de Salida</td>
                  <td style="text-align:right">${fechaStr} ${horaStr}</td>
              </tr>
              <tr>
                  <td>Tiempo Ocupado</td>
                  <td style="text-align:right">${diffDays} Días</td>
              </tr>
              <tr>
                  <td>Valor por Día</td>
                  <td style="text-align:right">$${valorBulto}</td>
              </tr>
              <tr>
                  <td>Valor Total</td>
                  <td style="text-align:right">$${Math.round(valorTotal)}</td>
              </tr>
              <tr>
                  <td>Talla</td>
                  <td style="text-align:right">${
                    result.talla || "No especificado"
                  }</td>
              </tr>
          `;
        document.getElementById("tabla-body").innerHTML = filasHTML;
      })
      .catch((err) => {
        console.error(err.message);
        alert(err.message || "Error al consultar el ticket.");
      });
  };

  // Mantener función printComp como fallback si es necesario
  function printComp() {
    // Normalizar y obtener barcode (id/rut) desde el input
    const rawBarcode =
      barcodeInput && barcodeInput.value
        ? barcodeInput.value.trim().replace(/-/g, "/")
        : "";
    // Datos visibles en el comprobante tomados de la tabla (si existen)
    const casillero =
      document.querySelector("#tabla-body tr:nth-child(1) td:nth-child(2)")
        ?.innerText || "";
    const fechaEntrada =
      document.querySelector("#tabla-body tr:nth-child(2) td:nth-child(2)")
        ?.innerText || "";
    const fechaSalida =
      document.querySelector("#tabla-body tr:nth-child(3) td:nth-child(2)")
        ?.innerText || "";
    const tiempoOcupado =
      document.querySelector("#tabla-body tr:nth-child(4) td:nth-child(2)")
        ?.innerText || "";
    const valorPorDia =
      document.querySelector("#tabla-body tr:nth-child(5) td:nth-child(2)")
        ?.innerText || "";
    const valorTotal =
      document.querySelector("#tabla-body tr:nth-child(6) td:nth-child(2)")
        ?.innerText || "";
    const talla =
      document.querySelector("#tabla-body tr:nth-child(7) td:nth-child(2)")
        ?.innerText || "";

    // Si no hay barcode, pedir confirmación antes de imprimir sin él
    if (!rawBarcode) {
      if (
        !confirm(
          "No se detectó el código (id/rut). ¿Deseas imprimir el comprobante sin código de barras?"
        )
      )
        return;
    }

    const dateAct = new Date();
    const horaStr =
      dateAct.getHours().toString().padStart(2, "0") +
      ":" +
      dateAct.getMinutes().toString().padStart(2, "0") +
      ":" +
      dateAct.getSeconds().toString().padStart(2, "0");
    const fechaStr = dateAct.toISOString().split("T")[0];

    const printContent = `
    <!doctype html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>Imprimir</title>
    <style>
        @page { margin: 4mm; }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 6mm;
            text-align: center;
        }
        .ticket { width: 100%; padding: 4px 0; page-break-after: avoid; }
        h1 { font-size: 12px; margin: 0; }
        .datetime { font-size: 10px; margin: 4px 0 8px; }
        .left { text-align: left; padding: 0 6mm; font-size: 11px; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        svg { max-width: 100%; height: auto; display: block; margin: 6px auto; }
        .total { font-weight: bold; font-size: 13px; margin-top: 6px; }
    </style>
    </head>
    <body>
        <div class="ticket">
            <h1>Terminal Calama</h1>
            <div class="datetime">${fechaStr} ${horaStr}</div>
            <div class="left">
                <div><strong>Casillero:</strong> ${casillero}</div>
                <div><strong>Entrada:</strong> ${fechaEntrada}</div>
                <div><strong>Salida:</strong> ${fechaSalida}</div>
                <div><strong>Tiempo:</strong> ${tiempoOcupado}</div>
                <div class="line"></div>
                <div><strong>Valor/día:</strong> ${valorPorDia}</div>
                <div><strong>Talla:</strong> ${talla}</div>
                <div class="line"></div>
                <div class="total">TOTAL: ${valorTotal}</div>
            </div>
            <div id="barcode-wrap" style="margin-top:8px;">
                <svg id="barcode"></svg>
            </div>
        </div>
    
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
            (function() {
                try {
                    const data = ${JSON.stringify(rawBarcode)};
                    if (data) {
                        try {
                            JsBarcode("#barcode", data, { format: "CODE128", displayValue: true, width: 2, height: 50, margin: 10 });
                        } catch (e) {
                            console.warn('JsBarcode error', e);
                            document.getElementById('barcode-wrap').innerHTML = '<div style="font-size:10px;">'+data+'</div>';
                        }
                    } else {
                        // No hay barcode: eliminar SVG y mostrar texto
                        document.getElementById('barcode-wrap').innerHTML = '<div style="font-size:12px;">No hay código disponible</div>';
                    }
                } catch (err) {
                    console.error('print window init error', err);
                }
    
                // Esperar un poco para que el SVG se renderice, luego imprimir y cerrar
                setTimeout(() => {
                    try { window.focus(); window.print(); } catch (e) { console.error('print error', e); }
                    setTimeout(() => { try { window.close(); } catch(e){} }, 800);
                }, 350);
            })();
        </script>
    </body>
    </html>
    `;

    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) {
      alert("Permite popups en tu navegador para poder imprimir.");
      return;
    }
    win.document.open();
    win.document.write(printContent);
    win.document.close();
  }

  function clearPaymentUI() {
    try {
      // 1) Limpiar input de barcode
      const barcodeInput = document.getElementById("barcodeIn");
      if (barcodeInput) barcodeInput.value = "";

      // 2) Limpiar la tabla de detalles (tabla-body)
      const tablaBody = document.getElementById("tabla-body");
      if (tablaBody)
        tablaBody.innerHTML = `
                <tr><td colspan="2" class="text-muted" style="text-align:center">Sin datos</td></tr>
            `;

      // 3) Limpiar los resúmenes del modal (si quedan abiertos)
      const resumenValorTotal = document.getElementById("resumenValorTotal");
      const resumenCasillero = document.getElementById("resumenCasillero");
      const resumenTiempo = document.getElementById("resumenTiempo");
      if (resumenValorTotal) resumenValorTotal.textContent = "$0";
      if (resumenCasillero) resumenCasillero.textContent = "-";
      if (resumenTiempo) resumenTiempo.textContent = "-";

      // 4) Resetear formulario y botones del modal
      const formulario = document.getElementById("formulario");
      if (formulario) formulario.reset();

      const btnLiberarImprimir = document.getElementById("btnLiberarImprimir");
      if (btnLiberarImprimir) {
        resetBtnLiberar();
      }
      const btnConfirmarPago = document.getElementById("btnConfirmarPago");
      if (btnConfirmarPago) {
        btnConfirmarPago.disabled = true;
      }

      // 5) Cerrar modal de pago si está abierto
      const modalEl = document.getElementById("modalPago");
      if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }

      // 6) Limpiar variable de datos en memoria
      datosPagoActual = null;

      // 7) Remover any pending highlight de la casilla (si existe)
      // Si marcaste la casilla como .pending en otros flujos, remuévela
      try {
        const casilla = document.querySelector(".casilla.pending");
        if (casilla) casilla.classList.remove("pending");
      } catch (e) {
        /* ignore */
      }

      // 8) Opcional: actualizar tabla general/tabla de historial
      if (typeof actualizarTabla === "function") {
        try {
          actualizarTabla();
        } catch (e) {
          /* ignore */
        }
      }

      console.log("UI limpiada tras pago/entrega exitosa.");
    } catch (err) {
      console.error("Error limpiando UI:", err);
      resetBtnLiberar();
    }
  }

  function setBtnLiberarLoading(loading) {
    if (!btnLiberarImprimir) return;

    if (loading) {
      btnLiberarImprimir.disabled = true;
      btnLiberarImprimir.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';
    } else {
      btnLiberarImprimir.disabled = false;
      btnLiberarImprimir.innerHTML = "Liberar e Imprimir";
    }
  }

  function resetBtnLiberar() {
    setBtnLiberarLoading(false);
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Inicializar eventos del modal
    inicializarEventosModal();
  });

  // Exportar funciones globales si es necesario
  window.boleta = {
    generarPDFEntrega,
    enviarPdfAlServidor,
    printComp,
    mostrarModalPago,
    getValorBulto,
    procesarPago,
    completarProcesoEntrega,
    generarPDFEntrega,
    enviarPdfAlServidor,
  };
})();
