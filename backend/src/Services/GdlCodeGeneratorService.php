<?php
namespace App\Services;

class GdlCodeGeneratorService
{
    /**
     * Generates array definitions for the Master Script
     */
    public function generateMasterArrays(array $parameters): string
    {
        $blocks = [];

        foreach ($parameters as $param) {
            $gdlName = $param['gdl_name'] ?? $param['name'];
            $uiData = $this->getUiData($param);

            if ($uiData && !empty($uiData['type']) && $uiData['type'] === 'VALUES2') {
                $content = $uiData['content'] ?? '';
                if (empty($content))
                    continue;

                $values = array_map('trim', explode("\n", $content));
                $values = array_filter($values, 'strlen');

                if (!empty($values)) {
                    // Use underscore prefix to match the UI Designer JS convention:
                    // ui-designer.js uses `_${param.gdl_name}` → _int_typ_text[], etc.
                    $arrayName = '_' . $gdlName;

                    $block = "DIM {$arrayName}_text[], {$arrayName}_pic[], {$arrayName}_value[]\n";
                    $block .= "i = 1\n";
                    foreach ($values as $idx => $val) {
                        $escapedVal = str_replace('"', '""', $val);
                        $block .= "{$arrayName}_text[i] = \"$escapedVal\" : {$arrayName}_pic[i] = \"\" : {$arrayName}_value[i] = i : i = i + 1\n";
                    }
                    $blocks[] = $block;
                }
            }
        }

        if (empty($blocks))
            return "";

        return implode("\n! ---------------------------------------------------------------------- !\n\n", $blocks) . "\n! ---------------------------------------------------------------------- !\n";
    }

    /**
     * Generates VALUES commands for a single parameter
     */
    public function generateValuesCommands(array $param): array
    {
        $lines = [];
        $gdlName = $param['gdl_name'] ?? $param['name'];
        $uiCode = $this->getUiData($param);

        // 1. Check for manual VALUES type selection from ui_code (JSON)
        if (!empty($uiCode) && isset($uiCode['type'])) {
            $type = $uiCode['type'];
            $content = $uiCode['content'] ?? '';

            if ($type === 'VALUES') {
                // Manual VALUES
                $lines[] = "! VALUES from UI selection";

                $valuesList = [];
                $rawLines = explode("\n", $content);
                foreach ($rawLines as $line) {
                    $line = trim($line);
                    if ($line === '')
                        continue;
                    $valuesList[] = $line;
                }

                if (!empty($valuesList)) {
                    $lines[] = "VALUES \"$gdlName\", " . implode(", ", $valuesList);
                }

            } elseif ($type === 'VALUES2') {
                // Manual VALUES{2} – underscore prefix matches generateMasterArrays and UI Designer JS
                $lines[] = "! VALUES{2} from UI selection";
                $lines[] = "VALUES{2} \"$gdlName\", _" . $gdlName . "_value, _" . $gdlName . "_text";
            }
        }
        // 2. Fallback: Old behavior (values_raw or values array)
        elseif (!empty($param['values_raw'])) {
            $lines[] = "VALUES \"$gdlName\", " . $param['values_raw'];
        } elseif (!empty($param['values']) && is_array($param['values'])) {
            $parts = [];
            foreach ($param['values'] as $val) {
                $parts[] = is_numeric($val) ? $val : "\"$val\"";
            }
            if (!empty($parts)) {
                $lines[] = "VALUES \"$gdlName\", " . implode(", ", $parts);
            }
        }

        return $lines;
    }

    private function getUiData($param)
    {
        if (empty($param['ui_code']))
            return null;
        if (is_array($param['ui_code']))
            return $param['ui_code'];
        if (is_string($param['ui_code']) && strpos($param['ui_code'], '{') === 0) {
            return json_decode($param['ui_code'], true);
        }
        return null; // Return null if it's a string but NOT a JSON object (legacy strings are handled via values_raw mostly, or we could return array with type='none')
    }

    /**
     * Legacy method for backward compatibility
     */
    public function generateValuesScript(array $parameters): string
    {
        $allLines = [];
        foreach ($parameters as $param) {
            $lines = $this->generateValuesCommands($param);
            if (!empty($lines)) {
                $allLines = array_merge($allLines, $lines);
            }
        }
        return implode("\n", $allLines);
    }
}
