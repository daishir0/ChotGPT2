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
            const threadElement = document.createElement('button');
            threadElement.className = 'thread-item';
            threadElement.dataset.threadId = thread.id;
            
            threadElement.innerHTML = `
                <div class="thread-name">${this.escapeHtml(thread.name)}</div>
                <div class="thread-time">${this.formatDate(thread.updated_at)}</div>
            `;
            
            threadElement.addEventListener('click', () => {
                this.selectThread(thread.id, thread.name);
            });
            
            threadList.appendChild(threadElement);
        });
    }
    
    selectThread(threadId, threadName) {
        this.currentThread = threadId;
        
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
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessageContent(message.content)}</div>
                <div class="message-actions">
                    <button class="message-action-btn" onclick="app.editMessage(${message.id})" title="編集">✏️</button>
                    <button class="message-action-btn" onclick="app.branchMessage(${message.id})" title="分岐">🌿</button>
                    <button class="message-action-btn" onclick="app.deleteMessage(${message.id})" title="削除">🗑️</button>
                </div>
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
        // Implementation for message editing
        const newContent = prompt('メッセージを編集してください:');
        if (newContent !== null && newContent.trim()) {
            try {
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/chat.php?action=edit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message_id: messageId,
                        content: newContent,
                        csrf_token: window.csrfToken
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    this.loadMessages();
                }
            } catch (error) {
                console.error('Edit message error:', error);
            }
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
}

// Initialize the application
const app = new ChotGPTApp();