<?php
header('Content-Type: application/json');

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Require files
require_once '../classes/Database.php';
require_once '../classes/Auth.php';
require_once '../classes/Logger.php';
require_once '../classes/ChatManager.php';
require_once '../classes/OpenAIClient.php';
require_once '../classes/FileManager.php';
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
    $openaiClient = new OpenAIClient($config, $logger);
    $fileManager = new FileManager($db, $logger, $config);
    
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'send':
            handleSendMessage($chatManager, $openaiClient, $fileManager, $auth, $logger);
            break;
            
        case 'history':
            handleGetHistory($chatManager, $_GET['thread_id'] ?? null);
            break;
            
        case 'edit':
            handleEditMessage($chatManager, $auth, $_POST, $logger);
            break;
            
        case 'delete':
            handleDeleteMessage($chatManager, $auth, $_POST);
            break;
            
        case 'context':
            handleUpdateContext($chatManager, $auth, $_POST);
            break;
            
        case 'branch':
            handleCreateBranch($chatManager, $auth, $_POST);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    if (isset($logger)) {
        $logger->error('Chat API Error', ['error' => $e->getMessage()]);
    }
}

function handleSendMessage($chatManager, $openaiClient, $fileManager, $auth, $logger) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$auth->validateCSRFToken($input['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $threadId = $input['thread_id'] ?? null;
    $message = $auth->sanitizeInput($input['message'] ?? '');
    $parentMessageId = $input['parent_message_id'] ?? null;
    $selectedFiles = $input['files'] ?? [];
    $systemPrompt = $input['system_prompt'] ?? null;
    $model = $input['model'] ?? null;
    
    if (empty($message)) {
        throw new Exception('Message cannot be empty');
    }
    
    if (!$threadId) {
        $threadName = substr($message, 0, 50) . (strlen($message) > 50 ? '...' : '');
        $threadId = $chatManager->createThread($threadName);
    }
    
    $userMessageId = $chatManager->addMessage($threadId, 'user', $message, $parentMessageId);
    
    foreach ($selectedFiles as $fileId) {
        $fileManager->attachFileToMessage($userMessageId, $fileId);
    }
    
    $contextMessages = $chatManager->getContextMessages($userMessageId);
    
    foreach ($selectedFiles as $fileId) {
        $file = $fileManager->getFile($fileId);
        if ($file && $file['content_markdown']) {
            $contextMessages[] = [
                'role' => 'user',
                'content' => "File: " . $file['original_name'] . "\n\n" . $file['content_markdown']
            ];
        }
    }
    
    $compressedContext = $openaiClient->compressContext($contextMessages);
    
    $response = $openaiClient->sendMessage($compressedContext, $model, $systemPrompt);
    
    $assistantMessageId = $chatManager->addMessage(
        $threadId, 
        'assistant',
        $response['content'], 
        $userMessageId
    );
    
    echo json_encode([
        'success' => true,
        'thread_id' => $threadId,
        'user_message_id' => $userMessageId,
        'assistant_message_id' => $assistantMessageId,
        'response' => $response['content'],
        'usage' => $response['usage']
    ]);
}

function handleGetHistory($chatManager, $threadId) {
    if (!$threadId) {
        throw new Exception('Thread ID required');
    }
    
    $tree = $chatManager->getMessageTree($threadId);
    $thread = $chatManager->getThread($threadId);
    
    echo json_encode([
        'success' => true,
        'thread' => $thread,
        'tree' => $tree
    ]);
}

function handleEditMessage($chatManager, $auth, $data, $logger) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $messageId = $data['message_id'] ?? null;
    $newContent = $auth->sanitizeInput($data['content'] ?? '');
    
    if (!$messageId || empty($newContent)) {
        throw new Exception('Message ID and content required');
    }
    
    $chatManager->updateMessage($messageId, $newContent);
    
    echo json_encode(['success' => true]);
}

function handleDeleteMessage($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $messageId = $data['message_id'] ?? null;
    
    if (!$messageId) {
        throw new Exception('Message ID required');
    }
    
    $chatManager->deleteMessage($messageId);
    
    echo json_encode(['success' => true]);
}

function handleUpdateContext($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $messageId = $data['message_id'] ?? null;
    $isContext = $data['is_context'] ?? false;
    
    if (!$messageId) {
        throw new Exception('Message ID required');
    }
    
    $chatManager->updateContextStatus($messageId, $isContext);
    
    echo json_encode(['success' => true]);
}

function handleCreateBranch($chatManager, $auth, $data) {
    if (!$auth->validateCSRFToken($data['csrf_token'] ?? '')) {
        throw new Exception('Invalid CSRF token');
    }
    
    $parentMessageId = $data['parent_message_id'] ?? null;
    $content = $auth->sanitizeInput($data['content'] ?? '');
    $role = $data['role'] ?? 'user';
    
    if (!$parentMessageId || empty($content)) {
        throw new Exception('Parent message ID and content required');
    }
    
    $branchMessageId = $chatManager->createBranch($parentMessageId, $content, $role);
    
    echo json_encode([
        'success' => true,
        'message_id' => $branchMessageId
    ]);
}