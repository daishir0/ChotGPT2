<?php

class UrlHelper {
    private static $baseUrl = null;
    
    public static function init($config) {
        if (!empty($config['system']['base_url'])) {
            self::$baseUrl = rtrim($config['system']['base_url'], '/');
        } else {
            // Auto detection
            self::$baseUrl = self::detectBaseUrl();
        }
    }
    
    private static function detectBaseUrl() {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        
        // Infer base URL from script path
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        $pathInfo = pathinfo($scriptName);
        $basePath = $pathInfo['dirname'];
        
        // Empty string for root
        if ($basePath === '/' || $basePath === '\\') {
            $basePath = '';
        }
        
        return $protocol . $host . $basePath;
    }
    
    public static function getBaseUrl() {
        return self::$baseUrl ?? '';
    }
    
    public static function getApiUrl($endpoint = '') {
        $baseUrl = self::getBaseUrl();
        $apiPath = '/api';
        
        // For relative paths
        if (strpos($baseUrl, 'http') !== 0) {
            return $baseUrl . $apiPath . ($endpoint ? '/' . ltrim($endpoint, '/') : '');
        }
        
        // For absolute URLs
        return $baseUrl . $apiPath . ($endpoint ? '/' . ltrim($endpoint, '/') : '');
    }
    
    public static function getAssetUrl($asset) {
        $baseUrl = self::getBaseUrl();
        return $baseUrl . '/assets/' . ltrim($asset, '/');
    }
    
    public static function getAppUrl($path = '') {
        $baseUrl = self::getBaseUrl();
        return $baseUrl . ($path ? '/' . ltrim($path, '/') : '');
    }
    
    // Get URL information for JavaScript use
    public static function getJsConfig() {
        return [
            'baseUrl' => self::getBaseUrl(),
            'apiUrl' => self::getApiUrl(),
            'assetsUrl' => self::getBaseUrl() . '/assets'
        ];
    }
}