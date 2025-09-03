<?php

class Logger {
    private $config;
    private $logDir;
    
    public function __construct($config) {
        $this->config = $config;
        $this->logDir = __DIR__ . '/../logs';
        
        if (!is_dir($this->logDir)) {
            mkdir($this->logDir, 0755, true);
        }
    }
    
    public function log($level, $message, $context = []) {
        if (!$this->shouldLog($level)) {
            return;
        }
        
        $logFile = $this->logDir . '/' . date('Y-m') . '.log';
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = empty($context) ? '' : ' ' . json_encode($context);
        $logLine = "[{$timestamp}] [{$level}] {$message}{$contextStr}" . PHP_EOL;
        
        file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
        
        if ($level === 'error') {
            error_log($logLine);
        }
    }
    
    public function debug($message, $context = []) {
        $this->log('debug', $message, $context);
    }
    
    public function info($message, $context = []) {
        $this->log('info', $message, $context);
    }
    
    public function warning($message, $context = []) {
        $this->log('warning', $message, $context);
    }
    
    public function error($message, $context = []) {
        $this->log('error', $message, $context);
    }
    
    private function shouldLog($level) {
        if (!$this->config['system']['debug'] && $level === 'debug') {
            return false;
        }
        
        $levels = ['debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3];
        $currentLevel = $levels[$this->config['system']['log_level']] ?? 1;
        $messageLevel = $levels[$level] ?? 1;
        
        return $messageLevel >= $currentLevel;
    }
    
    public function rotateOldLogs() {
        $files = glob($this->logDir . '/*.log');
        $cutoffDate = time() - ($this->config['system']['log_rotation_days'] * 24 * 60 * 60);
        
        foreach ($files as $file) {
            if (filemtime($file) < $cutoffDate) {
                $archiveName = $file . '.' . date('Y-m-d', filemtime($file)) . '.archived';
                rename($file, $archiveName);
                gzip($archiveName);
                unlink($archiveName);
            }
        }
    }
}