let valorTotGlobal = 0; // Variable global para almacenar el valor total
const baseURL = "https://andenes.terminal-calama.com/php";

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

async function calcAndenes() {
  const input = document.getElementById("andenQRPat").value;
  const cont = document.getElementById("contAnden");
  const dest = document.getElementById("destinoBuses");
  const empresaSelect = document.getElementById("empresaBuses"); // Selección de empresa

  if (!(dest.value > 0)) {
    alert("Seleccione Empresa y Destino");
    return;
  }

  if (!(empresaSelect.value > 0)) {
    // Verificar que se haya seleccionado una empresa
    alert("Seleccione una empresa");
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
        cont.textContent = "";

        const date = new Date();
        const fechaent = new Date(`${data["fechaent"]}T${data["horaent"]}`);
        const diferencia = (date.getTime() - fechaent.getTime()) / 1000;
        let minutos = Math.ceil(diferencia / 60);

        const destInfo = await getDestByID(dest.value);
        const empresaInfo = await getEmpByID(empresaSelect.value); // Obtener información de la empresa
        let valorBase = destInfo["valor"];
        let bloques = 0;

        if (destInfo["tipo"] === "nacional") {
          bloques = Math.ceil(minutos / configuracion.nacional);
          valorBase *= bloques;
        } else if (destInfo["tipo"] === "internacional") {
          bloques = Math.ceil(minutos / configuracion.internacional);
          valorBase *= bloques;
        }

        valorTotGlobal = valorBase;

        const ret = await getWLByPatente(data["patente"]);
        if (ret !== null) {
          valorTotGlobal = 0;
        }

        if (valorTotGlobal < 0) {
          valorTotGlobal = 0;
        }

        const iva = valorTotGlobal * configuracion.iva;
        const valorConIVA = valorTotGlobal + iva;

        const [
          elemPat,
          empresaPat,
          fechaPat,
          horaentPat,
          horasalPat,
          tiempPat,
          valPat,
          ivaPat,
          totalPat,
        ] = ["h1", "h3", "h3", "h3", "h3", "h3", "h3", "h3", "h3"].map((tag) =>
          document.createElement(tag)
        );

        elemPat.textContent = `Patente: ${data["patente"]}`;
        const empresaNombre = empresaInfo["nombre"];
        empresaPat.textContent = `Empresa: ${empresaNombre}`; // Mostrar tipo de empresa
        fechaPat.textContent = `Fecha ingreso: ${data["fechaent"]}`;
        horaentPat.textContent = `Hora Ingreso: ${data["horaent"]}`;
        horasalPat.textContent = `Hora salida: ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
        tiempPat.textContent = `Tiempo de Parking: ${minutos} min.`;
        valPat.textContent = `Valor NETO: $${valorTotGlobal.toFixed(0)}`;
        ivaPat.textContent = `IVA (${(configuracion.iva * 100).toFixed(
          0
        )}%): $${iva.toFixed(0)}`;
        totalPat.textContent = `Total con IVA: $${valorConIVA.toFixed(0)}`;
        cont.append(
          elemPat,
          empresaPat,
          fechaPat,
          horaentPat,
          horasalPat,
          tiempPat,
          valPat,
          ivaPat,
          totalPat
        );

        // Actualiza valorTotGlobal con el texto de totalPat
        valorTotGlobal =
          parseFloat(totalPat.textContent.replace(/\D+/g, "")) || 0;

        window.datosAnden = {
          id: data["idmov"],
          patente: data["patente"],
          fecha: date.toISOString().split("T")[0],
          hora: `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`,
          valor: valorTotGlobal,
          empresa: empresaSelect.value, // Guardar la ID de la empresa seleccionada
          empresaNombre: empresaNombre, // Guardar el nombre de la empresa seleccionada
        };
      } else {
        alert("Esta patente ya fue cobrada");
      }
    } else {
      parking();
      document.getElementById("parkingQRPat").value = input;
    }
  } catch (error) {
    console.error("Error en el cálculo:", error);
  }
}

async function filtrarDestinos() {
  const tipoDest = document.getElementById("tipoDestino").value; // Obtener el tipo de destino seleccionado
  const lista = document.getElementById("destinoBuses");

  if (tipoDest === "0") {
    return; // Si no se ha seleccionado ningún tipo de destino, no hacemos nada
  }

  try {
    const data = await andGetDestinos();
    if (data) {
      lista.textContent = ""; // Limpia la lista de destinos
      let nullData = document.createElement("option");
      nullData.value = 0;
      nullData.textContent = "Seleccione Destino";
      lista.appendChild(nullData);

      // Filtrar y mostrar los destinos según el tipo seleccionado
      data.forEach((itm) => {
        if (itm["tipo"] === tipoDest) {
          let optData = document.createElement("option");
          optData.value = itm["iddest"];
          optData.textContent = `${itm["ciudad"]} - $${itm["valor"]}`;
          lista.appendChild(optData);
        }
      });
    }
  } catch (error) {
    console.error("Error al filtrar destinos:", error);
  }
}

// Función para listar empresas en el select
function listarAndenesEmpresas() {
  andGetEmpresas()
    .then((data) => {
      if (data) {
        const lista = document.getElementById("empresaBuses");
        lista.innerHTML = ""; // Limpiar el select

        // Agregar la opción por defecto
        const nullData = document.createElement("option");
        nullData.value = 0;
        nullData.textContent = "Seleccione Empresa";
        lista.appendChild(nullData);

        // Agregar las empresas al select
        data.forEach((itm) => {
          const optData = document.createElement("option");
          optData.value = itm["idemp"];
          optData.textContent = itm["nombre"];
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
      lista.textContent = ""; // Limpia la lista de destinos
      let nullData = document.createElement("option");
      nullData.value = 0;
      nullData.textContent = "Seleccione Destino";
      lista.appendChild(nullData);

      // Filtrar y mostrar los destinos según el tipo seleccionado
      data.forEach((itm) => {
        if (itm["tipo"] === tipoDest) {
          let optData = document.createElement("option");
          optData.value = itm["iddest"];
          optData.textContent = `${itm["ciudad"]} - $${itm["valor"]}`;
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
    let ret = await fetch(apiDestinos, {
      method: "GET",
      mode: "cors",
      headers: {
        Authorization: `Bearer ${getCookie("jwt")}`,
      },
    })
      .then((reply) => reply.json())
      .catch((error) => console.log(error));
    return ret;
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
          await updateMov(datos);
          refreshMov(); // Refrescar la tabla de movimientos
          refreshPagos(); // Refrescar la tabla de pagos
          alert("Pago registrado correctamente.");

          // Imprimir boleta térmica solo después de registrar el pago
          const ventanaImpr = window.open("", "_blank");
          imprimirBoletaTermicaAndenes(datos, ventanaImpr);
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

function imprimirBoletaTermicaAndenes(datos, ventanaImpr) {
  ventanaImpr.document.write(`
        <html>
        <head>
            <title>Boleta de Pago</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; }
                h1, h3 { margin: 0; }
                .line { border-bottom: 1px solid #000; margin: 10px 0; }
            </style>
        </head>
        <body>
            <h1>WIT.LA</h1>
            <h3>Boleta de Pago (Andenes)</h3>
            <div class="line"></div>
            <h3>Patente: ${datos.patente}</h3>
            <h3>Empresa: ${datos.empresaNombre}</h3>
            <h3>Fecha: ${datos.fecha}</h3>
            <h3>Hora: ${datos.hora}</h3>
            <h3>Destino: ${datos.destino}</h3>
            <div class="line"></div>
            <h3>Valor Total: $${datos.valor}</h3>
            <div class="line"></div>
            <h3>Gracias por su visita</h3>
        </body>
        </html>
    `);
  ventanaImpr.document.close();

  setTimeout(() => {
    ventanaImpr.focus();
    ventanaImpr.print();

    // Intentar cerrar la ventana después de un tiempo más largo (ajustable)
    setTimeout(() => {
      try {
        ventanaImpr.close(); // Intenta cerrar la ventana
      } catch (e) {
        console.error("No se pudo cerrar la ventana:", e);
      }
    }, 1000); // Ajuste del tiempo, puede cambiarse según el comportamiento del navegador
  }, 1000);

  // Add event listener to close the window after printing or canceling
  ventanaImpr.onafterprint = () => {
    ventanaImpr.close();
  };
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
    return null;
  }
}
