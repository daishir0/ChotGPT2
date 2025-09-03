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
            <div class="modal-content file-manager-modal">
                <div class="modal-header">
                    <h3>ファイル管理</h3>
                    <button class="modal-close" id="fileManagerClose">×</button>
                </div>
                <div class="modal-body">
                    <!-- Upload Area -->
                    <div class="file-upload-area">
                        <input type="file" id="fileUpload" multiple accept=".pdf,.txt,.docx,.xlsx,.pptx,.md,.jpg,.jpeg,.png,.gif">
                        <label for="fileUpload" class="upload-label">
                            <span class="upload-icon">📤</span>
                            <span class="upload-text">ファイルをドラッグ&ドロップ、またはクリックして選択</span>
                        </label>
                    </div>
                    
                    <!-- Controls -->
                    <div class="file-controls">
                        <div class="file-search">
                            <input type="text" id="fileSearch" placeholder="🔍 ファイルを検索...">
                        </div>
                        
                        <div class="file-actions">
                            <div class="view-toggle">
                                <button class="view-btn active" id="gridViewBtn" data-view="grid" title="グリッド表示">⚏</button>
                                <button class="view-btn" id="listViewBtn" data-view="list" title="リスト表示">☰</button>
                            </div>
                            
                            <select class="sort-select" id="sortSelect">
                                <option value="name">名前順</option>
                                <option value="date">日付順</option>
                                <option value="size">サイズ順</option>
                                <option value="type">タイプ順</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Filter Chips -->
                    <div class="filter-chips">
                        <span class="chip active" data-type="all">すべて</span>
                        <span class="chip" data-type="pdf">PDF</span>
                        <span class="chip" data-type="image">画像</span>
                        <span class="chip" data-type="document">文書</span>
                        <span class="chip" data-type="other">その他</span>
                    </div>
                    
                    <!-- Selection Toolbar -->
                    <div class="selection-toolbar" id="selectionToolbar" style="display: none;">
                        <span class="selection-count" id="selectionCount">0個選択中</span>
                        <div class="bulk-actions">
                            <button class="bulk-action-btn" id="bulkDownloadBtn">📥 ダウンロード</button>
                            <button class="bulk-action-btn danger" id="bulkDeleteBtn">🗑️ 削除</button>
                            <button class="cancel-selection" id="cancelSelectionBtn">キャンセル</button>
                        </div>
                    </div>
                    
                    <!-- File List Container -->
                    <div class="file-container">
                        <div class="file-list grid-view" id="fileList">
                            <!-- ファイル一覧がここに動的生成される -->
                        </div>
                        
                        <div class="empty-state" id="emptyState" style="display: none;">
                            <div class="empty-icon">📁</div>
                            <div class="empty-text">ファイルがありません</div>
                            <div class="empty-subtext">上記のエリアからファイルをアップロードしてください</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="clearSelectionBtn">選択解除</button>
                    <button class="btn-primary" id="selectFilesBtn">選択したファイルを添付</button>
                </div>
            </div>
        </div>
        
        <!-- Delete Confirmation Modal -->
        <div class="modal" id="deleteConfirmModal" style="display: none;">
            <div class="modal-content small">
                <div class="modal-header">
                    <h3>ファイル削除</h3>
                    <button class="modal-close" id="deleteConfirmClose">×</button>
                </div>
                <div class="modal-body">
                    <div class="delete-confirm-content">
                        <div class="warning-icon">⚠️</div>
                        <div class="delete-message">
                            <p>以下のファイルを削除しますか？</p>
                            <div class="delete-file-list" id="deleteFileList"></div>
                            <p class="delete-warning">この操作は取り消せません。</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="deleteConfirmCancel">キャンセル</button>
                    <button class="btn-danger" id="deleteConfirmOk">削除する</button>
                </div>
            </div>
        </div>
        
        <!-- Edit Message Modal -->
        <div class="modal" id="editMessageModal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>メッセージを編集</h3>
                    <button class="modal-close" id="editMessageClose">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-message-form">
                        <label for="editMessageTextarea">メッセージ内容:</label>
                        <textarea id="editMessageTextarea" rows="6" placeholder="メッセージを編集してください..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="editMessageCancel">キャンセル</button>
                    <button class="btn-primary" id="editMessageSave">保存</button>
                </div>
            </div>
        </div>
        
        <!-- Branch Message Modal -->
        <div class="modal" id="branchMessageModal" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>メッセージを分岐</h3>
                    <button class="modal-close" id="branchMessageClose">×</button>
                </div>
                <div class="modal-body">
                    <div class="branch-message-form">
                        <label for="branchMessageTextarea">分岐メッセージ内容:</label>
                        <textarea id="branchMessageTextarea" rows="6" placeholder="分岐メッセージを入力してください..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="branchMessageCancel">キャンセル</button>
                    <button class="btn-primary" id="branchMessageSave">分岐作成</button>
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