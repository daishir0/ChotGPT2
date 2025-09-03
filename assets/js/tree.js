// Tree Visualization Component

class TreeViewer {
    constructor() {
        this.container = document.getElementById('treeContainer');
        this.currentPath = [];
    }
    
    render(tree) {
        this.container.innerHTML = '';
        this.renderNodes(tree, '', true);
    }
    
    renderNodes(nodes, prefix = '', isLast = true, level = 0) {
        if (!nodes || nodes.length === 0) return;
        
        nodes.forEach((node, index) => {
            const isLastChild = index === nodes.length - 1;
            const connector = this.getConnector(prefix, isLastChild, level);
            const nodeElement = this.createNodeElement(node, connector);
            
            this.container.appendChild(nodeElement);
            
            // Recursively render children
            if (node.children && node.children.length > 0) {
                const childPrefix = prefix + (isLastChild ? '    ' : '│   ');
                this.renderNodes(node.children, childPrefix, false, level + 1);
            }
        });
    }
    
    getConnector(prefix, isLast, level) {
        if (level === 0) {
            return isLast ? '└── ' : '├── ';
        }
        return prefix + (isLast ? '└── ' : '├── ');
    }
    
    createNodeElement(node, connector) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = `tree-node ${node.role}`;
        nodeDiv.dataset.messageId = node.id;
        
        if (node.id === app.currentMessageId) {
            nodeDiv.classList.add('current');
        }
        
        const preview = this.getMessagePreview(node.content);
        const timestamp = this.formatTimestamp(node.created_at);
        
        nodeDiv.innerHTML = `
            <span class="tree-connector">${this.escapeHtml(connector)}</span>
            <span class="tree-role">[${node.role === 'user' ? 'U' : 'AI'}]</span>
            <span class="tree-preview">${this.escapeHtml(preview)}</span>
            <span class="tree-time">(${timestamp})</span>
        `;
        
        // Only add click event for user messages
        if (node.role === 'user') {
            nodeDiv.addEventListener('click', () => {
                this.selectNode(node.id);
            });
        }
        
        return nodeDiv;
    }
    
    getMessagePreview(content) {
        const maxLength = 50;
        const preview = content.replace(/\n/g, ' ').trim();
        
        if (preview.length > maxLength) {
            return preview.substring(0, maxLength) + '...';
        }
        
        return preview;
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    selectNode(messageId) {
        // Update current message
        app.currentMessageId = messageId;
        
        // Update visual selection
        this.container.querySelectorAll('.tree-node').forEach(node => {
            node.classList.toggle('current', node.dataset.messageId == messageId);
        });
        
        // Reload chat display with the new message path
        if (typeof app.loadMessages === 'function') {
            app.loadMessages();
        }
        
        // Optionally, scroll to the message in the chat view
        this.scrollToMessage(messageId);
    }
    
    scrollToMessage(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }
    
    expandPath(messageId) {
        // Get the path to the message and expand all nodes in that path
        const path = this.getPathToMessage(messageId);
        path.forEach(nodeId => {
            const nodeElement = document.querySelector(`[data-message-id="${nodeId}"]`);
            if (nodeElement) {
                nodeElement.classList.add('expanded');
            }
        });
    }
    
    getPathToMessage(messageId) {
        // This would traverse the tree to find the path to a specific message
        // Implementation depends on your tree structure
        return [];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Alternative Tree Visualization using Canvas or SVG for better performance
class CanvasTreeViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tree = null;
        this.nodeRadius = 8;
        this.levelHeight = 60;
        this.nodeSpacing = 40;
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        // Handle high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        // Add click handler
        this.canvas.addEventListener('click', (e) => {
            this.handleClick(e);
        });
    }
    
    render(tree) {
        this.tree = tree;
        this.clearCanvas();
        
        if (!tree || tree.length === 0) return;
        
        const layout = this.calculateLayout(tree);
        this.drawTree(layout);
    }
    
    calculateLayout(nodes, level = 0, startX = 0) {
        const layout = [];
        let currentX = startX;
        
        nodes.forEach((node, index) => {
            const nodeLayout = {
                ...node,
                x: currentX + (index * this.nodeSpacing),
                y: level * this.levelHeight + 30,
                level: level
            };
            
            layout.push(nodeLayout);
            
            if (node.children && node.children.length > 0) {
                const childLayout = this.calculateLayout(
                    node.children, 
                    level + 1, 
                    nodeLayout.x - (node.children.length * this.nodeSpacing) / 2
                );
                layout.push(...childLayout);
                
                // Draw connections to children
                childLayout.forEach(child => {
                    if (child.level === level + 1) {
                        this.drawConnection(nodeLayout, child);
                    }
                });
            }
            
            currentX += this.nodeSpacing;
        });
        
        return layout;
    }
    
    drawTree(layout) {
        // Draw connections first
        layout.forEach(node => {
            if (node.children) {
                node.children.forEach(child => {
                    this.drawConnection(node, child);
                });
            }
        });
        
        // Then draw nodes
        layout.forEach(node => {
            this.drawNode(node);
        });
    }
    
    drawNode(node) {
        const { x, y } = node;
        
        // Node circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.nodeRadius, 0, 2 * Math.PI);
        
        // Color based on role and current status
        if (node.id === app.currentMessageId) {
            this.ctx.fillStyle = '#4a9eff';
        } else if (node.role === 'user') {
            this.ctx.fillStyle = '#10b981';
        } else {
            this.ctx.fillStyle = '#6366f1';
        }
        
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Node label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            node.role === 'user' ? 'U' : 'AI', 
            x, 
            y + 4
        );
        
        // Message preview
        const preview = this.getMessagePreview(node.content, 20);
        this.ctx.fillStyle = '#cccccc';
        this.ctx.font = '10px sans-serif';
        this.ctx.fillText(preview, x, y + this.nodeRadius + 15);
    }
    
    drawConnection(parent, child) {
        this.ctx.beginPath();
        this.ctx.moveTo(parent.x, parent.y + this.nodeRadius);
        this.ctx.lineTo(child.x, child.y - this.nodeRadius);
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Find clicked node
        if (this.tree) {
            const layout = this.calculateLayout(this.tree);
            const clickedNode = layout.find(node => {
                const distance = Math.sqrt(
                    Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2)
                );
                return distance <= this.nodeRadius;
            });
            
            if (clickedNode) {
                app.currentMessageId = clickedNode.id;
                this.render(this.tree); // Re-render to update selection
                
                // Reload chat display with the new message path
                if (typeof app.loadMessages === 'function') {
                    app.loadMessages();
                }
            }
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    getMessagePreview(content, maxLength = 20) {
        const preview = content.replace(/\n/g, ' ').trim();
        return preview.length > maxLength 
            ? preview.substring(0, maxLength) + '...'
            : preview;
    }
}

// Initialize tree viewer
const treeViewer = new TreeViewer();
window.treeViewer = treeViewer;