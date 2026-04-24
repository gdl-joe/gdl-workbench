/**
 * GDL Script Editor JavaScript
 * Handles Monaco Editor, script loading, saving and exporting.
 */

class ScriptEditor {
    constructor() {
        this.API_BASE_URL = '../backend/public/api/local';
        this.currentGdlObjectId = localStorage.getItem('currentGdlObjectId');
        this.monacoEditor = null;
        this.currentScriptType = localStorage.getItem('currentScriptType') || 'script_master';
        this.isMonacoLoading = false;
        this.isDirty = false;
        this.originalValue = '';
        // Code waiting to be inserted from Codeschmiede
        this._pendingForgeInsert = localStorage.getItem('codeForgeInsert') || null;
        if (this._pendingForgeInsert) localStorage.removeItem('codeForgeInsert');

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadObjectInfo();
        this.initializeMonaco();
    }

    setupEventListeners() {
        // Script selection
        document.querySelectorAll('.script-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.switchScript(type);

                // Update active state
                document.querySelectorAll('.script-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Save button
        document.getElementById('saveEditorBtn')?.addEventListener('click', () => this.saveCurrentScript());

        // Export to Files button
        document.getElementById('exportToFilesBtn')?.addEventListener('click', () => this.exportToFiles());

        // Reload from Files button
        document.getElementById('reloadFromFilesBtn')?.addEventListener('click', () => this.reloadFromFiles());
    }

    async loadObjectInfo() {
        if (!this.currentGdlObjectId) {
            this.updateStatus('msg_no_object_selected', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
            const result = await response.json();
            if (result.success && result.data) {
                const obj = result.data;
                const objectNameEl = document.getElementById('headerObjectName');
                const projectNameEl = document.getElementById('headerProjectName');

                if (objectNameEl) {
                    const label = window.i18n ? window.i18n.t('object') : 'Objekt';
                    objectNameEl.textContent = `${label}: ${obj.name}`;
                }
                if (projectNameEl && obj.project_id) {
                    const projectIdStr = String(obj.project_id);
                    const projectName = projectIdStr.split('/').pop() || (window.i18n ? window.i18n.t('unknown') : 'Unbekannt');
                    const label = window.i18n ? window.i18n.t('project') : 'Projekt';
                    projectNameEl.textContent = `${label}: ${projectName}`;
                }

                this.updateStatus(window.i18n ? window.i18n.t('msg_ready') + ': ' + obj.name : `Bereit: ${obj.name}`);
            }
        } catch (e) {
            console.error('Error loading object info:', e);
            this.updateStatus('msg_load_error', 'error');
        }
    }

    initializeMonaco() {
        if (this.isMonacoLoading) return;
        this.isMonacoLoading = true;

        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

        require(['vs/editor/editor.main'], () => {
            // Register GDL Language (using global config from gdl-monaco-config.js)
            if (window.gdlMonaco) {
                monaco.languages.register({ id: 'gdl' });
                monaco.languages.setMonarchTokensProvider('gdl', window.gdlMonaco.definition);
                monaco.editor.defineTheme('gdlTheme', window.gdlMonaco.theme);
            }

            this.monacoEditor = monaco.editor.create(document.getElementById('monacoContainer'), {
                value: '',
                language: 'gdl',
                theme: 'gdlTheme',
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false
            });

            this.monacoEditor.onDidChangeModelContent(() => {
                const currentVal = this.monacoEditor.getValue();
                this.setDirty(currentVal !== this.originalValue);
            });

            this.isMonacoLoading = false;
            console.log('Monaco initialized');

            // Load initial script (from persistence or default)
            this.switchScript(this.currentScriptType);
            document.querySelector(`[data-type="${this.currentScriptType}"]`)?.classList.add('active');
        });
    }

    async switchScript(type) {
        if (!this.currentGdlObjectId) return;
        this.currentScriptType = type;
        localStorage.setItem('currentScriptType', type);

        const fileNames = {
            'script_master': 'Master Script',
            'script_2d': '2D Script',
            'script_3d': '3D Script',
            'script_parameter': 'Parameter Script',
            'script_ui': 'Interface Script',
            'script_properties': 'Properties Script',
            'script_migration_forward': 'Forward Migration',
            'script_migration_backward': 'Backward Migration',
            'xml': 'Parameters.xml'
        };

        document.getElementById('currentFileName').textContent = fileNames[type] || type;

        try {
            const loadingMsg = window.i18n ? window.i18n.t('msg_loading').replace('{name}', fileNames[type] || type) : `Lade ${fileNames[type]}...`;
            this.updateStatus(loadingMsg);

            if (type === 'xml') {
                const response = await fetch(`${this.API_BASE_URL}/objects/${this.currentGdlObjectId}/parameters/export`);
                const tex = await response.text();
                this.originalValue = tex;
                this.setEditorValue(tex, 'xml');
            } else {
                const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
                const result = await response.json();
                if (result.success && result.data) {
                    const code = result.data[type] || '';
                    this.originalValue = code;
                    this.setEditorValue(code, 'gdl');
                }
            }
            this.setDirty(false);
            this.updateStatus('msg_ready');

            // Insert code arriving from Codeschmiede (only on the first load)
            if (this._pendingForgeInsert && this.monacoEditor) {
                const insertCode = this._pendingForgeInsert;
                this._pendingForgeInsert = null;
                const model     = this.monacoEditor.getModel();
                const lineCount = model.getLineCount();
                const lastCol   = model.getLineLength(lineCount) + 1;
                this.monacoEditor.executeEdits('codeschmiede', [{
                    range: new monaco.Range(lineCount, lastCol, lineCount, lastCol),
                    text: '\n' + insertCode + '\n',
                    forceMoveMarkers: true
                }]);
                this.monacoEditor.revealLine(lineCount + 1);
                this.setDirty(true);
                this.updateStatus('Code aus Codeschmiede eingefügt');
            }
        } catch (e) {
            console.error('Error loading script:', e);
            this.updateStatus('msg_load_error', 'error');
        }
    }

    setEditorValue(value, language) {
        if (!this.monacoEditor) return;
        this.monacoEditor.setValue(value);
        monaco.editor.setModelLanguage(this.monacoEditor.getModel(), language);
    }

    async saveCurrentScript() {
        if (!this.currentGdlObjectId || !this.monacoEditor) return;
        const code = this.monacoEditor.getValue();
        const type = this.currentScriptType;

        try {
            this.updateStatus('msg_saving');

            if (type === 'xml') {
                // For XML, we use the import endpoint to update the DB and local file
                const response = await fetch(`${this.API_BASE_URL}/objects/${this.currentGdlObjectId}/parameters/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ xml: code })
                });
                const result = await response.json();
                if (result.success) {
                    this.originalValue = code;
                    this.setDirty(false);
                    this.updateStatus('msg_xml_save_success');
                } else {
                    throw new Error(result.error || 'XML Speichern fehlgeschlagen');
                }
            } else {
                // Save to Local API (which handles both file and DB)
                const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [type]: code })
                });

                const result = await response.json();
                if (result.success) {
                    this.originalValue = code;
                    this.setDirty(false);
                    this.updateStatus('msg_save_success');
                } else {
                    throw new Error(result.error || 'Speichern fehlgeschlagen');
                }
            }
        } catch (e) {
            console.error('Error saving:', e);
            this.updateStatus('msg_save_error', 'error');
        }
    }

    setDirty(dirty) {
        this.isDirty = dirty;
        const btn = document.querySelector(`.script-btn[data-type="${this.currentScriptType}"]`);
        if (btn) {
            let indicator = btn.querySelector('.dirty-indicator');
            if (dirty) {
                if (!indicator) {
                    indicator = document.createElement('i');
                    indicator.className = 'fas fa-circle dirty-indicator';
                    indicator.style.fontSize = '8px';
                    indicator.style.color = '#ebcb8b'; // Yellow/Orange
                    indicator.style.marginLeft = '10px';
                    btn.appendChild(indicator);
                }
            } else {
                indicator?.remove();
            }
        }
    }

    async exportToFiles() {
        if (!this.currentGdlObjectId) return;

        const confirmMsg = window.i18n ? window.i18n.t('msg_confirm_export') : 'Möchten Sie alle Änderungen (Skripte und XML) in lokale Dateien exportieren?';
        if (!confirm(confirmMsg)) return;

        try {
            this.updateStatus('msg_exporting');
            const response = await fetch(`${this.API_BASE_URL}/objects/${this.currentGdlObjectId}/export`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                this.updateStatus('msg_export_success');
                // Reset dirty state after successful export
                this.isDirty = false;
                this.setDirty(false);
            } else {
                const failedMsg = window.i18n ? window.i18n.t('msg_export_failed') : 'Export fehlgeschlagen: ';
                this.updateStatus(failedMsg + (result.error || 'Unbekannter Fehler'), 'error');
            }
        } catch (e) {
            console.error('Export error:', e);
            const errorMsg = window.i18n ? window.i18n.t('msg_reload_error') : 'Fehler beim Export: ';
            this.updateStatus(errorMsg + e.message, 'error');
        }
    }

    async reloadFromFiles() {
        if (!this.currentGdlObjectId) {
            const noObjMsg = window.i18n ? window.i18n.t('msg_no_object_selected') : 'Kein Objekt ausgewählt.';
            alert(noObjMsg);
            return;
        }

        try {
            // Check if local files are newer
            this.updateStatus('msg_check_local');
            const checkResponse = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
            const checkResult = await checkResponse.json();

            if (!checkResult.success) {
                alert('Fehler beim Laden der Objekt-Informationen.');
                return;
            }

            const obj = checkResult.data;

            // Show info about current state
            let message = (window.i18n ? window.i18n.t('msg_confirm_reload') : 'Möchten Sie die Skripte von den lokalen Dateien neu laden?') + '\n\n';
            message += (window.i18n ? window.i18n.t('object') : 'Objekt') + ': ' + obj.name + '\n';

            if (obj.last_modified) {
                const localDate = new Date(obj.last_modified * 1000);
                const lastModMsg = window.i18n ? window.i18n.t('msg_last_modified_local') : 'Letzte Änderung (lokal): ';
                message += lastModMsg + localDate.toLocaleString() + '\n';
            }

            if (this.isDirty) {
                message += '\n' + (window.i18n ? window.i18n.t('msg_warn_unsaved') : '⚠️ WARNUNG: Sie haben ungespeicherte Änderungen im Editor!') + '\n';
                message += (window.i18n ? window.i18n.t('msg_unsaved_loss') : 'Diese gehen verloren, wenn Sie neu laden.') + '\n';
            }

            if (!confirm(message)) return;

            // Reload current script from local files
            this.updateStatus('msg_loading');

            // Force reload from files by clearing cache and reloading
            const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}?_t=${Date.now()}`);
            const result = await response.json();

            if (result.success && result.data) {
                // Reload current script
                await this.switchScript(this.currentScriptType);
                this.isDirty = false;
                this.setDirty(false);
                this.updateStatus('msg_reload_success');
            } else {
                this.updateStatus('msg_load_error', 'error');
            }
        } catch (e) {
            console.error('Reload error:', e);
            const errorMsg = window.i18n ? window.i18n.t('msg_reload_error') : 'Fehler beim Neu-Laden: ';
            this.updateStatus(errorMsg + e.message, 'error');
        }
    }

    updateStatus(msg, type = 'info') {
        const el = document.getElementById('statusMessage');
        if (el) {
            const translation = window.i18n ? (window.i18n.translations[msg] ? window.i18n.t(msg) : msg) : msg;
            const prefix = window.i18n ? window.i18n.t('status_prefix') : 'Status: ';
            el.textContent = `${prefix}${translation}`;
            el.style.color = type === 'error' ? '#bf616a' : (type === 'warning' ? '#ebcb8b' : '#eceff4');
        }
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    window.scriptEditor = new ScriptEditor();
});

// ─────────────────────────────────────────────────────────────────
// KI-Assistent (Script Editor)
// ─────────────────────────────────────────────────────────────────
const AI_BASE = '../backend/public/api/local';
const AI_STORAGE_KEY = 'gdl_ai_chat_history';

document.addEventListener('DOMContentLoaded', () => {
    const aiMessages    = document.getElementById('aiMessages');
    const aiInput       = document.getElementById('aiInput');
    const aiSendBtn     = document.getElementById('aiSendBtn');
    const aiClearBtn    = document.getElementById('aiClearBtn');
    const aiModelSelect = document.getElementById('aiModelSelect');
    const aiCtxScript   = document.getElementById('aiCtxCurrentScript');
    const aiCtxParams   = document.getElementById('aiCtxParams');

    // Gespeichertes Modell wiederherstellen
    const savedModel = localStorage.getItem('gdl_ai_model');
    if (savedModel && aiModelSelect) aiModelSelect.value = savedModel;
    aiModelSelect?.addEventListener('change', () => {
        localStorage.setItem('gdl_ai_model', aiModelSelect.value);
    });

    if (!aiMessages) return;

    // Verlauf aus localStorage laden
    let aiHistory = [];
    try {
        const stored = localStorage.getItem(AI_STORAGE_KEY);
        if (stored) aiHistory = JSON.parse(stored);
    } catch(e) {}

    function aiSaveHistory() {
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiHistory));
    }

    function getMonacoEditor() {
        return window.scriptEditor?.monacoEditor ?? null;
    }

    function aiRenderAll() {
        aiMessages.innerHTML = '';
        if (aiHistory.length === 0) {
            aiAddMessage('assistant',
                'Hallo! Ich helfe Dir beim GDL-Programmieren. ' +
                'Du kannst das aktuelle Skript als Kontext mitsenden — einfach die Checkbox aktivieren.',
                false);
            return;
        }
        aiHistory.forEach(m => aiAddMessage(m.role, m.content, false));
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    function aiAddMessage(role, text, save = true) {
        const div = document.createElement('div');
        div.className = 'ai-msg ' + role;

        const html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
                `<pre>${code.trim()}</pre>`)
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        div.innerHTML = html;

        // "In Editor einfügen" direkt via Monaco API
        if (role === 'assistant' && text.includes('```')) {
            const btn = document.createElement('button');
            btn.className = 'ai-insert-btn';
            btn.innerHTML = '<i class="fas fa-arrow-right"></i> In Editor einfügen';
            btn.addEventListener('click', () => {
                const match = text.match(/```[\w]*\n?([\s\S]*?)```/);
                if (!match) return;
                const code = match[1].trim();
                const editor = getMonacoEditor();
                if (editor) {
                    // An Cursorposition einfügen
                    const pos = editor.getPosition();
                    editor.executeEdits('ai-insert', [{
                        range: new monaco.Range(
                            pos.lineNumber, pos.column,
                            pos.lineNumber, pos.column
                        ),
                        text: code + '\n',
                    }]);
                    editor.focus();
                } else {
                    // Fallback: in Zwischenablage kopieren
                    navigator.clipboard.writeText(code).then(() => {
                        btn.textContent = '✓ In Zwischenablage kopiert';
                        setTimeout(() => {
                            btn.innerHTML = '<i class="fas fa-arrow-right"></i> In Editor einfügen';
                        }, 2000);
                    });
                }
            });
            div.appendChild(btn);
        }

        aiMessages.appendChild(div);
        aiMessages.scrollTop = aiMessages.scrollHeight;
        return div;
    }

    async function aiSend() {
        const text = aiInput.value.trim();
        if (!text) return;

        aiInput.value = '';
        aiInput.style.height = 'auto';
        aiSendBtn.disabled = true;

        aiHistory.push({ role: 'user', content: text });
        aiSaveHistory();
        aiAddMessage('user', text, false);

        const thinking = document.createElement('div');
        thinking.className = 'ai-msg thinking';
        thinking.textContent = '⏳ KI denkt nach …';
        aiMessages.appendChild(thinking);
        aiMessages.scrollTop = aiMessages.scrollHeight;

        // Kontext aufbauen
        const context = {};
        if (aiCtxScript?.checked) {
            const editor = getMonacoEditor();
            if (editor) {
                const currentFile = document.getElementById('currentFileName')?.textContent?.trim() || 'script';
                context.scripts = { [currentFile]: editor.getValue() };
            }
        }
        if (aiCtxParams?.checked) {
            const stored = localStorage.getItem('gdl_parameters');
            if (stored) { try { context.parameters = JSON.parse(stored); } catch(e) {} }
        }

        try {
            const model = aiModelSelect?.value || 'claude-3-5-sonnet-20241022';
            const res = await fetch(`${AI_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: aiHistory, context, model }),
            });
            const data = await res.json();
            thinking.remove();

            if (data.success && data.data?.reply) {
                const reply = data.data.reply;
                aiHistory.push({ role: 'assistant', content: reply });
                aiSaveHistory();
                aiAddMessage('assistant', reply, false);
                if (data.data.model) aiModelBadge.textContent = data.data.model;
            } else {
                aiAddMessage('error', '❌ ' + (data.message || 'Unbekannter Fehler'), false);
                aiHistory.pop();
                aiSaveHistory();
            }
        } catch (e) {
            thinking.remove();
            aiAddMessage('error', '❌ Netzwerkfehler: ' + e.message, false);
            aiHistory.pop();
            aiSaveHistory();
        }

        aiSendBtn.disabled = false;
        aiInput.focus();
    }

    aiSendBtn.addEventListener('click', aiSend);
    aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(); }
    });
    aiInput.addEventListener('input', () => {
        aiInput.style.height = 'auto';
        aiInput.style.height = Math.min(aiInput.scrollHeight, 180) + 'px';
    });
    aiClearBtn.addEventListener('click', () => {
        aiHistory = [];
        aiSaveHistory();
        aiRenderAll();
    });

    // Verlauf beim Start rendern
    aiRenderAll();
});
