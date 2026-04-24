/**
 * GDL Build Tasks JavaScript
 * Handles task execution and console output display.
 */

class TaskRunner {
    constructor() {
        this.API_BASE_URL = '../backend/public/api/local';
        this.currentProjectId = localStorage.getItem('currentProjectId');
        this.activeTask = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProjectInfo();
    }

    setupEventListeners() {
        // Task buttons
        document.querySelectorAll('.task-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskKey = btn.dataset.task;
                this.runTask(taskKey, btn.innerText.trim());
            });
        });

        // Console actions
        document.getElementById('clearConsole')?.addEventListener('click', () => {
            document.getElementById('consoleOutput').innerHTML = '';
        });

        document.getElementById('copyConsole')?.addEventListener('click', () => {
            const text = document.getElementById('consoleOutput').innerText;
            navigator.clipboard.writeText(text).then(() => {
                alert(window.i18n ? window.i18n.t('msg_clipboard_copied') : 'In die Zwischenablage kopiert');
            });
        });
    }

    async loadProjectInfo() {
        const projectNameEl = document.getElementById('headerProjectName');
        const objectNameEl = document.getElementById('headerObjectName');

        if (this.currentProjectId) {
            const projectName = this.currentProjectId.split('/').pop() || (window.i18n ? window.i18n.t('unknown') : 'Unbekannt');
            const label = window.i18n ? window.i18n.t('project') : 'Projekt';
            if (projectNameEl) projectNameEl.textContent = `${label}: ${projectName}`;
        }

        const currentGdlObjectId = localStorage.getItem('currentGdlObjectId');
        if (currentGdlObjectId && objectNameEl) {
            try {
                const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${currentGdlObjectId}`);
                const result = await response.json();
                if (result.success && result.data) {
                    const label = window.i18n ? window.i18n.t('object') : 'Objekt';
                    objectNameEl.textContent = `${label}: ${result.data.name}`;
                }
            } catch (e) {
                console.error('Error loading object info for header:', e);
            }
        }
    }

    async runTask(taskKey, label) {
        if (this.activeTask) {
            alert(window.i18n ? window.i18n.t('msg_task_already_running') : 'Es läuft bereits ein Task. Bitte warten Sie, bis dieser abgeschlossen ist.');
            return;
        }

        if (!this.currentProjectId) {
            alert(window.i18n ? window.i18n.t('msg_no_project_loaded') : 'Kein Projekt ausgewählt.');
            return;
        }

        this.setActive(true, label);
        this.log(`\n${window.i18n ? window.i18n.t('msg_task_started') : '> Starte Task: '}${label}`, 'cmd');
        this.log(`${window.i18n ? window.i18n.t('msg_task_key') : '> Befehl-Key: '}${taskKey}`);

        try {
            const response = await fetch(`${this.API_BASE_URL}/tasks/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: taskKey,
                    project_path: this.currentProjectId
                })
            });

            const result = await response.json();

            if (result.success) {
                if (result.output) {
                    this.log(result.output);
                }
                const successMsg = window.i18n ? window.i18n.t('msg_task_success') : '[SUCCESS] Task abgeschlossen.';
                this.log(`\n${successMsg}`, 'success');
                this.setStatus('success');
            } else {
                const errorPrefix = window.i18n ? window.i18n.t('msg_task_error') : '[ERROR] ';
                this.log(`\n${errorPrefix}${result.error || 'Unbekannter Fehler'}`, 'error');
                if (result.output) {
                    this.log(result.output);
                }
                this.setStatus('error');
            }
        } catch (error) {
            console.error('Task execution failed:', error);
            const fatalMsg = window.i18n ? window.i18n.t('msg_task_fatal') : '[FATAL] Netzwerkfehler oder Server-Absturz.';
            this.log(`\n${fatalMsg}`, 'error');
            this.setStatus('error');
        } finally {
            this.setActive(false);
        }
    }

    setActive(active, label = 'Bereit') {
        this.activeTask = active ? label : null;
        const badge = document.getElementById('taskStatusBadge');
        if (active) {
            badge.className = 'status-badge status-running';
            badge.textContent = window.i18n ? window.i18n.t('status_running_dots') : 'Läuft...';
            // Disable buttons
            document.querySelectorAll('.task-btn').forEach(b => b.disabled = true);
        } else {
            // Re-enable after delay
            setTimeout(() => {
                document.querySelectorAll('.task-btn').forEach(b => b.disabled = false);
            }, 500);
        }
    }

    setStatus(status) {
        const badge = document.getElementById('taskStatusBadge');
        badge.className = `status-badge status-${status}`;
        if (status === 'success') {
            badge.textContent = window.i18n ? window.i18n.t('status_success') : 'Erfolgreich';
        } else {
            badge.textContent = window.i18n ? window.i18n.t('status_failed') : 'Fehlgeschlagen';
        }
    }

    log(message, type = '') {
        const consoleOutput = document.getElementById('consoleOutput');
        const span = document.createElement('span');
        if (type) span.className = `log-${type}`;
        span.textContent = message + '\n';
        consoleOutput.appendChild(span);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.taskRunner = new TaskRunner();
});
