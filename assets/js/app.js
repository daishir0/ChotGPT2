// ChotGPT Main Application JavaScript

class ChotGPTApp {
    constructor() {
        this.currentThread = null;
        this.currentMessageId = null;
        this.selectedFiles = [];
        this.settings = {
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a helpful assistant.',
            theme: 'dark'
        };
        
        // URL設定を取得
        this.apiBaseUrl = window.appConfig?.urls?.apiUrl || '/api';
        
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
    
    init() {
        this.loadSettings();
        this.bindEvents();
        this.loadThreads();
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
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
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
        
        // Mobile Menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => {
            this.toggleMobileMenu();
        });
        
        // Sidebar Overlay
        document.getElementById('sidebarOverlay').addEventListener('click', () => {
            this.closeMobileMenu();
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
        
        // File Manager
        document.getElementById('fileManagerBtn').addEventListener('click', () => {
            window.fileManager.show();
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
                this.renderThreads(data.threads);
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
    
    selectThread(threadId, threadName) {
        this.currentThread = threadId;
        
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
    }
    
    async loadMessages() {
        if (!this.currentThread) return;
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=history&thread_id=${this.currentThread}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderMessages(data.tree);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    renderMessages(tree, container = null) {
        if (!container) {
            container = document.getElementById('messagesContainer');
            container.innerHTML = '';
        }
        
        tree.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
            
            // Render children if they exist
            if (message.children && message.children.length > 0) {
                this.renderMessages(message.children, container);
            }
        });
        
        container.scrollTop = container.scrollHeight;
    }
    
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        messageDiv.dataset.messageId = message.id;
        
        const avatar = message.role === 'user' ? 'U' : 'AI';
        const avatarClass = message.role === 'user' ? 'user' : 'assistant';
        
        // アクションボタンはユーザーメッセージにのみ表示
        const actionsHTML = message.role === 'user' ? `
            <div class="message-actions">
                <button class="message-action-btn" onclick="app.editMessage(${message.id})" title="編集">✏️</button>
                <button class="message-action-btn" onclick="app.branchMessage(${message.id})" title="分岐">🌿</button>
                <button class="message-action-btn" onclick="app.deleteMessage(${message.id})" title="削除">🗑️</button>
            </div>
        ` : '';
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessageContent(message.content)}</div>
                ${actionsHTML}
            </div>
        `;
        
        return messageDiv;
    }
    
    formatMessageContent(content) {
        // Simple markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
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
        // Implementation for message branching
        const content = prompt('分岐メッセージを入力してください:');
        if (content !== null && content.trim()) {
            try {
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=branch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        parent_message_id: messageId,
                        content: content,
                        csrf_token: window.csrfToken
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    this.currentMessageId = data.message_id;
                    this.loadMessages();
                    this.loadTree();
                }
            } catch (error) {
                console.error('Branch message error:', error);
            }
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
    
    saveSettings() {
        this.settings.model = document.getElementById('modelSelect').value;
        this.settings.systemPrompt = document.getElementById('systemPrompt').value;
        this.settings.theme = document.querySelector('input[name="theme"]:checked').value;
        
        this.applyTheme();
        this.storeSettings();
        this.hideModal('settingsModal');
    }
    
    loadSettings() {
        const stored = localStorage.getItem('chotgpt-settings');
        if (stored) {
            this.settings = { ...this.settings, ...JSON.parse(stored) };
        }
        this.applyTheme();
    }
    
    storeSettings() {
        localStorage.setItem('chotgpt-settings', JSON.stringify(this.settings));
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