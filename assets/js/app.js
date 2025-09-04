// ChotGPT Main Application JavaScript

// Markdown rendering utility class
class MessageRenderer {
    constructor() {
        this.initializeLibraries();
    }
    
    initializeLibraries() {
        if (typeof marked !== 'undefined') {
            // Marked.js設定
            marked.setOptions({
                highlight: (code, lang) => {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            console.warn('Highlight.js error:', err);
                        }
                    }
                    return hljs ? hljs.highlightAuto(code).value : this.escapeHtml(code);
                },
                breaks: true,
                gfm: true,
                tables: true,
                sanitize: false,
                smartypants: true
            });
        }
        
        // KaTeX初期化確認
        if (typeof katex !== 'undefined') {
            console.log('KaTeX initialized successfully');
        }
        
        // Mermaid初期化
        if (typeof mermaid !== 'undefined') {
            this.initializeMermaidTheme();
            console.log('Mermaid initialized successfully');
        }
    }
    
    async renderMessage(content) {
        if (!content) return '';
        
        try {
            // 数式・図表を含むかどうかもチェック
            if (this.isMarkdownContent(content) || this.hasMathContent(content) || this.hasMermaidContent(content)) {
                let html;
                
                // Mermaidの前処理（数式より先に処理）
                content = await this.preprocessMermaid(content);
                
                // 数式の前処理
                content = this.preprocessMath(content);
                
                // Markdownレンダリング
                html = marked ? marked.parse(content) : this.escapeHtml(content);
                
                // テーブルをレスポンシブ対応に変換
                html = this.makeTablesResponsive(html);
                
                // Mermaidの後処理
                setTimeout(() => this.processMermaidDiagrams(), 100);
                
                return `<div class="markdown-content">${html}</div>`;
            } else {
                // 通常のテキストとして処理
                return this.escapeHtml(content).replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.warn('Markdown rendering error:', error);
            return this.escapeHtml(content).replace(/\n/g, '<br>');
        }
    }
    
    makeTablesResponsive(html) {
        // テーブルをラッパーで囲む
        return html.replace(/<table([^>]*)>/g, '<div class="table-wrapper"><table$1>').replace(/<\/table>/g, '</table></div>');
    }
    
    hasMathContent(content) {
        const mathPatterns = [
            /\$\$[\s\S]*?\$\$/,     // ブロック数式 $$...$$
            /\$[^$\n]*\$/,          // インライン数式 $...$
            /\\\[[\s\S]*?\\\]/,     // LaTeX ブロック数式 \[...\]
            /\\\([\s\S]*?\\\)/,     // LaTeX インライン数式 \(...\)
            /\[[\s\S]*?\]/          // 簡略ブロック数式 [...]（AIがよく使う）
        ];
        
        return mathPatterns.some(pattern => pattern.test(content));
    }
    
    hasMermaidContent(content) {
        const mermaidPatterns = [
            /```mermaid[\s\S]*?```/i,       // コードブロック内のmermaid
            /```graph[\s\S]*?```/i,        // graph記法
            /```flowchart[\s\S]*?```/i,    // flowchart記法
            /```sequence[\s\S]*?```/i,     // sequence記法
            /```gantt[\s\S]*?```/i,        // gantt記法
            /```pie[\s\S]*?```/i,          // pie記法
            /```mindmap[\s\S]*?```/i,      // mindmap記法
            /```stateDiagram[\s\S]*?```/i, // stateDiagram記法
            /```state[\s\S]*?```/i,        // state記法（短縮形）
            /```journey[\s\S]*?```/i,      // journey記法
            /```gitgraph[\s\S]*?```/i      // gitgraph記法
        ];
        
        return mermaidPatterns.some(pattern => pattern.test(content));
    }
    
    initializeMermaidTheme() {
        const isDark = document.body.classList.contains('dark-theme');
        
        const mermaidConfig = {
            startOnLoad: false,
            securityLevel: 'loose',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            theme: isDark ? 'dark' : 'default',
            themeVariables: isDark ? {
                // ダークモード用カスタムカラー
                primaryColor: '#4a9eff',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#6b7280',
                lineColor: '#9ca3af',
                secondaryColor: '#374151',
                tertiaryColor: '#1f2937',
                background: '#111827',
                mainBkg: '#1f2937',
                secondBkg: '#374151',
                tertiaryBkg: '#4b5563'
            } : {
                // ライトモード用カスタムカラー
                primaryColor: '#4a9eff',
                primaryTextColor: '#1f2937',
                primaryBorderColor: '#d1d5db',
                lineColor: '#6b7280',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#ffffff',
                background: '#ffffff',
                mainBkg: '#ffffff',
                secondBkg: '#f9fafb',
                tertiaryBkg: '#f3f4f6'
            }
        };
        
        mermaid.initialize(mermaidConfig);
    }
    
    async preprocessMermaid(content) {
        if (typeof mermaid === 'undefined') {
            console.warn('Mermaid not available');
            return content;
        }
        
        try {
            // Mermaidコードブロックをプレースホルダーに置換
            let diagramCount = 0;
            content = content.replace(/```(mermaid|graph|flowchart|sequence|gantt|pie|mindmap|stateDiagram|state|journey|gitgraph)\n([\s\S]*?)```/gi, (match, type, diagramCode) => {
                const diagramId = `mermaid-diagram-${Date.now()}-${diagramCount++}`;
                
                // プレースホルダーを作成（後でSVGに置換される）
                return `<div class="mermaid-container">
                    <div class="mermaid" id="${diagramId}" data-diagram="${this.escapeHtml(diagramCode.trim())}">
                        ${diagramCode.trim()}
                    </div>
                </div>`;
            });
            
            return content;
        } catch (error) {
            console.warn('Mermaid preprocessing error:', error);
            return content;
        }
    }
    
    async processMermaidDiagrams() {
        if (typeof mermaid === 'undefined') return;
        
        // テーマが変更されている可能性があるので再初期化
        this.initializeMermaidTheme();
        
        const diagrams = document.querySelectorAll('.mermaid:not(.mermaid-processed)');
        
        for (const diagram of diagrams) {
            try {
                const diagramCode = diagram.dataset.diagram || diagram.textContent;
                
                if (diagramCode.trim()) {
                    // SVGを生成
                    const { svg } = await mermaid.render(diagram.id + '-svg', diagramCode);
                    diagram.innerHTML = svg;
                    diagram.classList.add('mermaid-processed');
                }
            } catch (error) {
                console.warn('Mermaid rendering error:', error);
                diagram.innerHTML = `<div class="mermaid-error">
                    <strong>図表レンダリングエラー:</strong><br>
                    <code>${this.escapeHtml(error.message)}</code>
                </div>`;
                diagram.classList.add('mermaid-processed');
            }
        }
    }
    
    preprocessMath(content) {
        if (typeof katex === 'undefined') {
            console.warn('KaTeX not available');
            return content;
        }
        
        try {
            // ブロック数式の処理 $$...$$
            content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false,
                        strict: false
                    });
                    return `<div class="math-block">${rendered}</div>`;
                } catch (error) {
                    console.warn('KaTeX block math error:', error);
                    return `<div class="math-error">$$${math}$$</div>`;
                }
            });
            
            // LaTeX ブロック数式の処理 \[...\]
            content = content.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false,
                        strict: false
                    });
                    return `<div class="math-block">${rendered}</div>`;
                } catch (error) {
                    console.warn('KaTeX LaTeX block math error:', error);
                    return `<div class="math-error">\\[${math}\\]</div>`;
                }
            });
            
            // 簡略ブロック数式の処理 [...]（AIがよく使う）
            content = content.replace(/^\s*\[\s*([\s\S]*?)\s*\]\s*$/gm, (match, math) => {
                // 数式っぽいかチェック（英数字、記号、LaTeX命令を含む）
                if (/[a-zA-Z0-9+\-=^_{}\\()√∫∑∏αβγδεζηθικλμνξοπρστυφχψω]/.test(math)) {
                    try {
                        const rendered = katex.renderToString(math.trim(), {
                            displayMode: true,
                            throwOnError: false,
                            strict: false
                        });
                        return `<div class="math-block">${rendered}</div>`;
                    } catch (error) {
                        console.warn('KaTeX bracket math error:', error);
                        return `<div class="math-error">[${math}]</div>`;
                    }
                }
                return match; // 数式でない場合はそのまま
            });
            
            // インライン数式の処理 $...$
            content = content.replace(/\$([^$\n]+?)\$/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false,
                        strict: false
                    });
                    return `<span class="math-inline">${rendered}</span>`;
                } catch (error) {
                    console.warn('KaTeX inline math error:', error);
                    return `<span class="math-error">$${math}$</span>`;
                }
            });
            
            // LaTeX インライン数式の処理 \(...\)
            content = content.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false,
                        strict: false
                    });
                    return `<span class="math-inline">${rendered}</span>`;
                } catch (error) {
                    console.warn('KaTeX LaTeX inline math error:', error);
                    return `<span class="math-error">\\(${math}\\)</span>`;
                }
            });
            
            return content;
        } catch (error) {
            console.warn('Math preprocessing error:', error);
            return content;
        }
    }
    
    isMarkdownContent(content) {
        const markdownPatterns = [
            /^#{1,6}\s/m,           // 見出し
            /```[\s\S]*?```/,       // コードブロック
            /\|.+\|/,              // テーブル
            /^\s*[-*+]\s/m,        // リスト
            /^\s*\d+\.\s/m,        // 番号付きリスト
            /^\s*>\s/m,            // 引用
            /\*\*[^*]+\*\*/,       // 太字
            /\*[^*]+\*/,           // 斜体
            /`[^`]+`/,             // インラインコード
            /\[.+\]\(.+\)/,        // リンク
            /^---+$/m,             // 水平線
            /\$\$[\s\S]*?\$\$/,    // ブロック数式
            /\$[^$\n]+\$/,         // インライン数式
            /\\\[[\s\S]*?\\\]/,    // LaTeX ブロック数式
            /\\\([\s\S]*?\\\)/,    // LaTeX インライン数式
            /\[[\s\S]*?\]/,        // 簡略ブロック数式
            /```mermaid[\s\S]*?```/i,      // Mermaid図表
            /```graph[\s\S]*?```/i,       // Graph記法
            /```flowchart[\s\S]*?```/i,   // Flowchart記法
            /```stateDiagram[\s\S]*?```/i, // StateDiagram記法
            /```state[\s\S]*?```/i,       // State記法
            /```journey[\s\S]*?```/i,     // Journey記法
            /```gitgraph[\s\S]*?```/i     // Gitgraph記法
        ];
        
        return markdownPatterns.some(pattern => pattern.test(content));
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

class ChotGPTApp {
    constructor() {
        this.currentThread = null;
        this.currentMessageId = null;
        this.currentThreadMessages = []; // Store complete message tree for copy functionality
        this.selectedFiles = [];
        this.allThreads = []; // Store all threads for search
        this.filteredThreads = []; // Store filtered threads
        this.settings = {
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a helpful assistant.',
            theme: 'dark'
        };
        
        // URL設定を取得
        this.apiBaseUrl = window.appConfig?.urls?.apiUrl || '/api';
        
        // Message renderer初期化
        this.messageRenderer = new MessageRenderer();
        
        this.init();
    }
    
    // ヘルパー関数：認証付きFetch
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': 'Basic ' + window.authCredentials,
                ...options.headers
            }
        };
        
        return fetch(url, { ...options, ...defaultOptions });
    }
    
    async init() {
        await this.loadSettings();
        this.bindEvents();
        this.loadThreads();
        this.preventDoubleTabZoom();
    }
    
    bindEvents() {
        // New Chat
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.newChat();
        });
        
        // Chat Form
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Message Input
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Check if device is mobile
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                    || window.innerWidth <= 768;
                
                if (isMobile) {
                    // Mobile: Enter key creates new line (default behavior)
                    return;
                } else {
                    // PC: Enter sends message, Shift+Enter creates new line
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                }
            }
        });
        
        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });
        
        document.getElementById('settingsClose').addEventListener('click', () => {
            this.hideModal('settingsModal');
        });
        
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // Tree Toggle
        document.getElementById('treeToggleBtn').addEventListener('click', () => {
            this.toggleTreeView();
        });
        
        // Thread Persona
        document.getElementById('personaBtn').addEventListener('click', () => {
            this.showThreadPersona();
        });
        
        document.getElementById('threadPersonaClose').addEventListener('click', () => {
            this.hideModal('threadPersonaModal');
        });
        
        document.getElementById('threadPersonaCancel').addEventListener('click', () => {
            this.hideModal('threadPersonaModal');
        });
        
        document.getElementById('threadPersonaSave').addEventListener('click', () => {
            this.saveThreadPersona();
        });
        
        document.getElementById('threadPersonaClear').addEventListener('click', () => {
            this.clearThreadPersona();
        });
        
        // Character count for persona textarea
        document.getElementById('threadPersonaTextarea').addEventListener('input', (e) => {
            this.updatePersonaCharCount(e.target.value);
        });
        
        // Mobile Menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            this.toggleMobileMenu();
        });
        
        // Sidebar Overlay
        document.getElementById('sidebarOverlay').addEventListener('click', () => {
            this.closeMobileMenu();
        });
        
        // Thread Search
        const threadSearch = document.getElementById('threadSearch');
        const searchClearBtn = document.getElementById('searchClearBtn');
        
        threadSearch.addEventListener('input', (e) => {
            this.searchThreads(e.target.value);
            this.updateSearchClearButton(e.target.value);
        });
        
        threadSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.selectFirstSearchResult();
            } else if (e.key === 'Escape') {
                this.clearSearch();
                threadSearch.blur();
            }
        });
        
        searchClearBtn.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // Edit Message Modal
        document.getElementById('editMessageClose').addEventListener('click', () => {
            this.hideModal('editMessageModal');
        });
        
        document.getElementById('editMessageCancel').addEventListener('click', () => {
            this.hideModal('editMessageModal');
        });
        
        document.getElementById('editMessageSave').addEventListener('click', () => {
            this.saveEditedMessage();
        });
        
        // Edit message textarea keyboard shortcuts
        document.getElementById('editMessageTextarea').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveEditedMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideModal('editMessageModal');
            }
        });
        
        // Branch Message Modal
        document.getElementById('branchMessageClose').addEventListener('click', () => {
            this.hideModal('branchMessageModal');
        });
        
        document.getElementById('branchMessageCancel').addEventListener('click', () => {
            this.hideModal('branchMessageModal');
        });
        
        document.getElementById('branchMessageSave').addEventListener('click', () => {
            this.saveBranchMessage();
        });
        
        // Branch message textarea keyboard shortcuts
        document.getElementById('branchMessageTextarea').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveBranchMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideModal('branchMessageModal');
            }
        });
        
        
        document.getElementById('attachFileBtn').addEventListener('click', () => {
            window.fileManager.show();
        });
        
        // Modal Close Events
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }
    
    async loadThreads() {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php?action=list`);
            const data = await response.json();
            
            if (data.success) {
                this.allThreads = data.threads;
                this.filteredThreads = [...data.threads];
                this.renderThreads(this.filteredThreads);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
        }
    }
    
    renderThreads(threads) {
        const threadList = document.getElementById('threadList');
        threadList.innerHTML = '';
        
        threads.forEach(thread => {
            const threadElement = document.createElement('div');
            threadElement.className = 'thread-item';
            threadElement.dataset.threadId = thread.id;
            
            threadElement.innerHTML = `
                <div class="thread-content" data-thread-id="${thread.id}">
                    <div class="thread-name" data-thread-name="${this.escapeHtml(thread.name)}">${this.escapeHtml(thread.name)}</div>
                    <div class="thread-time">${this.formatDate(thread.updated_at)}</div>
                </div>
                <div class="thread-actions">
                    <button class="thread-edit-btn" data-thread-id="${thread.id}" title="編集">✏️</button>
                    <button class="thread-delete-btn" data-thread-id="${thread.id}" title="削除">🗑️</button>
                </div>
            `;
            
            // Thread content click event
            const threadContent = threadElement.querySelector('.thread-content');
            threadContent.addEventListener('click', () => {
                this.selectThread(thread.id, thread.name);
            });
            
            // Add touchstart event for better mobile responsiveness
            threadContent.addEventListener('touchstart', (e) => {
                // Prevent hover effects on touch devices
                e.preventDefault();
            }, { passive: false });
            
            threadContent.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.selectThread(thread.id, thread.name);
            }, { passive: false });
            
            // Edit button event
            const editBtn = threadElement.querySelector('.thread-edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editThreadName(thread.id, thread.name);
            });
            
            // Delete button event
            const deleteBtn = threadElement.querySelector('.thread-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteThread(thread.id, thread.name);
            });
            
            threadList.appendChild(threadElement);
        });
    }
    
    // Thread Search Methods
    searchThreads(query) {
        if (!query.trim()) {
            this.filteredThreads = [...this.allThreads];
            this.updateSearchResultsInfo('');
        } else {
            const normalizedQuery = query.toLowerCase().trim();
            this.filteredThreads = this.allThreads.filter(thread => 
                thread.name.toLowerCase().includes(normalizedQuery)
            );
            this.updateSearchResultsInfo(query);
        }
        this.renderThreads(this.filteredThreads);
    }
    
    updateSearchClearButton(value) {
        const clearBtn = document.getElementById('searchClearBtn');
        if (value.trim()) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    }
    
    updateSearchResultsInfo(query) {
        const resultsInfo = document.getElementById('searchResultsInfo');
        if (!query.trim()) {
            resultsInfo.style.display = 'none';
            return;
        }
        
        const count = this.filteredThreads.length;
        const totalCount = this.allThreads.length;
        
        if (count === 0) {
            resultsInfo.textContent = '該当するスレッドが見つかりません';
            resultsInfo.style.color = 'var(--error-color)';
        } else if (count === totalCount) {
            resultsInfo.textContent = `全 ${totalCount} 件のスレッド`;
            resultsInfo.style.color = 'var(--text-secondary)';
        } else {
            resultsInfo.textContent = `${count} / ${totalCount} 件のスレッド`;
            resultsInfo.style.color = 'var(--text-secondary)';
        }
        resultsInfo.style.display = 'block';
    }
    
    clearSearch() {
        const searchInput = document.getElementById('threadSearch');
        searchInput.value = '';
        this.filteredThreads = [...this.allThreads];
        this.renderThreads(this.filteredThreads);
        this.updateSearchClearButton('');
        this.updateSearchResultsInfo('');
    }
    
    selectFirstSearchResult() {
        if (this.filteredThreads.length > 0) {
            const firstThread = this.filteredThreads[0];
            this.selectThread(firstThread.id, firstThread.name);
        }
    }
    
    selectThread(threadId, threadName) {
        this.currentThread = threadId;
        this.currentMessageId = null; // Reset message ID when switching threads
        this.currentThreadMessages = []; // Reset message cache when switching threads
        
        // Close mobile menu if open
        if (window.innerWidth <= 768) {
            this.closeMobileMenu();
        }
        
        // Update UI
        document.getElementById('currentThreadName').textContent = threadName;
        document.querySelectorAll('.thread-item').forEach(item => {
            item.classList.toggle('active', item.dataset.threadId == threadId);
        });
        
        this.loadMessages();
        this.loadTree();
        this.loadThreadPersonaState();
    }
    
    async loadMessages() {
        if (!this.currentThread) return;
        
        try {
            console.log('Loading messages for thread:', this.currentThread);
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=history&thread_id=${this.currentThread}`);
            console.log('Response status:', response.status);
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                console.log('Processing tree data...');
                
                // Store the complete message tree for copy functionality
                this.currentThreadMessages = data.tree;
                console.log('Stored currentThreadMessages:', this.currentThreadMessages.length, 'messages');
                
                // Get the path for current message instead of rendering entire tree
                const messagePath = this.getMessagePath(data.tree);
                console.log('Message path:', messagePath);
                
                this.renderMessagePath(messagePath);
                
                // Set currentMessageId to the last message in the displayed path
                if (messagePath && messagePath.length > 0) {
                    this.currentMessageId = messagePath[messagePath.length - 1].id;
                    console.log('Set currentMessageId to:', this.currentMessageId);
                }
            } else {
                console.error('Data success is false:', data);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            console.error('Error details:', error.stack);
        }
    }
    
    renderMessages(tree, container = null) {
        if (!container) {
            container = document.getElementById('messagesContainer');
            container.innerHTML = '';
        }
        
        let userMessageIndex = 0;
        
        const renderRecursively = (messages) => {
            messages.forEach(message => {
                if (message.role === 'user') {
                    userMessageIndex++;
                }
                
                const messageElement = this.createMessageElement(message, userMessageIndex);
                container.appendChild(messageElement);
                
                // Render children if they exist
                if (message.children && message.children.length > 0) {
                    renderRecursively(message.children);
                }
            });
        };
        
        renderRecursively(tree);
        container.scrollTop = container.scrollHeight;
    }
    
    getMessagePath(tree) {
        // If no current message selected, find the deepest message path
        if (!this.currentMessageId) {
            return this.findDeepestPath(tree);
        }
        
        // Find path to currentMessageId
        const path = [];
        this.findMessagePath(tree, this.currentMessageId, path);
        
        // If clicked message has children, include the first child (AI response)
        const clickedMessage = this.findMessageById(tree, this.currentMessageId);
        if (clickedMessage && clickedMessage.children && clickedMessage.children.length > 0) {
            path.push(clickedMessage.children[0]);
        }
        
        return path;
    }
    
    findDeepestPath(tree) {
        let deepestPath = [];
        
        const traverse = (nodes, currentPath) => {
            for (const node of nodes) {
                const newPath = [...currentPath, node];
                
                if (!node.children || node.children.length === 0) {
                    // Leaf node - check if this path is deeper
                    if (newPath.length > deepestPath.length) {
                        deepestPath = newPath;
                    }
                } else {
                    // Continue traversing
                    traverse(node.children, newPath);
                }
            }
        };
        
        traverse(tree, []);
        return deepestPath;
    }
    
    findMessagePath(tree, targetId, currentPath) {
        for (const node of tree) {
            const newPath = [...currentPath, node];
            
            if (node.id == targetId) {
                // Found the target - replace currentPath with the found path
                currentPath.length = 0;
                currentPath.push(...newPath);
                return true;
            }
            
            if (node.children && node.children.length > 0) {
                if (this.findMessagePath(node.children, targetId, newPath)) {
                    // Found in children - update currentPath with the result
                    currentPath.length = 0;
                    currentPath.push(...newPath);
                    return true;
                }
            }
        }
        return false;
    }
    
    findMessageById(tree, targetId) {
        for (const node of tree) {
            if (node.id == targetId) {
                return node;
            }
            
            if (node.children && node.children.length > 0) {
                const found = this.findMessageById(node.children, targetId);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
    
    async renderMessagePath(messagePath) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        if (!messagePath || messagePath.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>ChotGPTへようこそ</h3>
                    <p>新しいチャットを開始するか、既存のスレッドを選択してください。</p>
                </div>
            `;
            return;
        }
        
        let userMessageIndex = 0;
        
        for (const message of messagePath) {
            if (message.role === 'user') {
                userMessageIndex++;
            }
            
            const messageElement = await this.createMessageElement(message, userMessageIndex);
            container.appendChild(messageElement);
        }
        
        container.scrollTop = container.scrollHeight;
    }
    
    async createMessageElement(message, userMessageIndex = 0) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        messageDiv.dataset.messageId = message.id;
        
        const avatar = message.role === 'user' ? 'U' : 'AI';
        const avatarClass = message.role === 'user' ? 'user' : 'assistant';
        
        // アクションボタンの設定
        let actionsHTML = '';
        if (message.role === 'user') {
            // ユーザーメッセージ: 編集・分岐・削除ボタン
            const showBranchButton = userMessageIndex > 1;
            actionsHTML = `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="app.editMessage(${message.id})" title="編集">✏️</button>
                    ${showBranchButton ? `<button class="message-action-btn" onclick="app.branchMessage(${message.id})" title="分岐">🌿</button>` : ''}
                    <button class="message-action-btn" onclick="app.deleteMessage(${message.id})" title="削除">🗑️</button>
                </div>
            `;
        } else if (message.role === 'assistant') {
            // AIメッセージ: コピーボタンのみ
            actionsHTML = `
                <div class="message-actions ai-actions">
                    <button class="message-action-btn copy-btn" onclick="app.copyMessage(${message.id})" title="コピー">📋</button>
                </div>
            `;
        }
        
        const formattedContent = await this.formatMessageContent(message.content);
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${formattedContent}</div>
                ${actionsHTML}
            </div>
        `;
        
        // Add double-tap prevention to dynamically created messages
        this.addDoubleTabPreventionToElement(messageDiv);
        
        // Add mobile tap interaction for showing action buttons
        this.addMobileActionInteraction(messageDiv);
        
        return messageDiv;
    }
    
    async formatMessageContent(content) {
        return await this.messageRenderer.renderMessage(content);
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = true;
        messageInput.disabled = true;
        
        this.showLoading();
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    thread_id: this.currentThread,
                    parent_message_id: this.currentMessageId,
                    files: this.selectedFiles,
                    system_prompt: this.settings.systemPrompt,
                    model: this.settings.model,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageInput.value = '';
                this.selectedFiles = [];
                this.updateFileAttachments();
                
                if (!this.currentThread) {
                    this.currentThread = data.thread_id;
                    this.loadThreads();
                }
                
                this.currentMessageId = data.assistant_message_id;
                this.loadMessages();
                this.loadTree();
            } else {
                throw new Error(data.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Send message error:', error);
            alert('Failed to send message: ' + error.message);
        } finally {
            this.hideLoading();
            sendBtn.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    }
    
    newChat() {
        this.currentThread = null;
        this.currentMessageId = null;
        this.selectedFiles = [];
        
        document.getElementById('currentThreadName').textContent = '新しいチャット';
        document.getElementById('messagesContainer').innerHTML = `
            <div class="welcome-message">
                <h3>新しいチャットを開始</h3>
                <p>メッセージを入力してチャットを始めてください。</p>
            </div>
        `;
        
        document.querySelectorAll('.thread-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.updateFileAttachments();
        this.hideTreeView();
    }
    
    async editMessage(messageId) {
        // Get current message content
        try {
            const message = await this.getMessage(messageId);
            if (message) {
                this.currentEditMessageId = messageId;
                document.getElementById('editMessageTextarea').value = message.content;
                this.showModal('editMessageModal');
                
                // Focus on textarea after modal is shown
                setTimeout(() => {
                    const textarea = document.getElementById('editMessageTextarea');
                    textarea.focus();
                    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
                }, 100);
            }
        } catch (error) {
            console.error('Get message error:', error);
            alert('メッセージの取得に失敗しました');
        }
    }
    
    async getMessage(messageId) {
        // Helper method to get message by ID
        const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=get&message_id=${messageId}`);
        const data = await response.json();
        return data.success ? data.message : null;
    }
    
    async saveEditedMessage() {
        const newContent = document.getElementById('editMessageTextarea').value.trim();
        
        if (!newContent) {
            alert('メッセージ内容を入力してください');
            return;
        }
        
        if (!this.currentEditMessageId) {
            alert('エラー: 編集対象のメッセージが見つかりません');
            return;
        }
        
        // Show loading spinner
        document.getElementById('loadingSpinner').style.display = 'flex';
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=edit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message_id: this.currentEditMessageId,
                    content: newContent,
                    system_prompt: this.settings.systemPrompt,
                    model: this.settings.model,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            console.log('Edit message response:', data);
            
            if (data.success) {
                this.hideModal('editMessageModal');
                
                // Check if AI response generation was successful
                if (data.ai_response && data.ai_response.error) {
                    alert('メッセージは更新されましたが、AI応答の生成に失敗しました: ' + data.ai_response.error);
                } else if (data.ai_response) {
                    console.log('AI response generated:', data.ai_response);
                }
                
                // Reload messages and tree
                this.loadMessages();
                this.loadTree();
                this.currentEditMessageId = null;
            } else {
                alert('メッセージの更新に失敗しました: ' + (data.error || data.message || '不明なエラー'));
            }
        } catch (error) {
            console.error('Edit message error:', error);
            alert('メッセージの更新中にエラーが発生しました');
        } finally {
            // Hide loading spinner
            document.getElementById('loadingSpinner').style.display = 'none';
        }
    }
    
    async branchMessage(messageId) {
        this.currentBranchParentId = messageId;
        document.getElementById('branchMessageTextarea').value = '';
        this.showModal('branchMessageModal');
        
        // Focus on textarea after modal is shown
        setTimeout(() => {
            const textarea = document.getElementById('branchMessageTextarea');
            textarea.focus();
        }, 100);
    }
    
    async saveBranchMessage() {
        const content = document.getElementById('branchMessageTextarea').value.trim();
        
        if (!content) {
            alert('分岐メッセージ内容を入力してください');
            return;
        }
        
        if (!this.currentBranchParentId) {
            alert('エラー: 分岐元のメッセージが見つかりません');
            return;
        }
        
        // Show loading spinner
        document.getElementById('loadingSpinner').style.display = 'flex';
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=branch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clicked_message_id: this.currentBranchParentId,
                    content: content,
                    system_prompt: this.settings.systemPrompt,
                    model: this.settings.model,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            console.log('Branch message response:', data);
            
            if (data.success) {
                this.hideModal('branchMessageModal');
                
                // Update current message to the AI response (for proper path display)
                this.currentMessageId = data.ai_response && data.ai_response.message_id ? data.ai_response.message_id : data.user_message_id;
                
                // Check if AI response generation was successful
                if (data.ai_response && data.ai_response.error) {
                    alert('分岐は作成されましたが、AI応答の生成に失敗しました: ' + data.ai_response.error);
                } else if (data.ai_response) {
                    console.log('AI response generated for branch:', data.ai_response);
                }
                
                // Reload messages and tree
                this.loadMessages();
                this.loadTree();
                this.currentBranchParentId = null;
            } else {
                alert('分岐の作成に失敗しました: ' + (data.error || data.message || '不明なエラー'));
            }
        } catch (error) {
            console.error('Branch message error:', error);
            alert('分岐の作成中にエラーが発生しました');
        } finally {
            // Hide loading spinner
            document.getElementById('loadingSpinner').style.display = 'none';
        }
    }
    
    async deleteMessage(messageId) {
        if (confirm('このメッセージを削除しますか？')) {
            try {
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message_id: messageId,
                        csrf_token: window.csrfToken
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    this.loadMessages();
                    this.loadTree();
                }
            } catch (error) {
                console.error('Delete message error:', error);
            }
        }
    }
    
    toggleTreeView() {
        const treePanel = document.getElementById('treePanel');
        const toggleBtn = document.getElementById('treeToggleBtn');
        
        if (treePanel.style.display === 'none' || !treePanel.style.display) {
            this.showTreeView();
        } else {
            this.hideTreeView();
        }
    }
    
    showTreeView() {
        const treePanel = document.getElementById('treePanel');
        const toggleBtn = document.getElementById('treeToggleBtn');
        
        treePanel.style.display = 'block';
        toggleBtn.classList.add('active');
        this.loadTree();
    }
    
    hideTreeView() {
        const treePanel = document.getElementById('treePanel');
        const toggleBtn = document.getElementById('treeToggleBtn');
        
        treePanel.style.display = 'none';
        toggleBtn.classList.remove('active');
    }
    
    async loadTree() {
        if (!this.currentThread) return;
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php?action=tree&id=${this.currentThread}`);
            const data = await response.json();
            
            if (data.success) {
                window.treeViewer.render(data.tree);
            }
        } catch (error) {
            console.error('Failed to load tree:', error);
        }
    }
    
    updateFileAttachments() {
        const attachmentsContainer = document.getElementById('fileAttachments');
        
        if (this.selectedFiles.length === 0) {
            attachmentsContainer.style.display = 'none';
            return;
        }
        
        attachmentsContainer.style.display = 'block';
        attachmentsContainer.innerHTML = '';
        
        this.selectedFiles.forEach(fileId => {
            // Get file info and create attachment element
            this.createAttachmentElement(fileId, attachmentsContainer);
        });
    }
    
    async createAttachmentElement(fileId, container) {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/files.php?action=get&id=${fileId}`);
            const data = await response.json();
            
            if (data.success) {
                const file = data.file;
                const attachmentDiv = document.createElement('div');
                attachmentDiv.className = 'attachment-item';
                attachmentDiv.innerHTML = `
                    <span>📎 ${this.escapeHtml(file.original_name)}</span>
                    <button class="attachment-remove" onclick="app.removeAttachment(${fileId})">×</button>
                `;
                container.appendChild(attachmentDiv);
            }
        } catch (error) {
            console.error('Failed to load file info:', error);
        }
    }
    
    removeAttachment(fileId) {
        this.selectedFiles = this.selectedFiles.filter(id => id !== fileId);
        this.updateFileAttachments();
    }
    
    showSettings() {
        document.getElementById('modelSelect').value = this.settings.model;
        document.getElementById('systemPrompt').value = this.settings.systemPrompt;
        document.querySelector(`input[name="theme"][value="${this.settings.theme}"]`).checked = true;
        
        this.showModal('settingsModal');
    }
    
    async saveSettings() {
        this.settings.model = document.getElementById('modelSelect').value;
        this.settings.systemPrompt = document.getElementById('systemPrompt').value;
        this.settings.theme = document.querySelector('input[name="theme"]:checked').value;
        
        this.applyTheme();
        await this.storeSettings();
        this.hideModal('settingsModal');
    }
    
    async loadSettings() {
        try {
            // Load settings from server
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/settings.php?action=get`);
            const data = await response.json();
            
            if (data.success) {
                this.settings = { ...this.settings, ...data.settings };
            } else {
                console.error('Failed to load settings:', data.error);
                // Use default settings if server fails
                this.settings = {
                    model: 'gpt-4o-mini',
                    systemPrompt: 'You are a helpful assistant.',
                    theme: 'dark'
                };
            }
        } catch (error) {
            console.error('Settings load error:', error);
            // Use default settings on error
            this.settings = {
                model: 'gpt-4o-mini',
                systemPrompt: 'You are a helpful assistant.',
                theme: 'dark'
            };
        }
        
        this.applyTheme();
    }
    
    async storeSettings() {
        try {
            // Save to server
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/settings.php?action=save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: this.settings,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to save settings');
            }
            
            console.log('Settings saved to server');
        } catch (error) {
            console.error('Settings save error:', error);
            alert('設定の保存中にエラーが発生しました。サーバーに接続できません。');
            throw error; // Re-throw to prevent silent failures
        }
    }
    
    async showThreadPersona() {
        if (!this.currentThread) {
            alert('スレッドを選択してください');
            return;
        }
        
        try {
            // Load current thread persona
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php?action=get_persona&thread_id=${this.currentThread}`);
            const data = await response.json();
            
            if (data.success) {
                // Update modal content
                document.getElementById('threadPersonaTextarea').value = data.thread_system_prompt || '';
                this.updatePersonaCharCount(data.thread_system_prompt || '');
                this.updatePersonaButtonState(data.thread_system_prompt || '');
                this.showModal('threadPersonaModal');
            } else {
                throw new Error(data.error || 'Failed to load thread persona');
            }
        } catch (error) {
            console.error('Thread persona load error:', error);
            alert('ペルソナ設定の読み込みに失敗しました');
        }
    }
    
    async saveThreadPersona() {
        if (!this.currentThread) {
            alert('スレッドが選択されていません');
            return;
        }
        
        const persona = document.getElementById('threadPersonaTextarea').value.trim();
        
        if (persona.length > 1000) {
            alert('ペルソナは1000文字以内で入力してください');
            return;
        }
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php?action=set_persona`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    thread_id: this.currentThread,
                    thread_system_prompt: persona,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.hideModal('threadPersonaModal');
                this.updatePersonaButtonState(persona);
                
                // Show notification for future messages
                if (persona) {
                    this.showNotification('ペルソナが設定されました。新しいメッセージから適用されます。');
                } else {
                    this.showNotification('ペルソナがクリアされました。');
                }
            } else {
                throw new Error(data.error || 'Failed to save thread persona');
            }
        } catch (error) {
            console.error('Thread persona save error:', error);
            alert('ペルソナの保存に失敗しました');
        }
    }
    
    clearThreadPersona() {
        if (confirm('スレッドペルソナを削除しますか？')) {
            document.getElementById('threadPersonaTextarea').value = '';
            this.updatePersonaCharCount('');
        }
    }
    
    updatePersonaCharCount(text) {
        const count = text.length;
        document.getElementById('personaCharCount').textContent = count;
        
        // Change color based on limit
        const countElement = document.getElementById('personaCharCount');
        if (count > 1000) {
            countElement.style.color = 'var(--error-color, #ff4444)';
        } else if (count > 800) {
            countElement.style.color = 'var(--warning-color, #ffaa00)';
        } else {
            countElement.style.color = '';
        }
    }
    
    updatePersonaButtonState(persona) {
        const personaBtn = document.getElementById('personaBtn');
        if (persona && persona.trim()) {
            personaBtn.classList.add('active');
            personaBtn.title = 'スレッドペルソナ設定済み';
        } else {
            personaBtn.classList.remove('active');
            personaBtn.title = 'スレッドペルソナ設定';
        }
    }
    
    showNotification(message) {
        // Simple notification - can be enhanced later
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color, #007bff);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    async loadThreadPersonaState() {
        if (!this.currentThread) {
            this.updatePersonaButtonState('');
            return;
        }
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php?action=get_persona&thread_id=${this.currentThread}`);
            const data = await response.json();
            
            if (data.success) {
                this.updatePersonaButtonState(data.thread_system_prompt || '');
            }
        } catch (error) {
            console.error('Failed to load thread persona state:', error);
            this.updatePersonaButtonState('');
        }
    }
    
    applyTheme() {
        document.body.className = this.settings.theme + '-theme';
        
        // Mermaidテーマも更新
        if (typeof mermaid !== 'undefined' && this.messageRenderer) {
            this.messageRenderer.initializeMermaidTheme();
            // 既存の図表を再レンダリング（オプション）
            this.reRenderMermaidDiagrams();
        }
    }
    
    reRenderMermaidDiagrams() {
        const diagrams = document.querySelectorAll('.mermaid.mermaid-processed');
        diagrams.forEach(diagram => {
            diagram.classList.remove('mermaid-processed');
        });
        
        // 少し遅延してから再レンダリング
        setTimeout(() => {
            if (this.messageRenderer) {
                this.messageRenderer.processMermaidDiagrams();
            }
        }, 100);
    }
    
    async copyMessage(messageId) {
        try {
            console.log('Copying message:', messageId);
            
            // Step 1: メッセージIDから実際のメッセージデータを取得
            let messageContent = await this.getFullMessageContent(messageId);
            
            if (messageContent) {
                console.log('Retrieved full message content from data, length:', messageContent.length);
                
                // テキストのクリーンアップ
                messageContent = messageContent
                    .replace(/\n\s*\n\s*\n/g, '\n\n') // 3つ以上の改行を2つに
                    .replace(/^\s+|\s+$/g, '') // 前後の空白を削除
                    .trim();
                
                // クリップボードにコピー
                await this.copyTextToClipboard(messageContent);
                this.showCopyFeedback(messageId);
                return;
            }
            
            console.log('Fallback: searching for message element in DOM');
            
            // Step 2: フォールバック - DOM要素から取得
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (!messageElement) {
                console.error('Message element not found for ID:', messageId);
                throw new Error('Message not found');
            }
            
            console.log('Found message element:', messageElement);
            console.log('Element structure:', messageElement.innerHTML);
            
            // ツリーノードの場合は、メインメッセージエリアから該当メッセージを探す
            if (messageElement.classList.contains('tree-node')) {
                console.log('This is a tree node, searching for actual message in main area...');
                const mainMessageElement = document.querySelector(`#messagesContainer [data-message-id="${messageId}"]`);
                if (mainMessageElement) {
                    console.log('Found corresponding message in main area');
                    return this.copyFromDOMElement(mainMessageElement, messageId);
                } else {
                    console.log('No corresponding message found in main area, using stored data');
                    throw new Error('Unable to find full message content');
                }
            }
            
            // 通常のメッセージ要素の場合
            return this.copyFromDOMElement(messageElement, messageId);
            
        } catch (error) {
            console.error('Copy failed:', error);
            console.error('Error stack:', error.stack);
            alert(`コピーに失敗しました: ${error.message}`);
        }
    }
    
    async getFullMessageContent(messageId) {
        try {
            // キャッシュされたメッセージからコンテンツを取得
            const allMessages = this.getAllStoredMessages();
            const message = this.findMessageInTree(allMessages, messageId);
            
            if (message && message.content) {
                console.log('Found message in stored data:', message.content.substring(0, 100) + '...');
                return message.content;
            }
            
            console.log('Message not found in stored data, will use DOM fallback');
            return null;
        } catch (error) {
            console.error('Error getting full message content:', error);
            return null;
        }
    }
    
    getAllStoredMessages() {
        // 現在表示されているメッセージツリーから全メッセージを取得
        if (this.currentThreadMessages) {
            return this.currentThreadMessages;
        }
        
        // フォールバック: APIから取得（キャッシュがない場合）
        return [];
    }
    
    findMessageInTree(messages, targetId) {
        for (const message of messages) {
            if (message.id == targetId) {
                return message;
            }
            if (message.children && message.children.length > 0) {
                const found = this.findMessageInTree(message.children, targetId);
                if (found) return found;
            }
        }
        return null;
    }
    
    async copyTextToClipboard(text) {
        console.log('Copying text to clipboard, length:', text.length);
        console.log('First 200 chars:', text.substring(0, 200));
        console.log('Last 200 chars:', text.substring(text.length - 200));
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            console.log('Using modern clipboard API');
            await navigator.clipboard.writeText(text);
        } else {
            console.log('Using fallback clipboard method');
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (!successful) {
                throw new Error('Fallback copy command failed');
            }
        }
        
        console.log('Copy successful');
    }
    
    async copyFromDOMElement(messageElement, messageId) {
        // より柔軟にメッセージテキスト要素を検索
        let messageTextElement = messageElement.querySelector('.message-text');
        
        // .message-textが見つからない場合、代替要素を探す
        if (!messageTextElement) {
            console.log('Primary .message-text not found, searching alternatives...');
            
            // 代替候補を検索
            messageTextElement = messageElement.querySelector('.message-content') || 
                                messageElement.querySelector('.message') || 
                                messageElement;
            
            console.log('Using alternative element:', messageTextElement);
        }
        
        if (!messageTextElement) {
            console.error('No suitable message text element found');
            throw new Error('Message text element not found');
        }
        
        console.log('Found message text element:', messageTextElement);
        
        let textContent = '';
        
        // 複数の方法でテキスト取得を試行
        try {
            // 最も確実な方法：要素をクローンしてボタン類を削除してからテキスト抽出
            const tempDiv = messageTextElement.cloneNode(true);
            
            // すべてのボタン要素とアクション要素を削除
            const elementsToRemove = tempDiv.querySelectorAll('.copy-btn, .message-action-btn, .message-actions, button');
            elementsToRemove.forEach(el => el.remove());
            
            // 方法1: innerTextを使用（最も正確）
            textContent = tempDiv.innerText || '';
            
            // 方法2: innerTextが空の場合、textContentを試行
            if (!textContent.trim()) {
                console.log('innerText empty, trying textContent...');
                textContent = tempDiv.textContent || '';
            }
            
            // 方法3: それでも空の場合、子要素から再帰的に取得
            if (!textContent.trim()) {
                console.log('textContent empty, trying recursive extraction...');
                
                const extractText = (element) => {
                    let text = '';
                    for (const node of element.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            text += node.textContent;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'BR') {
                                text += '\n';
                            } else if (node.tagName === 'P') {
                                text += extractText(node) + '\n\n';
                            } else if (node.tagName === 'PRE' || node.tagName === 'CODE') {
                                text += node.textContent || node.innerText || '';
                            } else if (node.tagName === 'H1' || node.tagName === 'H2' || node.tagName === 'H3' || 
                                      node.tagName === 'H4' || node.tagName === 'H5' || node.tagName === 'H6') {
                                text += extractText(node) + '\n\n';
                            } else if (node.tagName === 'LI') {
                                text += '• ' + extractText(node) + '\n';
                            } else if (node.tagName === 'TD' || node.tagName === 'TH') {
                                text += extractText(node) + '\t';
                            } else if (node.tagName === 'TR') {
                                text += extractText(node) + '\n';
                            } else {
                                text += extractText(node);
                            }
                        }
                    }
                    return text;
                };
                
                textContent = extractText(tempDiv);
            }
            
            console.log('DOM extracted text content length:', textContent.length);
            console.log('First 200 chars:', textContent.substring(0, 200));
            console.log('Last 200 chars:', textContent.substring(textContent.length - 200));
            
        } catch (extractError) {
            console.error('Text extraction error:', extractError);
            // 緊急時のフォールバック
            textContent = messageTextElement.innerText || messageTextElement.textContent || 'テキスト抽出エラー';
        }
        
        if (!textContent || !textContent.trim()) {
            console.error('No content found to copy');
            throw new Error('No content to copy');
        }
        
        // テキストのクリーンアップ
        textContent = textContent
            .replace(/\n\s*\n\s*\n/g, '\n\n') // 3つ以上の改行を2つに
            .replace(/^\s+|\s+$/g, '') // 前後の空白を削除
            .trim();
        
        console.log('Cleaned DOM text content:', textContent);
        
        // クリップボードにコピー
        await this.copyTextToClipboard(textContent);
        this.showCopyFeedback(messageId);
    }
    
    showCopyFeedback(messageId) {
        const button = document.querySelector(`[data-message-id="${messageId}"] .copy-btn`);
        if (button) {
            const originalText = button.textContent;
            const originalTitle = button.title;
            
            // 一時的に成功表示
            button.textContent = '✅';
            button.title = 'コピーしました！';
            button.classList.add('copy-success');
            
            // 2秒後に元に戻す
            setTimeout(() => {
                button.textContent = originalText;
                button.title = originalTitle;
                button.classList.remove('copy-success');
            }, 2000);
        }
    }
    
    addMobileActionInteraction(messageElement) {
        // モバイルデバイスでのタップでアクションボタン表示制御
        let tapTimeout = null;
        let isActive = false;
        
        const toggleActions = () => {
            // 他のアクティブなメッセージを非アクティブに
            document.querySelectorAll('.message.active').forEach(el => {
                if (el !== messageElement) {
                    el.classList.remove('active');
                }
            });
            
            // このメッセージのアクティブ状態を切り替え
            isActive = !isActive;
            if (isActive) {
                messageElement.classList.add('active');
                
                // 5秒後に自動的に非アクティブに
                if (tapTimeout) {
                    clearTimeout(tapTimeout);
                }
                tapTimeout = setTimeout(() => {
                    messageElement.classList.remove('active');
                    isActive = false;
                }, 5000);
            } else {
                messageElement.classList.remove('active');
                if (tapTimeout) {
                    clearTimeout(tapTimeout);
                    tapTimeout = null;
                }
            }
        };
        
        // タッチデバイスでのタップイベント
        messageElement.addEventListener('touchstart', (e) => {
            // アクションボタンのクリックは除外
            if (e.target.closest('.message-action-btn, .message-actions')) {
                return;
            }
            
            // メッセージ本体をタップした場合のみアクション表示
            if (e.target.closest('.message-content') || e.target.closest('.message-text')) {
                e.preventDefault();
                toggleActions();
            }
        }, { passive: false });
        
        // 非タッチデバイス（PC）でのクリック
        messageElement.addEventListener('click', (e) => {
            // タッチデバイスではないか確認
            if ('ontouchstart' in window) {
                return; // タッチデバイスではクリックイベントを無視
            }
            
            // アクションボタンのクリックは除外
            if (e.target.closest('.message-action-btn, .message-actions')) {
                return;
            }
            
            // メッセージ本体をクリックした場合のみアクション表示
            if (e.target.closest('.message-content') || e.target.closest('.message-text')) {
                toggleActions();
            }
        });
        
        // 外部クリックで非アクティブ化
        document.addEventListener('click', (e) => {
            if (!messageElement.contains(e.target)) {
                messageElement.classList.remove('active');
                isActive = false;
                if (tapTimeout) {
                    clearTimeout(tapTimeout);
                    tapTimeout = null;
                }
            }
        });
    }
    
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }
    
    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }
    
    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'たった今';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '時間前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '日前';
        
        return date.toLocaleDateString('ja-JP');
    }
    
    // Mobile menu methods
    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar.classList.contains('open')) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }
    
    openMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    // Prevent double-tap zoom on mobile devices
    preventDoubleTabZoom() {
        let lastTouchEnd = 0;
        
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Additional prevention for specific elements
        const elements = document.querySelectorAll('.message, .message-content, .message-text, .messages-container');
        elements.forEach(element => {
            let tapCount = 0;
            let tapTimeout;
            
            element.addEventListener('touchstart', function(event) {
                tapCount++;
                if (tapCount === 1) {
                    tapTimeout = setTimeout(function() {
                        tapCount = 0;
                    }, 300);
                } else if (tapCount === 2) {
                    clearTimeout(tapTimeout);
                    event.preventDefault();
                    event.stopPropagation();
                    tapCount = 0;
                }
            }, { passive: false });
        });
    }
    
    // Helper method to add double-tap prevention to a specific element
    addDoubleTabPreventionToElement(element) {
        let tapCount = 0;
        let tapTimeout;
        
        element.addEventListener('touchstart', function(event) {
            tapCount++;
            if (tapCount === 1) {
                tapTimeout = setTimeout(function() {
                    tapCount = 0;
                }, 300);
            } else if (tapCount === 2) {
                clearTimeout(tapTimeout);
                event.preventDefault();
                event.stopPropagation();
                tapCount = 0;
            }
        }, { passive: false });
    }

    // Thread management methods
    async editThreadName(threadId, currentName) {
        const newName = prompt('スレッド名を編集:', currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            try {
                const formData = new FormData();
                formData.append('action', 'update');
                formData.append('thread_id', threadId);
                formData.append('name', newName.trim());
                formData.append('csrf_token', window.csrfToken);
                
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                console.log('Update thread response:', data);
                if (data.success) {
                    // Update current thread name if this is the active thread
                    if (this.currentThread == threadId) {
                        document.getElementById('currentThreadName').textContent = newName.trim();
                    }
                    // Reload threads to reflect the change
                    this.loadThreads();
                } else {
                    console.error('Update thread failed:', data);
                    alert('スレッド名の更新に失敗しました: ' + (data.error || data.message || '不明なエラー'));
                }
            } catch (error) {
                console.error('Edit thread error:', error);
                alert('スレッド名の更新中にエラーが発生しました');
            }
        }
    }
    
    async deleteThread(threadId, threadName) {
        if (confirm(`スレッド「${threadName}」を削除しますか？この操作は取り消せません。`)) {
            try {
                const formData = new FormData();
                formData.append('action', 'delete');
                formData.append('thread_id', threadId);
                formData.append('csrf_token', window.csrfToken);
                
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/threads.php`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                console.log('Delete thread response:', data);
                if (data.success) {
                    // If this was the active thread, reset the view
                    if (this.currentThread == threadId) {
                        this.currentThread = null;
                        this.currentMessageId = null;
                        document.getElementById('currentThreadName').textContent = 'チャットを選択してください';
                        document.getElementById('messagesContainer').innerHTML = `
                            <div class="welcome-message">
                                <h3>ChotGPTへようこそ</h3>
                                <p>新しいチャットを開始するか、既存のスレッドを選択してください。</p>
                            </div>
                        `;
                        this.hideTreeView();
                    }
                    // Reload threads to reflect the change
                    this.loadThreads();
                } else {
                    console.error('Delete thread failed:', data);
                    alert('スレッドの削除に失敗しました: ' + (data.error || data.message || '不明なエラー'));
                }
            } catch (error) {
                console.error('Delete thread error:', error);
                alert('スレッドの削除中にエラーが発生しました');
            }
        }
    }
}

// Initialize the application
const app = new ChotGPTApp();