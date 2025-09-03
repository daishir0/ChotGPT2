<?php

class UrlHelper {
    private static $baseUrl = null;
    
    public static function init($config) {
        if (!empty($config['system']['base_url'])) {
            self::$baseUrl = rtrim($config['system']['base_url'], '/');
        } else {
            // 自動検出
            self::$baseUrl = self::detectBaseUrl();
        }
    }
    
    private static function detectBaseUrl() {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        
        // スクリプトのパスから基準URLを推測
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        $pathInfo = pathinfo($scriptName);
        $basePath = $pathInfo['dirname'];
        
        // ルートの場合は空文字に
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
        
        // 相対パスの場合
        if (strpos($baseUrl, 'http') !== 0) {
            return $baseUrl . $apiPath . ($endpoint ? '/' . ltrim($endpoint, '/') : '');
        }
        
        // 絶対URLの場合
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
    
    // JavaScriptで使用するためのURL情報を取得
    public static function getJsConfig() {
        return [
            'baseUrl' => self::getBaseUrl(),
            'apiUrl' => self::getApiUrl(),
            'assetsUrl' => self::getBaseUrl() . '/assets'
        ];
    }
}