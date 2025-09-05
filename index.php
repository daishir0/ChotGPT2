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
    
    // configから取得したタイムゾーンを設定
    if (isset($config['system']['timezone'])) {
        date_default_timezone_set($config['system']['timezone']);
    } else {
        // フォールバック
        date_default_timezone_set('Asia/Tokyo');
    }
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
            
            <!-- Thread Search -->
            <div class="thread-search">
                <div class="search-input-container">
                    <input type="text" id="threadSearch" placeholder="🔍 スレッドを検索..." class="search-input">
                    <button class="search-clear-btn" id="searchClearBtn" title="クリア">×</button>
                </div>
                <div class="search-results-info" id="searchResultsInfo" style="display: none;"></div>
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
                    <button class="persona-btn" id="personaBtn" title="スレッドペルソナ設定">🎭</button>
                    <button class="tree-toggle-btn" id="treeToggleBtn">🌳</button>
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
                        <input type="file" id="fileUpload" multiple accept=".pdf,.txt,.docx,.xlsx,.pptx,.md,.csv,.jpg,.jpeg,.png,.gif">
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
                        <span class="chip" data-type="word">Word</span>
                        <span class="chip" data-type="excel">Excel</span>
                        <span class="chip" data-type="ppt">PPT</span>
                        <span class="chip" data-type="text">TEXT</span>
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
        
        <!-- Thread Persona Modal -->
        <div class="modal" id="threadPersonaModal" style="display: none;">
            <div class="modal-content persona-modal">
                <div class="modal-header">
                    <div class="modal-title-group">
                        <span class="persona-icon">🎭</span>
                        <h3>AIペルソナ設定</h3>
                    </div>
                    <button class="modal-close" id="threadPersonaClose">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="persona-editor">
                        <div class="persona-input-section">
                            <textarea 
                                id="threadPersonaTextarea" 
                                class="persona-textarea"
                                placeholder="このスレッド専用のAIキャラクターを設定してください...

例：
• あなたは経験豊富なプログラミング講師です
• コード例を積極的に示し、丁寧に説明してください
• 初心者にもわかりやすく教えることを心がけてください"
                                rows="8"></textarea>
                        </div>
                        
                        <div class="persona-meta">
                            <div class="character-count">
                                <span id="personaCharCount">0</span><span class="count-limit">/50000</span>
                            </div>
                            <div class="persona-hint">
                                💡 基本システムプロンプトに追加適用されます
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-text" id="threadPersonaClear">リセット</button>
                    <div class="action-buttons">
                        <button class="btn-secondary" id="threadPersonaCancel">キャンセル</button>
                        <button class="btn-primary" id="threadPersonaSave">
                            <span class="btn-icon">✓</span>
                            保存
                        </button>
                    </div>
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
                            <!-- モデル選択肢はJavaScriptで動的に生成されます -->
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
    <!-- External Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>

    <!-- Core Framework -->
    <script src="assets/js/core/utils.js"></script>
    <script src="assets/js/core/api-client.js"></script>

    <!-- Components -->
    <script src="assets/js/components/message-renderer.js"></script>
    <script src="assets/js/components/settings-manager.js"></script>
    <script src="assets/js/components/ui-manager.js"></script>
    <script src="assets/js/components/chat-manager.js"></script>
    <script src="assets/js/components/thread-manager.js"></script>
    <script src="assets/js/components/file-manager.js"></script>

    <!-- Modules -->
    <script src="assets/js/modules/mobile-handler.js"></script>
    <script src="assets/js/modules/message-actions.js"></script>

    <!-- Main Application -->
    <script src="assets/js/core/app.js"></script>

    <!-- Legacy Components -->
    <script src="assets/js/legacy/tree.js"></script>
</body>
</html>