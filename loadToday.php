<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");

include(dirname(__DIR__) . "/conf.php");

// Consulta única para obtener totales del día
$sql = "
    SELECT
        COUNT(*) AS totalTransactions,
        SUM(CASE WHEN tipo = 'Baño' THEN 1 ELSE 0 END) AS totalBanos,
        SUM(CASE WHEN tipo = 'Ducha' THEN 1 ELSE 0 END) AS totalDuchas,
        SUM(valor) AS totalAmount
    FROM restroom
    WHERE date = CURDATE()
";

$result = $conn->query($sql);

$response = [
    "totalAmount" => 0,
    "totalTransactions" => 0,
    "totalBanos" => 0,
    "totalDuchas" => 0
];

if ($result && $row = $result->fetch_assoc()) {
    $response = [
        "totalAmount" => (float)$row['totalAmount'],
        "totalTransactions" => (int)$row['totalTransactions'],
        "totalBanos" => (int)$row['totalBanos'],
        "totalDuchas" => (int)$row['totalDuchas']
    ];
}

echo json_encode($response);

$conn->close();
