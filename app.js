// Initialize default data
// function initializeData() {
//   if (!localStorage.getItem("users")) {
//     const defaultUsers = [
//       {
//         id: 1,
//         email: "admin@wit.la",
//         password: "admin123",
//         role: "Administrador",
//         sections: [
//           "banos",
//           "custodias",
//           "parking",
//           "andenes",
//           "caja",
//           "configuracion",
//         ],
//       },
//       {
//         id: 2,
//         email: "user@wit.la",
//         password: "user123",
//         role: "Usuario",
//         sections: ["parking", "andenes", "caja"],
//       },
//       {
//         id: 3,
//         email: "dgonzalez@wit.la",
//         password: "pass123",
//         role: "Administrador",
//         sections: [
//           "banos",
//           "custodias",
//           "parking",
//           "andenes",
//           "caja",
//           "configuracion",
//         ],
//       },
//     ];
//     localStorage.setItem("users", JSON.stringify(defaultUsers));
//   }

//   if (!localStorage.getItem("companies")) {
//     const defaultCompanies = [
//       { id: 1, nombre: "Havana-vida", contacto: "No definida" },
//       { id: 2, nombre: "Tur-Bus", contacto: "NA" },
//       { id: 3, nombre: "Pullman", contacto: "NA" },
//       { id: 4, nombre: "Particulares", contacto: "NA" },
//       { id: 5, nombre: "Taxis", contacto: "NA" },
//     ];
//     localStorage.setItem("companies", JSON.stringify(defaultCompanies));
//   }

//   if (!localStorage.getItem("destinations")) {
//     const defaultDestinations = [
//       { id: 1, ciudad: "Valparaiso", valor: 2000, tipo: "nacional" },
//       { id: 2, ciudad: "Mendoza", valor: 16000, tipo: "internacional" },
//       { id: 3, ciudad: "Rancagua", valor: 5000, tipo: "nacional" },
//       { id: 4, ciudad: "Valdivia", valor: 12000, tipo: "nacional" },
//       { id: 5, ciudad: "SALTA", valor: 14000, tipo: "internacional" },
//     ];
//     localStorage.setItem("destinations", JSON.stringify(defaultDestinations));
//   }

//   if (!localStorage.getItem("vehicles")) {
//     const defaultVehicles = [
//       {
//         patente: "ABCD12",
//         empresaId: 2,
//         destinoId: 1,
//         horaIngreso: "08:30",
//         estado: "activo",
//       },
//       {
//         patente: "WXYZ98",
//         empresaId: 3,
//         destinoId: 4,
//         horaIngreso: "10:15",
//         estado: "activo",
//       },
//     ];
//     localStorage.setItem("vehicles", JSON.stringify(defaultVehicles));
//   }
// }

// Authentication functions
// function login(email, password) {
//   const users = JSON.parse(localStorage.getItem("users")) || [];

//   const user = users.find((u) => u.email === email && u.password === password);

//   console.log(user, email, password);

//   if (user) {
//     localStorage.setItem("currentUser", JSON.stringify(user));
//     return true;
//   }
//   return false;
// }

// function logout() {
//   localStorage.removeItem("user");
//   window.location.href = "index.html";
// }

function checkAuth() {
  const currentUser = localStorage.getItem("user");
  if (!currentUser) {
    window.location.href = "index.html";
  }
}

function loadUserInfo() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (currentUser) {
    window.jQuery("#userEmail").text(currentUser.email);
    window.jQuery("#userRole").text(currentUser.role);
  }
}

// User CRUD functions
function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || [];
}

function getUserById(id) {
  const users = getUsers();
  return users.find((u) => u.id === id);
}

function addUser(user) {
  const users = getUsers();
  user.id = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
  users.push(user);
  localStorage.setItem("users", JSON.stringify(users));
}

function updateUser(user) {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  if (index !== -1) {
    users[index] = user;
    localStorage.setItem("users", JSON.stringify(users));
  }
}

function removeUser(id) {
  let users = getUsers();
  users = users.filter((u) => u.id !== id);
  localStorage.setItem("users", JSON.stringify(users));
}

// Company CRUD functions
function getCompanies() {
  return JSON.parse(localStorage.getItem("companies")) || [];
}

function getCompanyById(id) {
  const companies = getCompanies();
  return companies.find((c) => c.id === Number.parseInt(id));
}

function addCompany(company) {
  const companies = getCompanies();
  company.id =
    companies.length > 0 ? Math.max(...companies.map((c) => c.id)) + 1 : 1;
  companies.push(company);
  localStorage.setItem("companies", JSON.stringify(companies));
}

function updateCompany(company) {
  const companies = getCompanies();
  const index = companies.findIndex((c) => c.id === company.id);
  if (index !== -1) {
    companies[index] = company;
    localStorage.setItem("companies", JSON.stringify(companies));
  }
}

function removeCompany(id) {
  let companies = getCompanies();
  companies = companies.filter((c) => c.id !== id);
  localStorage.setItem("companies", JSON.stringify(companies));
}

// Destination CRUD functions
function getDestinations() {
  return JSON.parse(localStorage.getItem("destinations")) || [];
}

function getDestinationById(id) {
  const destinations = getDestinations();
  return destinations.find((d) => d.id === Number.parseInt(id));
}

function addDestination(destination) {
  const destinations = getDestinations();
  destination.id =
    destinations.length > 0
      ? Math.max(...destinations.map((d) => d.id)) + 1
      : 1;
  destinations.push(destination);
  localStorage.setItem("destinations", JSON.stringify(destinations));
}

function updateDestination(destination) {
  const destinations = getDestinations();
  const index = destinations.findIndex((d) => d.id === destination.id);
  if (index !== -1) {
    destinations[index] = destination;
    localStorage.setItem("destinations", JSON.stringify(destinations));
  }
}

function removeDestination(id) {
  let destinations = getDestinations();
  destinations = destinations.filter((d) => d.id !== id);
  localStorage.setItem("destinations", JSON.stringify(destinations));
}

// Vehicle functions
function getActiveVehicles() {
  return JSON.parse(localStorage.getItem("vehicles")) || [];
}

function findVehicleByPatente(patente) {
  const vehicles = getActiveVehicles();
  return vehicles.find((v) => v.patente === patente);
}

function addVehicle(vehicle) {
  const vehicles = getActiveVehicles();
  vehicles.push(vehicle);
  localStorage.setItem("vehicles", JSON.stringify(vehicles));
}

function removeVehicle(patente) {
  let vehicles = getActiveVehicles();
  vehicles = vehicles.filter((v) => v.patente !== patente);
  localStorage.setItem("vehicles", JSON.stringify(vehicles));
}

// Initialize data on page load
window.jQuery(document).ready(() => {
  initializeData();
});
