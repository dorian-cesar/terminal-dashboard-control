<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Caja - WIT</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body class="dashboard-page">
    <div class="wrapper">
        <!-- Sidebar -->
        <nav id="sidebar" class="sidebar">
            <div class="sidebar-header">
                <h3>WIT</h3>
                <div class="user-info">
                    <i class="bi bi-x-circle"></i>
                    <div>
                        <div class="user-email" id="userEmail"></div>
                        <div class="user-role" id="userRole"></div>
                    </div>
                </div>
            </div>

            <ul class="list-unstyled components">
                <li>
                    <a href="dashboard.html"><i class="bi bi-grid"></i> Dashboard</a>
                </li>
                <li>
                    <a href="banos.html"><i class="bi bi-droplet"></i> Baños</a>
                </li>
                <li>
                    <a href="custodia.html"><i class="bi bi-shield-check"></i> Custodia</a>
                </li>
                <li>
                    <a href="parking.html"><i class="bi bi-car-front"></i> Parking</a>
                </li>
                <li>
                    <a href="andenes.html"><i class="bi bi-signpost"></i> Andenes</a>
                </li>
                <li class="active">
                    <a href="caja.html"><i class="bi bi-cash-coin"></i> Caja</a>
                </li>
                <li>
                    <a href="monitoreo.html"><i class="bi bi-display"></i> Monitoreo</a>
                </li>
                <li class="menu-section">CONFIGURACIÓN</li>
                <li>
                    <a href="empresas.html"><i class="bi bi-building"></i> Empresas</a>
                </li>
                <li>
                    <a href="destinos.html"><i class="bi bi-geo-alt"></i> Destinos</a>
                </li>
                <li>
                    <a href="usuarios.html"><i class="bi bi-people"></i> Usuarios</a>
                </li>
                <li>
                    <a href="listas-blancas.html"><i class="bi bi-list-check"></i> Listas Blancas</a>
                </li>
                <li>
                    <a href="pagos-diarios.html"><i class="bi bi-currency-dollar"></i> Pagos Diarios</a>
                </li>
                <li>
                    <a href="entradas-salidas.html"><i class="bi bi-arrow-left-right"></i> Entradas y Salidas</a>
                </li>
                <li>
                    <a href="#" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Log Out</a>
                </li>
            </ul>
        </nav>

        <!-- Page Content -->
        <div id="content">
            <div class="top-bar">
                <h4>Sistema de Control de Terminales Terrestres</h4>
            </div>

            <div class="container-fluid">
                <div class="page-header mb-4">
                    <h2>Caja</h2>
                    <p class="text-muted">Resumen de ingresos y transacciones</p>
                </div>

                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-success">
                                <i class="bi bi-currency-dollar"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="totalDay">$500</h3>
                                <p>Total del Día</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-primary">
                                <i class="bi bi-receipt"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="totalTransactions">2</h3>
                                <p>Transacciones</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card">
                            <div class="stat-icon bg-info">
                                <i class="bi bi-grid-3x3"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="totalServices">2</h3>
                                <p>Servicios</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="card mb-4">
                            <div class="card-header">
                                <h5 class="mb-0">Desglose por Servicio</h5>
                            </div>
                            <div class="card-body">
                                <div class="service-breakdown">
                                    <div class="service-item">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span><i class="bi bi-droplet text-primary"></i> Baños</span>
                                            <strong>$500</strong>
                                        </div>
                                        <div class="progress" style="height: 10px;">
                                            <div class="progress-bar bg-primary" style="width: 100%"></div>
                                        </div>
                                    </div>
                                    <div class="service-item">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span><i class="bi bi-shield-check text-success"></i> Custodia</span>
                                            <strong>$0</strong>
                                        </div>
                                        <div class="progress" style="height: 10px;">
                                            <div class="progress-bar bg-success" style="width: 0%"></div>
                                        </div>
                                    </div>
                                    <div class="service-item">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <span><i class="bi bi-car-front text-info"></i> Parking</span>
                                            <strong>$0</strong>
                                        </div>
                                        <div class="progress" style="height: 10px;">
                                            <div class="progress-bar bg-info" style="width: 0%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Últimas Transacciones</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Monto</th>
                                                <th>Servicio</th>
                                                <th>Cliente</th>
                                            </tr>
                                        </thead>
                                        <tbody id="transactionsTable">
                                            <tr>
                                                <td><strong>$500</strong></td>
                                                <td><span class="badge bg-primary">BANO</span></td>
                                                <td>Juan Pérez</td>
                                            </tr>
                                            <tr>
                                                <td><strong>$0</strong></td>
                                                <td><span class="badge bg-warning">ANDEN</span></td>
                                                <td>Tur-Bus</td>
                                            </tr>
                                            <tr>
                                                <td><strong>$0</strong></td>
                                                <td><span class="badge bg-info">Parking</span></td>
                                                <td>-</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="app.js"></script>
    <script>
        $(document).ready(function() {
            checkAuth();
            loadUserInfo();
            
            $('#logoutBtn').on('click', function(e) {
                e.preventDefault();
                logout();
            });
        });
    </script>
</body>
</html>
