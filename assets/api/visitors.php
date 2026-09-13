<?php
// api/visitors.php
header('Content-Type: application/json');

$dataFile = __DIR__ . '/active_users.json';
$timeout = 35; // Segundos antes de considerar que un usuario se fue
$currentTime = time();

// Leer usuarios activos actuales
$activeUsers = [];
if (file_exists($dataFile)) {
    $content = file_get_contents($dataFile);
    $activeUsers = json_decode($content, true) ?: [];
}

// Obtener la IP o un identificador único de sesión del cliente
$visitorId = $_SERVER['REMOTE_ADDR'] . $_SERVER['HTTP_USER_AGENT'];
$visitorHash = md5($visitorId);

// Registrar o actualizar el timestamp del visitante actual
$input = json_decode(file_get_contents('php://input'), true);
if (isset($input['action']) && $input['action'] === 'ping') {
    $activeUsers[$visitorHash] = $currentTime;
}

// Limpiar usuarios que ya superaron el tiempo de inactividad
foreach ($activeUsers as $hash => $timestamp) {
    if (($currentTime - $timestamp) > $timeout) {
        unset($activeUsers[$hash]);
    }
}

// Guardar la lista actualizada
file_put_contents($dataFile, json_encode($activeUsers));

// Responder con el total de usuarios activos
echo json_encode([
    'activeUsers' => count($activeUsers)
]);
?>