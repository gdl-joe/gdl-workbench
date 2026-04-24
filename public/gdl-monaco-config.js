/**
 * GDL Syntax Definition for Monaco Editor
 */
const GDL_LANGUAGE_DEFINITION = {
    keywords: [
        'ABS', 'ACS', 'ASN', 'ATN', 'COS', 'EXP', 'FRA', 'INT', 'LOG', 'NOT', 'PI', 'RND', 'SGN', 'SIN', 'SQR', 'TAN',
        'IF', 'THEN', 'ELSE', 'ENDIF', 'FOR', 'TO', 'STEP', 'NEXT', 'WHILE', 'ENDWHILE', 'DO', 'UNTIL',
        'GOSUB', 'RETURN', 'END', 'EXIT', 'GOTO', 'CALL', 'PARAMETERS', 'SET', 'LOCK', 'HIDEPARAMETER',
        'VALUES', 'VALUES2', 'RANGE', 'STENCIL', 'DEFINE', 'STYLE', 'FILL', 'LINE_TYPE', 'MATERIAL', 'PEN',
        'LINE2', 'RECT2', 'POLY2', 'POLY2_B', 'CIRCLE2', 'ARC2', 'TEXT2', 'UI_DIALOG', 'UI_PAGE', 'UI_BUTTON',
        'UI_INFIELD', 'UI_OUTFIELD', 'UI_SEPARATOR', 'UI_RADIOBUTTON', 'UI_PICT', 'UI_STYLE', 'UI_LISTFIELD',
        'DESCRIPTOR', 'BINARY', 'FRAGMENT', 'HOTSPOT', 'HOTSPOT2', 'PROJECT2', 'MUL2', 'ADD2', 'ROT2', 'SCALE2'
    ],
    operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
        root: [
            [/[a-z_$][\w$]*/, {
                cases: {
                    '@keywords': 'keyword',
                    '@default': 'variable'
                }
            }],
            [/[A-Z_$][\w$]*/, {
                cases: {
                    '@keywords': 'keyword',
                    '@default': 'variable'
                }
            }],
            { include: '@whitespace' },
            [/[{}()\[\]]/, '@brackets'],
            [/@symbols/, {
                cases: {
                    '@operators': 'operator',
                    '@default': ''
                }
            }],
            [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
            [/\d+/, 'number'],
            [/[;,]/, 'delimiter'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        ],
        string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/!.*$/, 'comment'],
        ],
    },
};

const GDL_THEME = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'operator', foreground: 'D4D4D4' },
    ],
    colors: {
        'editor.background': '#1E1E1E',
    }
};

window.gdlMonaco = {
    definition: GDL_LANGUAGE_DEFINITION,
    theme: GDL_THEME
};
