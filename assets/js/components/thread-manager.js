// ChotGPT Thread Manager Component

class ThreadManager {
    constructor(app) {
        this.app = app;
        this.allThreads = []; // Store all threads for search
        this.filteredThreads = []; // Store filtered threads
    }
    
    /**
     * スレッド一覧を読み込み
     */
    async loadThreads() {
        try {
            const data = await this.app.apiClient.listThreads();
            
            if (data.success) {
                this.allThreads = data.threads;
                this.filteredThreads = [...data.threads];
                this.renderThreads(this.filteredThreads);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
        }
    }
    
    /**
     * スレッド一覧をレンダリング
     */
    renderThreads(threads) {
        const threadList = document.getElementById('threadList');
        threadList.innerHTML = '';
        
        threads.forEach(thread => {
            const threadElement = document.createElement('div');
            threadElement.className = 'thread-item';
            threadElement.dataset.threadId = thread.id;
            
            threadElement.innerHTML = `
                <div class="thread-content" data-thread-id="${thread.id}">
                    <div class="thread-name" data-thread-name="${AppUtils.escapeHtml(thread.name)}">${AppUtils.escapeHtml(thread.name)}</div>
                    <div class="thread-time">${AppUtils.formatDate(thread.updated_at)}</div>
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
    
    /**
     * スレッドを選択
     */
    selectThread(threadId, threadName) {
        this.app._currentThread = threadId;
        this.app._currentMessageId = null; // Reset message ID when switching threads
        this.app._currentThreadMessages = []; // Reset message cache when switching threads
        
        // Close mobile menu if open
        if (window.innerWidth <= 768) {
            this.app.mobileHandler.closeMobileMenu();
        }
        
        // Update UI
        document.getElementById('currentThreadName').textContent = threadName;
        document.querySelectorAll('.thread-item').forEach(item => {
            item.classList.toggle('active', item.dataset.threadId == threadId);
        });
        
        this.app.chatManager.loadMessages();
        this.app.uiManager.loadTree();
        this.app.settingsManager.loadThreadPersonaState();
    }
    
    /**
     * スレッド検索
     */
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
    
    /**
     * 検索クリアボタンの表示更新
     */
    updateSearchClearButton(value) {
        const clearBtn = document.getElementById('searchClearBtn');
        if (value.trim()) {
            clearBtn.classList.add('visible');
        } else {
            clearBtn.classList.remove('visible');
        }
    }
    
    /**
     * 検索結果情報更新
     */
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
    
    /**
     * 検索クリア
     */
    clearSearch() {
        const searchInput = document.getElementById('threadSearch');
        searchInput.value = '';
        this.filteredThreads = [...this.allThreads];
        this.renderThreads(this.filteredThreads);
        this.updateSearchClearButton('');
        this.updateSearchResultsInfo('');
    }
    
    /**
     * 最初の検索結果を選択
     */
    selectFirstSearchResult() {
        if (this.filteredThreads.length > 0) {
            const firstThread = this.filteredThreads[0];
            this.selectThread(firstThread.id, firstThread.name);
        }
    }
    
    /**
     * スレッド名を編集
     */
    async editThreadName(threadId, currentName) {
        const newName = prompt('スレッド名を編集:', currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            try {
                const data = await this.app.apiClient.updateThread(threadId, newName.trim());
                console.log('Update thread response:', data);
                if (data.success) {
                    // Update current thread name if this is the active thread
                    if (this.app._currentThread == threadId) {
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
    
    /**
     * スレッドを削除
     */
    async deleteThread(threadId, threadName) {
        if (confirm(`スレッド「${threadName}」を削除しますか？この操作は取り消せません。`)) {
            try {
                const data = await this.app.apiClient.deleteThread(threadId);
                console.log('Delete thread response:', data);
                if (data.success) {
                    // If this was the active thread, reset the view
                    if (this.app._currentThread == threadId) {
                        this.app._currentThread = null;
                        this.app._currentMessageId = null;
                        document.getElementById('currentThreadName').textContent = 'チャットを選択してください';
                        document.getElementById('messagesContainer').innerHTML = `
                            <div class="welcome-message">
                                <h3>ChotGPTへようこそ</h3>
                                <p>新しいチャットを開始するか、既存のスレッドを選択してください。</p>
                            </div>
                        `;
                        this.app.uiManager.hideTreeView();
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

// グローバルに公開
window.ThreadManager = ThreadManager;