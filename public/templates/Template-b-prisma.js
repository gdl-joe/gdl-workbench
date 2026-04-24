// Template b-prisma
// Dieses Template implementiert die Standard b-prisma UI Struktur mit Tabs (oben/unten) und Rahmen.

window.GdlTemplateBPrisma = {
    name: "b-prisma Standard",
    id: "b-prisma",

    // Rendert die Vorschau im Canvas (DOM-Manipulation)
    renderPreview: function (container, uiConfig, parameters) {
        const getParamVal = (name, fallback) => {
            const p = parameters.find(p => p.gdl_name === name);
            if (!p || !p.default_value_json) return fallback;
            try { return JSON.parse(p.default_value_json); } catch (e) { return p.default_value_json; }
        };

        const nTabs = parseInt(getParamVal('nTabs', uiConfig.pages.length));

        // TabTitles extraction
        let rawTabTitles = getParamVal('TabTitles', null);
        let tabTitles = [];
        if (Array.isArray(rawTabTitles)) {
            tabTitles = rawTabTitles;
        } else if (typeof rawTabTitles === 'object' && rawTabTitles !== null) {
            tabTitles = Object.values(rawTabTitles);
        } else if (rawTabTitles !== null) {
            tabTitles = [rawTabTitles];
        } else {
            tabTitles = uiConfig.pages.map(p => p.name);
        }

        // SubTabs Parameters
        let rawNTabsSub = getParamVal('nTabs_sub', null);
        let nTabsSub = [];
        if (Array.isArray(rawNTabsSub)) nTabsSub = rawNTabsSub;
        else if (typeof rawNTabsSub === 'object' && rawNTabsSub !== null) nTabsSub = Object.values(rawNTabsSub);
        else nTabsSub = new Array(nTabs).fill(0);

        let rawSubTabTitles = getParamVal('subTabTitles', null);
        let subTabTitles = [];
        if (Array.isArray(rawSubTabTitles)) subTabTitles = rawSubTabTitles;

        const uiWidth = uiConfig.width;
        const uiHeight = uiConfig.height;
        const hit_diff = uiHeight - 266;

        // Helper Line Drawer
        const drawLine = (x1, y1, x2, y2) => {
            const line = document.createElement('div');
            line.className = 'ui-element ui-separator template-element';
            line.style.left = `${Math.min(x1, x2)}px`;
            line.style.top = `${Math.min(y1, y2)}px`;
            line.style.width = `${Math.max(1, Math.abs(x2 - x1))}px`;
            line.style.height = `${Math.max(1, Math.abs(y2 - y1))}px`;
            line.style.backgroundColor = '#8899a6'; // Light Gray
            line.style.opacity = '0.6';
            line.style.pointerEvents = 'none';
            container.appendChild(line);
        };

        // 1. Determine Layout (Subroutine 99 logic)
        // Frame Lines
        drawLine(1, 30, 1, 265 + hit_diff);
        drawLine(uiWidth - 3, 30, uiWidth - 3, 265 + hit_diff);

        const currentSubTabs = (nTabsSub[uiConfig.currentPage] && parseInt(nTabsSub[uiConfig.currentPage]) > 1) ? parseInt(nTabsSub[uiConfig.currentPage]) : 0;
        // If subtabs exist, bottom line is at 243+diff (Sub 111), else 263+diff (Sub 99)
        const bottomLineY = currentSubTabs > 1 ? 243 + hit_diff : 263 + hit_diff;

        // Only draw bottom line if NO subtabs (Standard Box), otherwise subtabs handle bottom separation
        if (currentSubTabs <= 1) {
            drawLine(3, bottomLineY, uiWidth - 2, bottomLineY);
        }


        // 2. Top Tabs (Subroutine 100)
        let curX = 1;
        const xAddition = Math.floor(uiWidth / Math.max(1, nTabs)) - 1;

        for (let i = 0; i < nTabs; i++) {
            const isCurrent = (i === uiConfig.currentPage);
            const title = tabTitles[i] || `Seite ${i + 1}`;

            if (isCurrent) {
                // Current Tab (Outfield style) → UI_STYLE 2,0 (normal), schwarz, zentriert
                const tab = document.createElement('div');
                tab.className = 'ui-element ui-outfield template-element';
                tab.style.left = `${curX + 4}px`;
                tab.style.top = '4px';
                tab.style.width = `${xAddition - 9}px`;
                tab.style.height = '20px';
                tab.style.display = 'flex';
                tab.style.alignItems = 'center';
                tab.style.justifyContent = 'center';
                tab.style.fontFamily = 'Arial';
                tab.style.fontSize = '11px';
                tab.style.fontWeight = 'normal';
                tab.style.color = '#000';
                tab.textContent = title;
                tab.style.pointerEvents = 'none';
                container.appendChild(tab);

                // Tab Border
                drawLine(curX, 2, curX, 30); // Left
                drawLine(curX + 2, 1, curX + xAddition - 2, 1); // Top
                drawLine(curX + xAddition - 4, 3, curX + xAddition - 4, 31); // Right

                // Separator lines beside tab (y=29)
                if (curX > 1) drawLine(3, 29, curX + 1, 29);
                if (curX < uiWidth) drawLine(curX + xAddition - 2, 29, uiWidth - 2, 29);

            } else {
                // Inactive Tab (Button style) → UI_STYLE 2,1 (bold), schwarz, zentriert
                const btn = document.createElement('div');
                btn.className = 'ui-element ui-button shadow-outer template-element';
                btn.style.left = `${curX + 1}px`;
                btn.style.top = '2px';
                btn.style.width = `${xAddition - 3}px`;
                btn.style.height = '24px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.fontFamily = 'Arial';
                btn.style.fontSize = '11px';
                btn.style.fontWeight = 'bold';
                btn.style.color = '#000';
                btn.textContent = title;
                btn.style.pointerEvents = 'none';
                // Make it look like inactive button (grayish/transparent)
                btn.style.backgroundColor = 'rgba(255,255,255,0.8)';
                container.appendChild(btn);
            }
            curX += xAddition;
        }

        // 3. Bottom Tabs (Subroutine 300 / 112)
        if (currentSubTabs > 1) {
            let subCurX = 1;
            const subXAddition = Math.floor(uiWidth / currentSubTabs) - 1;
            const currentSubPage = 0; // Default to first subtab active for preview

            const mySubTitles = (subTabTitles && subTabTitles[uiConfig.currentPage]) ? subTabTitles[uiConfig.currentPage] : [];

            for (let j = 0; j < currentSubTabs; j++) {
                const isCurrentSub = (j === currentSubPage);
                const subTitle = (mySubTitles && mySubTitles[j]) ? mySubTitles[j] : `Sub ${j + 1}`;

                if (isCurrentSub) {
                    // Active Subtab → UI_STYLE 2,0 (normal), schwarz, zentriert
                    const tab = document.createElement('div');
                    tab.className = 'ui-element ui-outfield template-element';
                    tab.style.left = `${subCurX + 4}px`;
                    tab.style.top = `${245 + hit_diff}px`;
                    tab.style.width = `${subXAddition - 9}px`;
                    tab.style.height = '20px';
                    tab.style.display = 'flex';
                    tab.style.alignItems = 'center';
                    tab.style.justifyContent = 'center';
                    tab.style.fontFamily = 'Arial';
                    tab.style.fontSize = '11px';
                    tab.style.fontWeight = 'normal';
                    tab.style.color = '#000';
                    tab.textContent = subTitle;
                    container.appendChild(tab);

                    // SubTab Borders (Subroutine 112)
                    drawLine(subCurX, 243 + hit_diff, subCurX, 265 + hit_diff); // Left
                    drawLine(subCurX + 2, 264 + hit_diff, subCurX + subXAddition - 2, 264 + hit_diff); // Bottom
                    drawLine(subCurX + subXAddition - 4, 243 + hit_diff, subCurX + subXAddition - 4, 265 + hit_diff); // Right

                    // Horizontal Separators beside active tab
                    if (subCurX > 1) drawLine(3, 241 + hit_diff, subCurX + 1, 241 + hit_diff);
                    if (subCurX < uiWidth) drawLine(subCurX + subXAddition - 2, 241 + hit_diff, uiWidth - 2, 241 + hit_diff);

                } else {
                    // Inactive Subtab → UI_STYLE 2,1 (bold), schwarz, zentriert
                    const btn = document.createElement('div');
                    btn.className = 'ui-element ui-button shadow-outer template-element';
                    btn.style.left = `${subCurX + 1}px`;
                    btn.style.top = `${245 + hit_diff}px`;
                    btn.style.width = `${subXAddition - 3}px`;
                    btn.style.height = '20px';
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.justifyContent = 'center';
                    btn.style.fontFamily = 'Arial';
                    btn.style.fontSize = '11px';
                    btn.style.fontWeight = 'bold';
                    btn.style.color = '#000';
                    btn.textContent = subTitle;
                    btn.style.backgroundColor = 'rgba(255,255,255,0.8)';
                    container.appendChild(btn);
                }
                subCurX += subXAddition;
            }
        }
    },

    // Generiert das GDL Script
    generateScript: function (uiConfig, parameters, helperFuncs) {
        const { generateScriptHeader, generateScriptEnd, generateSubroutineWrapper, getValuesData } = helperFuncs;

        const spacer = '-'.repeat(70);
        let code = "";
        code += generateScriptHeader('U I  -  S c r i p t');
        code += `UI_DIALOG "${uiConfig.name || 'GDL-UI-Studio'}", ${uiConfig.width}, ${uiConfig.height}\n\n`;

        // Variable initialization
        code += `\tint_ui_wid\t= ${uiConfig.width}\n`;
        code += `\tint_ui_hit\t= ${uiConfig.height}\n`;
        code += `\tnTabs     \t= ${uiConfig.pages.length}\n`;
        code += `\tstr_objectName\t= "Project"\n`;
        code += `\tstr_version\t= "1.0"\n`;
        code += `\tstr_date\t= "${new Date().toLocaleDateString('de-DE')}"\n\n`;

        // Header Logic from Template
        code += `\twid_diff \t= int_ui_wid - 480\t\t\t\t! Differenz Breite zu Standard\n`;
        code += `\thit_diff \t= int_ui_hit - 266\t\t\t\t! Differenz Höhe zu Standard\n\n`;
        code += `\tUI_DIALOG str_objectName + " V" + str_version + ":" + str_date, int_ui_wid, int_ui_hit\n\n`;
        code += `\t! Parameters for ArchiCAD version and Platform\n`;
        code += `\tDose = 0\n`;
        code += `\tGDL = REQ("GDL_Version")\n`;
        code += `\tsts = REQUEST("Name_of_program", "", TeX)\n`;
        code += `\tIF STRSTR(TeX,".EXE") OR STRSTR(TeX,".exe") THEN Dose = 1\n\n`;
        code += `\t! Seitendefinition\n`;
        code += `\tUI_CURRENT_PAGE gs_ui_current_page\n\n`;
        code += `\tdy_start = 30\n`;
        code += `\tled = 25\n`;
        code += `\ttx1 = 0\n`;
        code += `\tdrawBox = 1\n\n`;

        code += `! ${spacer} ! \n`;
        code += `! ${spacer} ! \n\n`;

        // Logic for dynamic tabs
        code += `TABID_ROOT = -1\n`;
        code += `DIM TAB_ID[], TAB_ID_SUB[][]\n\n`;
        code += `! Tab-IDs dynamisch generieren\n`;
        code += `_idxTab = 1\n`;
        code += `FOR i = 1 TO nTabs\n`;
        code += `    TAB_ID[i] = _idxTab\n`;
        code += `    _idxTab = _idxTab + 1\n`;
        code += `    IF nTabs_sub[i] > 1 THEN\n`;
        code += `        FOR j = 1 TO (nTabs_sub[i] - 1)\n`;
        code += `            TAB_ID_SUB[i][j] = _idxTab\n`;
        code += `            _idxTab = _idxTab + 1\n`;
        code += `        NEXT j\n`;
        code += `    ENDIF\n`;
        code += `NEXT i\n\n`;

        code += `! UI-Pages dynamisch erstellen\n`;
        code += `FOR i = 1 TO nTabs\n`;
        code += `    UI_PAGE TAB_ID[i], TABID_ROOT, TabTitles[i], TabPicture[i]\n`;
        code += `    GOSUB "UI_PAGE " + STR(i, 1, 0)\n`;
        code += `    IF nTabs_sub[i] > 1 THEN\n`;
        code += `        FOR j = 1 TO (nTabs_sub[i] - 1)\n`;
        code += `            UI_PAGE TAB_ID_SUB[i][j], TAB_ID[i], subTabTitles[i][j+1], subTabPicture[i][j+1]\n`;
        code += `            GOSUB "UI_PAGE " + STR(i, 1, 0) + "_" + STR(j, 1, 0)\n`;
        code += `        NEXT j\n`;
        code += `    ENDIF\n`;
        code += `NEXT i\n\n\n`;

        code += generateScriptEnd() + "\n";

        // Generate Page Subroutines
        uiConfig.pages.forEach((page, pageIndex) => {
            let pageCode = "";
            pageCode += `\tGOSUB 99\t\t\t\t\t\t! UI-DRAWABOX \n`;
            pageCode += `\tGOSUB 100\t\t\t\t\t\t! UI-Tabcontrol \n`;
            pageCode += `\tdy = dy_start\n\n`;

            let currentUiStyle = null;

            page.elements.forEach(element => {
                // UI_STYLE setzen
                if (element.uiStyle) {
                    const [style1, style2] = element.uiStyle.split(',');
                    if (currentUiStyle !== element.uiStyle) {
                        pageCode += `\tUI_STYLE ${style1}, ${style2}\n`;
                        currentUiStyle = element.uiStyle;
                    }
                }

                if (element.type === 'UI_INFIELD') {
                    const paramName = element.paramName || 'A';
                    const adjustedWidth = Math.max(1, element.width - 2);
                    const param = parameters.find(p => p.gdl_name === paramName);
                    const valuesData = param ? getValuesData(param) : null;

                    if (valuesData && valuesData.type === 'VALUES2') {
                        const baseName = `_${paramName}`;
                        pageCode += `\tUI_INFIELD{3} "${paramName}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(adjustedWidth)}, ${Math.round(element.height)}, \n`;
                        pageCode += `\t8, "", \n`;
                        pageCode += `\t0, 0, 0, 0, 0, 0, \n`;
                        pageCode += `\t${baseName}_pic, ${baseName}_text, ${baseName}_value\n`;
                    } else {
                        pageCode += `\tUI_INFIELD "${paramName}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(adjustedWidth)}, ${Math.round(element.height)}\n`;
                    }
                }

                if (element.type === 'UI_INFIELD_IMAGE') {
                    const paramName = element.gdlParam || 'A';
                    const baseName = `_${paramName}`;
                    const method = element.imageMethod || 2;
                    const imageCount = element.imageCount || 3;
                    const imageRows = element.imageRows || 3;
                    const cellX = element.cellX || 30;
                    const cellY = element.cellY || 30;
                    const imageX = element.imageX || 30;
                    const imageY = element.imageY || 30;

                    pageCode += `\tUI_INFIELD{3} "${paramName}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}, \n`;
                    pageCode += `\t${method}, "", \n`;
                    pageCode += `\t${imageCount}, ${imageRows}, \n`;
                    pageCode += `\t${cellX}, ${cellY}, ${imageX}, ${imageY}, \n`;
                    pageCode += `\t${baseName}_pic, ${baseName}_text, ${baseName}_value\n`;
                }

                if (element.type === 'UI_OUTFIELD') {
                    const text = element.outfieldText || 'Text';
                    let flag = 0;
                    if (element.textAlign === 1) flag += 1;
                    if (element.textGrayed) flag = 4; // Simplified flag
                    pageCode += `\tUI_OUTFIELD "${text}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}${flag ? ', ' + flag : ''}\n`;
                }

                if (element.type === 'UI_BUTTON') {
                    const text = element.buttonText || element.paramName || 'Button';
                    const paramName = element.gdlParam ? `"${element.gdlParam}"` : 'UI_FUNCTION';
                    const buttonId = element.buttonId || 0;
                    const linkUrl = element.linkUrl ? `"${element.linkUrl}"` : '""';
                    const tooltipText = element.tooltipText ? `"${element.tooltipText}"` : '""';
                    pageCode += `\tUI_BUTTON UI_LINK, "${text}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}, ${buttonId}, ${linkUrl} UI_TOOLTIP ${tooltipText}\n`;
                }

                if (element.type === 'UI_SEPARATOR') {
                    const x2 = (element.x2 !== undefined) ? element.x2 : element.x + element.width;
                    const y2 = (element.y2 !== undefined) ? element.y2 : element.y + element.height;
                    pageCode += `\tUI_SEPARATOR ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(x2)}, ${Math.round(y2)}\n`;
                }

                if (element.type === 'UI_PICT') {
                    // UI_PICT "image", x, y, w, h, mask
                    const imgName = element.imageName || 'placeholder_ui_pict.png';
                    const mask = element.mask || 0;
                    pageCode += `\tUI_PICT "${imgName}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}, ${mask}\n`;
                }

                if (element.type === 'UI_RADIOBUTTON') {
                    const paramName = element.gdlParam || 'A';
                    const value = element.radioValue || '1';
                    const text = element.buttonText || 'Radiobutton';
                    pageCode += `\tUI_RADIOBUTTON "${paramName}", ${value}, "${text}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}\n`;
                }
            });

            code += generateSubroutineWrapper(`UI_PAGE ${pageIndex + 1}`, pageCode);
        });

        // Include Template Static Helper Subroutines
        code += `! ${spacer} ! \n`;
        code += `! ${spacer} ! \n`;
        code += `! STATIC TEMPLATE HELPERS \n`;
        code += `! ${spacer} ! \n\n`;

        code += `99: ! Draw Box einfach: Rahmen unten ohn Subpages \n\n`;
        code += `\tIF drawBox THEN \n`;
        code += `\t\tUI_SEPARATOR\t1,   \t\t30,  \t\t\t1, \t\t265 + hit_diff\t\t! Hauptfeld Linie Senkrecht Links \n`;
        code += `\t\tUI_SEPARATOR\tint_ui_wid - 3, \t30, \t\t\tint_ui_wid - 3, 265 + hit_diff\t\t! Hauptfeld Linie Senkrecht Rechts \n`;
        code += `\t\tUI_SEPARATOR\t3 - dose * 1,  \t263 + hit_diff, \tint_ui_wid - 2, 263 + hit_diff\t\t! Hauptfeld Linie Waagerecht unten \n`;
        code += `\tENDIF \n\t\t\nRETURN \n\n`;

        code += `100: ! Tab Control Standard (Tabs oben)\n`;
        code += `\tcurX = 1 \n`;
        code += `\txAddition = INT(int_ui_wid / nTabs)-1 \n`;
        code += `\tUI_STYLE 2, 1 \t\t\t\t\t! Inaktive Tabs: UI_STYLE 2,1 (bold)\n`;
        code += `\tFOR i_sub = 1 TO nTabs\n`;
        code += `\t\tIF gs_ui_current_page = TAB_ID[i_sub] THEN \n`;
        code += `\t\t\tUI_STYLE 2, 0 \t\t\t\t\t! Aktiver Tab: UI_STYLE 2,0 (normal)\n`;
        code += `\t\t\tUI_OUTFIELD\tTabTitles[i_sub], curX+4, 4, xAddition-9, 20, 2 \n`;
        code += `\t\t\tUI_STYLE 2, 1 \n`;
        code += `\t\t\tIF i_sub = nTabs THEN tzu = 1 ELSE tzu = 0 \n`;
        code += `\t\t\tUI_SEPARATOR\tcurX,              \t\t2, \t\t\tcurX,               \t30 + dose * 1\t\t\t! Tab Senkrecht Links \n`;
        code += `\t\t\tUI_SEPARATOR\tcurX + 2 - dose * 2,\t1, \t\t\t\tcurX + xAddition-2,  \t1\t\t\t\t\t! Tab Linie Oben \n`;
        code += `\t\t\tUI_SEPARATOR\tcurX + xAddition-4-tzu, 3 - dose * 1,curX + xAddition-4-tzu, 31\t\t\t\t\t! Tab Senkrecht rechts \n\n`;
        code += `\t\t\tIF curX > 1 THEN \n`;
        code += `\t\t\t\tUI_SEPARATOR\t3 - dose * 2,   29, curX+1, 29\t\t\t\t\t\t\t\t\t\t\t! Linie Waagerecht links neben Tab \n`;
        code += `\t\t\tENDIF \n`;
        code += `\t\t\tIF curX < int_ui_wid THEN \n`;
        code += `\t\t\t\tUI_SEPARATOR\tcurX + xAddition - 2 - dose * 2 , 29, int_ui_wid - 2 + dose * 1, 29\t\t\t\t\t\t! Linie Waagerecht rechts neben Tab \n`;
        code += `\t\t\tENDIF \n`;
        code += `\t\tELSE \n`;
        code += `\t\t\tUI_BUTTON UI_FUNCTION,\tTabTitles[i_sub], curX+1, 2, xAddition - 3, 24, - TAB_ID[i_sub] UI_TOOLTIP "Seite " + STR(i_sub,1,0) \n`;
        code += `\t\tENDIF \n`;
        code += `\t\tcurX = curX + xAddition \n`;
        code += `\tNEXT i_sub \nRETURN \n\n`;

        code += `200: ! Tab Control Standard (Tabs oben bei Subpage)\n`;
        code += `\t_nr_TabTitles = ii \n`;
        code += `\tcurX = 1 \n`;
        code += `\txAddition = INT(int_ui_wid / nTabs)-1 \n`;
        code += `\tcurX = curX + xAddition * (ii - 1) \n\n`;
        code += `\tUI_STYLE 2, 0 \t\t\t\t\t! Aktiver Tab: UI_STYLE 2,0 (normal)\n`;
        code += `\tUI_OUTFIELD\tTabTitles[_nr_TabTitles], curX+4, 4, xAddition-9, 20, 2 \n`;
        code += `\tUI_STYLE 2, 1 \t\t\t\t\t! Inaktive Tabs: UI_STYLE 2,1 (bold)\n`;
        code += `\tIF i = nTabs THEN tzu = 1 ELSE tzu = 0 \n`;
        code += `\tUI_SEPARATOR\tcurX,              \t\t2, \t\t\tcurX,               \t30 + dose * 1\n`;
        code += `\tUI_SEPARATOR\tcurX + 2 - dose * 2,\t1, \t\t\t\tcurX + xAddition-2,  \t1\n`;
        code += `\tUI_SEPARATOR\tcurX + xAddition-4-tzu, 3 - dose * 1,curX + xAddition-4-tzu, 31\n\n`;
        code += `\tIF curX > 1 THEN \n`;
        code += `\t\tUI_SEPARATOR\t3 - dose * 2,   29, curX+1, 29\n`;
        code += `\tENDIF \n`;
        code += `\tIF curX < int_ui_wid THEN \n`;
        code += `\t\tUI_SEPARATOR\tcurX + xAddition - 2 - dose * 2 , 29, int_ui_wid - 2 + dose * 1, 29\n`;
        code += `\tENDIF \n\n`;
        code += `\tcurX = 1 \n`;
        code += `\txAddition = INT(int_ui_wid / nTabs)-1 \n`;
        code += `\tFOR i_sub = 1 TO nTabs \n`;
        code += `\t\tIF i_sub # _nr_TabTitles THEN UI_BUTTON UI_FUNCTION,\tTabTitles[i_sub], curX+1, 2, xAddition - 3, 24, - TAB_ID[i_sub] UI_TOOLTIP "Seite " + STR(i_sub,1,0)\n`;
        code += `\t\tcurX = curX + xAddition \n`;
        code += `\tNEXT i_sub \nRETURN \n\n`;

        code += `300: ! Draw Box mit Tabs unten für gs_ui_sub_tabpages\n`;
        code += `\tGOSUB 111 \n`;
        code += `\txAddition = INT(int_ui_wid / nTabs_sub[ii]) - 1 \n\n`;
        code += `\tUI_STYLE 2, 1 \t\t\t\t\t! Inaktive Tabs unten: UI_STYLE 2,1 (bold)\n`;
        code += `\tIF gs_ui_current_page = TAB_ID[ii] THEN \n`;
        code += `\t\tUI_STYLE 2, 0 \t\t\t\t\t! Aktiver Tab unten: UI_STYLE 2,0 (normal)\n`;
        code += `\t\tUI_OUTFIELD\tsubTabTitles[ii][1], curX+4, 245 + hit_diff, xAddition-9, 20, 2 \n`;
        code += `\t\tUI_STYLE 2, 1 \n`;
        code += `\t\tGOSUB 112 \n`;
        code += `\tELSE \n`;
        code += `\t\tUI_BUTTON UI_FUNCTION,\tsubTabTitles[ii][1], curX+1, 245 + hit_diff, xAddition - 3, 20, - TAB_ID[ii] UI_TOOLTIP "Unterseite 1"\n`;
        code += `\tENDIF \n\n`;
        code += `\tcurX = curX + xAddition \n`;
        code += `\tFOR i_sub = 1 TO nTabs_sub[ii] - 1 \n`;
        code += `\t\tIF gs_ui_current_page = TAB_ID_SUB[ii][i_sub] THEN \n`;
        code += `\t\t\tUI_STYLE 2, 0 \n`;
        code += `\t\t\tUI_OUTFIELD\tsubTabTitles[ii][i_sub + 1], curX+4, 245 + hit_diff, xAddition-9, 20, 2 \n`;
        code += `\t\t\tUI_STYLE 2, 1 \n`;
        code += `\t\t\tGOSUB 112 \n`;
        code += `\t\tELSE \n`;
        code += `\t\t\tUI_BUTTON UI_FUNCTION,\tsubTabTitles[ii][i_sub + 1], curX+1, 245 + hit_diff, xAddition - 3, 20, - TAB_ID_SUB[ii][i_sub] UI_TOOLTIP "Unterseite " + STR(i_sub+1,1,0)\n`;
        code += `\t\tENDIF \n`;
        code += `\t\tcurX = curX + xAddition \n`;
        code += `\tNEXT i_sub \nRETURN \n\n`;

        code += `111: ! Linien Seite, wenn es TABs unten gibt\n`;
        code += `\tIF drawBox THEN \n`;
        code += `\t\tUI_SEPARATOR\t1,   30,   1, 243 + hit_diff\n`;
        code += `\t\tUI_SEPARATOR\tint_ui_wid - 3, 30, int_ui_wid - 3, 243 + hit_diff\n`;
        code += `\tENDIF \n`;
        code += `\tcurX = 1 \nRETURN \n\n`;

        code += `112: ! Tab-Linien unten bei TABs unten\n`;
        code += `\tUI_SEPARATOR\tcurX,               \t243 + hit_diff - dose * 2, curX,               \t265 + hit_diff\n`;
        code += `\tUI_SEPARATOR\tcurX + 2 - dose * 2,    264 + hit_diff, \t\t\tcurX + xAddition-2,  \t264 + hit_diff\n`;
        code += `\tUI_SEPARATOR\tcurX + xAddition-4, \t243 + hit_diff - dose * 2, curX + xAddition-4, \t265 + hit_diff\n\n`;
        code += `\tIF curX > 1 THEN \n`;
        code += `\t\tUI_SEPARATOR\t3 - dose * 2,   241 + hit_diff, curX+1, 241 + hit_diff\n`;
        code += `\tENDIF \n`;
        code += `\tIF curX < 333 THEN \n`;
        code += `\t\tUI_SEPARATOR\tcurX + xAddition - 2 - dose * 2, 241 + hit_diff, int_ui_wid - 2, 241 + hit_diff\n`;
        code += `\tENDIF \nRETURN \n\n`;

        return code;
    }
};
