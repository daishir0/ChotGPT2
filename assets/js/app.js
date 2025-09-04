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
    }
    
    renderMessage(content) {
        if (!content) return '';
        
        try {
            // Markdown判定
            if (this.isMarkdownContent(content)) {
                const html = marked ? marked.parse(content) : this.escapeHtml(content);
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
            /^---+$/m              // 水平線
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
    
    renderMessagePath(messagePath) {
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
        
        messagePath.forEach(message => {
            if (message.role === 'user') {
                userMessageIndex++;
            }
            
            const messageElement = this.createMessageElement(message, userMessageIndex);
            container.appendChild(messageElement);
        });
        
        container.scrollTop = container.scrollHeight;
    }
    
    createMessageElement(message, userMessageIndex = 0) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        messageDiv.dataset.messageId = message.id;
        
        const avatar = message.role === 'user' ? 'U' : 'AI';
        const avatarClass = message.role === 'user' ? 'user' : 'assistant';
        
        // アクションボタンはユーザーメッセージにのみ表示
        // ただし、最初のユーザーメッセージ（userMessageIndex === 1）には分岐ボタンを表示しない
        let actionsHTML = '';
        if (message.role === 'user') {
            const showBranchButton = userMessageIndex > 1;
            actionsHTML = `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="app.editMessage(${message.id})" title="編集">✏️</button>
                    ${showBranchButton ? `<button class="message-action-btn" onclick="app.branchMessage(${message.id})" title="分岐">🌿</button>` : ''}
                    <button class="message-action-btn" onclick="app.deleteMessage(${message.id})" title="削除">🗑️</button>
                </div>
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessageContent(message.content)}</div>
                ${actionsHTML}
            </div>
        `;
        
        // Add double-tap prevention to dynamically created messages
        this.addDoubleTabPreventionToElement(messageDiv);
        
        return messageDiv;
    }
    
    formatMessageContent(content) {
        return this.messageRenderer.renderMessage(content);
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