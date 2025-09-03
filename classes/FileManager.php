<?php

class FileManager {
    private $db;
    private $logger;
    private $config;
    private $uploadDir;
    
    public function __construct($db, $logger, $config) {
        $this->db = $db;
        $this->logger = $logger;
        $this->config = $config;
        $this->uploadDir = $config['upload']['storage_path'];
        
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }
    }
    
    public function uploadFile($fileData) {
        if (!$this->validateFile($fileData)) {
            throw new Exception('Invalid file');
        }
        
        $originalName = $fileData['name'];
        $tempPath = $fileData['tmp_name'];
        $fileSize = $fileData['size'];
        
        try {
            // Convert to markdown directly from temporary file
            $content = $this->convertToMarkdown($tempPath, $originalName);
            $metadata = $this->extractMetadata($originalName, $fileSize);
            
            // Store only the markdown content in database - no physical file storage
            $sql = "INSERT INTO files (original_name, stored_name, content_markdown, metadata, file_size) 
                    VALUES (?, ?, ?, ?, ?)";
            
            // Use empty string for stored name since we're not storing physical files
            $this->db->query($sql, [
                $originalName,
                '', // Empty stored name since we're not keeping physical files
                $content,
                json_encode($metadata),
                $fileSize
            ]);
            
            $fileId = $this->db->lastInsertId();
            
            $this->logger->info('File processed and content stored', [
                'file_id' => $fileId,
                'original_name' => $originalName,
                'size' => $fileSize,
                'content_length' => strlen($content)
            ]);
            
            return $fileId;
            
        } catch (Exception $e) {
            throw new Exception('Failed to process file: ' . $e->getMessage());
        }
    }
    
    private function validateFile($fileData) {
        if ($fileData['error'] !== UPLOAD_ERR_OK) {
            return false;
        }
        
        if ($fileData['size'] > $this->config['upload']['max_size']) {
            return false;
        }
        
        $extension = strtolower(pathinfo($fileData['name'], PATHINFO_EXTENSION));
        return in_array($extension, $this->config['upload']['allowed_types']);
    }
    
    private function generateStoredName($originalName) {
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);
        return date('Y-m-d_H-i-s_') . bin2hex(random_bytes(8)) . '.' . $extension;
    }
    
    private function convertToMarkdown($filePath, $originalName) {
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        
        switch ($extension) {
            case 'txt':
            case 'md':
                return file_get_contents($filePath);
                
            case 'pdf':
                return $this->convertPdfToMarkdown($filePath);
                
            case 'docx':
                return $this->convertDocxToMarkdown($filePath);
                
            case 'xlsx':
                return $this->convertXlsxToMarkdown($filePath);
                
            case 'pptx':
                return $this->convertPptxToMarkdown($filePath);
                
            default:
                return "# " . $originalName . "\n\nUnsupported file format for text extraction.";
        }
    }
    
    private function convertPdfToMarkdown($filePath) {
        if (class_exists('\\Smalot\\PdfParser\\Parser')) {
            try {
                $parser = new \Smalot\PdfParser\Parser();
                $pdf = $parser->parseFile($filePath);
                return "# PDF Content\n\n" . $pdf->getText();
            } catch (Exception $e) {
                $this->logger->warning('PDF parsing failed', ['error' => $e->getMessage()]);
            }
        }
        
        return "# PDF File\n\nPDF parsing not available. Install smalot/pdfparser for PDF support.";
    }
    
    private function convertDocxToMarkdown($filePath) {
        if (class_exists('\\PhpOffice\\PhpWord\\IOFactory')) {
            try {
                $phpWord = \PhpOffice\PhpWord\IOFactory::load($filePath);
                $content = "# Word Document\n\n";
                
                foreach ($phpWord->getSections() as $section) {
                    foreach ($section->getElements() as $element) {
                        if (method_exists($element, 'getText')) {
                            $content .= $element->getText() . "\n\n";
                        }
                    }
                }
                
                return $content;
            } catch (Exception $e) {
                $this->logger->warning('DOCX parsing failed', ['error' => $e->getMessage()]);
            }
        }
        
        return "# Word Document\n\nWord document parsing not available. Install phpoffice/phpword for DOCX support.";
    }
    
    private function convertXlsxToMarkdown($filePath) {
        if (class_exists('\\PhpOffice\\PhpSpreadsheet\\IOFactory')) {
            try {
                $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($filePath);
                $content = "# Excel Spreadsheet\n\n";
                
                foreach ($spreadsheet->getWorksheetIterator() as $worksheet) {
                    $content .= "## " . $worksheet->getTitle() . "\n\n";
                    $content .= "| ";
                    
                    $highestRow = $worksheet->getHighestRow();
                    $highestColumn = $worksheet->getHighestColumn();
                    
                    for ($row = 1; $row <= min($highestRow, 100); $row++) {
                        $rowData = [];
                        for ($col = 'A'; $col <= $highestColumn; $col++) {
                            $cellValue = $worksheet->getCell($col . $row)->getCalculatedValue();
                            $rowData[] = $cellValue;
                        }
                        $content .= implode(' | ', $rowData) . " |\n";
                        
                        if ($row === 1) {
                            $content .= "|" . str_repeat(" --- |", count($rowData)) . "\n";
                        }
                    }
                    $content .= "\n";
                }
                
                return $content;
            } catch (Exception $e) {
                $this->logger->warning('XLSX parsing failed', ['error' => $e->getMessage()]);
            }
        }
        
        return "# Excel Spreadsheet\n\nSpreadsheet parsing not available. Install phpoffice/phpspreadsheet for XLSX support.";
    }
    
    private function convertPptxToMarkdown($filePath) {
        return "# PowerPoint Presentation\n\nPowerPoint parsing not yet implemented.";
    }
    
    private function extractMetadata($fileName, $fileSize) {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        return [
            'original_name' => $fileName,
            'extension' => $extension,
            'size' => $fileSize,
            'type' => $this->getFileType($extension),
            'searchable' => in_array($extension, ['txt', 'md', 'pdf', 'docx']),
            'keywords' => $this->extractKeywords($fileName)
        ];
    }
    
    private function getFileType($extension) {
        $types = [
            'pdf' => 'document',
            'docx' => 'document',
            'txt' => 'text',
            'md' => 'markdown',
            'xlsx' => 'spreadsheet',
            'pptx' => 'presentation'
        ];
        
        return $types[$extension] ?? 'unknown';
    }
    
    private function extractKeywords($fileName) {
        $name = pathinfo($fileName, PATHINFO_FILENAME);
        $keywords = preg_split('/[_\-\s]+/', strtolower($name));
        return array_filter($keywords, function($word) {
            return strlen($word) > 2;
        });
    }
    
    public function getFile($fileId) {
        $sql = "SELECT * FROM files WHERE id = ?";
        return $this->db->fetchOne($sql, [$fileId]);
    }
    
    public function getFiles($limit = 50, $offset = 0) {
        $sql = "SELECT * FROM files ORDER BY created_at DESC LIMIT ? OFFSET ?";
        return $this->db->fetchAll($sql, [$limit, $offset]);
    }
    
    public function searchFiles($query, $limit = 20) {
        $sql = "SELECT * FROM files WHERE 
                original_name LIKE ? OR 
                content_markdown LIKE ? OR 
                metadata LIKE ? 
                ORDER BY created_at DESC LIMIT ?";
        
        $searchTerm = "%{$query}%";
        return $this->db->fetchAll($sql, [$searchTerm, $searchTerm, $searchTerm, $limit]);
    }
    
    public function deleteFile($fileId) {
        $file = $this->getFile($fileId);
        if (!$file) {
            throw new Exception('File not found');
        }
        
        // Only delete from database - no physical files to remove
        $sql = "DELETE FROM files WHERE id = ?";
        $this->db->query($sql, [$fileId]);
        
        $this->logger->info('File record deleted', [
            'file_id' => $fileId,
            'original_name' => $file['original_name']
        ]);
    }
    
    public function attachFileToMessage($messageId, $fileId) {
        $sql = "INSERT INTO message_files (message_id, file_id) VALUES (?, ?)";
        $this->db->query($sql, [$messageId, $fileId]);
    }
    
    public function getMessageFiles($messageId) {
        $sql = "SELECT f.* FROM files f 
                JOIN message_files mf ON f.id = mf.file_id 
                WHERE mf.message_id = ?";
        
        return $this->db->fetchAll($sql, [$messageId]);
    }
}