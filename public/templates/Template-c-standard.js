// Template c-standard
// Dieses Template implementiert die Standard Graphisoft Navigation ohne Custom-Rahmen.

window.GdlTemplateStandard = {
    name: "Graphisoft Standard",
    id: "c-standard",

    // Rendert die Vorschau im Canvas (DOM-Manipulation)
    renderPreview: function (container, uiConfig, parameters) {
        // Simple Preview: Just show the elements, no complex tab simulation required for this task
        // as the user focus is on the GDL Output structure.
        // We can reuse basic frame logic or just leave it clean.

        // Draw a simple border to indicate canvas area
        container.style.border = '1px solid #ccc';
        container.style.backgroundColor = '#f7f7f7';
    },

    // Generiert das GDL Script
    generateScript: function (uiConfig, parameters, helperFuncs) {
        const { generateScriptHeader, generateScriptEnd, generateSubroutineWrapper, getValuesData } = helperFuncs;

        const getParamVal = (name, fallback) => {
            const p = parameters.find(p => p.gdl_name === name);
            if (!p || !p.default_value_json) return fallback;
            try { return JSON.parse(p.default_value_json); } catch (e) { return p.default_value_json; }
        };

        const nTabs = parseInt(getParamVal('nTabs', uiConfig.pages.length));

        let rawNTabsSub = getParamVal('nTabs_sub', null);
        let nTabsSub = [];
        if (Array.isArray(rawNTabsSub)) nTabsSub = rawNTabsSub;
        else if (typeof rawNTabsSub === 'object' && rawNTabsSub !== null) nTabsSub = Object.values(rawNTabsSub);
        else nTabsSub = new Array(nTabs).fill(0);

        const spacer = '-'.repeat(70);
        let code = generateScriptHeader('U I  -  S c r i p t');

        code += `! ${'-'.repeat(22)} H E A D E R ${'-'.repeat(35)} !\n\n`;

        // Variable initialization using Template logic
        code += `\tint_ui_wid\t= ${uiConfig.width}\n`;
        code += `\tint_ui_hit\t= ${uiConfig.height}\n\n`;

        code += `\twid_diff \t= int_ui_wid - 480\t\t\t\t! Differenz Breite zu Standard\n`;
        code += `\thit_diff \t= int_ui_hit - 266\t\t\t\t! Differenz Höhe zu Standard\n\n`;

        code += `\tUI_DIALOG str_objectName + "V" + str_version +":"+ str_date, int_ui_wid, int_ui_hit\n\n`;

        code += `\t! Parameters for ArchiCAD version and Platform\n`;
        code += `\tDose = 0\n`;
        code += `\tGDL = REQ("GDL_Version")\n`;
        code += `\tsts = REQUEST("Name_of_program", "",TeX)\n`;
        code += `\tIF STRSTR(TeX,".EXE") OR STRSTR(TeX,".exe") THEN Dose = 1\n\n`;

        code += `\t! Seitendefinition\n`;
        code += `\tui_current_page gs_ui_current_page\n\n`;

        code += `\tdy_start = 0\n`;
        code += `\tled = 25\n`;
        code += `\ttx1 = 0\n\n`;

        code += `! ${spacer} ! \n`;
        code += `! ${spacer} ! \n\n`;

        code += `TABID_ROOT = -1\n\n`;
        code += `DIM TAB_ID[], TAB_ID_SUB[][]\n\n`;

        code += `! Tab-IDs dynamisch generieren\n`;
        code += `_idxTab = 1\n`;
        code += `FOR i = 1 TO nTabs\n`;
        code += `    TAB_ID[i] = _idxTab\n`;
        code += `    _idxTab = _idxTab + 1    \n`;
        code += `    ! nTabs_sub[i] enthält Haupttab + Subtabs, daher -1 für echte Subtabs\n`;
        code += `    IF nTabs_sub[i] > 1 THEN\n`;
        code += `        FOR j = 1 TO (nTabs_sub[i] - 1)\n`;
        code += `            TAB_ID_SUB[i][j] = _idxTab\n`;
        code += `            _idxTab = _idxTab + 1\n`;
        code += `        NEXT j\n`;
        code += `    ENDIF\n`;
        code += `NEXT i\n\n`;

        code += `! UI-Pages dynamisch erstellen\n`;
        code += `FOR i = 1 TO nTabs\n`;
        code += `    ui_page TAB_ID[i], TABID_ROOT, TabTitles[i], TabPicture[i]\n`;
        code += `    gosub "UI_PAGE " + STR(i, 1, 0)    \n`;
        code += `    ! nTabs_sub[i] enthält Haupttab + Subtabs (z.B. 4 = 1+3)\n`;
        code += `    IF nTabs_sub[i] > 1 THEN\n`;
        code += `        FOR j = 1 TO (nTabs_sub[i] - 1)\n`;
        code += `            ui_page TAB_ID_SUB[i][j], TAB_ID[i], subTabTitles[i][j+1], subTabPicture[i][j+1]\n`;
        code += `            gosub "UI_PAGE " + STR(i, 1, 0) + "_" + STR(j, 1, 0)\n`;
        code += `        NEXT j\n`;
        code += `    ENDIF\n`;
        code += `NEXT i\n\n\n`;

        code += generateScriptEnd() + "\n";

        // --- Generate Subroutines Mapping ---
        // We map the flat list of uiConfig.pages to the hierarchical structure

        let pageCursor = 0; // Points to current page in uiConfig.pages
        const totalDesignerPages = uiConfig.pages.length;

        const getNextPageContent = () => {
            if (pageCursor < totalDesignerPages) {
                return uiConfig.pages[pageCursor++];
            }
            return { elements: [] }; // Return empty page if we run out of designer pages
        };

        const generatePageContent = (elements) => {
            let pageCode = `\n\tdy = dy_start\n\n`;
            if (!elements || elements.length === 0) {
                pageCode += `\t! >>>>> I N H A L T\n\n`;
                return pageCode;
            }

            // Sort elements by Y position to roughly match visual order if desired, 
            // but strictly we just output them.

            let currentUiStyle = null;

            elements.forEach(element => {
                // UI_STYLE setzen
                if (element.uiStyle) {
                    const [style1, style2] = element.uiStyle.split(',');
                    // For Standard template, maybe we don't enforce styles or use defaults?
                    // User example showed content but no strict style guide. 
                    // We will use the generic generation logic for elements.
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

                if (element.type === 'UI_OUTFIELD') {
                    const text = element.outfieldText || 'Text';
                    let flag = 0;
                    if (element.textAlign === 1) flag += 1;
                    if (element.textGrayed) flag = 4;
                    pageCode += `\tUI_OUTFIELD "${text}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}${flag ? ', ' + flag : ''}\n`;
                }

                if (element.type === 'UI_BUTTON') {
                    const text = element.buttonText || element.paramName || 'Button';
                    const buttonId = element.buttonId || 0;
                    const linkUrl = element.linkUrl ? `"${element.linkUrl}"` : '""';
                    const tooltipText = element.tooltipText ? `"${element.tooltipText}"` : '""';
                    // Note: Standard template might handle buttons differently? Using generic for now.
                    pageCode += `\tUI_BUTTON UI_LINK, "${text}", ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(element.width)}, ${Math.round(element.height)}, ${buttonId}, ${linkUrl} UI_TOOLTIP ${tooltipText}\n`;
                }

                if (element.type === 'UI_SEPARATOR') {
                    const x2 = (element.x2 !== undefined) ? element.x2 : element.x + element.width;
                    const y2 = (element.y2 !== undefined) ? element.y2 : element.y + element.height;
                    pageCode += `\tUI_SEPARATOR ${Math.round(element.x)}, ${Math.round(element.y)}, ${Math.round(x2)}, ${Math.round(y2)}\n`;
                }

                if (element.type === 'UI_PICT') {
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

            return pageCode;
        };

        // Loop i from 1 to nTabs to generate subroutines
        for (let i = 1; i <= nTabs; i++) {
            // Main Tab Page (e.g. "UI_PAGE 1")
            const tabName = `UI_PAGE ${i}`;
            const pageConfig = getNextPageContent();
            const pageContent = generatePageContent(pageConfig.elements);
            code += generateSubroutineWrapper(tabName, pageContent);

            // Sub Tabs
            const subCount = (nTabsSub[i - 1] !== undefined) ? parseInt(nTabsSub[i - 1]) : 0;
            // IMPORTANT: nTabsSub index logic. Arrays are 0-based in JS, 1-based in GDL logic above. 
            // We loaded nTabsSub from JSON, usually 0-based array.
            // If nTabsSub[i] > 1... wait, in GDL loop above: IF nTabs_sub[i] > 1. 
            // Assuming GDL array 1..nTabs maps to JS array 0..nTabs-1.

            if (subCount > 1) {
                for (let j = 1; j < subCount; j++) {
                    const subTabName = `UI_PAGE ${i}_${j}`;
                    const subPageConfig = getNextPageContent();
                    const subPageContent = generatePageContent(subPageConfig.elements);
                    code += generateSubroutineWrapper(subTabName, subPageContent);
                }
            }
        }

        return code;
    }
};
