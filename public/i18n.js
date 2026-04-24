/**
 * i18n logic for GDL Workbench
 * Handles loading translations and updating the UI
 */

class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('lang') || 'de';
        this.translations = {};
        this.isLoaded = false;
    }

    async init() {
        await this.loadTranslations(this.currentLang);
        this.updateUI();
        this.setupSwitcher();
    }

    async loadTranslations(lang) {
        try {
            const v = new Date().getTime(); // Simple cache busting
            const response = await fetch(`lang/${lang}.json?v=${v}`);
            if (!response.ok) throw new Error(`Could not load language ${lang}`);
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('lang', lang);
            this.isLoaded = true;
            document.documentElement.lang = lang;
            console.log(`Language loaded: ${lang}`);
        } catch (error) {
            console.error('Translation error:', error);
            // Fallback to German if not already German
            if (lang !== 'de') await this.loadTranslations('de');
        }
    }

    t(key) {
        return this.translations[key] || key;
    }

    updateUI() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number' || el.type === 'search')) {
                // For inputs with placeholder only
                if (el.hasAttribute('placeholder')) {
                    el.placeholder = translation;
                }
            } else if (el.hasAttribute('title')) {
                el.title = translation;
            } else {
                // Default: innerHTML (or textContent)
                // If it contains icons (FontAwesome), preserve them
                const icon = el.querySelector('i.fas, i.fab, i.far');
                if (icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.appendChild(document.createTextNode(' ' + translation));
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Custom updates for specialized elements
        this.updateDynamicElements();
    }

    updateDynamicElements() {
        // Handle select options with data-i18n if they exist
        document.querySelectorAll('select option[data-i18n]').forEach(opt => {
            opt.textContent = this.t(opt.getAttribute('data-i18n'));
        });
    }

    setupSwitcher() {
        const switchers = document.querySelectorAll('.lang-switcher select');
        switchers.forEach(switcher => {
            // Update options to include all 4 languages
            switcher.innerHTML = `
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
            `;
            switcher.value = this.currentLang;
            switcher.addEventListener('change', async (e) => {
                await this.loadTranslations(e.target.value);
                this.updateUI();
                // Sync other switchers on the page if any
                document.querySelectorAll('.lang-switcher select').forEach(s => {
                    if (s !== e.target) s.value = e.target.value;
                });
            });
        });
    }
}

// Global instance
window.i18n = new I18n();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.init();
});
