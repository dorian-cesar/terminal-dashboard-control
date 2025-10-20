
const BASE = "http://localhost/parkingCalama/php";
const API_URL = BASE + "/whitelist/api.php";          // GET, POST (BD), PUT, DELETE
const API_INSERT = BASE + "/whitelist/InsertWL.php"; // Inserta en app externa (y luego BD)
const API_DELETE_EXT = BASE + "/whitelist/deleteWL.php"; // Borra en app externa
const API_EMP = BASE + "/empresas/api.php";

/* RegEx de patentes (igual que tenías) */
const patRegEx = /^[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}-?[a-zA-Z\d]{2}$/;

/* Paginación cliente simple */
let currentPage = 1;
let entriesPerPage = parseInt(document.getElementById('entriesPerPage').value || 10);
let cachedWL = []; // caché de datos para filtrar/paginar en cliente

/* Elementos */
const tbody = $('#wlTable');
const tableInfo = $('#tableInfo');
const searchInput = $('#searchInput');
const entriesSelect = $('#entriesPerPage');

/* --- Funciones API --- */

async function getWL() {
    try {
        const res = await axios.get(API_URL);
        return res.data;
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function getWLById(id) {
    try {
        const res = await axios.get(`${API_URL}?id=${id}`);
        return res.data;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function addWL(datos) {
    // Reproduce la lógica que tenías: primero insertar en app externa, luego en BD
    try {
        const ext = await axios.post(API_INSERT, datos);
        if (ext.data && ext.data.error) {
            return { error: ext.data.error };
        }
    } catch (e) {
        console.error('Error insert externa', e);
        return { error: e.message || 'Error en app externa' };
    }

    try {
        const db = await axios.post(API_URL, datos);
        return db.data;
    } catch (e) {
        console.error('Error insert BD', e);
        return { error: e.message || 'Error en base de datos' };
    }
}

async function updateWL(datos) {
    try {
        const res = await axios.put(API_URL, datos);
        return res.data;
    } catch (e) {
        console.error(e);
        return { error: e.message };
    }
}

async function removeWL(id) {
    // Primero obtener patente para eliminar en app externa
    const data = await getWLById(id);
    if (!data) return { error: 'Registro no encontrado' };

    try {
        const ext = await axios.post(API_DELETE_EXT, { patente: data.patente });
        if (ext.data && ext.data.error) {
            return { error: ext.data.error };
        }
    } catch (e) {
        console.error('Error delete externa', e);
        return { error: e.message || 'Error en app externa' };
    }

    try {
        const db = await axios.delete(API_URL, { data: id });
        return db.data;
    } catch (e) {
        console.error('Error delete BD', e);
        return { error: e.message || 'Error en base de datos' };
    }
}

async function getEmpresas() {
    try {
        const res = await axios.get(API_EMP);
        return res.data;
    } catch (e) {
        console.error(e);
        return [];
    }
}

/* --- Rellenar tabla (cliente-side, búsqueda y paginación simple) --- */

function applyPagination(filtered) {
    entriesPerPage = parseInt(entriesSelect.val());
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / entriesPerPage));

    if (currentPage > lastPage) currentPage = lastPage;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * entriesPerPage;
    const pageItems = filtered.slice(start, start + entriesPerPage);

    // Render filas
    tbody.empty();
    pageItems.forEach(item => {
        const tr = `
    <tr>
        <td>${item.idwl ?? ''}</td>
        <td>${item.patente ?? ''}</td>
        <td>${item.nombre ?? ''}</td>
        <td>
            <button class="btn btn-sm btn-warning ctrlbtn" onclick="editWL(${item.idwl})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger ctrlbtn" onclick="deleteWL(${item.idwl})"><i class="bi bi-trash"></i></button>
        </td>
    </tr>
`;
        tbody.append(tr);
    });

    tableInfo.text(`Mostrando ${start + 1 <= total ? start + 1 : 0} a ${Math.min(start + entriesPerPage, total)} de ${total} registros`);
    $('#currentPage').text(currentPage);
}

/* Carga + filtro */
async function loadWLTable() {
    const all = await getWL();
    cachedWL = Array.isArray(all) ? all : [];
    const term = searchInput.val().toLowerCase().trim();

    const filtered = cachedWL.filter(u => {
        const patente = (u.patente || '').toString().toLowerCase();
        const nombre = (u.nombre || '').toString().toLowerCase();
        return patente.includes(term) || nombre.includes(term);
    });

    applyPagination(filtered);
}

/* --- Modal manejo --- */

async function openWLModal(id = null) {
    $('#wlForm')[0].reset();
    $('#wlId').val('');
    $('#wlEmpresa').empty().append('<option value="">Cargando...</option>');

    // poblar empresas
    const empresas = await getEmpresas();
    $('#wlEmpresa').empty();
    empresas.forEach(e => {
        $('#wlEmpresa').append(`<option value="${e.idemp}">${e.nombre}</option>`);
    });

    if (id) {
        const data = await getWLById(id);
        if (data) {
            $('#wlModalTitle').text('Editar Entrada');
            $('#wlId').val(data.idwl || '');
            $('#wlPatente').val(data.patente || '');
            // si la API devuelve empresa id en 'idemp' o 'empresa', intenta ambos
            $('#wlEmpresa').val(data.idemp || data.empresa || '');
        }
    } else {
        $('#wlModalTitle').text('Crear Entrada');
    }

    new bootstrap.Modal(document.getElementById('wlModal')).show();
}

function openWLModalPublic() { openWLModal(null); } // helper si quieres llamar sin nombre

/* --- CRUD handlers (form) --- */

async function saveWL() {
    const id = $('#wlId').val();
    const patente = $('#wlPatente').val().trim();
    const empresa = $('#wlEmpresa').val();

    if (!patRegEx.test(patente)) {
        alert('Formatos de patente:\nABCD12\nABCD-12\nAB-CD-12');
        return;
    }
    if (!empresa) {
        alert('Selecciona una empresa');
        return;
    }

    const datos = { patente: patente, empresa: empresa };

    if (id) {
        datos.id = id;
        const res = await updateWL(datos);
        if (res && res.error) {
            alert(res.error);
        } else {
            alert('Entrada actualizada');
        }
    } else {
        const res = await addWL(datos);
        if (res && res.error) {
            alert(res.error);
        } else {
            alert('Entrada creada');
        }
    }

    const modalEl = document.getElementById('wlModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open').css('padding-right', '');

    // recarga
    currentPage = 1;
    await loadWLTable();
}

/* --- acciones rápidas --- */

async function editWL(id) { await openWLModal(id); }

async function deleteWL(id) {
    if (!confirm('¿Eliminar el registro?')) return;
    const res = await removeWL(id);
    if (res && res.error) {
        alert(res.error);
    } else {
        alert('Usuario eliminado');
        await loadWLTable();
    }
}

/* --- botones de paginación --- */
$('#firstPage').on('click', () => { currentPage = 1; loadWLTable(); });
$('#prevPage').on('click', () => { currentPage = Math.max(1, currentPage - 1); loadWLTable(); });
$('#nextPage').on('click', () => { currentPage = currentPage + 1; loadWLTable(); });
$('#lastPage').on('click', () => {
    const total = cachedWL.length;
    const last = Math.max(1, Math.ceil(total / entriesPerPage));
    currentPage = last;
    loadWLTable();
});

entriesSelect.on('change', () => { currentPage = 1; loadWLTable(); });
searchInput.on('keyup', () => { currentPage = 1; loadWLTable(); });

/* Init */
$(document).ready(function () {
    loadWLTable();
});