const ENV = window.APP_ENV;
const BASE_URL = window.BASE_URL;

const API_URL = `${BASE_URL}parkingCalama/php/users/api.php`;

// Variables de paginación
let currentPage = 1;
let entriesPerPage = 10;
let allUsers = [];
let filteredUsers = [];

// --- Cargar tabla ---
async function getUsers() {
    try {
        const res = await axios.get(API_URL);
        return res.data;
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function getUserById(id) {
    try {
        const res = await axios.get(`${API_URL}?id=${id}`);
        return res.data;
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function addUser(user) {
    try {
        await axios.post(API_URL, user);
    } catch (e) {
        console.error(e);
        alert('Error al agregar usuario');
    }
}

async function updateUser(user) {
    try {
        await axios.put(API_URL, user);
    } catch (e) {
        console.error(e);
        alert('Error al actualizar usuario');
    }
}

async function removeUser(id) {
    try {
        await axios.delete(API_URL, { data: { id } });
    } catch (e) {
        console.error(e);
        alert('Error al eliminar usuario');
    }
}

// --- Funciones de paginación ---
function updatePaginationInfo() {
    const start = (currentPage - 1) * entriesPerPage + 1;
    const end = Math.min(currentPage * entriesPerPage, filteredUsers.length);
    const total = filteredUsers.length;
    
    $('#tableInfo').text(`Mostrando ${start} a ${end} de ${total} registros`);
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    
    // Habilitar/deshabilitar botones
    $('#firstPageBtn, #prevPageBtn').prop('disabled', currentPage === 1);
    $('#nextPageBtn, #lastPageBtn').prop('disabled', currentPage === totalPages || totalPages === 0);
    
    // Actualizar texto de página
    $('.pagination-controls .current-page').text(`Página ${currentPage} de ${totalPages}`);
}

function getCurrentPageUsers() {
    const start = (currentPage - 1) * entriesPerPage;
    const end = start + entriesPerPage;
    return filteredUsers.slice(start, end);
}

// --- Cargar tabla con paginación ---
async function loadUsersTable() {
    if (allUsers.length === 0) {
        allUsers = await getUsers();
    }
    
    const searchTerm = $('#searchInput').val().toLowerCase();
    const tbody = $('#usersTable');
    tbody.empty();

    // Filtrar usuarios
    filteredUsers = allUsers.filter(u =>
        u.mail.toLowerCase().includes(searchTerm) ||
        u.seccion.toLowerCase().includes(searchTerm)
    );

    // Resetear a página 1 al buscar o cambiar número de registros
    if (searchTerm || filteredUsers.length !== allUsers.length) {
        currentPage = 1;
    }

    // Obtener usuarios de la página actual
    const currentUsers = getCurrentPageUsers();

    // Renderizar tabla
    if (currentUsers.length === 0) {
        tbody.append(`
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">
                    No se encontraron usuarios
                </td>
            </tr>
        `);
    } else {
        currentUsers.forEach(u => {
            tbody.append(`
                <tr>
                    <td>${u.iduser}</td>
                    <td>${u.mail}</td>
                    <td>${u.descriptor}</td>
                    <td>${u.seccion}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editUser(${u.iduser})" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.iduser})" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Actualizar controles
    updatePaginationInfo();
    updatePaginationButtons();
}

// --- Navegación de paginación ---
function goToFirstPage() {
    currentPage = 1;
    loadUsersTable();
}

function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadUsersTable();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        loadUsersTable();
    }
}

function goToLastPage() {
    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    currentPage = totalPages;
    loadUsersTable();
}

// --- Modal ---
async function openUserModal(userId = null) {
    $('#userForm')[0].reset();

    if (userId) {
        const user = await getUserById(userId);
        $('#userModalTitle').text('Editar Usuario');
        $('#userId').val(user.iduser);
        $('#userEmailInput').val(user.mail);
        $('#userPassInput').val('');
        $('#userLevelInput').val(user.nivel);
        $('#userSectionInput').val(user.seccion);
    } else {
        $('#userModalTitle').text('Crear Usuario');
        $('#userId').val('');
    }

    new bootstrap.Modal(document.getElementById('userModal')).show();
}

// --- CRUD ---
async function saveUser() {
    const id = $('#userId').val();
    const mail = $('#userEmailInput').val();
    const pass = $('#userPassInput').val();
    const lvl = parseInt($('#userLevelInput').val());
    const seccion = $('#userSectionInput').val();

    const user = { mail, lvl, seccion };
    if (pass) user.pass = pass;

    try {
        if (id) {
            user.id = parseInt(id);
            await updateUser(user);
            alert('Usuario actualizado');
        } else {
            await addUser(user);
            alert('Usuario creado');
        }

        const modalEl = document.getElementById('userModal');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();

        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css('padding-right', '');

        // Recargar datos
        allUsers = [];
        await loadUsersTable();
    } catch (error) {
        console.error('Error al guardar usuario:', error);
    }
}

async function editUser(id) {
    await openUserModal(id);
}

async function deleteUser(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
        await removeUser(id);
        alert('Usuario eliminado');
        // Recargar datos
        allUsers = [];
        await loadUsersTable();
    }
}

$(document).ready(function () {
    loadUsersTable();
    
    // Event listeners
    $('#searchInput').on('keyup', loadUsersTable);
    
    $('#entriesPerPage').on('change', function() {
        entriesPerPage = parseInt($(this).val());
        currentPage = 1;
        loadUsersTable();
    });
    
    // Asignar eventos de paginación con IDs específicos
    $('#firstPageBtn').on('click', goToFirstPage);
    $('#prevPageBtn').on('click', goToPreviousPage);
    $('#nextPageBtn').on('click', goToNextPage);
    $('#lastPageBtn').on('click', goToLastPage);
});