<?php
namespace App\Services;

use PDO;
use SimpleXMLElement;
use DOMDocument;

class GdlXmlService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function generateParametersXml(int $objectId): string
    {
        // Get object name
        $stmt = $this->db->prepare("SELECT name FROM gdl_objects WHERE id = ?");
        $stmt->execute([$objectId]);
        $objectName = $stmt->fetchColumn();

        // Get parameters
        $stmt = $this->db->prepare("
            SELECT p.*, pt.language_code, pt.description
            FROM parameters p
            LEFT JOIN parameter_translations pt ON p.id = pt.param_id AND pt.language_code = 'de'
            WHERE p.gdl_object_id = ?
            ORDER BY p.sort_order ASC
        ");
        $stmt->execute([$objectId]);
        $parameters = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build XML
        $xml = new SimpleXMLElement('<ParamSection></ParamSection>');
        $xml->addAttribute('SectVersion', '27');
        $xml->addAttribute('SectionFlags', '0');
        $xml->addAttribute('SubIdent', '0');

        // Add ParamSectHeader
        $header = $xml->addChild('ParamSectHeader');
        $header->addChild('AutoHotspots', 'false');
        $statBits = $header->addChild('StatBits');
        $statBits->addChild('STBit_FixSize');
        $header->addChild('WDLeftFrame', '0');
        $header->addChild('WDRightFrame', '0');
        $header->addChild('WDTopFrame', '0');
        $header->addChild('WDBotFrame', '0');
        $header->addChild('LayFlags', '65535');
        $header->addChild('WDMirrorThickness', '0');
        $header->addChild('WDWallInset', '0');

        // Add Parameters section
        $paramsSection = $xml->addChild('Parameters');

        foreach ($parameters as $param) {
            $this->addParameterToXml($paramsSection, $param);
        }

        // Format XML nicely
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = true;
        @$dom->loadXML($xml->asXML());
        return $dom->saveXML($dom->documentElement);
    }

    private function addParameterToXml($paramsSection, $param)
    {
        $paramNode = $paramsSection->addChild($param['gdl_type']);
        $paramNode->addAttribute('Name', $param['gdl_name']);

        // Description
        if (!empty($param['description'])) {
            $descNode = $paramNode->addChild('Description');
            $dom = dom_import_simplexml($descNode);
            $desc = $param['description'];
            // Descriptions need to be wrapped in quotes
            if (strpos($desc, '"') === 0 && substr($desc, -1) === '"') {
                // Already has quotes
            } else {
                // Add quotes
                $desc = '"' . $desc . '"';
            }
            $dom->appendChild($dom->ownerDocument->createCDATASection($desc));
        }

        // Fix flag - always for ArchiCAD standard parameters
        $fixNames = ['A', 'B', 'ZZYZX', 'AC_show2DHotspotsIn3D', 'ac_bottomlevel', 'ac_toplevel'];
        if ($param['is_fix_name'] || in_array($param['gdl_name'], $fixNames)) {
            $paramNode->addChild('Fix');
        }

        // Other flags
        $this->addFlags($paramNode, $param);

        // Value
        $this->addValue($paramNode, $param);

        // Arrays
        $this->addArrayValues($paramNode, $param);
    }

    private function addFlags($paramNode, $param)
    {
        if ($param['flag_bold'] || $param['flag_child'] || $param['flag_hidden'] || $param['flag_unique']) {
            $flagsNode = $paramNode->addChild('Flags');
            if ($param['flag_bold']) {
                $flagsNode->addChild('ParFlg_BoldName');
            }
            if ($param['flag_child']) {
                $flagsNode->addChild('ParFlg_Child');
            }
            if ($param['flag_hidden']) {
                $flagsNode->addChild('ParFlg_Hidden');
            }
            if ($param['flag_unique']) {
                $flagsNode->addChild('ParFlg_Unique');
            }
        }
    }

    private function addValue($paramNode, $param)
    {
        if (in_array($param['gdl_type'], ['Separator', 'Title'])) {
            return;
        }

        $isString = in_array(strtoupper($param['gdl_type'] ?? ''), ['STRING', 'TEXT', 'UISTRING']);
        $hasArray = ($param['array_type'] !== 'None' && ($param['array_first_dim'] > 0));

        // CRITICAL: Do NOT add Value element for array parameters
        if ($hasArray) {
            return;
        }

        // Also check if default_value_json contains array data
        if (!empty($param['default_value_json'])) {
            $decodedValue = json_decode($param['default_value_json']);
            if (json_last_error() === JSON_ERROR_NONE && (is_object($decodedValue) || is_array($decodedValue))) {
                // This is array data - do NOT create Value element
                return;
            }
        }

        // OK to create Value element now
        $valueNode = $paramNode->addChild('Value');
        
        if (!empty($param['default_value_json'])) {
            $val = $param['default_value_json'];
            
            $dom = dom_import_simplexml($valueNode);

            if ($isString) {
                // Strings: handle JSON-encoded values
                // Remove escaped backslashes first
                $val = str_replace('\\\\', '\\', $val);
                $val = str_replace('\\"', '"', $val);
                
                if (strpos($val, '"') === 0 && substr($val, -1) === '"') {
                    // Decode the JSON string
                    $decoded = json_decode($val);
                    if (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) {
                        $val = $decoded;
                    } else {
                        // Not valid JSON, just remove outer quotes
                        $val = substr($val, 1, -1);
                    }
                }
                
                // Now ensure the value has proper quotes
                if (strpos($val, '"') !== 0 || substr($val, -1) !== '"') {
                    $val = '"' . $val . '"';
                }
                
                $dom->appendChild($dom->ownerDocument->createCDATASection($val));
            } else {
                // Numeric types: remove ALL quotes and escapes
                $val = str_replace('\\\\', '', $val);
                $val = str_replace('\\"', '', $val);
                $val = str_replace('"', '', $val);
                $dom->appendChild($dom->ownerDocument->createTextNode($val));
            }
        } else {
            // Empty value handling
            if ($isString) {
                // Empty strings get ""
                $dom = dom_import_simplexml($valueNode);
                $dom->appendChild($dom->ownerDocument->createCDATASection('""'));
            } else {
                // Numeric types default to 0
                $dom = dom_import_simplexml($valueNode);
                $dom->appendChild($dom->ownerDocument->createTextNode('0'));
            }
        }
    }

    private function addArrayValues($paramNode, $param)
    {
        if ($param['array_type'] === 'None' || $param['array_first_dim'] <= 0) {
            return;
        }

        $arrayNode = $paramNode->addChild('ArrayValues');
        $arrayNode->addAttribute('FirstDimension', $param['array_first_dim']);
        $arrayNode->addAttribute('SecondDimension', $param['array_second_dim']);

        if (empty($param['default_value_json'])) {
            return;
        }

        $arrayData = json_decode($param['default_value_json'], true);
        if (!is_array($arrayData)) {
            return;
        }

        $isString = in_array(strtoupper($param['gdl_type'] ?? ''), ['STRING', 'TEXT', 'UISTRING']);

        foreach ($arrayData as $index => $rowValues) {
            if (is_array($rowValues)) {
                // 2D Array
                foreach ($rowValues as $colIndex => $colValue) {
                    $this->addArrayElement($arrayNode, $colValue, $isString, $index, $colIndex);
                }
            } else {
                // 1D Array
                $this->addArrayElement($arrayNode, $rowValues, $isString, $index, null);
            }
        }
    }

    private function addArrayElement($arrayNode, $value, $isString, $row, $col = null)
    {
        $val = (string) $value;
        
        // Remove quotes from numeric values
        if (!$isString && strpos($val, '"') === 0 && substr($val, -1) === '"') {
            $val = substr($val, 1, -1);
        }
        
        if ($isString) {
            // Handle JSON-encoded string values
            if (strpos($val, '"') === 0 && substr($val, -1) === '"') {
                // Decode the JSON string
                $decoded = json_decode($val);
                if (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) {
                    $val = $decoded;
                } else {
                    // Not valid JSON, just remove outer quotes
                    $val = substr($val, 1, -1);
                }
            }
            
            // Ensure proper quote format
            if (strpos($val, '"') !== 0 || substr($val, -1) !== '"') {
                $val = '"' . $val . '"';
            }
        }

        $aValNode = $arrayNode->addChild('AVal');
        if ($col !== null) {
            $aValNode->addAttribute('Column', $col + 1);
        }
        $aValNode->addAttribute('Row', $row + 1);

        $dom = dom_import_simplexml($aValNode);
        if ($isString) {
            $dom->appendChild($dom->ownerDocument->createCDATASection($val));
        } else {
            $dom->appendChild($dom->ownerDocument->createTextNode($val));
        }
    }
}
