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
    await axios.delete(API_URL, { data: { id } });
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
    const empresaNombre =
      cachedEmp.find((e) => e.idemp == w.empresa)?.nombre || "";
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

  const filtered = cachedWL.filter(
    (w) =>
      (w.patente ?? "").toLowerCase().includes(term) ||
      (cachedEmp.find((e) => e.id == w.empresa)?.nombre ?? "")
        .toLowerCase()
        .includes(term)
  );

  applyPagination(filtered);
}

/* --- MODAL --- */
async function openWhitelistModal(id = null) {
  $("#whitelistForm")[0].reset();

  // Carga empresas si no están en cache
  if (cachedEmp.length === 0) {
    await getEmpresas();
  }

  // Genera el select de empresas
  let selectHTML = `<select class="form-select" id="empresa" required>
                      <option value="">Seleccione empresa</option>`;
  cachedEmp.forEach((e) => {
    selectHTML += `<option value="${e.id}">${e.nombre}</option>`;
  });
  selectHTML += `</select>`;

  // Reemplaza el input de nombre por el select
  $("#nombre")
    .parent()
    .html(
      `<label for="empresa" class="form-label">Empresa</label>${selectHTML}`
    );

  if (id) {
    // EDITAR
    const item = await getWhitelistById(id);
    $("#whitelistModalTitle").text("Editar Patente");
    $("#whitelistId").val(item.idwl);
    $("#patente").val(item.patente);
    $("#empresa").val(item.empresa ?? "");
  } else {
    // NUEVO
    $("#whitelistModalTitle").text("Agregar Patente");
    $("#whitelistId").val("");
  }

  new bootstrap.Modal(document.getElementById("whitelistModal")).show();
}

/* --- CRUD HANDLERS --- */
async function saveWhitelist() {
  const id = $("#whitelistId").val();
  const patente = $("#patente").val().trim();
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
    alert("Patente actualizada");
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
}

async function editWhitelist(id) {
  await openWhitelistModal(id);
}

async function deleteWhitelist(id) {
  if (!confirm("¿Eliminar esta patente de la lista blanca?")) return;
  await removeWhitelist(id);
  alert("Patente eliminada");
  loadWhitelistTable();
}

/* --- PAGINACIÓN --- */
$("#firstPage").on("click", () => {
  currentPage = 1;
  loadWhitelistTable();
});
$("#prevPage").on("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  loadWhitelistTable();
});
$("#nextPage").on("click", () => {
  currentPage++;
  loadWhitelistTable();
});
$("#lastPage").on("click", () => {
  const total = cachedWL.length;
  currentPage = Math.max(1, Math.ceil(total / entriesPerPage));
  loadWhitelistTable();
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
