<?php

class ChatManager {
    private $db;
    private $logger;
    
    public function __construct($db, $logger) {
        $this->db = $db;
        $this->logger = $logger;
    }
    
    public function createThread($name) {
        $sql = "INSERT INTO threads (name) VALUES (?)";
        $this->db->query($sql, [$name]);
        $threadId = $this->db->lastInsertId();
        
        $this->logger->info('Thread created', ['thread_id' => $threadId, 'name' => $name]);
        
        return $threadId;
    }
    
    public function getThreads() {
        $sql = "SELECT * FROM threads ORDER BY updated_at DESC";
        return $this->db->fetchAll($sql);
    }
    
    public function getThread($threadId) {
        $sql = "SELECT * FROM threads WHERE id = ?";
        return $this->db->fetchOne($sql, [$threadId]);
    }
    
    public function deleteThread($threadId) {
        $sql = "DELETE FROM threads WHERE id = ?";
        $this->db->query($sql, [$threadId]);
        
        $this->logger->info('Thread deleted', ['thread_id' => $threadId]);
    }
    
    public function addMessage($threadId, $role, $content, $parentMessageId = null, $isContext = true) {
        $sql = "INSERT INTO messages (thread_id, parent_message_id, content, role, is_context) 
                VALUES (?, ?, ?, ?, ?)";
        
        $this->db->query($sql, [$threadId, $parentMessageId, $content, $role, $isContext ? 1 : 0]);
        $messageId = $this->db->lastInsertId();
        
        $this->logger->info('Message added', [
            'message_id' => $messageId,
            'thread_id' => $threadId,
            'role' => $role,
            'parent_id' => $parentMessageId
        ]);
        
        return $messageId;
    }
    
    public function updateMessage($messageId, $content) {
        $sql = "UPDATE messages SET content = ? WHERE id = ?";
        $this->db->query($sql, [$content, $messageId]);
        
        $this->logger->info('Message updated', ['message_id' => $messageId]);
    }
    
    public function getMessage($messageId) {
        $sql = "SELECT * FROM messages WHERE id = ?";
        return $this->db->fetchOne($sql, [$messageId]);
    }
    
    public function getMessages($threadId) {
        $sql = "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC";
        return $this->db->fetchAll($sql, [$threadId]);
    }
    
    public function getMessageTree($threadId) {
        $messages = $this->getMessages($threadId);
        return $this->buildTree($messages);
    }
    
    private function buildTree($messages, $parentId = null) {
        $tree = [];
        
        foreach ($messages as $message) {
            if ($message['parent_message_id'] == $parentId) {
                $message['children'] = $this->buildTree($messages, $message['id']);
                $tree[] = $message;
            }
        }
        
        return $tree;
    }
    
    public function getContextMessages($messageId) {
        $path = $this->getMessagePath($messageId);
        
        $contextMessages = [];
        foreach ($path as $msg) {
            if ($msg['is_context']) {
                $contextMessages[] = [
                    'role' => $msg['role'],
                    'content' => $msg['content'],
                    'id' => $msg['id']
                ];
            }
        }
        
        return $contextMessages;
    }
    
    public function getMessagePath($messageId) {
        $path = [];
        $currentId = $messageId;
        
        while ($currentId) {
            $message = $this->getMessage($currentId);
            if (!$message) break;
            
            array_unshift($path, $message);
            $currentId = $message['parent_message_id'];
        }
        
        return $path;
    }
    
    public function updateContextStatus($messageId, $isContext) {
        $sql = "UPDATE messages SET is_context = ? WHERE id = ?";
        $this->db->query($sql, [$isContext ? 1 : 0, $messageId]);
        
        $this->logger->info('Message context status updated', [
            'message_id' => $messageId,
            'is_context' => $isContext
        ]);
    }
    
    public function createBranch($parentMessageId, $content, $role = 'user') {
        $parentMessage = $this->getMessage($parentMessageId);
        if (!$parentMessage) {
            throw new Exception('Parent message not found');
        }
        
        return $this->addMessage(
            $parentMessage['thread_id'],
            $role,
            $content,
            $parentMessageId
        );
    }
    
    public function getMessageChildren($messageId) {
        $sql = "SELECT * FROM messages WHERE parent_message_id = ? ORDER BY created_at ASC";
        return $this->db->fetchAll($sql, [$messageId]);
    }
    
    public function deleteMessage($messageId) {
        $sql = "DELETE FROM messages WHERE id = ?";
        $this->db->query($sql, [$messageId]);
        
        $this->logger->info('Message deleted', ['message_id' => $messageId]);
    }
}