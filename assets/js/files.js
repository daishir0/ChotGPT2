// File Manager Component

class FileManager {
    constructor() {
        this.selectedFiles = [];
        this.allFiles = [];
        this.searchTimeout = null;
        
        // URL設定を取得
        this.apiBaseUrl = window.appConfig?.urls?.apiUrl || '/api';
        
        this.init();
    }
    
    // 認証付きFetch
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
        this.bindEvents();
        this.setupDragAndDrop();
    }
    
    bindEvents() {
        // File Manager Modal
        document.getElementById('fileManagerClose').addEventListener('click', () => {
            this.hide();
        });
        
        // File Upload
        document.getElementById('fileUpload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // File Search
        document.getElementById('fileSearch').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchFiles(e.target.value);
            }, 300);
        });
        
        // Select Files Button
        document.getElementById('selectFilesBtn').addEventListener('click', () => {
            this.selectFiles();
        });
    }
    
    setupDragAndDrop() {
        const uploadArea = document.querySelector('.file-upload-area');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });
        
        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileUpload(files);
        }, false);
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    show() {
        this.loadFiles();
        this.renderSelectedFiles();
        document.getElementById('fileManagerModal').style.display = 'flex';
    }
    
    hide() {
        document.getElementById('fileManagerModal').style.display = 'none';
        document.getElementById('fileSearch').value = '';
    }
    
    async loadFiles() {
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/files.php?action=list&limit=50`);
            const data = await response.json();
            
            if (data.success) {
                this.allFiles = data.files;
                this.renderFileList(this.allFiles);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        }
    }
    
    renderFileList(files) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<p class="text-muted">ファイルがありません</p>';
            return;
        }
        
        files.forEach(file => {
            const fileElement = this.createFileElement(file);
            fileList.appendChild(fileElement);
        });
    }
    
    createFileElement(file) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.dataset.fileId = file.id;
        
        if (this.selectedFiles.includes(file.id)) {
            fileDiv.classList.add('selected');
        }
        
        const icon = this.getFileIcon(file.original_name);
        const size = this.formatFileSize(file.file_size);
        const date = this.formatDate(file.created_at);
        
        fileDiv.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-info">
                <div class="file-name">${this.escapeHtml(file.original_name)}</div>
                <div class="file-meta">${size} • ${date}</div>
            </div>
            <input type="checkbox" class="file-checkbox" ${this.selectedFiles.includes(file.id) ? 'checked' : ''}>
        `;
        
        const checkbox = fileDiv.querySelector('.file-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.toggleFileSelection(file.id, e.target.checked);
        });
        
        fileDiv.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
        
        return fileDiv;
    }
    
    toggleFileSelection(fileId, isSelected) {
        if (isSelected) {
            if (!this.selectedFiles.includes(fileId)) {
                this.selectedFiles.push(fileId);
            }
        } else {
            this.selectedFiles = this.selectedFiles.filter(id => id !== fileId);
        }
        
        // Update visual selection
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.classList.toggle('selected', isSelected);
        }
        
        this.updateSelectButton();
    }
    
    updateSelectButton() {
        const selectBtn = document.getElementById('selectFilesBtn');
        const count = this.selectedFiles.length;
        
        if (count === 0) {
            selectBtn.textContent = 'ファイルを選択';
            selectBtn.disabled = false;
        } else {
            selectBtn.textContent = `${count}個のファイルを添付`;
            selectBtn.disabled = false;
        }
    }
    
    selectFiles() {
        app.selectedFiles = [...this.selectedFiles];
        app.updateFileAttachments();
        this.hide();
    }
    
    renderSelectedFiles() {
        // Clear previous selections
        this.selectedFiles = [...app.selectedFiles];
        this.updateSelectButton();
        
        // Update checkboxes in the file list
        document.querySelectorAll('.file-item').forEach(item => {
            const fileId = parseInt(item.dataset.fileId);
            const checkbox = item.querySelector('.file-checkbox');
            const isSelected = this.selectedFiles.includes(fileId);
            
            checkbox.checked = isSelected;
            item.classList.toggle('selected', isSelected);
        });
    }
    
    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        const formData = new FormData();
        formData.append('csrf_token', window.csrfToken);
        
        // Upload files one by one
        for (const file of files) {
            try {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);
                uploadFormData.append('csrf_token', window.csrfToken);
                
                const response = await this.authenticatedFetch(`${this.apiBaseUrl}/files.php?action=upload`, {
                    method: 'POST',
                    body: uploadFormData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    console.log(`File uploaded: ${file.name}`);
                } else {
                    throw new Error(data.error || 'Upload failed');
                }
            } catch (error) {
                console.error(`Upload failed for ${file.name}:`, error);
                alert(`Upload failed for ${file.name}: ${error.message}`);
            }
        }
        
        // Refresh file list
        this.loadFiles();
    }
    
    async searchFiles(query) {
        if (!query.trim()) {
            this.renderFileList(this.allFiles);
            return;
        }
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/files.php?action=search&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderFileList(data.files);
            }
        } catch (error) {
            console.error('Search failed:', error);
            // Fallback to client-side filtering
            const filtered = this.allFiles.filter(file => 
                file.original_name.toLowerCase().includes(query.toLowerCase())
            );
            this.renderFileList(filtered);
        }
    }
    
    async deleteFile(fileId) {
        if (!confirm('このファイルを削除しますか？')) {
            return;
        }
        
        try {
            const response = await this.authenticatedFetch(`${this.apiBaseUrl}/files.php?action=delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file_id: fileId,
                    csrf_token: window.csrfToken
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Remove from selected files if it was selected
                this.selectedFiles = this.selectedFiles.filter(id => id !== fileId);
                app.selectedFiles = app.selectedFiles.filter(id => id !== fileId);
                app.updateFileAttachments();
                
                // Refresh file list
                this.loadFiles();
            } else {
                throw new Error(data.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Delete failed: ' + error.message);
        }
    }
    
    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        const icons = {
            pdf: '📄',
            doc: '📄',
            docx: '📄',
            txt: '📄',
            md: '📄',
            xls: '📊',
            xlsx: '📊',
            ppt: '📊',
            pptx: '📊',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            zip: '📦',
            rar: '📦'
        };
        
        return icons[extension] || '📄';
    }
    
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) { // Less than 1 day
            return date.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('ja-JP');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize file manager
const fileManager = new FileManager();
window.fileManager = fileManager;