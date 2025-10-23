// const BASE = "https://andenes.terminal-calama.com/parkingCalama/php";
const BASE = "http://localhost/parkingCalama/php";
const API_URL = BASE + "/whitelist/api.php"; // GET, POST, PUT, DELETE
const API_EMP = BASE + "/empresas/api.php"; // GET empresas

/* RegEx de patentes */
const patRegEx = /^[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}$/;

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

/* --- TABLA / PAGINACIÓN --- */
function applyPagination(filtered) {
  entriesPerPage = parseInt(entriesSelect.val());
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / entriesPerPage));

  if (currentPage > lastPage) currentPage = lastPage;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * entriesPerPage;
  const pageItems = filtered.slice(start, start + entriesPerPage);

  tbody.empty();
  pageItems.forEach((w) => {
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

  $("#currentPage").text(currentPage);
  tableInfo.text(
    `Mostrando ${start + 1 <= total ? start + 1 : 0} a ${Math.min(
      start + entriesPerPage,
      total
    )} de ${total} registros`
  );
}

async function loadWhitelistTable() {
  const whitelist = await getWhitelist();
  cachedWL = Array.isArray(whitelist) ? whitelist : [];
  const term = searchInput.val().toLowerCase().trim();

  const filtered = cachedWL.filter((w) => {
    const empNombre =
      cachedEmp.find((e) => e.idemp == w.empresa)?.nombre?.toLowerCase() ?? "";
    return (
      (w.patente ?? "").toLowerCase().includes(term) || empNombre.includes(term)
    );
  });

  applyPagination(filtered);
}

/* --- MODAL --- */
async function openWhitelistModal(id = null) {
  $("#whitelistForm")[0].reset();

  if (cachedEmp.length === 0) {
    await getEmpresas();
  }

  let selectHTML = `<select class="form-select" id="empresa" required>
                      <option value="">Seleccione empresa</option>`;
  cachedEmp.forEach((e) => {
    selectHTML += `<option value="${e.idemp}">${e.nombre}</option>`;
  });
  selectHTML += `</select>`;

  $("#nombre")
    .parent()
    .html(
      `<label for="empresa" class="form-label">Empresa</label>${selectHTML}`
    );

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

    if (!patRegEx.test(patente)) {
      alert("Formatos de patente:\nABCD12\nABCD-12\nAB-CD-12");
      return;
    }

    if (!empresa) {
      alert("Debe seleccionar una empresa");
      return;
    }

    const data = { patente, empresa };

    if (id) {
      data.id = parseInt(id);
      await updateWhitelist(data);
    } else {
      await addWhitelist(data);
      alert("Patente agregada");
    }

    const modalEl = document.getElementById("whitelistModal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    $(".modal-backdrop").remove();
    $("body").removeClass("modal-open").css("padding-right", "");

    currentPage = 1;
    loadWhitelistTable();
  } catch (e) {
    console.error(e);
    alert("Error al guardar la patente");
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
  loadWhitelistTable();
}

/* --- PAGINACIÓN --- */
$("#firstPage").on("click", async (e) => {
  const btn = e.currentTarget;
  toggleButtonLoading(btn, true);
  currentPage = 1;
  await loadWhitelistTable();
  toggleButtonLoading(btn, false);
});

$("#prevPage").on("click", async (e) => {
  const btn = e.currentTarget;
  toggleButtonLoading(btn, true);
  currentPage = Math.max(1, currentPage - 1);
  await loadWhitelistTable();
  toggleButtonLoading(btn, false);
});

$("#nextPage").on("click", async (e) => {
  const btn = e.currentTarget;
  toggleButtonLoading(btn, true);
  currentPage++;
  await loadWhitelistTable();
  toggleButtonLoading(btn, false);
});

$("#lastPage").on("click", async (e) => {
  const btn = e.currentTarget;
  toggleButtonLoading(btn, true);
  const total = cachedWL.length;
  entriesPerPage = parseInt(entriesSelect.val());
  currentPage = Math.max(1, Math.ceil(total / entriesPerPage));
  await loadWhitelistTable();
  toggleButtonLoading(btn, false);
});

entriesSelect.on("change", () => {
  currentPage = 1;
  loadWhitelistTable();
});
searchInput.on("keyup", () => {
  currentPage = 1;
  loadWhitelistTable();
});

/* --- INIT --- */
$(document).ready(() => {
  loadEmpresasSelect();
  loadWhitelistTable();
});

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
