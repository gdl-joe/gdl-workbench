<?php
namespace App\Services;

class GdlScriptService
{
    /**
     * Merges new content into existing content between markers.
     * Uses regex to find and replace existing blocks even with dynamic headers.
     * If not found, inserts at the "tail insertion point" (before Release Notes or END block).
     */
    public function mergeContent(string $existingContent, string $newContent, string $header, string $footer = "! --- END"): string
    {
        // Never create blocks for empty content or technical placeholders
        if ($this->isPlaceholderContent($newContent)) {
            return $existingContent;
        }

        // Strip redundant headers from new content
        $newContent = $this->stripHeaders($newContent);

        // Final check after stripping
        if (empty(trim($newContent))) {
            return $existingContent;
        }

        $headerLine = "\n" . $header . "\n";
        $wrappedContent = $headerLine . trim($newContent) . "\n" . $footer . "\n";

        // Escape special regex characters
        $quotedHeader = preg_quote(trim($header), '/');
        $quotedFooter = preg_quote(trim($footer), '/');

        // Ultra-robust pattern: handles trailing whitespace, Windows/Unix line endings,
        // multiple consecutive duplicate blocks, and headers with trailing content (e.g. timestamps).
        // [^\r\n]* after the header matches "! --- AUTO GENERATED ARRAYS --- last changed: ... !"
        $pattern = '/(?:\r?\n\s*' . $quotedHeader . '[^\r\n]*\r?\n)+.*\r?\n\s*' . $quotedFooter . '[^\r\n]*\r?\n/s';

        // Search in the FULL content (not just "variable" lines after line 4).
        // The old "sacred lines" split caused a bug: when DB scripts start directly with
        // the auto-generated marker block (no 4-line GDL file header), the marker ended
        // up inside the "sacred" section, the pattern search in the "variable" section
        // found nothing, and the block was appended a second time → duplication.
        if (preg_match($pattern, $existingContent, $matches, PREG_OFFSET_CAPTURE)) {
            $firstMatchPos = $matches[0][1];

            // Count and remove ALL occurrences to eliminate any existing duplicates
            preg_match_all($pattern, $existingContent, $allMatches);
            $matchCount = count($allMatches[0]);
            if ($matchCount > 1) {
                error_log("GdlScriptService: Found and removed $matchCount duplicate blocks for header: $header");
            }

            $cleaned = preg_replace($pattern, '', $existingContent);

            // Re-insert the (single) new block at the position of the first match
            return substr($cleaned, 0, $firstMatchPos)
                . $wrappedContent
                . substr($cleaned, $firstMatchPos);
        }

        // Block not present yet – insert before the END marker / release notes
        $insertionPoint = $this->findTailInsertionPoint($existingContent);

        return substr($existingContent, 0, $insertionPoint)
            . $wrappedContent
            . substr($existingContent, $insertionPoint);
    }

    /**
     * Checks if content is just a placeholder like "! Script_2D" or empty.
     */
    public function isPlaceholderContent(string $content): bool
    {
        $trim = trim($content);
        if (empty($trim))
            return true;

        // Matches "! Script_2D", "Script_3D", "  ! Script_MASTER  "
        if (preg_match('/^!*\s*Script_\w+\s*$/i', $trim)) {
            return true;
        }

        return false;
    }

    /**
     * Specifically cleans out the 3-line headers often found in database scripts.
     * Robust against variable whitespace and line lengths.
     */
    public function stripHeaders(string $content): string
    {
        // Regex to match the 3-line header block
        // Line 1: ! --- ! (with any number of dashes)
        // Line 2: ! --- [NAME] - Script --- !
        // Line 3: ! --- ! (with any number of dashes)
        $pattern = '/! -+ !\s*\r?\n! -+ [A-Z0-9\s-]+ -+ !\s*\r?\n! -+ !/i';

        $cleaned = preg_replace($pattern, '', $content);
        return trim($cleaned);
    }

    /**
     * Finds the insertion point before Release Notes or the END block.
     * Priority: Absolute bottom (above END) for RELEASE NOTES.
     */
    private function findTailInsertionPoint(string $content, bool $isForReleaseNotes = false): int
    {
        // 1. Check for ArchiCAD END block (absolute bottom)
        $endPattern = '/\n\r?(! -+\s*E N D\s*-+ !\n\r?){1,2}\n\r?END\s+! -- END/i';
        if (preg_match($endPattern, $content, $matches, PREG_OFFSET_CAPTURE)) {
            return $matches[0][1];
        }

        // Standalone END word
        if (preg_match('/^\s*END\s*(!.*)?$/m', $content, $matches, PREG_OFFSET_CAPTURE)) {
            return $matches[0][1];
        }

        // 2. If NOT for release notes, stay ABOVE existing release notes
        if (!$isForReleaseNotes) {
            if (preg_match('/! --- RELEASE NOTES ---/i', $content, $matches, PREG_OFFSET_CAPTURE)) {
                return $matches[0][1];
            }
        }

        // Absolute bottom
        return strlen($content);
    }

    /**
     * Generates a script header with current timestamp for generated blocks.
     */
    public function generateTimestampedHeader(string $title): string
    {
        $timestamp = date('Y-m-d-H:i');
        // ! --- AUTO GENERATED ARRAYS --- last changed: 2026-02-03-22:56 -------- !
        $line = "! --- $title --- last changed: $timestamp ";
        $rem = 74 - strlen($line) - 2;
        if ($rem > 0)
            $line .= str_repeat('-', $rem);
        return $line . " !";
    }

    /**
     * Adds a release note to the content.
     */
    public function addReleaseNote(string $content, string $note): string
    {
        // Rule 4: Don't add release notes to empty/placeholder scripts
        if ($this->isPlaceholderContent($content)) {
            return $content;
        }

        $timestamp = date('Y-m-d');
        $noteLine = "! $timestamp: $note";

        $header = "! --- RELEASE NOTES ---";
        $footer = "! --- END RELEASE NOTES ---";

        // Split into "sacred" part (lines 1-4) and "variable" part
        $allLines = explode("\n", str_replace("\r\n", "\n", $content));
        $sacredLines = array_slice($allLines, 0, 4);
        $variableLines = array_slice($allLines, 4);

        $sacredContent = implode("\n", $sacredLines);
        $variableContent = implode("\n", $variableLines);

        // Handle newline transition if there is content after sacred lines
        if (count($allLines) > 4) {
            $sacredContent .= "\n";
        }

        // Find existing release notes block in variable part
        $pattern = '/! --- RELEASE NOTES ---.*?! --- END RELEASE NOTES ---/s';

        if (preg_match($pattern, $variableContent, $matches)) {
            $existingBlock = $matches[0];
            // If note already there, don't repeat exactly the same
            if (strpos($existingBlock, $noteLine) !== false) {
                // Ensure it's moves to absolute tail in variable part
                $cleaned = preg_replace($pattern, '', $variableContent);
                $insertionPoint = $this->findTailInsertionPoint($cleaned, true);
                return $sacredContent
                    . substr($cleaned, 0, $insertionPoint)
                    . trim($existingBlock) . "\n\n"
                    . substr($cleaned, $insertionPoint);
            }

            // Insert new note after the header
            $newBlock = str_replace($header, $header . "\n" . $noteLine, $existingBlock);

            // Re-clean and move to tail
            $cleaned = preg_replace($pattern, '', $variableContent);
            $insertionPoint = $this->findTailInsertionPoint($cleaned, true);
            return $sacredContent
                . substr($cleaned, 0, $insertionPoint)
                . trim($newBlock) . "\n\n"
                . substr($cleaned, $insertionPoint);
        } else {
            // Append new block before END
            $insertionPoint = $this->findTailInsertionPoint($variableContent, true);
            return $sacredContent
                . substr($variableContent, 0, $insertionPoint)
                . "\n" . $header . "\n" . $noteLine . "\n" . $footer . "\n\n"
                . substr($variableContent, $insertionPoint);
        }
    }

    /**
     * Checks if the content already contains a script header for the given label.
     */
    public function hasScriptHeader(string $content, string $label): bool
    {
        $name = strtoupper(trim($label));
        $pattern = '/' . preg_quote($name, '/') . '.*S\s*c\s*r\s*i\s*p\s*t/i';
        return preg_match($pattern, $content) === 1;
    }
}
