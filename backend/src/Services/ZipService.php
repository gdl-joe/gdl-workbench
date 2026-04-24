<?php
namespace App\Services;

use ZipArchive;

class ZipService
{
    /**
     * Creates a ZIP archive from an array of files (path => content pairs)
     * 
     * @param array $files [filename => content]
     * @return string|false The binary content of the ZIP or false on failure
     */
    public function createZipFromContents(array $files)
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'gdl_zip');
        $zip = new ZipArchive();

        if ($zip->open($tempFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
            return false;
        }

        foreach ($files as $name => $content) {
            $zip->addFromString($name, $content);
        }

        $zip->close();

        $zipContent = file_get_contents($tempFile);
        unlink($tempFile);

        return $zipContent;
    }
}
