import { verificarAccesoSeccion } from "../middlewares/seccionesMiddleware.js";

(() => {
  if (!verificarAccesoSeccion("custodia")) {
    // Si no tiene acceso, el middleware ya redirige automáticamente
    return;
  }

  const ENV = window.APP_ENV;
  const BASE_URL = window.BASE_URL;
  const urlLocal = window.URL_LOCAL;

  // URLs específicas de ESTA página
  const API_CUSTODIA_BASE = `${BASE_URL}TerminalCalama/PHP/Custodia/`;
  const urlSave = API_CUSTODIA_BASE + "save.php";
  const urlLoad = API_CUSTODIA_BASE + "load.php";
  const urlStore = API_CUSTODIA_BASE + "store.php";
  const urlState = API_CUSTODIA_BASE + "reload.php";

  // URLs de impresión y pago
  const urlImpresion = urlLocal + "/api/imprimir";
  const urlPaymentTarjeta = `${urlLocal}/api/payment`;

  // URL para pago en efectivo
  const urlPaymentEfectivo = window.URL_PAYMENT_EFECTIVO;

  let datosPagoActual = null;

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

  function getLetterFromNumber(num) {
    if (num > 25) {
      num += 6;
    }
    return String.fromCharCode(65 + num);
  }

  async function operacionAtomica(datosGuardado, datosEstado) {
    try {
      // Paso 1: Guardar el registro
      const resultadoGuardado = await callAPI(datosGuardado, urlSave);
      if (!resultadoGuardado || resultadoGuardado.error) {
        throw new Error("Error al guardar el registro");
      }

      // Paso 2: Actualizar el estado de los casilleros
      const resultadoEstado = await callAPI(datosEstado, urlStore);
      if (!resultadoEstado || resultadoEstado.error) {
        throw new Error("Error al actualizar el estado");
      }

      // Si ambos fueron exitosos, retornar el resultado del guardado
      return resultadoGuardado;
    } catch (error) {
      console.error("Operación atómica falló:", error);
      throw error; // Re-lanzar el error para manejarlo arriba
    }
  }

  async function generarPDFConJsPDF(datosTicket) {
    return new Promise(async (resolve, reject) => {
      try {
        // Verificar si jsPDF está disponible
        if (typeof jspdf === "undefined" && typeof jsPDF === "undefined") {
          // Cargar jsPDF dinámicamente
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = () => {
            // Dar tiempo para que cargue
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

            // Contenido simple del ticket
            let y = 5;

            // Título
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text("TICKET DE RECEPCIÓN", 29, y, { align: "center" });
            y += 6;

            // Información
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text(`Fecha: ${datosTicket.fecha} ${datosTicket.hora}`, 3, y);
            y += 4;
            pdf.text(`Casillero: ${datosTicket.casilla}`, 3, y);
            y += 4;
            pdf.text(`Tamaño: ${datosTicket.bulto}`, 3, y);
            y += 4;
            pdf.text(`RUT: ${datosTicket.rut}`, 3, y);
            y += 6;

            // Generar barcode en canvas offscreen y convertir a dataURL
            try {
              // Crear canvas temporal
              const canvas = document.createElement("canvas");
              // Ajusta el ancho/alto en px según la calidad que necesites
              // width (px) se calcula a partir de tus parámetros de JsBarcode (width * numberOfBars)
              // Aquí dejamos un tamaño suficientemente grande para buena resolución
              canvas.width = 600;
              canvas.height = 200;

              // Usar JsBarcode para dibujar en el canvas (no en SVG)
              // displayValue: false porque ya imprimimos el texto debajo o lo manejas aparte
              JsBarcode(canvas, datosTicket.codigoBarras, {
                format: "CODE128",
                displayValue: false,
                width: 2,
                height: 80,
                margin: 10,
              });

              const imageData = canvas.toDataURL("image/png");

              // Añadir la imagen al PDF
              // en un papel de 58mm de ancho dejamos margen: x=3, width=52mm
              // la altura la ajustamos proporcionalmente (ej: 18mm); ajusta si lo ves pequeño/grande
              const imgX = 3;
              const imgW = 52;
              const imgH = 16;
              pdf.addImage(imageData, "PNG", imgX, y, imgW, imgH);

              // Avanzar y escribir el texto del código (opcional)
              y += imgH + 3;
              pdf.setFont("courier", "bold");
              pdf.setFontSize(10);
              pdf.text("CÓDIGO:", 3, y);
              y += 3;
              pdf.text(datosTicket.codigoBarras, 3, y);
              y += 8;
            } catch (imgErr) {
              // Si algo falla generando la imagen, caemos a la versión solo texto
              console.warn(
                "No se pudo renderizar imagen del barcode, se añadirá solo texto",
                imgErr
              );
              pdf.setFont("courier", "bold");
              pdf.setFontSize(10);
              pdf.text("CÓDIGO:", 3, y);
              y += 3;
              pdf.text(datosTicket.codigoBarras, 3, y);
              y += 8;
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
    filename = "ticket.pdf",
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

  // Función para poblar el select de bultos usando valoresBulto de valores.js
  function poblarSelectBultos() {
    const selectBulto = document.getElementById("bulto");
    if (!selectBulto || typeof valoresBulto === "undefined") {
      console.warn("Select bulto no encontrado o valoresBulto no definido");
      return;
    }

    // Limpiar opciones existentes (excepto la primera que es "Seleccione un tamaño...")
    while (selectBulto.children.length > 1) {
      selectBulto.removeChild(selectBulto.lastChild);
    }

    // Agregar opciones dinámicamente desde valoresBulto
    Object.keys(valoresBulto).forEach((tipoBulto) => {
      const precio = valoresBulto[tipoBulto];
      const option = document.createElement("option");
      option.value = tipoBulto;
      option.textContent = `${tipoBulto} ($${precio.toLocaleString()})`;
      selectBulto.appendChild(option);
    });

    console.log("Select de bultos poblado exitosamente");
  }

  //==================================== UI ============================================
  function initMatriz(matCont) {
    const matX = 8,
      matY = 6;
    if (matCont.querySelector(".casilla")) return;

    for (let i = 0; i < matY; i++) {
      for (let j = 0; j < matX; j++) {
        const letra = getLetterFromNumber(j);
        const btn = document.createElement("button");
        btn.className = "casilla";
        btn.id = "lockerbtn" + i + letra;
        btn.textContent = `${i},${letra}`;
        btn.type = "button";
        btn.addEventListener("click", () => toggleButton(btn));
        matCont.appendChild(btn);
      }
    }
  }

  async function initFormHandlers(formulario, contBarcode) {
    formulario.addEventListener("submit", async (e) => {
      e.preventDefault();

      const casillaStr = formulario.casillero?.value?.trim() || "";
      const rutStr = (document.getElementById("rut")?.value || "")
        .trim()
        .replace(/[.-]/g, "");
      const bultoStr = document.getElementById("bulto")?.value;

      if (!casillaStr || !rutStr)
        return alert("Seleccione casilla e ingrese RUT");
      if (!bultoStr) return alert("Seleccione un tamaño para el bulto");

      const id_caja = localStorage.getItem("id_caja");
      if (!id_caja)
        return alert(
          "Por favor, primero debe abrir la caja antes de ocupar un casillero."
        );

      const dateAct = new Date();
      const horaStr = `${dateAct
        .getHours()
        .toString()
        .padStart(2, "0")}:${dateAct
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${dateAct.getSeconds().toString().padStart(2, "0")}`;
      const fechaStr = dateAct.toISOString().split("T")[0];

      const btnGenerar = document.getElementById("generar");
      if (btnGenerar) {
        btnGenerar.disabled = true;
        btnGenerar.classList.add("disabled");
      }

      try {
        // --- DATOS DEL TICKET PARA MOSTRAR EN EL MODAL ---
        const datosTicket = {
          fecha: fechaStr,
          hora: horaStr,
          casilla: casillaStr,
          bulto: bultoStr,
          rut: rutStr,
          id_caja,
          tipo: "Ingresado",
        };

        datosPagoActual = {
          valorTotal: getValorBulto(bultoStr),
          diffDays: 1,
          result: { posicion: casillaStr, talla: bultoStr },
          fechaStr,
          horaStr,
          id_caja,
          rutIn: rutStr,
        };

        // Mostrar el modal de pago y esperar confirmación
        const pagoRealizado = await mostrarModalPago({
          valorTotal: getValorBulto(bultoStr),
          diffDays: 1,
          result: { posicion: casillaStr, talla: bultoStr },
          fechaStr,
          horaStr,
          id_caja,
          rutIn: rutStr,
        });

        if (!pagoRealizado?.exito) {
          alert("El pago fue cancelado o falló.");
          return;
        }

        // SOLO AHORA HACEMOS LA OPERACIÓN ATÓMICA
        const estadoActual = await obtenerEstadoActual();
        estadoActual.push(casillaStr);

        const datosGuardado = {
          hora: horaStr,
          fecha: fechaStr,
          casilla: casillaStr,
          rut: rutStr,
          bulto: bultoStr,
          tipo: "Ingresado",
          id_caja,
        };

        const datosEstado = {
          estado: JSON.stringify(estadoActual),
          hora: horaStr,
          fecha: fechaStr,
        };

        const idGenerado = await operacionAtomica(datosGuardado, datosEstado);

        // Generar código de barras con el ID generado
        const barcodeData = `${idGenerado}/${rutStr}`;
        if (contBarcode) {
          contBarcode.innerHTML = `<svg id="barcode"></svg>`;
          JsBarcode("#barcode", barcodeData, {
            format: "CODE128",
            displayValue: true,
            width: 2,
            height: 50,
            margin: 10,
          });
        }

        try {
          await navigator.clipboard.writeText(barcodeData);
        } catch (_) {}

        // Generar ticket PDF e imprimir
        const datosFinalesTicket = {
          ...datosTicket,
          codigoBarras: barcodeData,
          idIn: idGenerado,
        };

        try {
          const pdf = await generarPDFConJsPDF(datosFinalesTicket);
          const filename = `ticket_${casillaStr}_${fechaStr}.pdf`;
          await enviarPdfAlServidor(pdf, filename, "");
          console.log("Ticket generado e impreso correctamente");
        } catch (err) {
          console.error("Error generando PDF ingreso:", err);
          await fallbackConHtml2PDF(barcodeData, datosFinalesTicket);
        }

        actualizarTabla();
        actualizarEstadoFrontend();
        formulario.casillero.value = "";
      } catch (err) {
        console.error("Error general:", err);
        alert("Ocurrió un error en el proceso de ingreso.");
      } finally {
        if (btnGenerar) {
          btnGenerar.disabled = false;
          btnGenerar.classList.remove("disabled");
        }
      }
    });
  }

  async function obtenerEstadoActual() {
    try {
      const response = await fetch(urlState);
      const data = await response.json();
      const raw = data.map((item) => item.estado)[0];
      if (!raw) return [];

      let estadoActual;
      try {
        estadoActual = JSON.parse(raw);
      } catch (e) {
        console.error("Error parseando estado actual", e);
        return [];
      }

      return Array.isArray(estadoActual) ? estadoActual : [];
    } catch (err) {
      console.error("Error obteniendo estado actual:", err);
      return [];
    }
  }

  function actualizarEstadoFrontend() {
    const btns = document.querySelectorAll(".casilla");
    btns.forEach((btn) => {
      btn.classList.remove("disabled", "active");
    });

    cargarEstado();
  }

  async function fallbackConHtml2PDF(barcodeData, datosTicket) {
    try {
      const element = document.createElement("div");
      element.innerHTML = `
                <div style="width:58mm;padding:5mm;font-family:Arial;text-align:center;">
                    <h3 style="margin:0 0 3mm 0;">TICKET DE RECEPCIÓN</h3>
                    <p style="margin:1mm 0;font-size:10px;">${datosTicket.fecha} ${datosTicket.hora}</p>
                    <p style="margin:1mm 0;font-size:10px;">Casillero: ${datosTicket.casilla}</p>
                    <p style="margin:1mm 0;font-size:10px;">Tamaño: ${datosTicket.bulto}</p>
                    <p style="margin:1mm 0;font-size:10px;">RUT: ${datosTicket.rut}</p>
                    <p style="margin:3mm 0 1mm 0;font-size:11px;font-weight:bold;">CÓDIGO:</p>
                    <p style="margin:0 0 3mm 0;font-family:monospace;font-size:10px;">${barcodeData}</p>
                </div>
            `;

      const opt = {
        margin: 0,
        filename: `ticket_${datosTicket.casilla}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: [58, 80], orientation: "portrait" },
      };

      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf("blob");
      const base64pdf = await blobToBase64NoPrefix(pdfBlob);
      await enviarPdfAlServidorBase64(
        base64pdf,
        `ticket_${datosTicket.casilla}.pdf`,
        ""
      );
      await enviarPdfAlServidorBase64(
        base64pdf,
        `ticket_${datosTicket.casilla}.pdf`,
        ""
      );
    } catch (fallbackError) {
      console.error("Fallback también falló:", fallbackError);
      throw fallbackError;
    }
  }

  function toggleButton(btn) {
    const btns = document.querySelectorAll(".casilla");
    btns.forEach((bt) => bt.classList.remove("active"));

    if (!btn.classList.contains("disabled")) {
      btn.classList.toggle("active");
      const formulario = document.getElementById("formulario");
      if (formulario && formulario.casillero) {
        formulario.casillero.value = btn.classList.contains("active")
          ? btn.textContent
          : "";
      }
    } else {
      const formulario = document.getElementById("formulario");
      if (formulario && formulario.casillero) {
        formulario.casillero.value = "";
      }
    }
  }

  function cargarEstado() {
    fetch(urlState)
      .then((r) => r.json())
      .then((data) => {
        const raw = data.map((item) => item.estado)[0];
        if (!raw) return;
        let est;
        try {
          est = JSON.parse(raw);
        } catch (e) {
          console.error("estado parse error", e);
          return;
        }
        const formulario = document.getElementById("formulario");
        if (formulario && formulario.casillero) formulario.casillero.value = "";
        est.forEach((estado) => {
          const btn = document.getElementById(
            "lockerbtn" + estado.replace(",", "")
          );
          if (btn) {
            btn.classList.add("disabled");
            btn.classList.remove("active");
          }
        });
      })
      .catch((err) => console.error("cargarEstado", err));
  }

  function guardarEstado() {
    const estadoObj = [];
    const btns = document.querySelectorAll(".casilla");
    btns.forEach((btn) => {
      if (
        btn.classList.contains("active") ||
        btn.classList.contains("disabled")
      )
        estadoObj.push(btn.textContent);
      if (btn.classList.contains("active")) {
        btn.classList.add("disabled");
        btn.classList.remove("active");
      }
    });
    const dateAct = new Date();
    const horaStr = `${dateAct.getHours()}:${dateAct.getMinutes()};${dateAct.getSeconds()}`;
    const fechaStr = dateAct.toISOString().split("T")[0];
    callAPI(
      { estado: JSON.stringify(estadoObj), hora: horaStr, fecha: fechaStr },
      urlStore
    );
  }

  function actualizarTabla() {
    const tablaBody = document.getElementById("tabla-body");
    if (!tablaBody) return;
    fetch(urlLoad)
      .then((r) => r.json())
      .then((data) => {
        const filasHTML = data
          .map(
            (item) => `
            <tr>
              <td>${item.idcustodia}/${item.rut}</td>
              <td>${item.posicion}</td>
              <td>${item.rut}</td>
              <td>${item.fecha} ${item.hora}</td>
              <td>${item.fechasal !== "0000-00-00" ? item.fechasal : ""} ${
              item.horasal !== "00:00:00" ? item.horasal : ""
            }</td>
              <td>${item.talla}</td>
              <td>${item.tipo}</td>
              <td>${item.valor > 0 ? item.valor : ""}</td>
            </tr>
          `
          )
          .join("");
        tablaBody.innerHTML = filasHTML;
      })
      .catch((err) => console.error("actualizarTabla", err));
  }

  function reactivarBoton(btn) {
    const fechaHoraAct = new Date();
    const horaStr = `${fechaHoraAct.getHours()}:${fechaHoraAct.getMinutes()}:${fechaHoraAct.getSeconds()}`;
    const fechaStr = fechaHoraAct.toISOString().split("T")[0];
    const posStr = btn.textContent;
    const datos = {
      hora: horaStr,
      fecha: fechaStr,
      casilla: posStr,
      rut: "-",
      bulto: "-",
      tipo: "Entregado",
    };
    callAPI(datos, urlSave).then(() => {
      actualizarTabla();
      guardarEstado();
    });
  }

  //   MODAL DE PAGO
  async function mostrarModalPago(datos) {
    return new Promise((resolve) => {
      document.getElementById(
        "resumenValorTotal"
      ).textContent = `$${datos.valorTotal}`;
      document.getElementById("resumenCasillero").textContent =
        datos.result.posicion || "-";
      document.getElementById("resumenTiempo").textContent = "Primer Día";

      // Reiniciar selección previa
      document
        .querySelectorAll(".card-pago-option")
        .forEach((card) => card.classList.remove("selected"));
      const btnConfirmarPago = document.getElementById("btnConfirmarPago");
      btnConfirmarPago.disabled = true;

      const modalEl = document.getElementById("modalPago");
      const modal = new bootstrap.Modal(modalEl);
      modal.show();

      let metodoSeleccionado = null;

      // --- AGREGAR EVENTOS A BOTONES DE PAGO (solo seleccionan) ---
      const btnEfectivo = document.querySelector(
        '.card-pago-option[data-metodo="efectivo"]'
      );
      const btnTarjeta = document.querySelector(
        '.card-pago-option[data-metodo="tarjeta"]'
      );

      btnEfectivo.addEventListener("click", () => {
        metodoSeleccionado = "efectivo";
        btnConfirmarPago.disabled = false;
        btnEfectivo.classList.add("selected");
        btnTarjeta.classList.remove("selected");
      });

      btnTarjeta.addEventListener("click", () => {
        metodoSeleccionado = "tarjeta";
        btnConfirmarPago.disabled = false;
        btnTarjeta.classList.add("selected");
        btnEfectivo.classList.remove("selected");
      });

      // --- CONFIRMAR PAGO (aquí se procesa realmente) ---
      btnConfirmarPago.onclick = async () => {
        try {
          if (!metodoSeleccionado)
            throw new Error("Seleccione un método de pago");
          btnConfirmarPago.disabled = true;
          await procesarPago(metodoSeleccionado);
          modal.hide();
          resolve({ exito: true, metodo: metodoSeleccionado });
        } catch (err) {
          console.error("Error procesando pago:", err);
          alert("Error al procesar el pago: " + err.message);
          modal.hide();
          resolve({ exito: false });
        }
      };

      // --- SI SE CIERRA MANUALMENTE ---
      modalEl.addEventListener(
        "hidden.bs.modal",
        () => resolve({ exito: false }),
        { once: true }
      );
    });
  }

  async function procesarPago(metodoPago) {
    if (!datosPagoActual) throw new Error("No hay datos de pago disponibles");

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

      if (!resultadoPago || !resultadoPago.success) {
        throw new Error(
          resultadoPago.mensaje || "Error en el procesamiento del pago"
        );
      }

      console.log("Pago procesado exitosamente:", resultadoPago);

      // Agregar detalles al comprobante
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

  async function enviarPdfAlServidor(
    pdf,
    filename = "comprobante_entrega.pdf",
    printer = ""
  ) {
    try {
      const pdfBlob = pdf.output("blob");
      const base64pdf = await blobToBase64NoPrefix(pdfBlob);

      const payload = {
        pdfData: base64pdf,
        printer: printer || undefined,
        filename,
      };
      const res = await fetch(urlImpresion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
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
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
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

  //==================================== DOM ===========================================
  document.addEventListener("DOMContentLoaded", () => {
    const matCont = document.getElementById("matriz");
    const formulario = document.getElementById("formulario");
    const contBarcode = document.getElementById("contBarcode");

    // Poblar select de bultos dinámicamente
    poblarSelectBultos();

    // Inicializar JsBarcode placeholder
    if (
      document.getElementById("barcode") &&
      typeof JsBarcode !== "undefined"
    ) {
      try {
        JsBarcode("#barcode", "wit.la", {
          format: "CODE128",
          displayValue: true,
          width: 2,
          height: 50,
          margin: 10,
        });
      } catch (e) {
        console.warn("JsBarcode init error", e);
      }
    }

    if (matCont) initMatriz(matCont);
    if (formulario && contBarcode) initFormHandlers(formulario, contBarcode);
    if (document.getElementById("tabla-body")) actualizarTabla();
    if (matCont) cargarEstado();

    // Inicializar JsBarcode placeholder
    if (
      document.getElementById("barcode") &&
      typeof JsBarcode !== "undefined"
    ) {
      try {
        JsBarcode("#barcode", "wit.la", {
          format: "CODE128",
          displayValue: true,
          width: 2,
          height: 50,
          margin: 10,
        });
      } catch (e) {
        console.warn("JsBarcode init error", e);
      }
    }

    // Exportar funciones globales
    window.custodia = {
      reactivarBoton,
      actualizarTabla,
      guardarEstado,
      cargarEstado,
      generarPDFConJsPDF,
      enviarPdfAlServidor,
      operacionAtomica,
      actualizarEstadoFrontend,
      poblarSelectBultos,
    };
  });
})();
