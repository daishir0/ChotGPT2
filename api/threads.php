<?php
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once '../classes/Database.php';
require_once '../classes/Auth.php';
require_once '../classes/Logger.php';
require_once '../classes/ChatManager.php';
require_once '../classes/DatabaseInitializer.php';

try {
    // データベースを初期化（初回起動時のみ作成）
    $dbInitializer = new DatabaseInitializer(__DIR__ . '/../config.php');
    $config = $dbInitializer->initializeDatabase();
    $logger = new Logger($config);
    $auth = new Auth($config);
    
    // Check authentication without output
    if (!isset($_SERVER['PHP_AUTH_USER']) || !isset($_SERVER['PHP_AUTH_PW'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    
    if ($_SERVER['PHP_AUTH_USER'] !== $config['auth']['username'] || 
        $_SERVER['PHP_AUTH_PW'] !== $config['auth']['password']) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }
    
    $db = Database::getInstance($config);
    $chatManager = new ChatManager($db, $logger);
    
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    switch ($action) {
        case 'list':
            handleList($chatManager);
            break;
            
        case 'create':
            handleCreate($chatManager, $auth, $_POST);
            break;
            
        case 'get':
            handleGet($chatManager, $_GET);
            break;
            
        case 'update':
            handleUpdate($chatManager, $auth, $_POST);
            break;
            
        case 'delete':
            handleDelete($chatManager, $auth, $_POST);
            break;
            
        case 'tree':
            handleGetTree($chatManager, $_GET);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    if (isset($logger)) {
        $logger->error('Threads API Error', ['error' => $e->getMessage()]);
    }
}

function handleList($chatManager) {
    $threads = $chatManager->getThreads();
    
    echo json_encode([
        'success' => true,
        'threads' => $threads
    ]);
}

function handleCreate($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $name = $auth->sanitizeInput($data['name'] ?? '');
    
    if (empty($name)) {
        throw new Exception('Thread name required');
    }
    
    $threadId = $chatManager->createThread($name);
    $thread = $chatManager->getThread($threadId);
    
    echo json_encode([
        'success' => true,
        'thread' => $thread
    ]);
}

function handleGet($chatManager, $params) {
    $threadId = $params['id'] ?? null;
    
    if (!$threadId) {
        throw new Exception('Thread ID required');
    }
    
    $thread = $chatManager->getThread($threadId);
    
    if (!$thread) {
        throw new Exception('Thread not found');
    }
    
    echo json_encode([
        'success' => true,
        'thread' => $thread
    ]);
}

function handleUpdate($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $threadId = $data['thread_id'] ?? null;
    $name = $auth->sanitizeInput($data['name'] ?? '');
    
    if (!$threadId) {
        throw new Exception('Thread ID required');
    }
    
    if (empty($name)) {
        throw new Exception('Thread name required');
    }
    
    $chatManager->updateThreadName($threadId, $name);
    $thread = $chatManager->getThread($threadId);
    
    echo json_encode([
        'success' => true,
        'thread' => $thread
    ]);
}

function handleDelete($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $threadId = $data['thread_id'] ?? null;
    
    if (!$threadId) {
        throw new Exception('Thread ID required');
    }
    
    $chatManager->deleteThread($threadId);
    
    echo json_encode(['success' => true]);
}

function handleGetTree($chatManager, $params) {
    $threadId = $params['id'] ?? null;
    
    if (!$threadId) {
        throw new Exception('Thread ID required');
    }
    
    $tree = $chatManager->getMessageTree($threadId);
    
    echo json_encode([
        'success' => true,
        'tree' => $tree
    ]);
}