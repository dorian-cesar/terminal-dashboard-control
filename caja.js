// --- Configuración de entorno ---
const ENV = "prod"; // Cambia a "dev" o "prod" según corresponda

const URLS = {
  dev: {
    FRONT: "http://localhost/parkingCalama/",
    API: "http://localhost/caja-calama/"
  },
  prod: {
    FRONT: "https://andenes.terminal-calama.com/parkingCalama/",
    API: "https://andenes.terminal-calama.com/caja-calama/"
  }
};

// --- URLs dinámicas según entorno ---
const VOLVER_URL = URLS[ENV].FRONT;
const API_URL = URLS[ENV].API;

// --- Sistema de Notificaciones ---
class ToastSystem {
    static show(message, type = 'info', duration = 5000) {
        const toast = $(`
            <div class="toast toast-${type}">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${this.getIcon(type)} ${this.getTitle(type)}</strong>
                        <div class="mt-1">${message}</div>
                    </div>
                    <button class="btn-close btn-close-white ms-3" onclick="$(this).closest('.toast').remove()"></button>
                </div>
            </div>
        `);
        
        $('.toast-container').append(toast);
        
        setTimeout(() => {
            toast.fadeOut(300, function() {
                $(this).remove();
            });
        }, duration);
    }
    
    static getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    static getTitle(type) {
        const titles = {
            success: 'Éxito',
            error: 'Error',
            warning: 'Advertencia',
            info: 'Información'
        };
        return titles[type] || titles.info;
    }
}

// --- Gestión de Estado de la UI ---
class UIStateManager {
    static setLoading(selector, isLoading) {
        const element = $(selector);
        if (isLoading) {
            element.addClass('loading').prop('disabled', true);
            element.prepend('<span class="spinner"></span>');
        } else {
            element.removeClass('loading').prop('disabled', false);
            element.find('.spinner').remove();
        }
    }
    
    static updateCajaStatus(isOpen, data = null) {
        const statusElement = $('#cajaStatus');
        const abrirBtn = $('#btnAbrirCaja');
        const cerrarBtn = $('#btnCerrarCaja');
        const imprimirBtn = $('#btnImprimir');
        const refreshBtn = $('#btnRefresh');
        
        if (isOpen && data) {
            statusElement.removeClass('caja-cerrada').addClass('caja-abierta');
            statusElement.html(`<i class="fas fa-circle"></i> Caja Abierta - ID: ${data.id}`);
            
            abrirBtn.prop('disabled', true);
            cerrarBtn.prop('disabled', false);
            imprimirBtn.prop('disabled', false);
            refreshBtn.prop('disabled', false);
            
            this.updateStats(data);
            this.startTurnTimer(data.hora_inicio);
        } else {
            statusElement.removeClass('caja-abierta').addClass('caja-cerrada');
            statusElement.html('<i class="fas fa-circle"></i> Caja Cerrada');
            
            abrirBtn.prop('disabled', false);
            cerrarBtn.prop('disabled', true);
            imprimirBtn.prop('disabled', true);
            refreshBtn.prop('disabled', false);
            
            this.resetStats();
            this.stopTurnTimer();
        }
    }
    
    static updateStats(data) {
        const monto_bano = parseFloat(data.monto_bano || 0);
        const monto_custodia = parseFloat(data.monto_custodia || 0);
        const monto_parking = parseFloat(data.monto_parking || 0);
        const monto_andenes = parseFloat(data.monto_andenes || 0);
        const monto_inicial = parseFloat(data.monto_inicial || 0);
        const total = monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;
        
        // Formato sin decimales para pesos chilenos
        $('#statMontoInicial').text(`$${this.formatCurrency(monto_inicial)}`);
        $('#statBanos').text(`$${this.formatCurrency(monto_bano)}`);
        $('#statCustodia').text(`$${this.formatCurrency(monto_custodia)}`);
        $('#statParking').text(`$${this.formatCurrency(monto_parking)}`);
        $('#statAndenes').text(`$${this.formatCurrency(monto_andenes)}`);
        $('#statTotal').text(`$${this.formatCurrency(total)}`);
    }
    
    static formatCurrency(amount) {
        // Formatear sin decimales y con separadores de miles
        return new Intl.NumberFormat('es-CL', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    static resetStats() {
        $('#statMontoInicial, #statBanos, #statCustodia, #statParking, #statAndenes, #statTotal')
            .text('$0');
    }
    
    static startTurnTimer(startTime) {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        const start = new Date(`2000-01-01T${startTime}`);
        
        this.timerInterval = setInterval(() => {
            const now = new Date();
            const diff = now - start;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            
            $('#progressTime').text(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
            
            // Calcular progreso basado en 8 horas de turno
            const progress = Math.min((diff / (8 * 3600000)) * 100, 100);
            $('#turnProgress').css('width', `${progress}%`);
            
            // SIEMPRE verde mientras la caja esté abierta
            $('#turnProgress').css('background-color', 'var(--accent-success)');
        }, 1000);
    }
    
    static stopTurnTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        $('#progressTime').text('--:--:--');
        $('#turnProgress').css('width', '0%');
        // No es necesario cambiar el color aquí ya que se reseteará cuando se abra una nueva caja
    }
}

// --- Funciones para Movimientos en Tiempo Real ---
function cargarMovimientosCaja(idCaja) {
    $.post(API_URL+'caja.php', { accion: 'obtener_movimientos', id_caja: idCaja })
        .done(function(res) {
            let data;
            try {
                data = JSON.parse(res);
            } catch (e) {
                console.error('Error parseando movimientos:', e);
                return;
            }
            
            if (data.success) {
                // Actualizar la tabla con los movimientos
                actualizarTablaConMovimientos(data);
                // Actualizar las estadísticas
                actualizarEstadisticas(data);
            } else {
                console.error('Error en movimientos:', data.error);
            }
        })
        .fail(function(xhr, status, error) {
            console.error('Error al cargar movimientos:', error);
        });
}

function actualizarTablaConMovimientos(movimientos) {
    // Obtener los datos básicos de la caja actual
    const id = localStorage.getItem('id_caja');
    const fecha = $('#tablaCaja tbody tr td:first-child').text().replace('📅 ', '') || new Date().toISOString().split('T')[0];
    const horaInicio = $('#tablaCaja tbody tr td:nth-child(2)').text().replace('⏰ ', '') || new Date().toLocaleTimeString('es-CL');
    const montoInicialText = $('#statMontoInicial').text().replace('$', '').replace(/\./g, '') || '0';
    const monto_inicial = parseFloat(montoInicialText) || 0;
    
    const monto_bano = parseFloat(movimientos.monto_bano || 0);
    const monto_custodia = parseFloat(movimientos.monto_custodia || 0);
    const monto_parking = parseFloat(movimientos.monto_parking || 0);
    const monto_andenes = parseFloat(movimientos.monto_andenes || 0);
    const total = monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;

    const estadoBadge = '<span class="badge badge-abierta"><i class="fas fa-play-circle me-1"></i>Abierta</span>';

    $('#tablaCaja tbody').html(`
        <tr>
            <td><i class="fas fa-calendar text-gray-400 me-2"></i>${fecha}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${horaInicio}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>-</td>
            <td><strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong></td>
            <td>$${UIStateManager.formatCurrency(monto_bano)}</td>
            <td>$${UIStateManager.formatCurrency(monto_custodia)}</td>
            <td>$${UIStateManager.formatCurrency(monto_parking)}</td>
            <td>$${UIStateManager.formatCurrency(monto_andenes)}</td>
            <td><strong class="text-success">$${UIStateManager.formatCurrency(total)}</strong></td>
            <td>${estadoBadge}</td>
        </tr>
    `);
    
    $('#noDataRow').hide();
    $('#registrosCount').text('1 registro');
}

function actualizarEstadisticas(movimientos) {
    const monto_inicial = parseFloat($('#statMontoInicial').text().replace('$', '').replace(/\./g, '') || 0);
    const total = monto_inicial + 
                 parseFloat(movimientos.monto_bano || 0) + 
                 parseFloat(movimientos.monto_custodia || 0) + 
                 parseFloat(movimientos.monto_parking || 0) + 
                 parseFloat(movimientos.monto_andenes || 0);
    
    $('#statBanos').text(`$${UIStateManager.formatCurrency(movimientos.monto_bano || 0)}`);
    $('#statCustodia').text(`$${UIStateManager.formatCurrency(movimientos.monto_custodia || 0)}`);
    $('#statParking').text(`$${UIStateManager.formatCurrency(movimientos.monto_parking || 0)}`);
    $('#statAndenes').text(`$${UIStateManager.formatCurrency(movimientos.monto_andenes || 0)}`);
    $('#statTotal').text(`$${UIStateManager.formatCurrency(total)}`);
}

// --- Funciones Principales ---
function mostrarCaja(data) {
    const monto_bano = parseFloat(data.monto_bano || 0);
    const monto_custodia = parseFloat(data.monto_custodia || 0);
    const monto_parking = parseFloat(data.monto_parking || 0);
    const monto_andenes = parseFloat(data.monto_andenes || 0);
    const monto_inicial = parseFloat(data.monto_inicial || 0);
    const total = monto_inicial + monto_bano + monto_custodia + monto_parking + monto_andenes;
    
    const estadoBadge = data.estado === 'abierta' 
        ? '<span class="badge badge-abierta"><i class="fas fa-play-circle me-1"></i>Abierta</span>'
        : '<span class="badge badge-cerrada"><i class="fas fa-stop-circle me-1"></i>Cerrada</span>';

    $('#tablaCaja tbody').html(`
        <tr>
            <td><i class="fas fa-calendar text-gray-400 me-2"></i>${data.fecha}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_inicio}</td>
            <td><i class="fas fa-clock text-gray-400 me-2"></i>${data.hora_cierre || '-'}</td>
            <td><strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong></td>
            <td>$${UIStateManager.formatCurrency(monto_bano)}</td>
            <td>$${UIStateManager.formatCurrency(monto_custodia)}</td>
            <td>$${UIStateManager.formatCurrency(monto_parking)}</td>
            <td>$${UIStateManager.formatCurrency(monto_andenes)}</td>
            <td><strong class="text-success">$${UIStateManager.formatCurrency(total)}</strong></td>
            <td>${estadoBadge}</td>
        </tr>
    `);
    
    $('#noDataRow').hide();
    $('#registrosCount').text('1 registro');

    // Actualizar resumen para impresión
    $('#resumenCaja').html(`
        <div class="text-center mb-4">
            <h3 class="mb-1">Terminal de Buses Calama</h3>
            <p class="text-muted mb-0">Resumen de Caja - ${data.fecha}</p>
        </div>
        <div class="row">
            <div class="col-6">
                <p><strong>Hora Inicio:</strong> ${data.hora_inicio}</p>
                ${data.hora_cierre ? `<p><strong>Hora Cierre:</strong> ${data.hora_cierre}</p>` : ''}
                <p><strong>Estado:</strong> ${data.estado}</p>
            </div>
            <div class="col-6 text-end">
                <p><strong>ID Caja:</strong> ${data.id}</p>
            </div>
        </div>
        <hr>
        <div class="monto-item">
            <span>Monto Inicial:</span>
            <strong>$${UIStateManager.formatCurrency(monto_inicial)}</strong>
        </div>
        <div class="monto-item">
            <span>Ingresos Baños:</span>
            <span>$${UIStateManager.formatCurrency(monto_bano)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Custodia:</span>
            <span>$${UIStateManager.formatCurrency(monto_custodia)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Parking:</span>
            <span>$${UIStateManager.formatCurrency(monto_parking)}</span>
        </div>
        <div class="monto-item">
            <span>Ingresos Andenes:</span>
            <span>$${UIStateManager.formatCurrency(monto_andenes)}</span>
        </div>
        <hr>
        <div class="monto-total">
            <div class="d-flex justify-content-between align-items-center">
                <span><strong>TOTAL GENERAL:</strong></span>
                <span class="h4 mb-0 text-success"><strong>$${UIStateManager.formatCurrency(total)}</strong></span>
            </div>
        </div>
        <div class="text-center mt-4 text-muted">
            <small>Generado el ${new Date().toLocaleString('es-CL')}</small>
        </div>
    `);
}

function cargarEstadoCaja() {
    const id = localStorage.getItem('id_caja');
    if (id) {
        UIStateManager.setLoading('#btnRefresh', true);
        
        $.post(API_URL+'caja.php', { accion: 'mostrar', id_caja: id })
            .done(function (res) {
                let data;
                try {
                    data = JSON.parse(res);
                } catch (e) {
                    throw new Error('Respuesta inválida del servidor');
                }
                
                if (data.success) {
                    mostrarCaja(data);
                    UIStateManager.updateCajaStatus(true, data);
                    
                    // CARGAR MOVIMIENTOS EN TIEMPO REAL
                    cargarMovimientosCaja(id);
                    
                } else {
                    // Si la caja no existe en el servidor, limpiar localStorage
                    localStorage.removeItem('id_caja');
                    UIStateManager.updateCajaStatus(false);
                    $('#noDataRow').show();
                    $('#registrosCount').text('0 registros');
                }
            })
            .fail(function (xhr, status, error) {
                ToastSystem.show('Error al cargar datos: ' + error, 'error');
            })
            .always(function () {
                UIStateManager.setLoading('#btnRefresh', false);
            });
    } else {
        UIStateManager.updateCajaStatus(false);
        $('#noDataRow').show();
        $('#registrosCount').text('0 registros');
    }
}

// --- Event Handlers ---
$('#formInicioCaja').on('submit', function (e) {
    e.preventDefault();
    
    const monto = $('#monto_inicial_modal').val();
    if (!monto || parseFloat(monto) <= 0) {
        ToastSystem.show('Ingrese un monto inicial válido', 'error');
        return;
    }

    UIStateManager.setLoading('#btnSubmitAbrir', true);
    
    $.post(API_URL+'caja.php', { accion: 'abrir', monto_inicial: monto })
        .done(function (res) {
            let data;
            try {
                data = JSON.parse(res);
            } catch (e) {
                throw new Error('Respuesta inválida del servidor');
            }
            
            if (data.success) {
                localStorage.setItem('id_caja', data.id);
                mostrarCaja(data);
                UIStateManager.updateCajaStatus(true, data);
                
                // CARGAR MOVIMIENTOS INICIALES
                cargarMovimientosCaja(data.id);
                
                $('#modalInicio').modal('hide');
                ToastSystem.show('Caja abierta correctamente', 'success');
                $('#formInicioCaja')[0].reset();
            } else {
                throw new Error(data.error || 'Error al abrir caja');
            }
        })
        .fail(function (xhr, status, error) {
            ToastSystem.show('Error de conexión: ' + error, 'error');
        })
        .always(function () {
            UIStateManager.setLoading('#btnSubmitAbrir', false);
        });
});

$('#btnCerrarCaja').on('click', function () {
    if (!confirm('¿Está seguro de que desea cerrar la caja? Esta acción no se puede deshacer.')) {
        return;
    }

    const id = localStorage.getItem('id_caja');
    if (!id) {
        ToastSystem.show('No hay caja abierta', 'warning');
        return;
    }

    UIStateManager.setLoading('#btnCerrarCaja', true);
    
    $.post(API_URL+'caja.php', { accion: 'cerrar', id_caja: id })
        .done(function (res) {
            let data;
            try {
                data = JSON.parse(res);
            } catch (e) {
                throw new Error('Respuesta inválida del servidor');
            }
            
            if (data.success) {
                localStorage.removeItem('id_caja');
                mostrarCaja(data);
                UIStateManager.updateCajaStatus(false);
                ToastSystem.show('Caja cerrada correctamente', 'success');
            } else {
                throw new Error(data.error || 'Error al cerrar caja');
            }
        })
        .fail(function (xhr, status, error) {
            ToastSystem.show('Error de conexión: ' + error, 'error');
        })
        .always(function () {
            UIStateManager.setLoading('#btnCerrarCaja', false);
        });
});

$('#btnImprimir').on('click', function () {
    const id = localStorage.getItem('id_caja');
    if (!id) {
        ToastSystem.show('No hay caja abierta para imprimir', 'warning');
        return;
    }
    
    $('#resumenCaja').show();
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            $('#resumenCaja').hide();
        }, 500);
    }, 500);
});

$('#btnRefresh').on('click', function () {
    cargarEstadoCaja();
    ToastSystem.show('Datos actualizados', 'info', 2000);
});

// --- Inicialización ---
$(document).ready(function () {
    // Cargar estado inicial de la caja
    cargarEstadoCaja();
    
    // Configurar auto-refresh cada 10 segundos para movimientos si hay caja abierta
    setInterval(() => {
        if (localStorage.getItem('id_caja')) {
            const id = localStorage.getItem('id_caja');
            cargarMovimientosCaja(id);
        }
    }, 10000); // Cada 10 segundos para movimientos en tiempo real
    
    // Configurar auto-refresh completo cada 30 segundos
    setInterval(() => {
        if (localStorage.getItem('id_caja')) {
            cargarEstadoCaja();
        }
    }, 30000); // Cada 30 segundos para refresh completo
    
    // Mejorar la experiencia del formulario
    $('#monto_inicial_modal').on('focus', function() {
        $(this).select();
    });
    
    // Prevenir el cierre del modal si hay errores
    $('#modalInicio').on('hide.bs.modal', function() {
        $('#formInicioCaja')[0].reset();
    });
    
    // Shortcut keys
    $(document).on('keydown', function(e) {
        // F5 para refresh
        if (e.key === 'F5') {
            e.preventDefault();
            $('#btnRefresh').click();
        }
        // Ctrl+P para imprimir
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            $('#btnImprimir').click();
        }
    });
});