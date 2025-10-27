const BASE = "https://andenes.terminal-calama.com/parkingCalama/php";
// const BASE = "http://localhost/parkingCalama/php";
const API_URL = BASE + "/whitelist/api.php"; // GET, POST, PUT, DELETE
const API_EMP = BASE + "/empresas/api.php"; // GET empresas

/* RegEx de patentes */
const patRegEx = /^[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}$/;

function verificarNivelMinimo(nivelMinimoRequerido = 10) {
    try {
        const userData = localStorage.getItem('user');
        
        if (!userData) {
            alert('Usuario no autenticado. Será redirigido al login.');
            window.location.href = 'index.html';
            return false;
        }

        const usuario = JSON.parse(userData);
        
        if (usuario.nivel < nivelMinimoRequerido) {
            window.location.href = 'index.html';
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error verificando nivel:', error);
        alert('Error de permisos. Será redirigido al login.');
        window.location.href = 'index.html';
        return false;
    }
}

function verificarNivel10() {
    return verificarNivelMinimo(10);
}

/* Paginación simple */
let currentPage = 1;
let entriesPerPage = parseInt($("#entriesPerPage").val() || 10);
let cachedWL = [];
let cachedEmp = [];

/* Elementos */
const tbody = $("#whitelistTable");
const tableInfo = $("#tableInfo");
const searchInput = $("#searchInput");
const entriesSelect = $("#entriesPerPage");

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie =
    "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
  window.location.href = "index.html";
}

function loadUserInfo() {
  const userData = localStorage.getItem("user");
  if (userData) {
    try {
      const user = JSON.parse(userData);
      $("#userEmail").text(user.mail || "Usuario");
      $("#userRole").text(`Nivel: ${user.nivel}`);
    } catch (e) {
      console.error("Error parsing user data:", e);
    }
  } else {
    console.warn("No se encontró información del usuario");
  }
}

/* --- API FUNCTIONS --- */
async function getWhitelist() {
  try {
    const res = await axios.get(API_URL);
    return res.data;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getWhitelistById(id) {
  try {
    const res = await axios.get(`${API_URL}?id=${id}`);
    return res.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function addWhitelist(item) {
  try {
    await axios.post(API_URL, item);
  } catch (e) {
    console.error(e);
    alert("Error al agregar patente");
  }
}

async function updateWhitelist(item) {
  try {
    await axios.put(API_URL, item);
  } catch (e) {
    console.error(e);
    alert("Error al actualizar");
  }
}

async function removeWhitelist(id) {
  try {
    await axios.delete(API_URL, {
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify(id),
    });
    alert("Eliminado correctamente");
  } catch (e) {
    console.error(e);
    alert("Error al eliminar");
  }
}

async function getEmpresas() {
  try {
    const res = await axios.get(API_EMP);
    cachedEmp = res.data;
    return res.data;
  } catch (err) {
    console.error(err);
    cachedEmp = [];
    return [];
  }
}

async function loadEmpresasSelect() {
  if (cachedEmp.length === 0) {
    await getEmpresas();
  }

  const select = $("#empresa");
  select.empty();
  select.append(`<option value="">Seleccione empresa</option>`);
  cachedEmp.forEach((e) => {
    select.append(`<option value="${e.idemp}">${e.nombre}</option>`);
  });
}

/* --- FILTRO + PAGINACIÓN EN MEMORIA --- */
function filterAndPaginate() {
  const term = searchInput.val().toLowerCase().trim();

  const filtered = cachedWL.filter((w) => {
    const empNombre =
      cachedEmp.find((e) => e.idemp == w.empresa)?.nombre?.toLowerCase() ?? "";
    return (
      (w.patente ?? "").toLowerCase().includes(term) || empNombre.includes(term)
    );
  });

  entriesPerPage = parseInt(entriesSelect.val());
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / entriesPerPage));

  if (currentPage > lastPage) currentPage = lastPage;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * entriesPerPage;
  const pageItems = filtered.slice(start, start + entriesPerPage);

  tbody.empty();
  if (pageItems.length === 0) {
    tbody.append(
      `<tr><td colspan="4" class="text-center text-muted">No se encontraron registros</td></tr>`
    );
  } else {
    pageItems.forEach((w, idx) => {
      const empresaNombre = w.nombre ?? "";
      tbody.append(`
        <tr>
          <td>${w.idwl ?? ""}</td>
          <td>${w.patente ?? ""}</td>
          <td>${empresaNombre}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editWhitelist(${
              w.idwl
            })">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteWhitelist(${
              w.idwl
            })">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `);
    });
  }

  $("#currentPage").text(currentPage);
  tableInfo.text(
    `Mostrando ${start + 1 <= total ? start + 1 : 0} a ${Math.min(
      start + entriesPerPage,
      total
    )} de ${total} registros`
  );
}

async function loadWhitelistTable() {
  if (cachedWL.length === 0) {
    const whitelist = await getWhitelist();
    cachedWL = Array.isArray(whitelist) ? whitelist : [];
  }
  filterAndPaginate();
}

/* --- MODAL --- */
async function openWhitelistModal(id = null) {
  $("#whitelistForm")[0].reset();
  await loadEmpresasSelect();

  if (id) {
    const item = await getWhitelistById(id);
    $("#whitelistModalTitle").text("Editar Patente");
    $("#whitelistId").val(item.idwl);
    $("#patente").val(item.patente);
    $("#empresa").val(item.empresa ?? "");
  } else {
    $("#whitelistModalTitle").text("Agregar Patente");
    $("#whitelistId").val("");
  }

  new bootstrap.Modal(document.getElementById("whitelistModal")).show();
}

/* --- CRUD HANDLERS --- */
async function saveWhitelist() {
  const btn = document.getElementById("btnGuardar");
  const spinner = btn.querySelector(".spinner-border");
  const text = btn.querySelector(".btn-text");

  btn.disabled = true;
  spinner.classList.remove("d-none");
  text.textContent = "Guardando...";

  try {
    const id = $("#whitelistId").val();
    const patente = $("#patente").val().trim().toUpperCase();
    const empresa = $("#empresa").val();

    // --- VALIDACIONES ---
    if (!patente) {
      alert("El campo Patente no puede estar vacío.");
      return;
    }

    if (!patRegEx.test(patente)) {
      alert("Formato de patente inválido:\nABCD12\nABCD-12\nAB-CD-12");
      return;
    }

    if (!empresa) {
      alert("Debe seleccionar una empresa.");
      return;
    }

    // Verificar si hay otros campos requeridos vacíos en el formulario
    const form = document.getElementById("whitelistForm");
    const emptyFields = Array.from(form.elements).filter(
      (el) => el.required && !el.value.trim()
    );
    if (emptyFields.length > 0) {
      alert("Todos los campos requeridos deben estar completos.");
      return;
    }

    const data = { patente, empresa };

    if (id) {
      data.id = parseInt(id);
      await updateWhitelist(data);
    } else {
      await addWhitelist(data);
      alert("Patente agregada.");
    }

    const modalEl = document.getElementById("whitelistModal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    $(".modal-backdrop").remove();
    $("body").removeClass("modal-open").css("padding-right", "");

    // Actualizar cachedWL y refrescar tabla sin llamar otra vez a la API
    if (id) {
      const index = cachedWL.findIndex((w) => w.idwl == id);
      if (index >= 0) {
        cachedWL[index].patente = patente;
        cachedWL[index].empresa = parseInt(empresa);
      }
    } else {
      cachedWL.push({
        idwl: cachedWL.length
          ? Math.max(...cachedWL.map((w) => w.idwl)) + 1
          : 1,
        patente,
        empresa: parseInt(empresa),
      });
    }

    filterAndPaginate();
  } catch (e) {
    console.error(e);
    alert("Error al guardar la patente.");
  } finally {
    btn.disabled = false;
    spinner.classList.add("d-none");
    text.textContent = "Guardar";
  }
}

async function editWhitelist(id) {
  await openWhitelistModal(id);
}

async function deleteWhitelist(id) {
  if (!confirm("¿Eliminar esta patente de la lista blanca?")) return;
  await removeWhitelist(id);

  // Eliminar de cachedWL y refrescar tabla
  cachedWL = cachedWL.filter((w) => w.idwl != id);
  filterAndPaginate();
}

/* --- PAGINACIÓN --- */
$("#firstPage").on("click", () => {
  currentPage = 1;
  filterAndPaginate();
});
$("#prevPage").on("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  filterAndPaginate();
});
$("#nextPage").on("click", () => {
  currentPage++;
  filterAndPaginate();
});
$("#lastPage").on("click", () => {
  const total = cachedWL.length;
  entriesPerPage = parseInt(entriesSelect.val());
  currentPage = Math.max(1, Math.ceil(total / entriesPerPage));
  filterAndPaginate();
});

entriesSelect.on("change", () => {
  currentPage = 1;
  filterAndPaginate();
});
searchInput.on("keyup", () => {
  currentPage = 1;
  filterAndPaginate();
});

/* --- INIT --- */
$(document).ready(async () => {
  if (!verificarNivel10()) {
    return; // Detener ejecución si no tiene permisos
  }
  await loadEmpresasSelect();
  const whitelist = await getWhitelist();
  cachedWL = Array.isArray(whitelist) ? whitelist : [];
  filterAndPaginate();
  loadUserInfo();

  $("#logoutBtn").on("click", function (e) {
    e.preventDefault();
    logout();
  });
});

/* --- BOTÓN LOADING --- */
function toggleButtonLoading(btn, loading = true) {
  const spinner = btn.querySelector(".spinner-border");
  const text = btn.querySelector(".btn-text");
  if (loading) {
    btn.disabled = true;
    spinner.classList.remove("d-none");
    text.classList.add("d-none");
  } else {
    btn.disabled = false;
    spinner.classList.add("d-none");
    text.classList.remove("d-none");
  }
}
