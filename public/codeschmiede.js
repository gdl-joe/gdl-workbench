/**
 * GDL Codeschmiede – v4
 *
 * Three modes per command:
 *   manual  – (a) Enter variable names and values by hand
 *   params  – (b) Pick variable names from existing parameters (filtered by type)
 *   declare – (c) Enter names/values, then save as new parameters with one click
 *
 * Param types in command definitions:
 *   text, select, var-value, section
 *
 * Global settings: eps, unID, loopMain, loopSub
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE    = '../backend/public/api/local';
const GLOBALS_KEY = 'codeForgeGlobals';
const STATE_KEY   = 'codeForgeState';

// Map from internal paramType → GDL type string used in the database
const GDL_TYPE_MAP = {
    length:       'Length',
    angle:        'Angle',
    integer:      'Integer',
    boolean:      'Boolean',
    string:       'String',
    material:     'Material',
    pen:          'Pen',
    fill:         'Fill',
    length_array: 'Length',   // 1D array of Length values
    integer_array:'Integer',  // 1D array of Integer values
    angle_array:  'Angle'     // 1D array of Angle values
};

/** Resolve base GDL type and whether this paramType is an array */
function resolveParamType(paramType) {
    const isArray = paramType?.endsWith('_array') ?? false;
    const base    = isArray ? paramType.replace('_array', '') : paramType;
    return { gdlType: GDL_TYPE_MAP[base] || GDL_TYPE_MAP[paramType] || 'Length', isArray };
}

// ─── Global Settings ─────────────────────────────────────────────────────────

function getGlobals() {
    try { return JSON.parse(localStorage.getItem(GLOBALS_KEY) || '{}'); } catch { return {}; }
}
function saveGlobals(g) { localStorage.setItem(GLOBALS_KEY, JSON.stringify(g)); }
function getGlobal(key, fallback) { return getGlobals()[key] ?? fallback; }

// ─── Command Registry ─────────────────────────────────────────────────────────

const GDL_COMMANDS = {

    // ═══════════════════════════════════════════════════════════════════════════
    // 2D-Elemente / Eingabesteuerung
    // ═══════════════════════════════════════════════════════════════════════════

    hotspot2_movable: {
        id: 'hotspot2_movable',
        category: '2D-Elemente',
        subcategory: 'Eingabesteuerung',
        path: '2D-Elemente / Eingabesteuerung / HOTSPOT2',
        label: 'HOTSPOT2 – bewegliche Hotspots',
        description:
            'Erzeugt 6 HOTSPOT2-Aufrufe für einen verschiebbaren 2D-Block: ' +
            'je 3 Hotspots für X- und Y-Richtung.',
        params: [
            {
                id: 'paramX', label: 'Parameter X-Richtung', type: 'text',
                default: 'sideX', paramType: 'length',
                hint: 'Parametername für die X-Ausdehnung', mono: true
            },
            {
                id: 'dirX', label: 'X-Richtung', type: 'select',
                options: [
                    { value: 'pos', label: '+ Positiv  (Anker −0.1)' },
                    { value: 'neg', label: '− Negativ  (Anker +0.1)' }
                ],
                default: 'pos',
                hint: 'Positiv → Anker bei −0.1 | Negativ → Anker bei +0.1'
            },
            {
                id: 'paramY', label: 'Parameter Y-Richtung', type: 'text',
                default: 'sideY', paramType: 'length',
                hint: 'Parametername für die Y-Ausdehnung', mono: true
            },
            {
                id: 'dirY', label: 'Y-Richtung', type: 'select',
                options: [
                    { value: 'pos', label: '+ Positiv  (Anker −0.1)' },
                    { value: 'neg', label: '− Negativ  (Anker +0.1)' }
                ],
                default: 'pos',
                hint: 'Positiv → Anker bei −0.1 | Negativ → Anker bei +0.1'
            },
            {
                id: 'hotspotId', label: 'Hotspot-ID Variable', type: 'text',
                default: 'unID', defaultFromGlobal: 'unID',
                hint: 'Zählervariable für Hotspot-IDs (aus Globale Einstellungen)', mono: true
            },
            {
                id: 'statusAdd', label: 'Status-Addend', type: 'select',
                options: [
                    { value: '128', label: '128  –  Länge dehnbar' },
                    { value: '256', label: '256  –  Rotierbar' },
                    { value: '512', label: '512  –  Spiegelbar' }
                ],
                default: '128',
                hint: 'Wird zu Basisstatus 1 addiert  (z.B. 1 + 128 = 129)'
            }
        ],

        generate(p) {
            const x  = (p.paramX    || 'sideX').trim();
            const y  = (p.paramY    || 'sideY').trim();
            const h  = (p.hotspotId || getGlobal('unID', 'unID')).trim();
            const s  = p.statusAdd  || '128';
            const ax = p.dirX === 'neg' ? '0.1' : '-0.1';
            const ay = p.dirY === 'neg' ? '0.1' : '-0.1';
            const T  = '\t';
            const inc = `: ${h} = ${h} + 1`;
            return [
                `HOTSPOT2${T}${ax},${T}${y},${T}${h}, ${x}, 3${T}${T}${inc}`,
                `HOTSPOT2${T}0,${T}${y},${T}${h}, ${x}, 1 + ${s}${T}${T}${inc}`,
                `HOTSPOT2${T}${x},${T}${y},${T}${h}, ${x}, 2${T}${T}${inc}`,
                `HOTSPOT2${T}${x},${T}${ay},${T}${h}, ${y}, 3${T}${T}${inc}`,
                `HOTSPOT2${T}${x},${T}0,${T}${h}, ${y}, 1 + ${s}${T}${T}${inc}`,
                `HOTSPOT2${T}${x},${T}${y},${T}${h}, ${y}, 2${T}${T}${inc}`
            ].join('\n');
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 2D-Elemente / Polygone
    // ═══════════════════════════════════════════════════════════════════════════

    poly2b: {
        id: 'poly2b',
        category: '2D-Elemente',
        subcategory: 'Polygone',
        path: '2D-Elemente / Polygone / POLY2_B',
        label: 'POLY2_B – ausgefülltes Rechteck',
        description:
            'Initialisiert Variablen, setzt Stift und Füllung, verschiebt per ADD2 ' +
            'und zeichnet ein ausgefülltes Rechteck.',
        params: [
            { id: 'sec_mass',   type: 'section', label: 'Maße' },
            {
                id: 'varX', label: 'X-Größe', type: 'var-value',
                defaultName: 'poly_x', defaultValue: '1',
                paramType: 'length',
                hint: 'Variablenname und Startwert'
            },
            {
                id: 'varY', label: 'Y-Größe', type: 'var-value',
                defaultName: 'poly_y', defaultValue: '1',
                paramType: 'length'
            },

            { id: 'sec_style',  type: 'section', label: 'Darstellung' },
            {
                id: 'varCont',    label: 'Konturlinie',      type: 'var-value',
                defaultName: 'poly_cont',     defaultValue: 'L_',
                paramType: 'pen',
                hint: 'Stiftnummer oder GDL-Variable (z.B. L_)'
            },
            {
                id: 'varFill',    label: 'Füllung Nr.',      type: 'var-value',
                defaultName: 'poly_fill',     defaultValue: '1',
                paramType: 'fill'
            },
            {
                id: 'varFillPen', label: 'Füllstift',        type: 'var-value',
                defaultName: 'poly_fill_pen', defaultValue: '1',
                paramType: 'pen'
            },
            {
                id: 'varBgPen',   label: 'Hintergrundstift', type: 'var-value',
                defaultName: 'poly_bg_pen',   defaultValue: '0',
                paramType: 'pen'
            },

            { id: 'sec_pos',    type: 'section', label: 'Position (ADD2)' },
            {
                id: 'varAddX',    label: 'X-Versatz',        type: 'var-value',
                defaultName: 'poly_addx',     defaultValue: '0',
                paramType: 'length'
            },
            {
                id: 'varAddY',    label: 'Y-Versatz',        type: 'var-value',
                defaultName: 'poly_addy',     defaultValue: '0',
                paramType: 'length'
            },

            { id: 'sec_cfg',    type: 'section', label: 'Konfiguration' },
            {
                id: 'varKontTyp', label: 'Konturtyp',        type: 'var-value',
                defaultName: 'kont_typ',      defaultValue: '7',
                paramType: 'integer',
                hint: '7 = Linie mit Füllung und Hintergrund'
            },
            {
                id: 'origin', label: 'Ursprung', type: 'select',
                options: [
                    { value: 'center', label: 'Mittelpunkt  (−x/2 … +x/2)' },
                    { value: 'origin', label: 'Nullpunkt  (0 … x)'         }
                ],
                default: 'center',
                hint: 'Mittelpunkt: zentriert · Nullpunkt: Ecke bei 0|0'
            }
        ],

        generate(p) {
            const vx  = (p.varX_name      || 'poly_x').trim();
            const vy  = (p.varY_name      || 'poly_y').trim();
            const vc  = (p.varCont_name   || 'poly_cont').trim();
            const vf  = (p.varFill_name   || 'poly_fill').trim();
            const vfp = (p.varFillPen_name || 'poly_fill_pen').trim();
            const vbp = (p.varBgPen_name  || 'poly_bg_pen').trim();
            const vax = (p.varAddX_name   || 'poly_addx').trim();
            const vay = (p.varAddY_name   || 'poly_addy').trim();
            const vkt = (p.varKontTyp_name || 'kont_typ').trim();

            const pad = s => (s + '                ').slice(0, 16);

            const decls = p._skipDecl ? '' : [
                `${pad(vx)} = ${p.varX_val      || '1'}`,
                `${pad(vy)} = ${p.varY_val      || '1'}`,
                `${pad(vkt)} = ${p.varKontTyp_val || '7'}`,
                `${pad(vc)} = ${p.varCont_val   || 'L_'}`,
                `${pad(vf)} = ${p.varFill_val   || '1'}`,
                `${pad(vfp)} = ${p.varFillPen_val || '1'}`,
                `${pad(vbp)} = ${p.varBgPen_val  || '0'}`,
                `${pad(vax)} = ${p.varAddX_val   || '0'}`,
                `${pad(vay)} = ${p.varAddY_val   || '0'}`
            ].join('\n') + '\n\n';

            let pts;
            if (p.origin === 'origin') {
                const T = '\t';
                pts = [
                    `0,${T}0,${T}1,`,
                    `${vx},${T}0,${T}1,`,
                    `${vx},${T}${vy},${T}1,`,
                    `0,${T}${vy},${T}1,`,
                    `0,${T}0,${T}-1`
                ].join('\n');
            } else {
                pts = [
                    `- ${vx} / 2, - ${vy} / 2, 1,`,
                    `  ${vx} / 2, - ${vy} / 2, 1,`,
                    `  ${vx} / 2,   ${vy} / 2, 1,`,
                    `- ${vx} / 2,   ${vy} / 2, 1,`,
                    `- ${vx} / 2, - ${vy} / 2, -1`
                ].join('\n');
            }

            return (
                `${decls}` +
                `PEN ${vc}\n` +
                `FILL ${vf}\n` +
                `ADD2 ${vax}, ${vay}\n` +
                `POLY2_B 5, ${vkt}, ${vfp}, ${vbp},\n` +
                `${pts}\n` +
                `DEL 1`
            );
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 2D-Elemente / Polygone (beliebige Form, mit Bogen-Unterstützung)
    // ═══════════════════════════════════════════════════════════════════════════

    poly2b_arc: {
        id: 'poly2b_arc',
        category: '2D-Elemente',
        subcategory: 'Polygone',
        path: '2D-Elemente / Polygone / POLY2_B (Bogen)',
        label: 'POLY2_B – Polygon mit geraden/gebogenen Kanten',
        description:
            'Beliebiges Polygon mit n Punkten. Stichhöhe z_poly[i] = 0 → gerade Kante, ' +
            'z_poly[i] ≠ 0 → Bogenkante. Berechnet Bogenparameter in Subroutine 12.',
        params: [
            { id: 'sec_poly', type: 'section', label: 'Polygon-Daten' },
            {
                id: 'varN', label: 'Anzahl Punkte', type: 'var-value',
                defaultName: 'int_poly_n', defaultValue: '4',
                paramType: 'integer', role: 'count',
                hint: 'Variablenname und Standardwert (z.B. 4)'
            },
            {
                id: 'varX', label: 'X-Array', type: 'text',
                default: 'x_poly', paramType: 'length_array',
                hint: 'Name des X-Koordinaten-Arrays (ohne [])', mono: true
            },
            {
                id: 'varY', label: 'Y-Array', type: 'text',
                default: 'y_poly', paramType: 'length_array',
                hint: 'Name des Y-Koordinaten-Arrays (ohne [])', mono: true
            },
            {
                id: 'varZ', label: 'Stichhöhen-Array', type: 'text',
                default: 'z_poly', paramType: 'length_array',
                hint: '0 = gerade Kante, ≠ 0 = Bogenkante', mono: true
            },
            {
                id: 'coordTable', type: 'coord-table',
                label: 'Koordinaten',
                countRef: 'varN',
                colRefs:  ['varX', 'varY', 'varZ'],
                hint: 'Koordinaten der Polygon-Punkte · nur Modus a) und c)'
            },

            { id: 'sec_style',  type: 'section', label: 'Darstellung' },
            {
                id: 'varCont',    label: 'Konturlinie',      type: 'var-value',
                defaultName: 'poly_cont',     defaultValue: 'L_',  paramType: 'pen'
            },
            {
                id: 'varFill',    label: 'Füllung Nr.',      type: 'var-value',
                defaultName: 'poly_fill',     defaultValue: '1',   paramType: 'fill'
            },
            {
                id: 'varFillPen', label: 'Füllstift',        type: 'var-value',
                defaultName: 'poly_fill_pen', defaultValue: '1',   paramType: 'pen'
            },
            {
                id: 'varBgPen',   label: 'Hintergrundstift', type: 'var-value',
                defaultName: 'poly_bg_pen',   defaultValue: '0',   paramType: 'pen'
            },

            { id: 'sec_pos',    type: 'section', label: 'Position (ADD2)' },
            {
                id: 'varAddX',    label: 'X-Versatz',        type: 'var-value',
                defaultName: 'poly_addx',     defaultValue: '0',   paramType: 'length'
            },
            {
                id: 'varAddY',    label: 'Y-Versatz',        type: 'var-value',
                defaultName: 'poly_addy',     defaultValue: '0',   paramType: 'length'
            },

            { id: 'sec_cfg',    type: 'section', label: 'Konfiguration' },
            {
                id: 'varKontTyp', label: 'Konturtyp',        type: 'var-value',
                defaultName: 'kont_typ',      defaultValue: '7',   paramType: 'integer',
                hint: '7 = Linie mit Füllung und Hintergrund'
            }
        ],

        generate(p) {
            const vN  = (p.varN_name       || 'int_poly_n').trim();
            const vX  = (p.varX            || 'x_poly').trim();
            const vY  = (p.varY            || 'y_poly').trim();
            const vZ  = (p.varZ            || 'z_poly').trim();
            const vc  = (p.varCont_name    || 'poly_cont').trim();
            const vf  = (p.varFill_name    || 'poly_fill').trim();
            const vfp = (p.varFillPen_name || 'poly_fill_pen').trim();
            const vbp = (p.varBgPen_name   || 'poly_bg_pen').trim();
            const vax = (p.varAddX_name    || 'poly_addx').trim();
            const vay = (p.varAddY_name    || 'poly_addy').trim();
            const vkt = (p.varKontTyp_name || 'kont_typ').trim();

            const pad = s => (s + '                ').slice(0, 16);
            const T   = '\t';

            const nDecl = p._skipDecl ? '' :
                `${pad(vN)} = ${p.varN_val || '4'}\n\n`;

            const dimDecl = p._skipDecl ? '' :
                `DIM ${vX}[], ${vY}[], ${vZ}[]\n\n`;

            const coordDecls = (() => {
                if (p._skipDecl || !p.coordTable) return '';
                let rows = [];
                try { rows = JSON.parse(p.coordTable); } catch {}
                if (!rows.length) return '';
                return rows.map((row, i) =>
                    `${vX}[${i + 1}] = ${row.x || 0} : ${vY}[${i + 1}] = ${row.y || 0} : ${vZ}[${i + 1}] = ${row.z || 0}`
                ).join('\n') + '\n\n';
            })();

            const styleDecls = p._skipDecl ? '' : [
                `${pad(vkt)} = ${p.varKontTyp_val || '7'}`,
                `${pad(vc)} = ${p.varCont_val   || 'L_'}`,
                `${pad(vf)} = ${p.varFill_val   || '1'}`,
                `${pad(vfp)} = ${p.varFillPen_val || '1'}`,
                `${pad(vbp)} = ${p.varBgPen_val  || '0'}`,
                `${pad(vax)} = ${p.varAddX_val   || '0'}`,
                `${pad(vay)} = ${p.varAddY_val   || '0'}`,
                ''
            ].join('\n');

            return (
`${nDecl}` +
`${dimDecl}` +
`${coordDecls}` +
`nix             = 0.0001\n` +
`eps             = 0.0001\n\n` +
`DIM arc_xm[], arc_ym[], arc_ang[]\n\n` +
`FOR i = 1 TO ${vN}\n` +
`${T}ii     = (i MOD ${vN}) + 1\n` +
`${T}dx     = ${vX}[ii] - ${vX}[i]\n` +
`${T}dy     = ${vY}[ii] - ${vY}[i]\n` +
`${T}seg_r  = MAX(nix, SQR(dx^2 + dy^2))\n` +
`${T}r2     = seg_r / 2\n` +
`${T}dx     = dx / seg_r\n` +
`${T}dy     = dy / seg_r\n` +
`${T}xm     = (${vX}[i] + ${vX}[ii]) / 2\n` +
`${T}ym     = (${vY}[i] + ${vY}[ii]) / 2\n` +
`${T}IF ABS(${vZ}[i]) < eps THEN${T}! gerade Kante\n` +
`${T}${T}arc_xm[i]  = 0\n` +
`${T}${T}arc_ym[i]  = 0\n` +
`${T}${T}arc_ang[i] = 0\n` +
`${T}ELSE\n` +
`${T}${T}xs         = (r2^2 - ${vZ}[i]^2) / (2 * ${vZ}[i])\n` +
`${T}${T}xs_r       = ABS(xs + ${vZ}[i])${T}${T}${T}! Radius\n` +
`${T}${T}arc_xm[i]  = xm - dy * xs${T}${T}${T}! Mittelpunkt X\n` +
`${T}${T}arc_ym[i]  = ym + dx * xs${T}${T}${T}! Mittelpunkt Y\n` +
`${T}${T}arc_ang[i] = ASN(r2 / xs_r) * SGN(${vZ}[i])${T}! Abweichungswinkel\n` +
`${T}ENDIF\n` +
`NEXT i\n\n` +
`FOR i = 1 TO ${vN}\n` +
`${T}PUT ${vX}[i], ${vY}[i], 1\n` +
`${T}IF ABS(${vZ}[i]) > eps THEN${T}! B O G E N\n` +
`${T}${T}PUT arc_xm[i], arc_ym[i], 900\n` +
`${T}${T}PUT 0, 2 * arc_ang[i], 4000\n` +
`${T}ENDIF\n` +
`NEXT i\n\n` +
`${styleDecls}` +
`PEN ${vc}\n` +
`FILL ${vf}\n` +
`ADD2 ${vax}, ${vay}\n` +
`POLY2_B NSP/3, ${vkt}, ${vfp}, ${vbp}, GET(NSP)\n` +
`DEL 1`
            );
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // Querschnitte / Profil-Editor
    // ═══════════════════════════════════════════════════════════════════════════

    querschnitt: {
        id: 'querschnitt',
        category: 'Querschnitte',
        subcategory: 'Profil-Editor',
        path: 'Querschnitte / Profil-Editor / Querschnitt',
        label: 'Querschnitt-Editor (Kreis / Rechteck)',
        description:
            'Definiert ein Profil (Kreis/Rohr oder Rechteck) und erzeugt die PUT-Statements ' +
            'für TUBE, PRISM_ und ähnliche GDL-Befehle. Als Querschnitts-Favorit speichern ' +
            'und in beliebige Befehle laden.',

        params: [
            {
                id: 'profilTyp', type: 'select',
                label: 'Profil-Typ',
                options: [
                    { value: 'kreis',     label: 'Kreis / Rohr'    },
                    { value: 'rechteck',  label: 'Rechteck / Profil' }
                ],
                default: 'kreis',
                controls: 'profilTypGrp',
                hint: 'Kreis → Rohrprofil mit Außen-Ø und Wandstärke · Rechteck → Hohlprofil'
            },

            { id: 'sec_kreis',     type: 'section', label: 'Kreis-Profil',     paramGroup: 'kreis'     },
            {
                id: 'varRohr', label: 'Außen-Ø', type: 'var-value',
                defaultName: 'x_rohr', defaultValue: '10', paramType: 'length',
                paramGroup: 'kreis',
                hint: 'Außendurchmesser'
            },
            {
                id: 'varWand', label: 'Wandstärke', type: 'var-value',
                defaultName: 'x_wand', defaultValue: '0.5', paramType: 'length',
                paramGroup: 'kreis',
                hint: '0 = Vollkreis · > 0 = Hohlrohr'
            },

            { id: 'sec_rechteck', type: 'section', label: 'Rechteck-Profil', paramGroup: 'rechteck' },
            {
                id: 'varB', label: 'Breite', type: 'var-value',
                defaultName: 'b_rohr', defaultValue: '5', paramType: 'length',
                paramGroup: 'rechteck'
            },
            {
                id: 'varH', label: 'Höhe', type: 'var-value',
                defaultName: 'h_rohr', defaultValue: '3', paramType: 'length',
                paramGroup: 'rechteck'
            },
            {
                id: 'varWandR', label: 'Wandstärke', type: 'var-value',
                defaultName: 'x_wand', defaultValue: '0.5', paramType: 'length',
                paramGroup: 'rechteck',
                hint: '0 = Vollrechteck · > 0 = Hohlprofil'
            }
        ],

        generate(p) {
            const T    = '\t';
            const typ  = p.profilTyp || 'kreis';
            const pad  = s => (s + '                ').slice(0, 16);

            const vRohr  = (p.varRohr_name  || 'x_rohr').trim();
            const vWand  = (p.varWand_name  || 'x_wand').trim();
            const vB     = (p.varB_name     || 'b_rohr').trim();
            const vH     = (p.varH_name     || 'h_rohr').trim();
            const vWandR = (p.varWandR_name || 'x_wand').trim();

            let decls = '';
            if (!p._skipDecl) {
                if (typ === 'kreis') {
                    decls = `${pad(vRohr)} = ${p.varRohr_val  || '10'}\n` +
                            `${pad(vWand)} = ${p.varWand_val  || '0.5'}\n\n`;
                } else {
                    decls = `${pad(vB)}     = ${p.varB_val     || '5'}\n` +
                            `${pad(vH)}     = ${p.varH_val     || '3'}\n` +
                            `${pad(vWandR)} = ${p.varWandR_val || '0.5'}\n\n`;
                }
            }

            let puts = '';
            if (typ === 'kreis') {
                puts =
                    `${T}PUT 0, 0, 900,\n` +
                    `${T}    ${vRohr} / 2, 360, 4000,\n` +
                    `${T}    ${vRohr} / 2 - ${vWand}, 360, 4000`;
            } else {
                puts =
                    `! Äußeres Rechteck\n` +
                    `${T}PUT  ${vB} / 2,  ${vH} / 2, 1,\n` +
                    `${T}    -${vB} / 2,  ${vH} / 2, 1,\n` +
                    `${T}    -${vB} / 2, -${vH} / 2, 1,\n` +
                    `${T}     ${vB} / 2, -${vH} / 2, 1,\n` +
                    `${T}     ${vB} / 2,  ${vH} / 2, -1\n` +
                    `! Inneres Rechteck (Wandstärke ${vWandR})\n` +
                    `${T}PUT  (${vB} / 2 - ${vWandR}),  (${vH} / 2 - ${vWandR}), 1,\n` +
                    `${T}     (${vB} / 2 - ${vWandR}), -(${vH} / 2 - ${vWandR}), 1,\n` +
                    `${T}    -(${vB} / 2 - ${vWandR}), -(${vH} / 2 - ${vWandR}), 1,\n` +
                    `${T}    -(${vB} / 2 - ${vWandR}),  (${vH} / 2 - ${vWandR}), 1,\n` +
                    `${T}     (${vB} / 2 - ${vWandR}),  (${vH} / 2 - ${vWandR}), -1`;
            }

            return (
                `${decls}` +
                `! Profil-PUT für TUBE / PRISM_ (profpts = NSP / 3)\n` +
                `${puts}`
            );
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 3D-Elemente / Extrusion
    // ═══════════════════════════════════════════════════════════════════════════

    tube: {
        id: 'tube',
        category: '3D-Elemente',
        subcategory: 'Extrusion',
        path: '3D-Elemente / Extrusion / TUBE',
        label: 'TUBE – Flexibler Extrudierpfad (mit Bogensegmenten)',
        description:
            'Erzeugt ein 3D-Rohr / -Profil entlang eines frei definierbaren Pfads mit geraden ' +
            'Abschnitten und Bögen. Volle HOTSPOT-Steuerung für interaktive Griffe in ArchiCAD.',
        querschnittBased: true,   // enables Querschnitts-Favorit loader in form

        params: [
            // ── Profil (shared IDs with querschnitt command → Favorit laden works) ──
            { id: 'sec_profil', type: 'section', label: 'Profil' },
            {
                id: 'profilTyp', type: 'select',
                label: 'Profil-Typ',
                options: [
                    { value: 'kreis',    label: 'Kreis / Rohr'      },
                    { value: 'rechteck', label: 'Rechteck / Profil'  }
                ],
                default: 'kreis',
                controls: 'profilTypGrp',
                hint: 'Kreis: Rohr mit Außen-Ø + Wandstärke · Rechteck: Hohlprofil mit Breite, Höhe + Wandstärke'
            },

            { id: 'sec_kreis',    type: 'section', label: 'Kreis-Parameter',    paramGroup: 'kreis'     },
            {
                id: 'varRohr', label: 'Außen-Ø (x_rohr)', type: 'var-value',
                defaultName: 'x_rohr', defaultValue: '10', paramType: 'length',
                paramGroup: 'kreis', hint: 'Außendurchmesser'
            },
            {
                id: 'varWand', label: 'Wandstärke (x_wand)', type: 'var-value',
                defaultName: 'x_wand', defaultValue: '0.5', paramType: 'length',
                paramGroup: 'kreis', hint: '0 = Vollkreis'
            },

            { id: 'sec_rechteck', type: 'section', label: 'Rechteck-Parameter', paramGroup: 'rechteck'  },
            {
                id: 'varB', label: 'Breite (b_rohr)', type: 'var-value',
                defaultName: 'b_rohr', defaultValue: '5', paramType: 'length',
                paramGroup: 'rechteck'
            },
            {
                id: 'varH', label: 'Höhe (h_rohr)', type: 'var-value',
                defaultName: 'h_rohr', defaultValue: '3', paramType: 'length',
                paramGroup: 'rechteck'
            },
            {
                id: 'varWandR', label: 'Wandstärke (x_wand)', type: 'var-value',
                defaultName: 'x_wand', defaultValue: '0.5', paramType: 'length',
                paramGroup: 'rechteck', hint: '0 = Vollrechteck'
            },

            // ── Pfad ──────────────────────────────────────────────────────────
            { id: 'sec_pfad', type: 'section', label: 'Pfad' },
            {
                id: 'varN', label: 'Segmentanzahl', type: 'var-value',
                defaultName: 'poly_n', defaultValue: '3',
                paramType: 'integer', role: 'count',
                hint: 'Anzahl gerader Strecken (jede Strecke kann anschließend einen Bogen haben)'
            },
            {
                id: 'varPolyX', label: 'Längen-Array', type: 'text',
                default: 'poly_x', paramType: 'length_array',
                hint: 'Array-Name für Streckenlängen', mono: true
            },
            {
                id: 'varAngBogen', label: 'Bogenwinkel-Array', type: 'text',
                default: 'ang_bogen', paramType: 'angle_array',
                hint: 'Biegewinkel nach Segment i (°), 0 = kein Bogen', mono: true
            },
            {
                id: 'varAngDreh', label: 'Drehwinkel-Array', type: 'text',
                default: 'ang_dreh', paramType: 'angle_array',
                hint: 'Twist-Winkel vor dem Bogen (°), 0 = kein Twist', mono: true
            },
            {
                id: 'pathTable', type: 'coord-table',
                label: 'Pfad-Segmente',
                countRef: 'varN',
                colLabels: ['Länge', 'Bogenwinkel°', 'Drehwinkel°'],
                hint: 'Manuelle Pfad-Eingabe · nur Modus a) und c)'
            },
            {
                id: 'varRRad', label: 'Biegeradius (r_rad)', type: 'var-value',
                defaultName: 'r_rad', defaultValue: '25', paramType: 'length',
                hint: 'Radius aller Biegebögen'
            },

            // ── Darstellung ───────────────────────────────────────────────────
            { id: 'sec_darst', type: 'section', label: 'Darstellung' },
            {
                id: 'varMat', label: 'Material (mat_1)', type: 'var-value',
                defaultName: 'mat_1', defaultValue: '1', paramType: 'material'
            },
            {
                id: 'varBKante', label: 'Rohrendkanten (b_kante)', type: 'var-value',
                defaultName: 'b_kante', defaultValue: '1', paramType: 'integer',
                hint: '1 = sichtbar, 0 = verborgen'
            }
        ],

        generate(p) {
            const T   = '\t';
            const typ = p.profilTyp || 'kreis';
            const pad = s => (s + '                ').slice(0, 16);

            // Variable names
            const vN    = (p.varN_name       || 'poly_n').trim();
            const vPX   = (p.varPolyX        || 'poly_x').trim();
            const vAB   = (p.varAngBogen     || 'ang_bogen').trim();
            const vAD   = (p.varAngDreh      || 'ang_dreh').trim();
            const vRR   = (p.varRRad_name    || 'r_rad').trim();
            const vMat  = (p.varMat_name     || 'mat_1').trim();
            const vBK   = (p.varBKante_name  || 'b_kante').trim();
            const vRohr  = (p.varRohr_name   || 'x_rohr').trim();
            const vWand  = (p.varWand_name   || 'x_wand').trim();
            const vB     = (p.varB_name      || 'b_rohr').trim();
            const vH     = (p.varH_name      || 'h_rohr').trim();
            const vWandR = (p.varWandR_name  || 'x_wand').trim();

            // ── Variable declarations (skipped in params mode) ─────────────
            let decls = '';
            if (!p._skipDecl) {
                if (typ === 'kreis') {
                    decls += `${pad(vRohr)}  = ${p.varRohr_val  || '10'}\n`;
                    decls += `${pad(vWand)}  = ${p.varWand_val  || '0.5'}\n`;
                } else {
                    decls += `${pad(vB)}     = ${p.varB_val     || '5'}\n`;
                    decls += `${pad(vH)}     = ${p.varH_val     || '3'}\n`;
                    decls += `${pad(vWandR)} = ${p.varWandR_val || '0.5'}\n`;
                }
                decls += `${pad(vN)}     = ${p.varN_val    || '3'}\n`;
                decls += `${pad(vRR)}    = ${p.varRRad_val || '25'}\n`;
                decls += `${pad(vMat)}   = ${p.varMat_val  || '1'}\n`;
                decls += `${pad(vBK)}    = ${p.varBKante_val || '1'}\n`;
                decls += '\n';
                decls += `DIM ${vPX}[], ${vAB}[], ${vAD}[]\n\n`;

                // Path values from table
                const pathRows = (() => {
                    if (!p.pathTable) return '';
                    let rows = [];
                    try { rows = JSON.parse(p.pathTable); } catch {}
                    if (!rows.length) return '';
                    return rows.map((row, i) =>
                        `${vPX}[${i+1}] = ${row.x||0} : ${vAB}[${i+1}] = ${row.y||0} : ${vAD}[${i+1}] = ${row.z||0}`
                    ).join('\n') + '\n\n';
                })();
                decls += pathRows;
            }

            // ── Profile PUT statements ─────────────────────────────────────
            const profilePuts = typ === 'kreis'
                ? (
                    `${T}PUT 0, 0, 900,\n` +
                    `${T}    ${vRohr} / 2, 360, 4000,\n` +
                    `${T}    ${vRohr} / 2 - ${vWand}, 360, 4000`
                )
                : (
                    `! Äußeres Rechteck\n` +
                    `${T}PUT  ${vB} / 2,  ${vH} / 2, 1,\n` +
                    `${T}    -${vB} / 2,  ${vH} / 2, 1,\n` +
                    `${T}    -${vB} / 2, -${vH} / 2, 1,\n` +
                    `${T}     ${vB} / 2, -${vH} / 2, 1,\n` +
                    `${T}     ${vB} / 2,  ${vH} / 2, -1\n` +
                    `! Inneres Rechteck\n` +
                    `${T}PUT  (${vB}/2-${vWandR}),  (${vH}/2-${vWandR}), 1,\n` +
                    `${T}     (${vB}/2-${vWandR}), -(${vH}/2-${vWandR}), 1,\n` +
                    `${T}    -(${vB}/2-${vWandR}), -(${vH}/2-${vWandR}), 1,\n` +
                    `${T}    -(${vB}/2-${vWandR}),  (${vH}/2-${vWandR}), 1,\n` +
                    `${T}     (${vB}/2-${vWandR}),  (${vH}/2-${vWandR}), -1`
                );

            return (
`! ══════════════════════════════════════════════════════════════
! GDL TUBE – Flexibler Extrudierpfad
! Profil: ${typ === 'kreis' ? 'Kreis / Rohr' : 'Rechteck'} · GDL Workbench Codeschmiede
! ══════════════════════════════════════════════════════════════

${decls}` +
`! ── Initialisierung ──────────────────────────────────────────
EPS             = 0.0001
unID            = 1
h_handle        = ${vRR}
IF h_handle < EPS THEN h_handle = 0.5

DIM start_x[]  : DIM start_y[]  : DIM start_z[]
DIM start_vx[] : DIM start_vy[] : DIM start_vz[]
DIM bogen_x[]  : DIM bogen_y[]  : DIM bogen_z[]
DIM bogen_ax[] : DIM bogen_ay[] : DIM bogen_az[]

tube_n          = 0
DIM tube_x[] : DIM tube_y[] : DIM tube_z[]

! ── Start-Zustand ─────────────────────────────────────────────
px = 0 : py = 0 : pz = 0
vx = 1 : vy = 0 : vz = 0
nx = 0 : ny = 1 : nz = 0
bx = 0 : by = 0 : bz = 1

IF ${vN} < 1 THEN GOTO "EndeRoutine"

! ── Phantompunkt Start ────────────────────────────────────────
ph1_dist        = ${vRR} * 2
tube_n          = 1
tube_x[1]       = px - vx * ph1_dist
tube_y[1]       = py - vy * ph1_dist
tube_z[1]       = pz - vz * ph1_dist

tube_n          = tube_n + 1
tube_x[tube_n]  = px : tube_y[tube_n] = py : tube_z[tube_n] = pz

! ── Hauptschleife ─────────────────────────────────────────────
FOR i = 1 TO ${vN}

${T}! A) Gerades Stück ─────────────────────────────────────────
${T}start_x[i]  = px  : start_y[i]  = py  : start_z[i]  = pz
${T}start_vx[i] = vx  : start_vy[i] = vy  : start_vz[i] = vz
${T}_len         = ${vPX}[i]

${T}HOTSPOT px - vx,        py - vy,        pz - vz,        unID, ${vPX}[i], 3     : unID = unID + 1
${T}HOTSPOT px,             py,             pz,             unID, ${vPX}[i], 1+128 : unID = unID + 1
${T}HOTSPOT px + vx * _len, py + vy * _len, pz + vz * _len, unID, ${vPX}[i], 2     : unID = unID + 1

${T}px = px + vx * _len : py = py + vy * _len : pz = pz + vz * _len
${T}tube_n          = tube_n + 1
${T}tube_x[tube_n]  = px : tube_y[tube_n] = py : tube_z[tube_n] = pz

${T}! B) Bogen (nur wenn nicht letztes Segment) ─────────────────
${T}IF i < ${vN} THEN

${T}${T}cur_ang_bogen = 0 : cur_ang_dreh = 0
${T}${T}n_dim_b = VARDIM1(${vAB}) : IF i <= n_dim_b THEN cur_ang_bogen = ${vAB}[i]
${T}${T}n_dim_d = VARDIM1(${vAD}) : IF i <= n_dim_d THEN cur_ang_dreh  = ${vAD}[i]

${T}${T}! === 1. Twist (Rotation um Längsachse) ===
${T}${T}HOTSPOT px,              py,              pz,              unID, ${vAD}[i], 6+128 : unID = unID + 1
${T}${T}HOTSPOT px + vx,         py + vy,         pz + vz,         unID, ${vAD}[i], 7     : unID = unID + 1
${T}${T}HOTSPOT px + nx*h_handle, py + ny*h_handle, pz + nz*h_handle, unID, ${vAD}[i], 4  : unID = unID + 1
${T}${T}vec_in_x = nx : vec_in_y = ny : vec_in_z = nz
${T}${T}axis_x = vx   : axis_y = vy   : axis_z = vz
${T}${T}angle_rot = cur_ang_dreh
${T}${T}GOSUB "RotateVector"
${T}${T}HOTSPOT px+vec_out_x*h_handle, py+vec_out_y*h_handle, pz+vec_out_z*h_handle, unID, ${vAD}[i], 5 : unID = unID + 1

${T}${T}IF ABS(cur_ang_dreh) > EPS THEN
${T}${T}${T}nx = vec_out_x : ny = vec_out_y : nz = vec_out_z
${T}${T}${T}bx = vy*nz - vz*ny : by = vz*nx - vx*nz : bz = vx*ny - vy*nx
${T}${T}ENDIF

${T}${T}! === 2. Bogen (Krümmung) ===
${T}${T}IF ABS(cur_ang_bogen) > EPS THEN

${T}${T}${T}center_x = px + nx * ${vRR}
${T}${T}${T}center_y = py + ny * ${vRR}
${T}${T}${T}center_z = pz + nz * ${vRR}
${T}${T}${T}bogen_x[i]  = center_x : bogen_y[i]  = center_y : bogen_z[i]  = center_z
${T}${T}${T}bogen_ax[i] = bx       : bogen_ay[i] = by       : bogen_az[i] = bz

${T}${T}${T}HOTSPOT center_x,      center_y,      center_z,      unID, ${vAB}[i], 6+128 : unID = unID + 1
${T}${T}${T}HOTSPOT center_x + bx, center_y + by, center_z + bz, unID, ${vAB}[i], 7     : unID = unID + 1
${T}${T}${T}HOTSPOT px,            py,            pz,            unID, ${vAB}[i], 4     : unID = unID + 1

${T}${T}${T}rad_vec_x = px - center_x : rad_vec_y = py - center_y : rad_vec_z = pz - center_z
${T}${T}${T}vec_in_x = rad_vec_x : vec_in_y = rad_vec_y : vec_in_z = rad_vec_z
${T}${T}${T}axis_x = bx : axis_y = by : axis_z = bz
${T}${T}${T}angle_rot = cur_ang_bogen
${T}${T}${T}GOSUB "RotateVector"
${T}${T}${T}HOTSPOT center_x+vec_out_x, center_y+vec_out_y, center_z+vec_out_z, unID, ${vAB}[i], 5 : unID = unID + 1

${T}${T}${T}steps    = INT(ABS(cur_ang_bogen) / 10)
${T}${T}${T}IF steps < 2 THEN steps = 2
${T}${T}${T}step_val = cur_ang_bogen / steps

${T}${T}${T}FOR k = 1 TO steps
${T}${T}${T}${T}angle_rot = k * step_val
${T}${T}${T}${T}vec_in_x  = rad_vec_x : vec_in_y  = rad_vec_y : vec_in_z  = rad_vec_z
${T}${T}${T}${T}axis_x    = bx        : axis_y    = by        : axis_z    = bz
${T}${T}${T}${T}GOSUB "RotateVector"
${T}${T}${T}${T}tube_n          = tube_n + 1
${T}${T}${T}${T}tube_x[tube_n]  = center_x + vec_out_x
${T}${T}${T}${T}tube_y[tube_n]  = center_y + vec_out_y
${T}${T}${T}${T}tube_z[tube_n]  = center_z + vec_out_z
${T}${T}${T}NEXT k

${T}${T}${T}px = tube_x[tube_n] : py = tube_y[tube_n] : pz = tube_z[tube_n]
${T}${T}${T}axis_x = bx : axis_y = by : axis_z = bz : angle_rot = cur_ang_bogen
${T}${T}${T}vec_in_x = vx : vec_in_y = vy : vec_in_z = vz
${T}${T}${T}GOSUB "RotateVector"
${T}${T}${T}vx = vec_out_x : vy = vec_out_y : vz = vec_out_z
${T}${T}${T}vec_in_x = nx : vec_in_y = ny : vec_in_z = nz
${T}${T}${T}GOSUB "RotateVector"
${T}${T}${T}nx = vec_out_x : ny = vec_out_y : nz = vec_out_z

${T}${T}ENDIF
${T}ENDIF

NEXT i

! ── Phantompunkt Ende ─────────────────────────────────────────
ph2_dist        = ${vRR} * 2
tube_n          = tube_n + 1
tube_x[tube_n]  = px + vx * ph2_dist
tube_y[tube_n]  = py + vy * ph2_dist
tube_z[tube_n]  = pz + vz * ph2_dist

GOTO "EndeRoutine"

! ── Subroutine: 3D-Vektor-Rotation (Rodrigues) ────────────────
"RotateVector":
${T}_c_rv    = COS(angle_rot)
${T}_s_rv    = SIN(angle_rot)
${T}_t_rv    = 1 - _c_rv
${T}_cx      = axis_y * vec_in_z - axis_z * vec_in_y
${T}_cy      = axis_z * vec_in_x - axis_x * vec_in_z
${T}_cz      = axis_x * vec_in_y - axis_y * vec_in_x
${T}_dot     = axis_x * vec_in_x + axis_y * vec_in_y + axis_z * vec_in_z
${T}vec_out_x = vec_in_x * _c_rv + _cx * _s_rv + axis_x * _dot * _t_rv
${T}vec_out_y = vec_in_y * _c_rv + _cy * _s_rv + axis_y * _dot * _t_rv
${T}vec_out_z = vec_in_z * _c_rv + _cz * _s_rv + axis_z * _dot * _t_rv
RETURN

"EndeRoutine":

! ── Profil + TUBE-Aufruf ──────────────────────────────────────
MATERIAL ${vMat}

${profilePuts}

profpts = NSP / 3

FOR i = 1 TO tube_n
${T}PUT tube_x[i], tube_y[i], tube_z[i], 0
NEXT i

pathpts = (NSP - profpts * 3) / 4
maske   = 1 + 2 + 4 + 8 + 16 * ${vBK} + 32
TUBE  profpts, pathpts, maske, GET(NSP)`
            );
        }
    }

    // ── Weitere Befehle hier ergänzen ─────────────────────────────────────────

};

// ─── State ────────────────────────────────────────────────────────────────────

let activeCommandId = null;
let generatedCode   = '';
let currentMode     = 'manual';   // 'manual' | 'params' | 'declare'
let cachedParams    = [];         // loaded from API when needed
let cachedSnippets  = {};         // { commandId: [{ id, name, params, created_at }] }

// ─── Storage ──────────────────────────────────────────────────────────────────

function saveState() {
    if (!activeCommandId) return;
    const cmd = GDL_COMMANDS[activeCommandId];
    if (!cmd) return;
    const params = {};
    cmd.params.forEach(p => {
        if (p.type === 'section') return;
        if (p.type === 'var-value') {
            const n = el(`param_${p.id}_name`);
            const v = el(`param_${p.id}_val`);
            if (n) params[`${p.id}_name`] = n.value;
            if (v) params[`${p.id}_val`]  = v.value;
        } else {
            const inp = el(`param_${p.id}`);
            if (inp) params[p.id] = inp.value;
        }
    });
    localStorage.setItem(STATE_KEY, JSON.stringify({ cmdId: activeCommandId, mode: currentMode, params }));
}

function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function clearState() { localStorage.removeItem(STATE_KEY); }

// ─── Snippets (DB) ────────────────────────────────────────────────────────────

async function loadSnippets(forceRefresh) {
    if (Object.keys(cachedSnippets).length > 0 && !forceRefresh) return cachedSnippets;
    try {
        const res    = await fetch(`${API_BASE}/snippets`);
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
            cachedSnippets = {};
            result.data.forEach(s => {
                if (!cachedSnippets[s.command_id]) cachedSnippets[s.command_id] = [];
                cachedSnippets[s.command_id].push(s);
            });
        }
    } catch { /* non-critical, tree just shows no snippets */ }
    return cachedSnippets;
}

async function apiDeleteSnippet(snippetId, snippetName) {
    try {
        await fetch(`${API_BASE}/snippets/${snippetId}`, { method: 'DELETE' });
        await loadSnippets(true);
        renderTree();
        setStatus(`Snippet "${snippetName}" gelöscht`);
    } catch {
        setStatus('Fehler beim Löschen des Snippets');
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function setStatus(msg) { const s = el('statusMessage'); if (s) s.textContent = 'Status: ' + msg; }

// ─── Load Parameters from API ─────────────────────────────────────────────────

async function loadAvailableParams(forceRefresh) {
    if (cachedParams.length > 0 && !forceRefresh) return cachedParams;
    const objectId = localStorage.getItem('currentGdlObjectId');
    if (!objectId) { cachedParams = []; return []; }
    try {
        const res    = await fetch(`${API_BASE}/objects/${objectId}/parameters`);
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
            cachedParams = result.data;
        } else {
            cachedParams = [];
        }
    } catch { cachedParams = []; }
    return cachedParams;
}

// ─── Mode Switching ───────────────────────────────────────────────────────────

async function switchMode(mode, overrideParams) {
    currentMode = mode;

    // Update mode button visuals
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show / hide declare-actions
    el('declareActions')?.classList.toggle('hidden', mode !== 'declare');

    // Load params from API for 'params' mode
    if (mode === 'params') {
        setStatus('Lade Parameter …');
        await loadAvailableParams();
    }

    // Re-render the form with the current (or given) values
    if (activeCommandId) {
        const params = overrideParams ?? collectParams(GDL_COMMANDS[activeCommandId]);
        renderForm(GDL_COMMANDS[activeCommandId], params);
        generateCode();
        saveState();
    }
    setStatus(`Modus: ${modeName(mode)}`);
}

function modeName(m) {
    return { manual: 'Manuell', params: 'Aus Parametern', declare: '→ Parameter' }[m] || m;
}

// ─── Command Tree ─────────────────────────────────────────────────────────────

function buildTree(commands) {
    const tree = {};
    Object.values(commands).forEach(cmd => {
        if (!tree[cmd.category]) tree[cmd.category] = {};
        if (!tree[cmd.category][cmd.subcategory]) tree[cmd.category][cmd.subcategory] = [];
        tree[cmd.category][cmd.subcategory].push(cmd);
    });
    return tree;
}

function renderTree() {
    const tree      = buildTree(GDL_COMMANDS);
    const container = el('commandTree');
    container.innerHTML = '';

    Object.entries(tree).forEach(([category, subcats]) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'cmd-category';

        const catHeader = document.createElement('div');
        catHeader.className = 'cmd-cat-header';
        catHeader.innerHTML =
            `<i class="fas fa-chevron-down arrow"></i>` +
            `<i class="fas fa-layer-group" style="font-size:0.78rem"></i> ${category}`;

        const subcatWrap = document.createElement('div');
        catHeader.addEventListener('click', () => {
            catHeader.classList.toggle('collapsed');
            subcatWrap.style.display = catHeader.classList.contains('collapsed') ? 'none' : '';
        });
        catDiv.appendChild(catHeader);

        Object.entries(subcats).forEach(([subcat, cmds]) => {
            const subcatDiv = document.createElement('div');
            subcatDiv.className = 'cmd-subcategory';

            const hdr = document.createElement('div');
            hdr.className = 'cmd-subcat-header';
            hdr.innerHTML = `<i class="fas fa-folder" style="font-size:0.73rem;color:var(--text-muted)"></i> ${subcat}`;
            subcatDiv.appendChild(hdr);

            cmds.forEach(cmd => {
                const item = document.createElement('div');
                item.className = 'cmd-item' + (cmd.id === activeCommandId ? ' active' : '');
                item.dataset.cmdId = cmd.id;
                item.innerHTML = `<i class="fas fa-code"></i> ${cmd.label}`;
                item.addEventListener('click', () => selectCommand(cmd.id));
                subcatDiv.appendChild(item);

                (cachedSnippets[cmd.id] || []).forEach(snip => {
                    const snipItem = document.createElement('div');
                    snipItem.className = 'cmd-item cmd-snippet';
                    snipItem.title     = `Gespeichert: ${new Date(snip.created_at).toLocaleString('de')}`;

                    const label = document.createElement('span');
                    label.className = 'snip-label';
                    label.innerHTML = `<i class="fas fa-bookmark" style="font-size:0.65rem"></i> ${snip.name}`;

                    const delBtn = document.createElement('button');
                    delBtn.className = 'snip-delete-btn';
                    delBtn.title     = 'Snippet löschen';
                    delBtn.innerHTML = '<i class="fas fa-times"></i>';
                    delBtn.addEventListener('click', e => {
                        e.stopPropagation();
                        if (confirm(`Snippet "${snip.name}" löschen?`)) {
                            apiDeleteSnippet(snip.id, snip.name);
                        }
                    });

                    snipItem.appendChild(label);
                    snipItem.appendChild(delBtn);
                    snipItem.addEventListener('click', () => {
                        selectCommand(cmd.id, snip.params);
                        setStatus(`Snippet geladen: ${snip.name}`);
                    });
                    subcatDiv.appendChild(snipItem);
                });
            });

            subcatWrap.appendChild(subcatDiv);
        });
        catDiv.appendChild(subcatWrap);
        container.appendChild(catDiv);
    });
}

// ─── Select & Display Command ─────────────────────────────────────────────────

async function selectCommand(cmdId, overrideParams) {
    activeCommandId = cmdId;
    const cmd = GDL_COMMANDS[cmdId];
    if (!cmd) return;

    document.querySelectorAll('.cmd-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.cmd-item[data-cmd-id="${cmdId}"]`)?.classList.add('active');

    el('cmdPlaceholder').classList.add('hidden');
    el('cmdContent').classList.remove('hidden');
    el('cmdTitle').textContent       = cmd.label;
    el('cmdPath').textContent        = cmd.path;
    el('cmdDescription').textContent = cmd.description;

    // Sync mode selector buttons to current mode
    document.querySelectorAll('.mode-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.mode === currentMode)
    );
    el('declareActions')?.classList.toggle('hidden', currentMode !== 'declare');

    if (currentMode === 'params') {
        await loadAvailableParams();
    }

    renderForm(cmd, overrideParams);
    generateCode();
    saveState();

    if (!overrideParams) setStatus(`Befehl geladen: ${cmd.label}`);
}

// ─── Coord-Table Helpers ──────────────────────────────────────────────────────

/** Returns { n, colNames } for a coord-table param, reading live DOM values. */
function _getCoordTableConfig(param, cmd) {
    const nParam = param.countRef
        ? cmd.params.find(p => p.id === param.countRef)
        : null;
    const nEl = nParam
        ? (el(`param_${nParam.id}_val`) || el(`param_${nParam.id}`))
        : null;
    const n = Math.max(1, Math.min(50, parseInt(nEl?.value || '4', 10) || 4));
    // colLabels = static string array; colRefs = dynamic (reads from DOM inputs)
    const colNames = param.colLabels
        ? param.colLabels
        : (param.colRefs || []).map(ref => {
            const refEl = el(`param_${ref}`);
            return refEl?.value?.trim() || ref;
        });
    return { n, colNames };
}

/** Reads current table rows from DOM into an array of { x, y, z } string objects. */
function _readCoordTableData(paramId) {
    const tbody = el(`ct_body_${paramId}`);
    if (!tbody) return [];
    const data = [];
    tbody.querySelectorAll('tr').forEach(row => {
        const inputs = row.querySelectorAll('.ct-inp');
        data.push({
            x: inputs[0]?.value ?? '0',
            y: inputs[1]?.value ?? '0',
            z: inputs[2]?.value ?? '0'
        });
    });
    return data;
}

/** Writes current table data as JSON into the hidden input. */
function _syncCoordTableHidden(paramId) {
    const hidden = el(`param_${paramId}`);
    if (hidden) hidden.value = JSON.stringify(_readCoordTableData(paramId));
}

/**
 * Rebuilds tbody rows for a coord-table.
 * prevData: array of { x, y, z } to pre-fill (extra rows default to '0').
 */
function _rebuildCoordTableRows(param, cmd, prevData) {
    const tbody = el(`ct_body_${param.id}`);
    if (!tbody) return;
    const { n, colNames } = _getCoordTableConfig(param, cmd);

    // Update column headers
    const table = tbody.closest('table');
    if (table) {
        const ths = table.querySelectorAll('thead th');
        colNames.forEach((name, ci) => { if (ths[ci + 1]) ths[ci + 1].textContent = name; });
    }

    tbody.innerHTML = '';
    for (let i = 0; i < n; i++) {
        const row   = document.createElement('tr');
        const idxTd = document.createElement('td');
        idxTd.className   = 'ct-i';
        idxTd.textContent = i + 1;
        row.appendChild(idxTd);

        ['x', 'y', 'z'].forEach((key, ci) => {
            const td  = document.createElement('td');
            const inp = document.createElement('input');
            inp.type      = 'text';
            inp.className = 'ct-inp';
            inp.id        = `ct_${param.id}_${i}_${ci}`;
            inp.value     = prevData?.[i]?.[key] ?? '0';
            inp.inputMode = 'decimal';
            inp.addEventListener('input', () => {
                _syncCoordTableHidden(param.id);
                generateCode();
                saveState();
            });
            td.appendChild(inp);
            row.appendChild(td);
        });
        tbody.appendChild(row);
    }
    _syncCoordTableHidden(param.id);
}

// ─── Render Form ──────────────────────────────────────────────────────────────

function renderForm(cmd, overrideParams) {
    const form    = el('cmdForm');
    form.innerHTML = '';
    const globals = getGlobals();
    const inParamsMode = currentMode === 'params';

    cmd.params.forEach(param => {

        // ── section ──────────────────────────────────────────────────────────
        if (param.type === 'section') {
            const div       = document.createElement('div');
            div.className   = 'form-section-header';
            div.textContent = param.label;
            if (param.paramGroup) div.dataset.paramGroup = param.paramGroup;
            form.appendChild(div);
            return;
        }

        // ── var-value ─────────────────────────────────────────────────────────
        if (param.type === 'var-value') {
            const group       = document.createElement('div');
            group.className   = 'form-group form-var-value';

            const label       = document.createElement('label');
            label.textContent = param.label;
            group.appendChild(label);

            const nameKey = `${param.id}_name`;
            const valKey  = `${param.id}_val`;
            const savedName = overrideParams?.[nameKey];
            const savedVal  = overrideParams?.[valKey];

            if (inParamsMode && param.paramType) {
                // ── Params mode: dropdown of filtered parameters ───────────
                const { gdlType, isArray } = resolveParamType(param.paramType);
                const filtered = isArray
                    ? cachedParams.filter(p => p.gdl_type === gdlType && p.array_type && p.array_type !== 'None')
                    : cachedParams.filter(p => p.gdl_type === gdlType && (!p.array_type || p.array_type === 'None'));

                if (filtered.length === 0) {
                    // No params of this type available
                    const notice   = document.createElement('div');
                    notice.className = 'params-notice';
                    notice.innerHTML =
                        `<i class="fas fa-info-circle"></i> ` +
                        `Keine Parameter vom Typ <b>${gdlType}</b> vorhanden.<br>` +
                        `<small>Wechsel zu Modus "Manuell" oder lege zuerst Parameter an.</small>`;
                    group.appendChild(notice);
                    // Hidden input so collectParams still works
                    const hidden     = document.createElement('input');
                    hidden.type      = 'hidden';
                    hidden.id        = `param_${nameKey}`;
                    hidden.value     = savedName ?? param.defaultName ?? '';
                    group.appendChild(hidden);
                } else {
                    const sel = document.createElement('select');
                    sel.id    = `param_${nameKey}`;
                    sel.title = `Typ: ${gdlType}`;

                    filtered.forEach(fp => {
                        const o       = document.createElement('option');
                        o.value       = fp.gdl_name;
                        o.textContent = fp.gdl_name;
                        if (savedName ? fp.gdl_name === savedName : fp.gdl_name === param.defaultName) {
                            o.selected = true;
                        }
                        sel.appendChild(o);
                    });
                    sel.addEventListener('change', () => { generateCode(); saveState(); });
                    group.appendChild(sel);
                }

            } else {
                // ── Manual / declare mode: text inputs ────────────────────
                const row       = document.createElement('div');
                row.className   = 'var-value-row';

                const nameInp   = document.createElement('input');
                nameInp.type    = 'text';
                nameInp.id      = `param_${nameKey}`;
                nameInp.className = 'vv-name';
                nameInp.value   = savedName ?? param.defaultName ?? '';
                nameInp.style.fontFamily = "'JetBrains Mono', monospace";
                nameInp.addEventListener('input',  () => { generateCode(); saveState(); });

                const eqSpan       = document.createElement('span');
                eqSpan.className   = 'var-equals';
                eqSpan.textContent = '=';

                const valInp    = document.createElement('input');
                valInp.type     = 'text';
                valInp.id       = `param_${valKey}`;
                valInp.className = 'vv-val';
                valInp.value    = savedVal ?? param.defaultValue ?? '';
                valInp.addEventListener('input',  () => { generateCode(); saveState(); });

                row.appendChild(nameInp);
                row.appendChild(eqSpan);
                row.appendChild(valInp);
                group.appendChild(row);
            }

            if (param.hint && !inParamsMode) {
                const hint       = document.createElement('div');
                hint.className   = 'hint';
                hint.textContent = param.hint;
                group.appendChild(hint);
            }

            if (param.paramGroup) group.dataset.paramGroup = param.paramGroup;
            form.appendChild(group);
            return;
        }

        // ── select ────────────────────────────────────────────────────────────
        if (param.type === 'select') {
            const group   = document.createElement('div');
            group.className = 'form-group';

            const label       = document.createElement('label');
            label.textContent = param.label;
            label.htmlFor     = `param_${param.id}`;
            group.appendChild(label);

            const sel = document.createElement('select');
            sel.id    = `param_${param.id}`;
            param.options.forEach(opt => {
                const o       = document.createElement('option');
                o.value       = opt.value;
                o.textContent = opt.label;
                sel.appendChild(o);
            });
            sel.value = overrideParams?.[param.id] ?? param.default;
            sel.addEventListener('change', () => { generateCode(); saveState(); });
            group.appendChild(sel);

            if (param.hint) {
                const hint       = document.createElement('div');
                hint.className   = 'hint';
                hint.textContent = param.hint;
                group.appendChild(hint);
            }
            if (param.paramGroup) group.dataset.paramGroup = param.paramGroup;
            form.appendChild(group);
            return;
        }

        // ── coord-table ───────────────────────────────────────────────────────────
        if (param.type === 'coord-table') {
            // Hidden input always present – stores JSON, read by collectParams
            const hidden = document.createElement('input');
            hidden.type  = 'hidden';
            hidden.id    = `param_${param.id}`;
            hidden.value = '[]';
            form.appendChild(hidden);

            if (inParamsMode) return;   // no visual table in params mode

            const wrap = document.createElement('div');
            wrap.className = 'coord-table-wrap';

            const lbl = document.createElement('label');
            lbl.textContent = param.label;
            wrap.appendChild(lbl);

            const table   = document.createElement('table');
            table.className = 'coord-table';
            table.id        = `ct_table_${param.id}`;

            const thead = document.createElement('thead');
            const hrow  = document.createElement('tr');
            const thIdx = document.createElement('th');
            thIdx.textContent = '#';
            hrow.appendChild(thIdx);
            _getCoordTableConfig(param, cmd).colNames.forEach(name => {
                const th = document.createElement('th');
                th.textContent = name;
                hrow.appendChild(th);
            });
            thead.appendChild(hrow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            tbody.id = `ct_body_${param.id}`;
            table.appendChild(tbody);
            wrap.appendChild(table);
            form.appendChild(wrap);

            // Populate rows from saved / override data
            let savedRows = [];
            try {
                const raw = overrideParams?.[param.id];
                if (raw) savedRows = JSON.parse(raw);
            } catch {}
            if (param.paramGroup) wrap.dataset.paramGroup = param.paramGroup;
            _rebuildCoordTableRows(param, cmd, savedRows);
            return;
        }

        // ── text ──────────────────────────────────────────────────────────────
        {
            const group       = document.createElement('div');
            group.className   = 'form-group';

            const label       = document.createElement('label');
            label.textContent = param.label;
            label.htmlFor     = `param_${param.id}`;
            group.appendChild(label);

            const globalDefault = param.defaultFromGlobal
                ? (globals[param.defaultFromGlobal] || param.default)
                : param.default;

            // In params mode with a paramType: show a dropdown
            if (inParamsMode && param.paramType) {
                const { gdlType, isArray } = resolveParamType(param.paramType);
                const filtered = isArray
                    ? cachedParams.filter(p => p.gdl_type === gdlType && p.array_type && p.array_type !== 'None')
                    : cachedParams.filter(p => p.gdl_type === gdlType && (!p.array_type || p.array_type === 'None'));

                const sel   = document.createElement('select');
                sel.id      = `param_${param.id}`;
                const saved = overrideParams?.[param.id] ?? globalDefault;

                if (filtered.length === 0) {
                    const o       = document.createElement('option');
                    o.value       = saved;
                    o.textContent = `(keine ${gdlType}-Parameter)`;
                    sel.appendChild(o);
                } else {
                    filtered.forEach(fp => {
                        const o       = document.createElement('option');
                        o.value       = fp.gdl_name;
                        o.textContent = fp.gdl_name;
                        if (fp.gdl_name === saved) o.selected = true;
                        sel.appendChild(o);
                    });
                }
                sel.addEventListener('change', () => { generateCode(); saveState(); });
                group.appendChild(sel);
            } else {
                const inp = document.createElement('input');
                inp.type  = 'text';
                inp.id    = `param_${param.id}`;
                inp.value = overrideParams?.[param.id] ?? globalDefault;
                if (param.mono) inp.style.fontFamily = "'JetBrains Mono', 'Consolas', monospace";
                if (param.defaultFromGlobal) inp.dataset.globalKey = param.defaultFromGlobal;
                inp.addEventListener('input',  () => { generateCode(); saveState(); });
                inp.addEventListener('change', () => { generateCode(); saveState(); });
                group.appendChild(inp);
            }

            if (param.hint) {
                const hint       = document.createElement('div');
                hint.className   = 'hint';
                hint.textContent = param.hint;
                group.appendChild(hint);
            }
            if (param.paramGroup) group.dataset.paramGroup = param.paramGroup;
            form.appendChild(group);
        }
    });

    // ── Wire up coord-table: resize on count change, update headers on name change ──
    if (!inParamsMode) {
        cmd.params.forEach(param => {
            if (param.type !== 'coord-table') return;

            // Resize table when count (varN_val) changes
            const nParam = param.countRef
                ? cmd.params.find(p => p.id === param.countRef)
                : null;
            if (nParam) {
                const nEl = el(`param_${nParam.id}_val`) || el(`param_${nParam.id}`);
                if (nEl) {
                    nEl.addEventListener('input', () => {
                        const prev = _readCoordTableData(param.id);
                        _rebuildCoordTableRows(param, cmd, prev);
                        generateCode();
                        saveState();
                    });
                }
            }

            // Update column headers when array name inputs change (only for colRefs, not colLabels)
            (param.colRefs || []).forEach(ref => {
                const refEl = el(`param_${ref}`);
                if (refEl) {
                    refEl.addEventListener('input', () => {
                        const table = el(`ct_table_${param.id}`);
                        if (!table) return;
                        const { colNames } = _getCoordTableConfig(param, cmd);
                        const ths = table.querySelectorAll('thead th');
                        colNames.forEach((name, ci) => { if (ths[ci + 1]) ths[ci + 1].textContent = name; });
                    });
                }
            });
        });
    }

    // ── Wire up paramGroup visibility (select params with 'controls' property) ──
    cmd.params.forEach(param => {
        if (param.type !== 'select' || !param.controls) return;
        const selEl = el(`param_${param.id}`);
        if (!selEl) return;
        const groups = param.options.map(o => o.value);
        const syncGroups = () => {
            const active = selEl.value;
            groups.forEach(g => {
                form.querySelectorAll(`[data-param-group="${g}"]`).forEach(wrap => {
                    wrap.style.display = g === active ? '' : 'none';
                });
            });
        };
        syncGroups();   // apply immediately on render
        selEl.addEventListener('change', syncGroups);
    });

    // ── Querschnitt-Favorit loader (for commands with querschnittBased: true) ──
    if (cmd.querschnittBased) {
        const qlSnippets = cachedSnippets['querschnitt'] || [];
        if (qlSnippets.length > 0) {
            const qlWrap = document.createElement('div');
            qlWrap.className = 'querschnitt-loader';
            qlWrap.id        = 'querschnittLoader';

            const qlLabel       = document.createElement('span');
            qlLabel.className   = 'ql-label';
            qlLabel.textContent = 'Querschnitts-Favorit:';
            qlWrap.appendChild(qlLabel);

            const qlSel = document.createElement('select');
            qlSel.id    = 'querschnittSelect';
            qlSel.className = 'ql-select';
            qlSnippets.forEach(snip => {
                const o       = document.createElement('option');
                o.value       = String(snip.id);
                o.textContent = snip.name;
                qlSel.appendChild(o);
            });
            qlWrap.appendChild(qlSel);

            const qlBtn       = document.createElement('button');
            qlBtn.className   = 'ql-btn';
            qlBtn.type        = 'button';
            qlBtn.innerHTML   = '<i class="fas fa-arrow-down"></i> Laden';
            qlBtn.addEventListener('click', () => loadQuerschnitt());
            qlWrap.appendChild(qlBtn);

            form.appendChild(qlWrap);
        }
    }
}

// ─── Collect Form Values ──────────────────────────────────────────────────────

function collectParams(cmd) {
    const p = {};
    cmd.params.forEach(param => {
        if (param.type === 'section') return;
        if (param.type === 'var-value') {
            const n = el(`param_${param.id}_name`);
            const v = el(`param_${param.id}_val`);
            p[`${param.id}_name`] = n?.value ?? param.defaultName ?? '';
            p[`${param.id}_val`]  = v?.value ?? param.defaultValue ?? '';
        } else {
            const inp = el(`param_${param.id}`);
            p[param.id] = inp?.value ?? param.default ?? '';
        }
    });
    // Signal to generate() whether to skip variable declarations
    p._skipDecl = currentMode === 'params';
    return p;
}

// ─── Generate Code ────────────────────────────────────────────────────────────

function generateCode() {
    if (!activeCommandId) return;
    const cmd = GDL_COMMANDS[activeCommandId];
    if (!cmd) return;
    generatedCode = cmd.generate(collectParams(cmd));
    el('codePreview').innerHTML = highlightGDL(generatedCode);
    setStatus('Code generiert');
}

// ─── Clear Command ────────────────────────────────────────────────────────────

function clearCommand() {
    activeCommandId = null;
    generatedCode   = '';
    currentMode     = 'manual';
    clearState();
    document.querySelectorAll('.cmd-item').forEach(i => i.classList.remove('active'));
    el('cmdPlaceholder').classList.remove('hidden');
    el('cmdContent').classList.add('hidden');
    el('codePreview').innerHTML =
        '<span style="color:#555;font-style:italic">! Wähle einen Befehl und fülle die Felder aus – der Code erscheint hier.</span>';
    setStatus('Zurückgesetzt');
}

// ─── Save as Snippet ──────────────────────────────────────────────────────────

async function promptSaveSnippet() {
    if (!activeCommandId || !generatedCode) { setStatus('Kein Code zum Speichern'); return; }
    const cmd      = GDL_COMMANDS[activeCommandId];
    const fallback = `${cmd?.label || 'Snippet'} – ${new Date().toLocaleDateString('de')}`;
    const name     = prompt('Snippet-Name:', fallback);
    if (!name?.trim()) return;
    try {
        const res = await fetch(`${API_BASE}/snippets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_id: activeCommandId,
                name:       name.trim(),
                params:     collectParams(cmd)
            })
        });
        const result = await res.json();
        if (result.success) {
            await loadSnippets(true);
            renderTree();
            setStatus(`Snippet gespeichert: "${name.trim()}"`);
        } else {
            setStatus(`Fehler: ${result.error || 'Snippet konnte nicht gespeichert werden'}`);
        }
    } catch {
        setStatus('Netzwerkfehler beim Speichern des Snippets');
    }
}

// ─── Load Querschnitts-Favorit into active command ───────────────────────────

function loadQuerschnitt() {
    if (!activeCommandId) return;
    const sel = el('querschnittSelect');
    if (!sel) return;
    const snippets = cachedSnippets['querschnitt'] || [];
    const snip = snippets.find(s => String(s.id) === sel.value);
    if (!snip) return;
    const current = collectParams(GDL_COMMANDS[activeCommandId]);
    // Merge: querschnitt snippet params overwrite profile fields in current command
    const merged = { ...current, ...snip.params };
    renderForm(GDL_COMMANDS[activeCommandId], merged);
    generateCode();
    saveState();
    setStatus(`Querschnitt geladen: ${snip.name}`);
}

// ─── Save Variables as Parameters (Mode c) ────────────────────────────────────

async function saveAsParameters() {
    if (!activeCommandId) return;
    const cmd      = GDL_COMMANDS[activeCommandId];
    const params   = collectParams(cmd);
    const objectId = localStorage.getItem('currentGdlObjectId');

    if (!objectId) {
        alert('Kein Objekt ausgewählt. Bitte zuerst ein GDL-Objekt wählen.');
        return;
    }

    // Find count param (role:'count') for array dimension defaults
    const countParam = cmd.params.find(p => p.role === 'count');
    const countVal   = countParam
        ? (parseInt(params[`${countParam.id}_val`] || params[countParam.id] || '10', 10) || 10)
        : 10;

    // Collect which params to create (var-value AND text fields that have a paramType)
    const toCreate = [];
    cmd.params.forEach(p => {
        if (p.type === 'var-value' && p.paramType) {
            const name  = params[`${p.id}_name`]?.trim();
            const value = params[`${p.id}_val`]?.trim() ?? '';
            if (!name) return;
            const { gdlType } = resolveParamType(p.paramType);
            toCreate.push({ gdl_name: name, gdl_type: gdlType, rawValue: value, label: p.label });
        } else if (p.type === 'text' && p.paramType) {
            const name = params[p.id]?.trim();
            if (!name) return;
            const { gdlType, isArray } = resolveParamType(p.paramType);
            const rawValue = isArray ? '0' : (params[`${p.id}_val`]?.trim() || p.defaultValue || '1');
            const entry = { gdl_name: name, gdl_type: gdlType, rawValue, label: p.label };
            if (isArray) {
                entry.array_type      = '1D';
                entry.array_first_dim = countVal;
            }
            toCreate.push(entry);
        }
    });

    if (toCreate.length === 0) {
        setStatus('Keine Variablen zum Anlegen gefunden');
        return;
    }

    // Build confirm message
    const listText = toCreate.map(t => `• ${t.gdl_name}  (${t.gdl_type})`).join('\n');
    const confirmed = confirm(
        `Sollen folgende Variablen als Parameter angelegt werden?\n\n${listText}\n\n` +
        `Bereits vorhandene Parameter werden übersprungen.\n` +
        `Neue Parameter werden am Ende der Parameterliste eingefügt.`
    );
    if (!confirmed) return;

    // Reload params to check for existing ones
    await loadAvailableParams(true);
    const existingNames = new Set(cachedParams.map(p => p.gdl_name.toLowerCase()));

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const item of toCreate) {
        if (existingNames.has(item.gdl_name.toLowerCase())) {
            skipped++;
            continue;
        }

        // Determine JSON value
        const num       = parseFloat(item.rawValue);
        const jsonValue = (!isNaN(num) && String(num) === item.rawValue)
            ? JSON.stringify(num)
            : JSON.stringify(item.rawValue);

        try {
            const res = await fetch(`${API_BASE}/parameters/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gdl_object_id:     objectId,
                    gdl_name:          item.gdl_name,
                    gdl_type:          item.gdl_type,
                    default_value_json: jsonValue,
                    array_type:        item.array_type      || 'None',
                    array_first_dim:   item.array_first_dim || 0,
                    array_second_dim:  0
                })
            });
            const result = await res.json();
            if (result.success) {
                created++;
                existingNames.add(item.gdl_name.toLowerCase()); // prevent double-create
            } else {
                errors.push(`${item.gdl_name}: ${result.error || 'Fehler'}`);
            }
        } catch (e) {
            errors.push(`${item.gdl_name}: Netzwerkfehler`);
        }
    }

    // Reload and switch to params mode
    await loadAvailableParams(true);

    let msg = `${created} Parameter angelegt`;
    if (skipped) msg += `, ${skipped} übersprungen (bereits vorhanden)`;
    if (errors.length) msg += `, ${errors.length} Fehler`;
    setStatus(msg);

    if (errors.length) {
        alert(`Fehler beim Anlegen:\n${errors.join('\n')}`);
    }

    // Switch to params mode and re-render
    await switchMode('params', params);
}

// ─── Global Settings Panel ────────────────────────────────────────────────────

function renderGlobals() {
    const g = getGlobals();
    const set = (id, key, fallback) => { const e = el(id); if (e) e.value = g[key] ?? fallback; };
    set('globalEps',      'eps',      'eps');
    set('globalUnID',     'unID',     'unID');
    set('globalLoopMain', 'loopMain', 'i, j, k');
    set('globalLoopSub',  'loopSub',  'ii, jj, kk');
}

function onGlobalChange() {
    const oldGlobals = getGlobals();
    const get = (id, fb) => el(id)?.value.trim() || fb;
    const newGlobals = {
        ...oldGlobals,
        eps:      get('globalEps',      'eps'),
        unID:     get('globalUnID',     'unID'),
        loopMain: get('globalLoopMain', 'i, j, k'),
        loopSub:  get('globalLoopSub',  'ii, jj, kk')
    };
    saveGlobals(newGlobals);

    // Propagate changed globals to open form fields
    if (activeCommandId) {
        document.querySelectorAll('[data-global-key]').forEach(inp => {
            const key    = inp.dataset.globalKey;
            const oldVal = oldGlobals[key] ?? key;
            if (inp.value === oldVal) inp.value = newGlobals[key] || oldVal;
        });
        generateCode();
        saveState();
    }
    setStatus('Globale Einstellungen gespeichert');
}

function initGlobalsToggle() {
    const toggle = el('globalsToggle');
    const body   = el('globalsBody');
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
        const collapsed = toggle.classList.toggle('collapsed');
        body.style.display = collapsed ? 'none' : '';
    });
}

// ─── GDL Syntax Highlighter ───────────────────────────────────────────────────

function highlightGDL(code) {
    let out = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    out = out.replace(
        /\b(HOTSPOT2?|POLY2_B|POLY2|LINE2|ARC2|CIRCLE2|RECT2|TEXT2|PICTURE2|ADD2|ROT2|MUL2|DEL|PEN|FILL|PUT|GET|DIM|FOR|TO|NEXT|IF|THEN|ELSE|ENDIF|END|GOSUB|RETURN|GOTO|TUBE|PRISM_|MATERIAL|MOD|MAX|MIN|ABS|SQR|ASN|SGN|COS|SIN|INT|NOT|AND|OR|NSP|VARDIM1)\b/g,
        '<span class="gdl-kw">$1</span>'
    );
    out = out.replace(
        /(?<![a-zA-Z_])(-?\d+(?:\.\d+)?)(?![a-zA-Z_])/g,
        '<span class="gdl-num">$1</span>'
    );
    out = out.replace(/(![^\n]*)/g, '<span class="gdl-cmt">$1</span>');
    return out;
}

// ─── Copy / Insert ────────────────────────────────────────────────────────────

function copyCode() {
    if (!generatedCode) { setStatus('Kein Code zum Kopieren'); return; }
    navigator.clipboard.writeText(generatedCode).then(() => {
        setStatus('Code in Zwischenablage kopiert ✓');
        const btn  = el('copyCodeBtn');
        const orig = btn.innerHTML;
        btn.innerHTML        = '<i class="fas fa-check"></i> Kopiert!';
        btn.style.borderColor = '#4CAF50';
        btn.style.color       = '#4CAF50';
        setTimeout(() => { btn.innerHTML = orig; btn.style.borderColor = ''; btn.style.color = ''; }, 2000);
    }).catch(() => setStatus('Kopieren fehlgeschlagen'));
}

function insertIntoScriptEditor() {
    if (!generatedCode) { setStatus('Kein Code zum Einfügen'); return; }
    localStorage.setItem('codeForgeInsert', generatedCode);
    setStatus('Code gespeichert – wechsle zum Script Editor …');
    window.location.href = 'script-editor.html';
}

// ─── Header ───────────────────────────────────────────────────────────────────

async function loadHeaderInfo() {
    const objectId = localStorage.getItem('currentGdlObjectId');
    if (!objectId) return;
    try {
        const res    = await fetch(`${API_BASE}/gdl-objects/${objectId}`);
        const result = await res.json();
        if (result.success && result.data) {
            el('headerObjectName').textContent = `Objekt: ${result.data.name}`;
        }
    } catch { /* non-critical */ }
}

// ─── Tree Search ──────────────────────────────────────────────────────────────

function filterTree(query) {
    const q = query.trim().toLowerCase();
    let anyVisible = false;

    document.querySelectorAll('.cmd-category').forEach(catDiv => {
        let catHasMatch = false;

        catDiv.querySelectorAll('.cmd-subcategory').forEach(subcatDiv => {
            let subcatHasMatch = false;

            subcatDiv.querySelectorAll('.cmd-item:not(.cmd-snippet)').forEach(item => {
                const cmdId = item.dataset.cmdId;
                const cmd   = cmdId ? GDL_COMMANDS[cmdId] : null;
                const match = !q || (cmd && (
                    cmd.label.toLowerCase().includes(q) ||
                    cmd.subcategory.toLowerCase().includes(q) ||
                    cmd.category.toLowerCase().includes(q)
                ));
                item.style.display = match ? '' : 'none';
                // Show/hide snippets belonging to this item
                let sib = item.nextElementSibling;
                while (sib && sib.classList.contains('cmd-snippet')) {
                    sib.style.display = match ? '' : 'none';
                    sib = sib.nextElementSibling;
                }
                if (match) subcatHasMatch = true;
            });

            subcatDiv.style.display = subcatHasMatch ? '' : 'none';
            if (subcatHasMatch) catHasMatch = true;
        });

        catDiv.style.display = catHasMatch ? '' : 'none';
        if (catHasMatch) anyVisible = true;
    });

    const noResults = el('treeNoResults');
    if (noResults) noResults.style.display = (!anyVisible && q) ? 'block' : 'none';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    renderGlobals();
    initGlobalsToggle();
    await loadSnippets();
    renderTree();

    el('treeSearch')?.addEventListener('input', e => filterTree(e.target.value));

    // Mode selector buttons
    document.querySelectorAll('.mode-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            if (!activeCommandId) return;
            const params = collectParams(GDL_COMMANDS[activeCommandId]);
            switchMode(btn.dataset.mode, params);
        })
    );

    el('copyCodeBtn')    ?.addEventListener('click', copyCode);
    el('insertCodeBtn')  ?.addEventListener('click', insertIntoScriptEditor);
    el('clearBtn')       ?.addEventListener('click', clearCommand);
    el('saveSnippetBtn') ?.addEventListener('click', promptSaveSnippet);
    el('saveAsParamsBtn')?.addEventListener('click', saveAsParameters);

    ['globalEps', 'globalUnID', 'globalLoopMain', 'globalLoopSub'].forEach(id =>
        el(id)?.addEventListener('input', onGlobalChange)
    );

    // Restore session state
    const state = loadState();
    if (state?.cmdId && GDL_COMMANDS[state.cmdId]) {
        currentMode = state.mode || 'manual';
        await selectCommand(state.cmdId, state.params);
        setStatus('Sitzung wiederhergestellt');
    }

    loadHeaderInfo();
    if (!activeCommandId) setStatus('Bereit');


});
