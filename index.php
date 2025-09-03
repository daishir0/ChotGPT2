<?php
// セットアップ済みかチェック
if (!file_exists('config.php')) {
    // 未設定の場合はセットアップ画面にリダイレクト
    header('Location: setup.php');
    exit;
}

session_start();
require_once 'classes/Database.php';
require_once 'classes/Auth.php';
require_once 'classes/Logger.php';
require_once 'classes/UrlHelper.php';
require_once 'classes/DatabaseInitializer.php';

try {
    // データベースを初期化（初回起動時のみ作成）
    $dbInitializer = new DatabaseInitializer();
    $config = $dbInitializer->initializeDatabase();
} catch (Exception $e) {
    die('Configuration or database initialization failed: ' . $e->getMessage());
}

// URL設定を初期化
UrlHelper::init($config);

$logger = new Logger($config);
$auth = new Auth($config);

if (!$auth->authenticate()) {
    exit;
}

$db = Database::getInstance($config);
$csrfToken = $auth->generateCSRFToken();

?><!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ChotGPT - ChatGPT Clone</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="dark-theme">
    <div class="app-container">
        <!-- Mobile Sidebar Overlay -->
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
        
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <h1 class="logo">ChotGPT</h1>
                <button class="new-chat-btn" id="newChatBtn">
                    <span>+</span> 新規チャット
                </button>
            </div>
            
            <div class="thread-list" id="threadList">
                <!-- スレッド一覧がここに動的に読み込まれます -->
            </div>
            
            <div class="sidebar-footer">
                <button class="settings-btn" id="settingsBtn">⚙️ 設定</button>
            </div>
        </aside>
        
        <!-- Main Content -->
        <main class="main-content">
            <!-- Chat Header -->
            <header class="chat-header">
                <div class="header-left">
                    <button class="mobile-menu-btn" id="mobileMenuBtn">☰</button>
                    <div class="thread-info">
                        <h2 id="currentThreadName">チャットを選択してください</h2>
                    </div>
                </div>
                <div class="chat-actions">
                    <button class="tree-toggle-btn" id="treeToggleBtn">🌳 ツリー表示</button>
                    <button class="file-manager-btn" id="fileManagerBtn">📁 ファイル</button>
                </div>
            </header>
            
            <!-- Tree View Panel -->
            <div class="tree-panel" id="treePanel" style="display: none;">
                <div class="tree-container" id="treeContainer">
                    <!-- メッセージツリーがここに表示されます -->
                </div>
            </div>
            
            <!-- Chat Messages -->
            <div class="messages-container" id="messagesContainer">
                <div class="welcome-message">
                    <h3>ChotGPTへようこそ</h3>
                    <p>新しいチャットを開始するか、既存のスレッドを選択してください。</p>
                </div>
            </div>
            
            <!-- Chat Input -->
            <div class="chat-input-container">
                <div class="file-attachments" id="fileAttachments" style="display: none;">
                    <!-- 添付ファイル表示エリア -->
                </div>
                
                <form class="chat-form" id="chatForm">
                    <div class="input-group">
                        <textarea 
                            id="messageInput" 
                            placeholder="メッセージを入力してください..." 
                            rows="3"
                            required
                        ></textarea>
                        <div class="input-actions">
                            <button type="button" id="attachFileBtn" title="ファイル添付">📎</button>
                            <button type="submit" id="sendBtn" title="送信">➤</button>
                        </div>
                    </div>
                </form>
            </div>
        </main>
        
        <!-- File Manager Modal -->
        <div class="modal" id="fileManagerModal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ファイル管理</h3>
                    <button class="modal-close" id="fileManagerClose">×</button>
                </div>
                <div class="modal-body">
                    <div class="file-upload-area">
                        <input type="file" id="fileUpload" multiple accept=".pdf,.txt,.docx,.xlsx,.pptx,.md">
                        <label for="fileUpload" class="upload-label">
                            ファイルをドラッグ&ドロップ、またはクリックして選択
                        </label>
                    </div>
                    
                    <div class="file-search">
                        <input type="text" id="fileSearch" placeholder="ファイルを検索...">
                    </div>
                    
                    <div class="file-list" id="fileList">
                        <!-- ファイル一覧 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="selectFilesBtn">選択したファイルを添付</button>
                </div>
            </div>
        </div>
        
        <!-- Settings Modal -->
        <div class="modal" id="settingsModal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>設定</h3>
                    <button class="modal-close" id="settingsClose">×</button>
                </div>
                <div class="modal-body">
                    <div class="setting-group">
                        <label for="modelSelect">AIモデル</label>
                        <select id="modelSelect">
                            <option value="gpt-4o-mini">GPT-4o Mini (Multimodal)</option>
                            <option value="gpt-4">GPT-4 (Advanced)</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
                        </select>
                    </div>
                    
                    <div class="setting-group">
                        <label for="systemPrompt">システムプロンプト</label>
                        <textarea id="systemPrompt" rows="4" placeholder="AIの動作を制御するシステムプロンプトを入力...">You are a helpful assistant.</textarea>
                    </div>
                    
                    <div class="setting-group">
                        <label>テーマ</label>
                        <div class="radio-group">
                            <label><input type="radio" name="theme" value="dark" checked> ダーク</label>
                            <label><input type="radio" name="theme" value="light"> ライト</label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="saveSettingsBtn">設定を保存</button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Loading Spinner -->
    <div class="loading-spinner" id="loadingSpinner" style="display: none;">
        <div class="spinner"></div>
        <p>AI が回答を生成中...</p>
    </div>
    
    <script>
        // アプリケーション設定をJavaScriptに渡す
        window.appConfig = {
            csrfToken: '<?php echo $csrfToken; ?>',
            authCredentials: '<?php echo base64_encode($config['auth']['username'] . ':' . $config['auth']['password']); ?>',
            urls: <?php echo json_encode(UrlHelper::getJsConfig()); ?>
        };
        
        // 後方互換性のため
        window.csrfToken = window.appConfig.csrfToken;
        window.authCredentials = window.appConfig.authCredentials;
    </script>
    <script src="assets/js/app.js"></script>
    <script src="assets/js/tree.js"></script>
    <script src="assets/js/files.js"></script>
</body>
</html>