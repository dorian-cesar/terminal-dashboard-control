let valorTotGlobal = 0; // Variable global para almacenar el valor total
const baseURL = "http://localhost/parkingCalama/php";
const apiDestinos = "http://localhost/parkingCalama/php/destinos/api.php";
const apiMovimientos = "http://localhost/parkingCalama/php/movimientos/api.php";
const apiEmpresas = "http://localhost/parkingCalama/php/empresas/api.php";
const apiWhitelist = "http://localhost/parkingCalama/php/whitelist/api.php";
const patRegEx = /^[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}$/;

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

// async function getDestByID(idIn) {
//   let ret = await fetch(
//     apiDestinos +
//       "?" +
//       new URLSearchParams({
//         id: idIn,
//       }),
//     {
//       method: "GET",
//       mode: "cors",
//       headers: {
//         Authorization: `Bearer ${getCookie("jwt")}`,
//       },
//     }
//   )
//     .then((reply) => reply.json())
//     .then((data) => {
//       return data;
//     })
//     .catch((error) => {
//       console.log(error);
//     });
//   return ret;
// }

// async function getEmpByID(idIn) {
//   let ret = await fetch(
//     apiEmpresas +
//       "?" +
//       new URLSearchParams({
//         id: idIn,
//       }),
//     {
//       method: "GET",
//       mode: "cors",
//       headers: {
//         Authorization: `Bearer ${getCookie("jwt")}`,
//       },
//     }
//   )
//     .then((reply) => reply.json())
//     .then((data) => {
//       return data;
//     })
//     .catch((error) => {
//       console.log(error);
//     });
//   return ret;
// }

async function getWLByPatente(patIn) {
  let ret = await fetch(
    apiWhitelist +
      "?" +
      new URLSearchParams({
        patente: patIn,
      }),
    {
      method: "GET",
      mode: "cors",
      headers: {
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    }
  )
    .then((reply) => reply.json())
    .then((data) => {
      return data;
    })
    .catch((error) => {
      console.log(error);
    });
  return ret;
}

async function updateMov(datos) {
  let ret = await fetch(apiMovimientos, {
    method: "PUT",
    mode: "cors",
    headers: {
      "Content-type": "application/json",
      Authorization: `Bearer ${getCookie("jwt")}`,
    },
    body: JSON.stringify(datos),
  })
    .then((reply) => reply.json())
    .then((data) => {
      return data;
    })
    .catch((error) => {
      console.log(error);
    });
  return ret;
}

async function calcAndenes() {
  const patente = document
    .getElementById("andenQRPat")
    .value.trim()
    .toUpperCase();
  const cont = document.getElementById("contAnden");
  const destinoSelect = document.getElementById("destinoBuses");
  const empresaSelect = document.getElementById("empresaBuses");

  if (!patente) {
    alert("Ingrese una patente válida.");
    return;
  }

  if (empresaSelect.value === "0" || destinoSelect.value === "0") {
    alert("Seleccione Empresa y Destino.");
    return;
  }

  try {
    const data = await getMovByPatente(patente);

    if (!data || Object.keys(data).length === 0) {
      alert("Patente no encontrada.");
      return;
    }

    if (data["tipo"].toLowerCase() !== "anden") {
      alert("La patente corresponde a otro tipo de movimiento.");
      return;
    }

    if (data["fechasal"] !== "0000-00-00") {
      alert("Esta patente ya fue cobrada.");
      return;
    }

    cont.innerHTML = "";

    const fechaActual = new Date();
    const fechaEntrada = new Date(`${data["fechaent"]}T${data["horaent"]}`);
    const diferencia = (fechaActual - fechaEntrada) / 1000;
    const minutos = Math.ceil(diferencia / 60);

    // Obtener info directamente del select
    const destOption = destinoSelect.options[destinoSelect.selectedIndex];
    const empresaOption = empresaSelect.options[empresaSelect.selectedIndex];

    const destInfo = {
      tipo: destOption.dataset.tipo,
      valor: Number(destOption.dataset.valor),
    };

    const empresaInfo = {
      nombre: empresaOption.dataset.nombre,
    };

    // Validar que estén los datos
    if (!destInfo.tipo || isNaN(destInfo.valor)) {
      alert("Error: datos del destino inválidos.");
      return;
    }

    // Calcular valor base según tipo
    let valorBase = destInfo.valor || 0;
    let bloques = 0;

    if (destInfo.tipo === "nacional") {
      bloques = Math.ceil(minutos / configuracion.nacional);
    } else if (destInfo.tipo === "internacional") {
      bloques = Math.ceil(minutos / configuracion.internacional);
    }

    valorBase *= bloques;
    valorTotGlobal = Math.max(valorBase, 0);

    const ret = await getWLByPatente(data["patente"]);
    if (ret !== null) valorTotGlobal = 0;

    const iva = valorTotGlobal * configuracion.iva;
    const valorConIVA = valorTotGlobal + iva;

    const crear = (tag, text) => {
      const el = document.createElement(tag);
      el.textContent = text;
      return el;
    };

    const nowTime = `${fechaActual
      .getHours()
      .toString()
      .padStart(2, "0")}:${fechaActual
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${fechaActual
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;

    const elementos = [
      crear("h1", `Patente: ${data["patente"]}`),
      crear("h3", `Empresa: ${empresaInfo.nombre}`),
      crear("h3", `Fecha ingreso: ${data["fechaent"]}`),
      crear("h3", `Hora ingreso: ${data["horaent"]}`),
      crear("h3", `Hora salida: ${nowTime}`),
      crear("h3", `Tiempo de Parking: ${minutos} min.`),
      crear("h3", `Valor NETO: $${valorTotGlobal.toFixed(0)}`),
      crear(
        "h3",
        `IVA (${(configuracion.iva * 100).toFixed(0)}%): $${iva.toFixed(0)}`
      ),
      crear("h3", `Total con IVA: $${valorConIVA.toFixed(0)}`),
    ];

    cont.append(...elementos);

    window.datosAnden = {
      id: data["idmov"],
      patente: data["patente"],
      fecha: fechaActual.toISOString().split("T")[0],
      hora: nowTime,
      valor: valorConIVA,
      empresa: empresaSelect.value,
      empresaNombre: empresaInfo.nombre,
    };

    valorTotGlobal = valorConIVA;
  } catch (error) {
    console.error("Error en el cálculo:", error);
    alert("Ocurrió un error al calcular el valor del andén.");
  }
}

async function getMovByPatente(patente) {
  if (getCookie("jwt")) {
    let ret = await fetch(
      apiMovimientos +
        "?" +
        new URLSearchParams({
          patente: patente,
        }),
      {
        method: "GET",
        mode: "cors",
        headers: {
          Authorization: `Bearer ${getCookie("jwt")}`,
        },
      }
    )
      .then((reply) => reply.json())
      .then((data) => {
        return data;
      })
      .catch((error) => {
        console.log(error);
      });
    return ret;
  }
}
// Función para listar empresas en el select
function listarAndenesEmpresas() {
  andGetEmpresas()
    .then((data) => {
      if (data) {
        const lista = document.getElementById("empresaBuses");
        lista.innerHTML = ""; // Limpiar el select

        const nullData = document.createElement("option");
        nullData.value = 0;
        nullData.textContent = "Seleccione Empresa";
        lista.appendChild(nullData);

        data.forEach((itm) => {
          const optData = document.createElement("option");
          optData.value = itm["idemp"];
          optData.textContent = itm["nombre"];
          optData.dataset.nombre = itm["nombre"];
          lista.appendChild(optData);
        });
      }
    })
    .catch((error) => {
      console.error("Error al listar empresas:", error);
    });
}

// Llamar a la función para listar empresas al cargar la página
document.addEventListener("DOMContentLoaded", listarAndenesEmpresas);

// Función auxiliar para cargar y filtrar destinos
async function cargarDestinos(tipoDest, lista) {
  try {
    const data = await andGetDestinos();
    if (data) {
      lista.textContent = "";
      let nullData = document.createElement("option");
      nullData.value = 0;
      nullData.textContent = "Seleccione Destino";
      lista.appendChild(nullData);

      data.forEach((itm) => {
        if (itm["tipo"] === tipoDest) {
          let optData = document.createElement("option");
          optData.value = itm["iddest"];
          optData.textContent = `${itm["ciudad"]} - $${itm["valor"]}`;
          optData.dataset.tipo = itm["tipo"];
          optData.dataset.valor = itm["valor"];
          lista.appendChild(optData);
        }
      });
    }
  } catch (error) {
    console.error("Error al cargar los destinos:", error);
  }
}

// Función para listar andenes y destinos (también utiliza la función auxiliar)
async function listarAndenesDestinos() {
  const tipoDest = document.getElementById("tipoDestino").value; // Obtener el tipo de destino seleccionado
  const lista = document.getElementById("destinoBuses");

  if (!tipoDest) {
    lista.textContent = ""; // Limpia el contenedor
    return;
  }

  cargarDestinos(tipoDest, lista);
}

// Agregar un evento para que se ejecute al cambiar el tipo de destino
document
  .getElementById("tipoDestino")
  .addEventListener("change", listarAndenesDestinos);

// Obtiene la lista de empresas desde la API
async function andGetEmpresas() {
  try {
    const response = await fetch(baseURL + "/empresas/api.php", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error al obtener empresas:", error);
    return null;
  }
}

// Obtiene la lista de destinos desde la API
async function andGetDestinos() {
  if (getCookie("jwt")) {
    try {
      const response = await fetch(apiDestinos, {
        method: "GET",
        mode: "cors",
        headers: {
          Authorization: `Bearer ${getCookie("jwt")}`,
        },
      });
      const ret = await response.json();
      return ret;
    } catch (error) {
      console.error("Error al obtener destinos:", error);
      return null;
    }
  }
}

async function pagarAnden(valorTot = valorTotGlobal) {
  console.log("valorTot recibido en impAnden:", valorTot);

  const input = document.getElementById("andenQRPat").value;
  const cont = document.getElementById("contAnden");
  const empresaSelect = document.getElementById("empresaBuses"); // Captura la empresa seleccionada
  const date = new Date();

  // Validación de id_caja en localStorage
  const id_caja = localStorage.getItem("id_caja");
  if (!id_caja) {
    alert("Por favor, primero debe abrir la caja antes de realizar un pago.");
    return; // Detiene la ejecución si no hay id_caja
  }

  if (!patRegEx.test(input)) {
    console.log("No es patente, leer QR");
    return;
  }

  try {
    const data = await getMovByPatente(input);
    if (!data) {
      alert("Patente no encontrada");
      return;
    }

    if (data["tipo"].toLowerCase() === "anden") {
      if (data["fechasal"] === "0000-00-00") {
        console.log("Patente válida, registrando el pago...");

        const empresaSeleccionada =
          empresaSelect.value !== "0" ? empresaSelect.value : null;

        if (!empresaSeleccionada || empresaSeleccionada === "0") {
          alert("Debe seleccionar una empresa antes de pagar.");
          return;
        }

        const datos = {
          id: data["idmov"],
          patente: data["patente"],
          fecha: date.toISOString().split("T")[0],
          hora: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`,
          valor: valorTot,
          empresa: empresaSeleccionada, // Insertar el ID de la empresa seleccionada
          empresaNombre: window.datosAnden.empresaNombre, // Insertar el nombre de la empresa seleccionada
          destino:
            document.getElementById("destinoBuses").options[
              document.getElementById("destinoBuses").selectedIndex
            ].text, // Obtener destino seleccionado
          id_caja: id_caja,
        };

        // Llamar a la API para actualizar el movimiento antes de imprimir la boleta
        const response = await fetch(baseURL + "/movimientos/api.php", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getCookie("jwt")}`,
          },
          body: JSON.stringify(datos),
        });

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        if (result.msg) {
          // Mover la actualización del movimiento y la alerta aquí
          // await updateMov(datos);
          // refreshMov(); // Refrescar la tabla de movimientos
          // refreshPagos(); // Refrescar la tabla de pagos
          alert("Pago registrado correctamente.");

          // Imprimir boleta térmica solo después de registrar el pago
          // const ventanaImpr = window.open("", "_blank");
          imprimirBoletaTermicaAndenes(datos);
        } else {
          alert("Error al registrar el pago: " + result.error);
        }

        // Limpiar el formulario
        document.getElementById("andenQRPat").value = "";
        cont.innerHTML = "";
      } else {
        alert("Esta patente ya fue cobrada");
      }
    } else {
      alert("La patente pertenece a un tipo distinto de movimiento.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Ocurrió un error al procesar la solicitud.");
  }
}

async function imprimirBoletaTermicaAndenes(datos) {
  const dateAct = new Date();
  const fechaStr = dateAct.toLocaleDateString("es-CL");
  const horaStr = dateAct.toLocaleTimeString("es-CL");
  const destino = datos.destino.split(" - ")[0].trim();

  // HTML del ticket térmico
  const ticketHTML = `
    <div id="ticketImpresion" style="
        width:200px;
        text-align:center;
        font-family:'Courier New', monospace;
        color:#000;
        font-size:13px;
        line-height:1.3;
        padding:5px;
    ">
      <h3 style="font-size:15px; font-weight:bold;">TERMINAL CALAMA</h3>
      <div style="margin:2px 0;">BOLETA DE ANDÉN</div>
      <div style="margin:2px 0;">${fechaStr} ${horaStr}</div>
      <div style="margin:4px 0;">----------------------------------</div>
      <div style="margin:2px 0;">PATENTE: <b>${datos.patente}</b></div>
      <div style="margin:2px 0;">EMPRESA: <b>${datos.empresaNombre}</b></div>
      <div style="margin:2px 0;">DESTINO: <b>${destino}</b></div>
      <div style="margin:2px 0;">VALOR TOTAL: <b>$${datos.valor}</b></div>
      <div style="margin:4px 0;">----------------------------------</div>
      <div style="margin-top:4px; font-size:12px;">VÁLIDO COMO BOLETA</div>
      <div style="margin-top:6px; font-size:12px;">¡GRACIAS POR SU VISITA!</div>
    </div>`;

  // Crear un div temporal fuera de pantalla
  const div = document.createElement("div");
  div.innerHTML = ticketHTML;
  div.style.position = "fixed";
  div.style.left = "-9999px";
  document.body.appendChild(div);

  try {
    // Capturar el HTML como imagen
    const canvas = await html2canvas(div, { scale: 4 });
    const imgData = canvas.toDataURL("image/png");

    // Crear PDF tipo térmico (58 mm de ancho)
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [58, 100],
    });

    pdf.addImage(imgData, "PNG", 2, 2, 54, 0);
    const pdfBase64 = pdf.output("datauristring").split(",")[1];

    // Enviar el PDF al servidor de impresión
    const response = await fetch("http://10.5.20.105:3000/api/imprimir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfData: pdfBase64,
        printer: "POS58",
        filename: `boleta_anden_${datos.patente}.pdf`,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showToast("Boleta enviada a impresión correctamente.", "success");
    } else {
      showToast("Error al imprimir: " + data.message, "error");
    }
  } catch (error) {
    console.error("Error al imprimir boleta térmica:", error);
    alert("Error generando o enviando la boleta térmica.");
  } finally {
    document.body.removeChild(div);
  }
}

async function andGetEmpresas() {
  try {
    const response = await fetch(baseURL + "/empresas/api.php", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error al obtener empresas:", error);
    // Redirigir al index.html
    window.location.href = "index.html";
    return null;
  }
}
