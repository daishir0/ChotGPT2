<?php

class SettingsManager {
    private $db;
    private $logger;
    
    public function __construct($database, $logger = null) {
        $this->db = $database;
        $this->logger = $logger;
    }
    
    /**
     * 全設定を取得
     */
    public function getAllSettings() {
        try {
            $rows = $this->db->fetchAll("SELECT key, value FROM settings ORDER BY key");
            
            $settings = [];
            foreach ($rows as $row) {
                $settings[$row['key']] = $this->parseValue($row['value']);
            }
            
            return $settings;
        } catch (Exception $e) {
            if ($this->logger) {
                $this->logger->error('Failed to get settings', ['error' => $e->getMessage()]);
            }
            throw $e;
        }
    }
    
    /**
     * 個別設定を取得
     */
    public function getSetting($key, $defaultValue = null) {
        try {
            $row = $this->db->fetchOne("SELECT value FROM settings WHERE key = ?", [$key]);
            
            if ($row) {
                return $this->parseValue($row['value']);
            }
            
            return $defaultValue;
        } catch (Exception $e) {
            if ($this->logger) {
                $this->logger->error('Failed to get setting', ['key' => $key, 'error' => $e->getMessage()]);
            }
            return $defaultValue;
        }
    }
    
    /**
     * 設定を保存
     */
    public function saveSetting($key, $value) {
        try {
            $this->validateSetting($key, $value);
            
            $result = $this->db->query("
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ", [$key, $this->formatValue($value)]);
            
            if ($this->logger) {
                $this->logger->info('Setting saved', ['key' => $key]);
            }
            
            return $result;
        } catch (Exception $e) {
            if ($this->logger) {
                $this->logger->error('Failed to save setting', ['key' => $key, 'error' => $e->getMessage()]);
            }
            throw $e;
        }
    }
    
    /**
     * 複数設定を一括保存
     */
    public function saveSettings($settings) {
        try {
            $this->db->beginTransaction();
            
            foreach ($settings as $key => $value) {
                $this->validateSetting($key, $value);
                
                $this->db->query("
                    INSERT OR REPLACE INTO settings (key, value, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                ", [$key, $this->formatValue($value)]);
            }
            
            $this->db->commit();
            
            if ($this->logger) {
                $this->logger->info('Settings saved', ['keys' => array_keys($settings)]);
            }
            
            return true;
        } catch (Exception $e) {
            $this->db->rollback();
            
            if ($this->logger) {
                $this->logger->error('Failed to save settings', ['error' => $e->getMessage()]);
            }
            throw $e;
        }
    }
    
    /**
     * 設定をデフォルト値にリセット
     */
    public function resetToDefaults() {
        try {
            $defaults = [
                'default_model' => 'gpt-4o-mini',
                'system_prompt' => 'You are a helpful assistant.',
                'theme' => 'dark'
            ];
            
            $this->saveSettings($defaults);
            
            if ($this->logger) {
                $this->logger->info('Settings reset to defaults');
            }
            
            return true;
        } catch (Exception $e) {
            if ($this->logger) {
                $this->logger->error('Failed to reset settings', ['error' => $e->getMessage()]);
            }
            throw $e;
        }
    }
    
    /**
     * 設定値の検証
     */
    private function validateSetting($key, $value) {
        switch ($key) {
            case 'system_prompt':
                if (!is_string($value)) {
                    throw new InvalidArgumentException('System prompt must be a string');
                }
                if (strlen($value) > 10000) {
                    throw new InvalidArgumentException('System prompt is too long (max 10000 characters)');
                }
                break;
                
            case 'default_model':
                $allowedModels = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
                if (!in_array($value, $allowedModels)) {
                    throw new InvalidArgumentException('Invalid model: ' . $value);
                }
                break;
                
            case 'theme':
                $allowedThemes = ['dark', 'light'];
                if (!in_array($value, $allowedThemes)) {
                    throw new InvalidArgumentException('Invalid theme: ' . $value);
                }
                break;
                
            default:
                // Allow other keys with basic validation
                if (!is_string($key) || strlen($key) > 100) {
                    throw new InvalidArgumentException('Invalid setting key');
                }
                break;
        }
    }
    
    /**
     * 値をデータベース保存形式に変換
     */
    private function formatValue($value) {
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        return (string)$value;
    }
    
    /**
     * データベースの値を適切な型に変換
     */
    private function parseValue($value) {
        // Boolean values
        if ($value === '1' || $value === '0') {
            return $value === '1';
        }
        
        // String values
        return $value;
    }
    
    /**
     * 設定が存在するかチェック
     */
    public function hasSettings() {
        try {
            $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM settings");
            
            return $result['count'] > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}