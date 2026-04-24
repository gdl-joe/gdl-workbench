// UI Designer JavaScript
// Verwaltet den UI-Designer mit Drag & Drop, Grid-System und Element-Management

class UIDesigner {
	constructor() {
		this.BUILD = '2026-01-28';
		const _urlParams = new URLSearchParams(window.location.search);
		this.debug = _urlParams.has('debug');
		this._debugEl = null;

		this.uiConfig = {
			width: 444,
			height: 266,
			pages: [{ name: (window.i18n ? window.i18n.t('page_short') : 'S.') + ' 1', elements: [] }],
			currentPage: 0,
			platform: 'windows',
			gridSize: 1, // Snap-to-Grid Größe (unused now)
			zoom: 100, // Zoom-Level in Prozent
			// Custom Guides: arrays of numbers (positions)
			guides: { x: new Array(10).fill(0), y: new Array(10).fill(0) },
			templateId: 'b-prisma' // Default Template
		};

		// Template Registry
		this.templates = {};
		this.currentTemplate = null;

		// UI_STYLE Definitionen

		// UI_STYLE Definitionen
		this.uiStyles = {
			'0,0': { height: 16, font: 'Arial', weight: 'normal', size: 11 },
			'0,1': { height: 16, font: 'Arial', weight: 'bold', size: 11 },
			'1,0': { height: 11, font: 'Arial', weight: 'normal', size: 9 },
			'1,1': { height: 11, font: 'Arial', weight: 'bold', size: 9 },
			'2,0': { height: 20, font: 'Arial', weight: 'normal', size: 11 },
			'2,1': { height: 20, font: 'Arial', weight: 'bold', size: 11 }
		};

		// Editierbare Parameter-Typen für UI_INFIELD
		this.editableTypes = ['Length', 'Angle', 'RealNum', 'Integer', 'String'];

		this.selectedElement = null;
		this.draggedElement = null;
		this.isDragging = false;
		this.isResizing = false;
		this.resizeHandle = null;
		this.dragOffset = { x: 0, y: 0 };
		this.elementCounter = 0;
		this.parameters = []; // Wird später aus API geladen
		this.subTabState = {}; // Aktiver Subtab je Seite (Web-UI)
		this.currentGdlObjectId = null; // Aktuelles Objekt
		this.saveTimeout = null; // Timeout für Auto-Save
		this.lastDesignSource = null;
		this.lastObjectFetchStatus = null;
		this.monacoEditor = null;
		this.isMonacoLoading = false;

		// Default-Werte für Element-Typen
		this.defaultSizes = {
			'UI_INFIELD': { width: 200, height: 20 },
			'UI_INFIELD_IMAGE': { width: 40, height: 40 },
			'UI_OUTFIELD': { width: 200, height: 20 },
			'UI_BUTTON': { width: 100, height: 20 },
			'UI_SEPARATOR': { width: 200, height: 0 },
			'UI_RADIOBUTTON': { width: 150, height: 20 },
			'UI_PICT': { width: 100, height: 100 }
		};


		// API Base URL - All objects now use database IDs (local files are imported first)
		this.API_BASE_URL = '../backend/public/api/local';

		// Image Base URL - Makros folder (relative to project root)
		this.IMAGE_BASE_URL = '01_gsms/gdl-ui-studio/Makros'; // Path to Makros folder
		this.imageList = []; // List of available images

		this.tabHeight = 32; // Default Höhe der Tab-Leiste

		this.init();
	}



	async init() {
		// Register Templates (assuming they are loaded globally via script tags)
		this.registerTemplates();

		this.setupEventListeners();
		await this.loadParameters();
		// loadImages is called inside loadParameters if an object is selected.
		if (!this.currentGdlObjectId) {
			await this.loadImages();
		}

		this.loadUIDesign(); // Lade gespeichertes Design
		this.restoreGuideInputs(); // Stelle Werte in Inputs wieder her (falls geladen)

		// Set Template from Config or Default
		this.setTemplate(this.uiConfig.templateId || 'b-prisma');

		this.updateUI();
		this.updateDebugOverlay();
		this.initializeMonaco();
	}

	initializeMonaco() {
		if (this.isMonacoLoading) return;
		this.isMonacoLoading = true;

		require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

		require(['vs/editor/editor.main'], () => {
			// Register GDL Language
			monaco.languages.register({ id: 'gdl' });
			monaco.languages.setMonarchTokensProvider('gdl', window.gdlMonaco.definition);
			monaco.editor.defineTheme('gdlTheme', window.gdlMonaco.theme);

			this.monacoEditor = monaco.editor.create(document.getElementById('monacoContainer'), {
				value: '',
				language: 'gdl',
				theme: 'gdlTheme',
				automaticLayout: true,
				minimap: { enabled: true },
				fontSize: 14,
				lineNumbers: 'on',
				scrollBeyondLastLine: false,
				roundedSelection: false,
				readOnly: false,
				cursorStyle: 'line',
				renderWhitespace: 'selection'
			});

			this.isMonacoLoading = false;
			console.log('Monaco initialized');
		});
	}

	openEditor(code, title, onSave) {
		const overlay = document.getElementById('editorOverlay');
		const titleEl = document.getElementById('editorTitle');
		if (overlay && titleEl) {
			overlay.classList.remove('hidden');
			titleEl.textContent = title || 'GDL Editor';

			if (this.monacoEditor) {
				this.monacoEditor.setValue(code || '');
			}

			// Clean up old events
			const saveBtn = document.getElementById('saveEditorBtn');
			const closeBtn = document.getElementById('closeEditorBtn');

			const newSaveBtn = saveBtn.cloneNode(true);
			const newCloseBtn = closeBtn.cloneNode(true);

			saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
			closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

			newSaveBtn.addEventListener('click', () => {
				const newCode = this.monacoEditor.getValue();
				if (onSave) onSave(newCode);
				overlay.classList.add('hidden');
			});

			newCloseBtn.addEventListener('click', () => {
				overlay.classList.add('hidden');
			});
		}
	}

	ensureDebugOverlay() {
		if (!this.debug) return null;
		if (this._debugEl) return this._debugEl;

		const el = document.createElement('div');
		el.id = 'uiDesignerDebug';
		el.style.position = 'fixed';
		el.style.left = '10px';
		el.style.bottom = '10px';
		el.style.zIndex = '99999';
		el.style.background = 'rgba(0,0,0,0.75)';
		el.style.color = '#fff';
		el.style.fontFamily = 'monospace';
		el.style.fontSize = '12px';
		el.style.lineHeight = '1.35';
		el.style.padding = '8px 10px';
		el.style.borderRadius = '6px';
		el.style.maxWidth = '60vw';
		el.style.whiteSpace = 'pre';
		el.style.pointerEvents = 'none';
		document.body.appendChild(el);
		this._debugEl = el;
		return el;
	}

	getTotalElementsCount() {
		if (!this.uiConfig?.pages) return 0;
		return this.uiConfig.pages.reduce((sum, p) => sum + (p?.elements?.length || 0), 0);
	}

	updateDebugOverlay(extra = {}) {
		if (!this.debug) return;
		const el = this.ensureDebugOverlay();
		if (!el) return;

		const lines = [
			`BUILD=${this.BUILD}`,
			`objectId=${this.currentGdlObjectId || '-'}`,
			`objectLoaded=${this.currentObject ? 'yes' : 'no'}`,
			`objectFetch=${this.lastObjectFetchStatus || '-'}`,
			`params=${this.parameters?.length ?? 0}`,
			`pages=${this.uiConfig?.pages?.length ?? 0} elements=${this.getTotalElementsCount()}`,
			`designSource=${this.lastDesignSource || '-'}`,
			...Object.entries(extra).map(([k, v]) => `${k}=${v}`)
		];

		el.textContent = lines.join('\n');
	}

	registerTemplates() {
		// Look for global GdlTemplate objects
		// Convention: window.GdlTemplate[ID] or just check specific ones
		if (window.GdlTemplateBPrisma) {
			this.registerTemplate(window.GdlTemplateBPrisma);
		}
		if (window.GdlTemplateStandard) {
			this.registerTemplate(window.GdlTemplateStandard);
		}
		// Future templates can be added here or self-register

		this.updateTemplateSelect();
	}

	registerTemplate(template) {
		if (template && template.id) {
			this.templates[template.id] = template;
			console.log(`Template registered: ${template.name}`);
		}
	}

	updateTemplateSelect() {
		const select = document.getElementById('templateSelect');
		if (!select) return;

		select.innerHTML = '';
		Object.values(this.templates).forEach(tpl => {
			const option = document.createElement('option');
			option.value = tpl.id;
			option.textContent = tpl.name;
			select.appendChild(option);
		});

		if (this.uiConfig.templateId && this.templates[this.uiConfig.templateId]) {
			select.value = this.uiConfig.templateId;
		}
	}

	setTemplate(templateId) {
		if (this.templates[templateId]) {
			this.currentTemplate = this.templates[templateId];
			this.uiConfig.templateId = templateId;
			this.updateTemplateSelect();
			console.log(`Switched to template: ${this.currentTemplate.name}`);
		} else {
			console.warn(`Template not found: ${templateId}`);
			// Fallback to first available
			const firstId = Object.keys(this.templates)[0];
			if (firstId) {
				this.currentTemplate = this.templates[firstId];
				this.uiConfig.templateId = firstId;
			}
		}
	}

	setupGuideListeners() {
		// Event Delegation oder direct Listeners
		document.querySelectorAll('.guide-input').forEach(input => {
			input.addEventListener('change', (e) => {
				const axis = e.target.dataset.axis;
				const index = parseInt(e.target.dataset.index);
				const value = parseInt(e.target.value) || 0;

				this.uiConfig.guides[axis][index] = value;
				this.renderGuides();
				this.saveUIDesign();
			});
		});
	}

	restoreGuideInputs() {
		if (!this.uiConfig.guides) {
			this.uiConfig.guides = { x: new Array(10).fill(0), y: new Array(10).fill(0) };
		}

		['x', 'y'].forEach(axis => {
			this.uiConfig.guides[axis].forEach((val, idx) => {
				const input = document.querySelector(`.guide-input[data-axis="${axis}"][data-index="${idx}"]`);
				if (input) {
					input.value = val === 0 ? '' : val;
				}
			});
		});
	}


	snapToGuidesOnly(val, size, axis) {
		const guides = this.uiConfig.guides[axis];
		const threshold = 10;
		let bestSnap = val;
		let minDist = Infinity;

		guides.forEach(guidePos => {
			if (guidePos <= 0) return;
			// Debug Snap
			const distStart = Math.abs(val - guidePos);
			if (distStart < threshold && distStart < minDist) {
				bestSnap = guidePos;
				minDist = distStart;
				console.log(`Snapped ${axis} Start to ${guidePos}`);
			}
			const distEnd = Math.abs((val + size) - guidePos);
			if (distEnd < threshold && distEnd < minDist) {
				bestSnap = guidePos - size;
				minDist = distEnd;
				console.log(`Snapped ${axis} End to ${guidePos}`);
			}
		});
		return bestSnap;
	}

	renderGuides() {
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;

		// Entferne alte Guides
		pageContent.querySelectorAll('.guide-line').forEach(el => el.remove());

		// Bei 100% Zoom blenden wir die Hilfslinien aus
		if (this.uiConfig.zoom === 100) return;

		// Wir rendern im pageContent, der bereits durch dialogFrame skaliert wird (via transform)
		// Daher verwenden wir LOGISCHE (unskalierte) Koordinaten, genau wie die Elemente.
		const width = this.uiConfig.width;
		const height = this.uiConfig.height;

		// Berechne Linienstärke: Visual 1px = 1 / ZoomFactor
		const zoomFactor = this.uiConfig.zoom / 100;
		const lineWidth = 1 / zoomFactor;

		// Render X Guides (Vertical lines)
		this.uiConfig.guides.x.forEach(pos => {
			if (pos > 0) {
				const line = document.createElement('div');
				line.className = 'guide-line guide-line-x';
				line.style.left = `${pos}px`;
				line.style.height = `${height}px`;
				line.style.width = `${lineWidth}px`;
				pageContent.appendChild(line);
			}
		});

		// Render Y Guides (Horizontal lines)
		this.uiConfig.guides.y.forEach(pos => {
			if (pos > 0) {
				const line = document.createElement('div');
				line.className = 'guide-line guide-line-y';
				line.style.top = `${pos}px`;
				line.style.width = `${width}px`;
				line.style.height = `${lineWidth}px`;
				pageContent.appendChild(line);
			}
		});
	}




	setupEventListeners() {
		// UI-Konfiguration
		document.getElementById('applyConfigBtn')?.addEventListener('click', () => this.applyConfig());
		document.getElementById('addPageBtn')?.addEventListener('click', () => this.addPage());
		document.getElementById('pageSelect')?.addEventListener('change', (e) => this.switchPage(parseInt(e.target.value)));
		document.getElementById('platformSelect')?.addEventListener('change', (e) => {
			this.uiConfig.platform = e.target.value;
			this.updateUI();
			this.saveUIDesign();
		});

		// Data Source Switcher
		document.getElementById('dataSourceSelect')?.addEventListener('change', (e) => {
			localStorage.setItem('dataSource', e.target.value);
			window.location.reload();
		});

		document.getElementById('templateSelect')?.addEventListener('change', (e) => {
			this.setTemplate(e.target.value);
			this.saveUIDesign();
		});

		// Header-Buttons
		document.getElementById('saveBtn')?.addEventListener('click', () => this.saveUIDesign());
		document.getElementById('loadBtn')?.addEventListener('click', () => this.loadUIDesign());
		document.getElementById('generateGdlBtn')?.addEventListener('click', () => this.generateAndDownloadGDL());
		document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadGDLCode());

		// Zoom Control
		document.getElementById('zoomSlider')?.addEventListener('input', (e) => {
			this.uiConfig.zoom = parseInt(e.target.value);
			this.applyZoom();
		});

		// Toolbox Drag & Drop
		const toolboxItems = document.querySelectorAll('.toolbox-item[draggable="true"]');
		toolboxItems.forEach(item => {
			item.addEventListener('dragstart', (e) => this.handleToolboxDragStart(e));
			item.addEventListener('dragend', (e) => this.handleToolboxDragEnd(e));
		});

		// Canvas Drop Zone
		const pageContent = document.getElementById('pageContent');
		if (pageContent) {
			pageContent.addEventListener('dragover', (e) => this.handleCanvasDragOver(e));
			pageContent.addEventListener('drop', (e) => this.handleCanvasDrop(e));
			pageContent.addEventListener('click', (e) => this.handleCanvasClick(e));
			// Event-Delegation für mousedown auf allen Elementen
			pageContent.addEventListener('mousedown', (e) => {
				// Prüfe ob auf Element geklickt wurde
				let elementDiv = e.target.closest('.ui-element');
				if (!elementDiv) {
					// Versuche auch parent zu prüfen
					if (e.target.parentElement && e.target.parentElement.classList.contains('ui-element')) {
						elementDiv = e.target.parentElement;
					} else {
						return; // Nicht auf Element geklickt
					}
				}

				const elementId = elementDiv.dataset.elementId;
				if (!elementId) return;

				const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
					el => el.id === elementId
				);
				if (!element) return;

				// Verhindere Drag wenn auf Resize-Handle geklickt wird
				if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
					return;
				}
				// Verhindere Drag wenn auf Input geklickt wird (Text darf gedraggd werden)
				if (e.target.tagName === 'INPUT' || e.target.closest('.corner-dot')) {
					return;
				}

				e.preventDefault();
				e.stopPropagation();
				this.handleElementMouseDown(e, element);
			}, true); // useCapture = true für früheres Abfangen
		}

		// Element-Eigenschaften
		document.getElementById('propPosX')?.addEventListener('input', (e) => {
			const value = parseInt(e.target.value) || 0;
			this.updateElementProperty('x', value);
		});
		document.getElementById('propPosY')?.addEventListener('input', (e) => {
			const value = parseInt(e.target.value) || 0;
			this.updateElementProperty('y', value);
		});
		document.getElementById('propWidth')?.addEventListener('input', (e) => {
			const value = parseInt(e.target.value);
			if (!isNaN(value)) {
				this.updateElementProperty('width', value);
			}
		});
		document.getElementById('propHeight')?.addEventListener('input', (e) => {
			const value = parseInt(e.target.value);
			if (!isNaN(value)) {
				this.updateElementProperty('height', value);
			}
		});
		document.getElementById('propParamName')?.addEventListener('input', (e) => {
			this.updateElementProperty('paramName', e.target.value);
			// Update auch das Input-Feld im Element
			const elementDiv = document.querySelector(`[data-element-id="${this.selectedElement?.id}"]`);
			if (elementDiv && elementDiv.querySelector('input')) {
				elementDiv.querySelector('input').value = e.target.value;
			}
		});
		document.getElementById('propGdlParam')?.addEventListener('change', (e) => {
			this.updateElementProperty('gdlParam', e.target.value);
			// Wenn GDL-Parameter ausgewählt, setze auch paramName
			if (e.target.value && !this.selectedElement?.paramName) {
				const param = this.parameters.find(p => p.gdl_name === e.target.value);
				if (param) {
					this.updateElementProperty('paramName', param.gdl_name);
					document.getElementById('propParamName').value = param.gdl_name;
					// Update auch die Anzeige im Element
					this.updateElementDisplay();
				}
			}
			// Update Parameter-Wert controls
			this.updateParameterValueControls();
		});

		document.getElementById('propButtonText')?.addEventListener('input', (e) => {
			this.updateElementProperty('buttonText', e.target.value);
		});
		document.getElementById('propButtonParam')?.addEventListener('change', (e) => {
			this.updateElementProperty('gdlParam', e.target.value);
		});

		// UI_PICT
		document.getElementById('selectPictImageBtn')?.addEventListener('click', async () => {
			if (!this.currentObject || !this.currentObject.project_id) {
				alert('Kein Projekt geladen.');
				return;
			}

			const selectedImage = await this.showImageSelectionDialog(this.imageList, this.currentObject.project_id);
			if (selectedImage) {
				this.updateElementProperty('imageName', selectedImage);
				// Update preview
				this.updatePictImagePreview(selectedImage);
				// Wenn Auto-Detect aktiv, Größe anpassen
				if (this.selectedElement && this.selectedElement.useOriginalSize) {
					this.applyOriginalImageSize(this.selectedElement);
				}
			}
		});
		document.getElementById('refreshImagesBtn')?.addEventListener('click', () => {
			this.loadImages();
		});
		document.getElementById('propPictMask')?.addEventListener('change', (e) => {
			this.updateElementProperty('mask', parseInt(e.target.value));
		});

		// UI_INFIELD_IMAGE
		document.getElementById('propGdlParamImage')?.addEventListener('change', (e) => {
			this.updateElementProperty('gdlParam', e.target.value);
			this.updateParameterValueControls();
		});
		document.getElementById('propImageMethod')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageMethod', parseInt(e.target.value));
		});
		document.getElementById('propImageCount')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageCount', parseInt(e.target.value));
		});
		document.getElementById('propImageRows')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageRows', parseInt(e.target.value));
		});
		document.getElementById('propCellX')?.addEventListener('change', (e) => {
			this.updateElementProperty('cellX', parseInt(e.target.value));
		});
		document.getElementById('propCellY')?.addEventListener('change', (e) => {
			this.updateElementProperty('cellY', parseInt(e.target.value));
		});
		document.getElementById('propImageX')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageX', parseInt(e.target.value));
		});
		document.getElementById('propImageY')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageY', parseInt(e.target.value));
		});
		document.getElementById('propFirstImage')?.addEventListener('change', (e) => {
			this.updateElementProperty('imageName', e.target.value);
		});

		document.getElementById('propButtonId')?.addEventListener('input', (e) => {
			this.updateElementProperty('buttonId', parseInt(e.target.value) || 0);
		});
		document.getElementById('propButtonUrl')?.addEventListener('input', (e) => {
			this.updateElementProperty('linkUrl', e.target.value);
		});
		document.getElementById('propButtonTooltip')?.addEventListener('input', (e) => {
			this.updateElementProperty('tooltipText', e.target.value);
		});
		document.getElementById('propPictAutoDetect')?.addEventListener('change', (e) => {
			this.updateElementProperty('useOriginalSize', e.target.checked);
			if (e.target.checked) {
				this.applyOriginalImageSize(this.selectedElement);
			}
		});

		// Parameter-Wert Controls
		document.getElementById('propParamValueSelect')?.addEventListener('change', (e) => {
			if (this.selectedElement && this.selectedElement.gdlParam) {
				const param = this.parameters.find(p => p.gdl_name === this.selectedElement.gdlParam);
				if (param) {
					param.default_value_json = e.target.value;
					this.renderCurrentPage();
					this.selectElement(this.selectedElement);
				}
			}
		});

		document.getElementById('propParamValueCheckbox')?.addEventListener('change', (e) => {
			if (this.selectedElement && this.selectedElement.gdlParam) {
				const param = this.parameters.find(p => p.gdl_name === this.selectedElement.gdlParam);
				if (param) {
					param.default_value_json = e.target.checked ? '1' : '0';
					this.renderCurrentPage();
					this.selectElement(this.selectedElement);
				}
			}
		});

		document.getElementById('propParamValueText')?.addEventListener('input', (e) => {
			if (this.selectedElement && this.selectedElement.gdlParam) {
				const param = this.parameters.find(p => p.gdl_name === this.selectedElement.gdlParam);
				if (param) {
					param.default_value_json = e.target.value;
					this.renderCurrentPage();
					this.selectElement(this.selectedElement);
				}
			}
		});

		// UI_STYLE Change
		document.getElementById('propUiStyle')?.addEventListener('change', (e) => {
			this.updateElementProperty('uiStyle', e.target.value);
		});

		// UI_OUTFIELD spezifisch
		document.getElementById('propOutfieldText')?.addEventListener('input', (e) => {
			this.updateElementProperty('outfieldText', e.target.value);
		});

		document.getElementById('propTextAlign')?.addEventListener('change', (e) => {
			this.updateElementProperty('textAlign', parseInt(e.target.value));
		});

		document.getElementById('propTextGrayed')?.addEventListener('change', (e) => {
			this.updateElementProperty('textGrayed', e.target.checked);
		});

		// UI_RADIOBUTTON spezifisch
		document.getElementById('propRadioParam')?.addEventListener('change', (e) => {
			this.updateElementProperty('gdlParam', e.target.value);
		});
		document.getElementById('propRadioValue')?.addEventListener('input', (e) => {
			this.updateElementProperty('radioValue', e.target.value);
		});
		document.getElementById('propRadioText')?.addEventListener('input', (e) => {
			this.updateElementProperty('buttonText', e.target.value);
		});

		// UI_SEPARATOR spezifisch
		document.getElementById('propSeparatorX1')?.addEventListener('input', (e) => {
			this.updateElementProperty('x1', parseInt(e.target.value) || 0);
		});
		document.getElementById('propSeparatorY1')?.addEventListener('input', (e) => {
			this.updateElementProperty('y1', parseInt(e.target.value) || 0);
		});
		document.getElementById('propSeparatorX2')?.addEventListener('input', (e) => {
			this.updateElementProperty('x2', parseInt(e.target.value) || 0);
		});
		document.getElementById('propSeparatorY2')?.addEventListener('input', (e) => {
			this.updateElementProperty('y2', parseInt(e.target.value) || 0);
		});

		document.getElementById('deleteElementBtn')?.addEventListener('click', () => this.deleteSelectedElement());

		// Tab-Klicks für Seitenwechsel
		document.getElementById('tabBar')?.addEventListener('click', (e) => {
			if (e.target.classList.contains('tab-button')) {
				const pageIndex = parseInt(e.target.dataset.page);
				this.switchPage(pageIndex);
			}
		});

		// Subtab Navigation (unten, basierend auf nTabs_sub)
		document.getElementById('subTabBar')?.addEventListener('click', (e) => {
			const btn = e.target.closest('.sub-tab-button');
			if (!btn) return;
			const subIndex = parseInt(btn.dataset.subtab, 10);
			const pageIndex = this.uiConfig.currentPage;
			if (!Number.isFinite(subIndex)) return;
			if (!this.subTabState) this.subTabState = {};
			this.subTabState[pageIndex] = subIndex;
			this.renderCurrentPage();
			this.updateSubTabs();
		});

		this.setupGuideListeners();
		this.setupScriptEditorListeners();
	}

	setupScriptEditorListeners() {
		const scripts = [
			{ id: 'editMasterScriptBtn', type: 'script_master', title: 'Master Script' },
			{ id: 'editInterfaceScriptBtn', type: 'script_ui', title: 'Interface Script' },
			{ id: 'editParameterScriptBtn', type: 'script_parameter', title: 'Parameter Script' },
			{ id: 'edit2DScriptBtn', type: 'script_2d', title: '2D Script' },
			{ id: 'edit3DScriptBtn', type: 'script_3d', title: '3D Script' }
		];

		scripts.forEach(s => {
			document.getElementById(s.id)?.addEventListener('click', async () => {
				if (!this.currentGdlObjectId) return;
				try {
					const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
					const result = await response.json();
					if (result.success && result.data) {
						let code = result.data[s.type] || '';
						// If interface/parameter scripts are empty, pre-generate them
						if (!code && s.type === 'script_ui') code = this.generateInterfaceScript();
						if (!code && s.type === 'script_parameter') code = this.generateParameterScript();
						if (!code && s.type === 'script_master') code = this.generateMasterScript();

						this.openEditor(code, s.title, async (newCode) => {
							this.updateStatus(`${s.title} wird gespeichert...`);
							try {
								const saveResponse = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`, {
									method: 'PUT',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ [s.type]: newCode })
								});
								const saveResult = await saveResponse.json();
								if (saveResult.success) {
									this.updateStatus(`${s.title} gespeichert!`);
									// Sync local object if needed
									if (this.currentObject) this.currentObject[s.type] = newCode;
								}
							} catch (e) {
								console.error(`Error saving ${s.title}:`, e);
								this.updateStatus(`Fehler beim Speichern von ${s.title}`);
							}
						});
					}
				} catch (e) {
					console.error(`Error loading ${s.title}:`, e);
				}
			});
		});
	}




	async loadParameters() {
		// Objekt-ID: URL-Parameter hat Vorrang (gleiche URL = gleiches Objekt in allen Browsern)
		const params = new URLSearchParams(window.location.search);
		const urlObjectId = params.get('objectId') || params.get('id');

		if (urlObjectId) {
			// All objects now use database IDs (local files are imported first)
			this.currentGdlObjectId = urlObjectId;
			localStorage.setItem('currentGdlObjectId', urlObjectId);
		} else {
			this.currentGdlObjectId = localStorage.getItem('currentGdlObjectId');

			// URL mit objectId aktualisieren, damit gleicher Link in allen Browsern dasselbe Objekt öffnet
			if (this.currentGdlObjectId && !params.has('objectId') && !params.has('id')) {
				const url = new URL(window.location.href);
				url.searchParams.set('objectId', this.currentGdlObjectId);
				window.history.replaceState({}, '', url.toString());
			}
		}
		if (!this.currentGdlObjectId) {
			this.updateStatus('Kein Objekt ausgewählt. Bitte wählen Sie ein Objekt über die Objektverwaltung.');
			this.updateProjectName('Kein Objekt ausgewählt');
			return;
		}

		// Lade Objekt-Info
		try {
			const objResponse = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
			const objResult = await objResponse.json();
			if (objResult.success && objResult.data) {
				this.currentObject = objResult.data;
				this.lastObjectFetchStatus = 'ok';
				const obj = this.currentObject;

				// Standardized Header naming
				const objectNameEl = document.getElementById('headerObjectName');
				const projectNameEl = document.getElementById('headerProjectName');

				if (objectNameEl) objectNameEl.textContent = 'Objekt: ' + (obj.name || 'Unbenannt');
				if (projectNameEl && obj.project_id) {
					const projectIdStr = String(obj.project_id);
					const projectName = projectIdStr.split('/').pop() || 'Unbekanntes Projekt';
					projectNameEl.textContent = 'Projekt: ' + projectName;
				}

				// Update IMAGE_BASE_URL based on object name
				const objectName = obj.name || 'UI-Designer-Template';
				this.IMAGE_BASE_URL = `images/${objectName}/${objectName}`;
			} else {
				this.lastObjectFetchStatus = 'no-data';
				console.warn('Objekt-Info konnte nicht geladen werden, verwende Standard-Pfad');
				this.IMAGE_BASE_URL = 'images/UI-Designer-Template/UI-Designer-Template';
			}
		} catch (error) {
			this.lastObjectFetchStatus = 'error';
			console.error('Fehler beim Laden der Objekt-Info:', error);
			this.IMAGE_BASE_URL = 'images/UI-Designer-Template/UI-Designer-Template';
		}

		// Reload images (always do this after attempting to set IMAGE_BASE_URL)
		await this.loadImages();

		// Lade Parameter aus API
		try {
			const response = await fetch(`${this.API_BASE_URL}/objects/${this.currentGdlObjectId}/parameters`);
			const result = await response.json();
			if (result.success && result.data) {
				this.parameters = result.data;
				this.updateParameterSelect();

				// Re-update properties panel if an element is selected
				// This ensures the parameter dropdown shows the correct value after options are loaded
				if (this.selectedElement) {
					this.updatePropertiesPanel();
				}

				this.updateStatus(`Parameter geladen: ${this.parameters.length} Parameter verfügbar`);
				this.updateDebugOverlay({ stage: 'params-loaded' });
			}
		} catch (error) {
			console.error('Fehler beim Laden der Parameter:', error);
			this.updateStatus('Fehler beim Laden der Parameter');
			this.updateDebugOverlay({ stage: 'params-error' });
		}


	}

	async loadImages() {
		// Load images from Makros folder via backend API
		try {
			// Get project ID from current object
			if (!this.currentObject || !this.currentObject.project_id) {
				console.warn('No project selected, cannot load Makros images');
				this.imageList = [];
				this.updateImageSelect();
				return;
			}

			const projectId = this.currentObject.project_id;
			const response = await fetch(`${this.API_BASE_URL}/images/makros?projectId=${encodeURIComponent(projectId)}`);
			const result = await response.json();

			if (result.success) {
				this.imageList = result.data || [];
				console.log(`Loaded ${this.imageList.length} images from Makros folder`);
			} else {
				console.warn('Could not load image list from Makros folder');
				this.imageList = [];
			}
		} catch (e) {
			console.warn('Error loading images from Makros folder:', e);
			this.imageList = [];
		}

		this.updateImageSelect();
	}

	updateImageSelect() {
		// No longer needed - we use image selection dialog instead
		// Keep for compatibility but do nothing
	}

	updatePictImagePreview(imageName) {
		const previewContainer = document.getElementById('selectedPictImagePreview');
		const previewImg = document.getElementById('selectedPictImageThumb');
		const previewName = document.getElementById('selectedPictImageName');

		if (!previewContainer || !previewImg || !previewName) return;

		if (imageName && this.currentObject && this.currentObject.project_id) {
			const projectId = this.currentObject.project_id;
			previewImg.src = `${this.API_BASE_URL}/images/makros/serve?projectId=${encodeURIComponent(projectId)}&image=${encodeURIComponent(imageName)}`;
			previewName.textContent = imageName;
			previewContainer.style.display = 'block';
		} else {
			previewContainer.style.display = 'none';
		}
	}

	showImageSelectionDialog(images, projectId) {
		return new Promise((resolve) => {
			if (!images || images.length === 0) {
				alert('Keine Bilder verfügbar. Bitte laden Sie zuerst Bilder in den Makros-Ordner.');
				resolve(null);
				return;
			}

			// Create modal overlay
			const overlay = document.createElement('div');
			overlay.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.7);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10000;
			`;

			// Create dialog
			const dialog = document.createElement('div');
			dialog.style.cssText = `
				background: #2e3440;
				border-radius: 8px;
				padding: 20px;
				max-width: 800px;
				max-height: 80vh;
				overflow: auto;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
			`;

			// Dialog header
			const header = document.createElement('h3');
			header.textContent = 'Bild auswählen';
			header.style.cssText = 'color: #88c0d0; margin-top: 0;';
			dialog.appendChild(header);

			// Image grid
			const grid = document.createElement('div');
			grid.style.cssText = `
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				gap: 10px;
				margin-top: 15px;
			`;

			images.forEach(imageName => {
				const imageCard = document.createElement('div');
				imageCard.style.cssText = `
					border: 2px solid #4c566a;
					border-radius: 4px;
					padding: 8px;
					cursor: pointer;
					transition: all 0.2s;
					background: #3b4252;
					text-align: center;
				`;
				imageCard.onmouseover = () => {
					imageCard.style.borderColor = '#88c0d0';
					imageCard.style.backgroundColor = '#434c5e';
				};
				imageCard.onmouseout = () => {
					imageCard.style.borderColor = '#4c566a';
					imageCard.style.backgroundColor = '#3b4252';
				};

				const img = document.createElement('img');
				img.src = `${this.API_BASE_URL}/images/makros/serve?projectId=${encodeURIComponent(projectId)}&image=${encodeURIComponent(imageName)}`;
				img.style.cssText = 'width: 100%; height: 80px; object-fit: contain; display: block;';
				img.onerror = () => {
					img.style.display = 'none';
					imageCard.textContent = imageName;
					imageCard.style.fontSize = '11px';
					imageCard.style.color = '#d8dee9';
				};

				const label = document.createElement('div');
				label.textContent = imageName;
				label.style.cssText = 'font-size: 10px; color: #d8dee9; margin-top: 5px; word-break: break-all;';

				imageCard.appendChild(img);
				imageCard.appendChild(label);

				imageCard.onclick = () => {
					document.body.removeChild(overlay);
					resolve(imageName);
				};

				grid.appendChild(imageCard);
			});

			dialog.appendChild(grid);

			// Cancel button
			const cancelBtn = document.createElement('button');
			cancelBtn.textContent = 'Abbrechen';
			cancelBtn.style.cssText = `
				margin-top: 15px;
				padding: 8px 16px;
				background: #4c566a;
				color: #d8dee9;
				border: none;
				border-radius: 4px;
				cursor: pointer;
			`;
			cancelBtn.onclick = () => {
				document.body.removeChild(overlay);
				resolve(null);
			};
			dialog.appendChild(cancelBtn);

			overlay.appendChild(dialog);
			document.body.appendChild(overlay);

			// Close on overlay click
			overlay.onclick = (e) => {
				if (e.target === overlay) {
					document.body.removeChild(overlay);
					resolve(null);
				}
			};
		});
	}

	async applyOriginalImageSize(element) {
		if (!element || !element.imageName) return;

		const img = new Image();
		img.src = `${this.IMAGE_BASE_URL}/${element.imageName}`;
		img.onload = () => {
			this.updateConfigInputs(); // Sync inputs just in case

			// Update Element Width/Height
			element.width = img.naturalWidth;
			element.height = img.naturalHeight;

			// Update UI
			const wInput = document.getElementById('propWidth');
			const hInput = document.getElementById('propHeight');
			if (this.selectedElement && this.selectedElement.id === element.id) {
				if (wInput) wInput.value = element.width;
				if (hInput) hInput.value = element.height;
			}

			this.renderCurrentPage();
			this.selectElement(element); // Refresh selection box
		};
	}

	updateProjectName(name) {
		const objectNameEl = document.getElementById('headerObjectName');
		if (objectNameEl) {
			const objLabel = window.i18n ? window.i18n.t('object') : 'Objekt';
			objectNameEl.textContent = `${objLabel}: ${name}`;
		}
	}

	updateParameterSelect() {
		const select = document.getElementById('propGdlParam');
		if (!select) return;

		const currentValue = select.value; // ← DIESE ZEILE HINZUFÜGEN
		// Leere Optionen außer der ersten
		while (select.children.length > 1) {
			select.removeChild(select.lastChild);
		}

		// Füge Parameter hinzu
		this.parameters.forEach(param => {
			const option = document.createElement('option');
			option.value = param.gdl_name;
			option.textContent = `${param.gdl_name} (${param.gdl_type})`;
			select.appendChild(option);
		});
		if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
			select.value = currentValue;
		}
	}

	applyConfig() {
		const width = parseInt(document.getElementById('uiWidth').value);
		const height = parseInt(document.getElementById('uiHeight').value);
		const pageCount = parseInt(document.getElementById('pageCount').value);

		if (width < 100 || width > 2000 || height < 100 || height > 2000) {
			const errMsg = window.i18n ? window.i18n.t('err_dim_limit') : 'Breite und Höhe müssen zwischen 100 und 2000 Pixeln liegen.';
			alert(errMsg);
			return;
		}

		this.uiConfig.width = width;
		this.uiConfig.height = height;

		// Seiten anpassen
		while (this.uiConfig.pages.length < pageCount) {
			this.addPage();
		}
		while (this.uiConfig.pages.length > pageCount) {
			this.uiConfig.pages.pop();
		}

		this.updateUI();
		const statusMsg = window.i18n ? window.i18n.t('status_config_applied') : 'Konfiguration übernommen';
		this.updateStatus(statusMsg);
		this.saveUIDesign(); // Speichere nach Konfiguration
	}

	addPage() {
		const pageLabel = window.i18n ? window.i18n.t('page_short') : 'S.';
		const pageNumber = this.uiConfig.pages.length + 1;
		this.uiConfig.pages.push({
			name: `${pageLabel} ${pageNumber}`,
			elements: []
		});

		// Update Seitenanzahl in Konfiguration
		const pageCountInput = document.getElementById('pageCount');
		if (pageCountInput) {
			pageCountInput.value = this.uiConfig.pages.length;
		}

		this.updateUI();
		this.saveUIDesign(); // Speichere nach Änderung
	}

	switchPage(pageIndex) {
		if (pageIndex >= 0 && pageIndex < this.uiConfig.pages.length) {
			this.uiConfig.currentPage = pageIndex;
			this.selectedElement = null;
			this.updateUI();
		}
	}

	updateUI() {
		// Update Dialog Frame Größe
		// uiConfig.height ist die Canvas-Höhe. Frame muss höher sein für Tabs.
		const dialogFrame = document.getElementById('uiDialogFrame');
		const tabBar = document.getElementById('tabBar');

		if (tabBar) {
			this.tabHeight = tabBar.offsetHeight || 32;
		}

		if (dialogFrame) {
			console.log('Update Frame:', this.uiConfig.width, this.uiConfig.height, this.tabHeight);
			dialogFrame.style.width = `${this.uiConfig.width}px`;
			// Gesamthöhe = Canvas + Tabs
			dialogFrame.style.height = `${this.uiConfig.height + this.tabHeight}px`;
		}

		const pageContent = document.getElementById('pageContent');
		if (pageContent) {
			// Canvas-Höhe explizit setzen
			pageContent.style.height = `${this.uiConfig.height}px`;
		}

		// Update Tabs
		this.updateTabs();
		this.updateSubTabs();

		// Update Seitenauswahl
		this.updatePageSelect();

		// Render aktuelle Seite
		this.renderCurrentPage();

		// Update Properties Panel
		this.updatePropertiesPanel();

		// Custom Guides rendern
		this.renderGuides();

		// Apply Zoom
		this.applyZoom();
	}

	applyZoom() {
		const dialogFrame = document.getElementById('uiDialogFrame');
		const canvasContainer = document.querySelector('.canvas-container');
		if (!dialogFrame || !canvasContainer) return;

		const zoomFactor = this.uiConfig.zoom / 100;
		dialogFrame.style.transform = `scale(${zoomFactor})`;
		dialogFrame.style.transformOrigin = 'top left';

		// Container-Größe anpassen für korrekte Positionierung
		// Tabs werden NICHT mitgezoomt, nur der Canvas-Bereich
		canvasContainer.style.width = `${this.uiConfig.width * zoomFactor}px`;
		// Container muss Canvas + Zoomed Tabs beinhalten
		canvasContainer.style.height = `${(this.uiConfig.height + this.tabHeight) * zoomFactor}px`;

		// Custom Guides rendern
		this.renderGuides();

		// Maßstabsleiste bei Zoom >= 200%
		this.updateRulers();

		// Update Zoom Slider
		const zoomSlider = document.getElementById('zoomSlider');
		const zoomLabel = document.getElementById('zoomLabel');
		if (zoomSlider) {
			zoomSlider.value = this.uiConfig.zoom;
		}
		if (zoomLabel) {
			zoomLabel.textContent = `${this.uiConfig.zoom}%`;
		}
	}

	updateRulers() {
		const showRulers = this.uiConfig.zoom >= 200;
		const canvasWrapper = document.querySelector('.canvas-wrapper');
		if (!canvasWrapper) return;

		let rulerHorizontal = document.getElementById('rulerHorizontal');
		let rulerVertical = document.getElementById('rulerVertical');

		if (showRulers) {
			const zoomFactor = this.uiConfig.zoom / 100;

			// Horizontaler Ruler (oben -> jetzt unten)
			if (!rulerHorizontal) {
				rulerHorizontal = document.createElement('div');
				rulerHorizontal.id = 'rulerHorizontal';
				rulerHorizontal.className = 'ruler ruler-horizontal';
				canvasWrapper.insertBefore(rulerHorizontal, canvasWrapper.firstChild);
			}
			rulerHorizontal.style.display = 'block';
			rulerHorizontal.style.width = `${this.uiConfig.width * zoomFactor}px`;
			rulerHorizontal.style.bottom = '0px';
			rulerHorizontal.style.top = 'auto'; // Reset top
			rulerHorizontal.innerHTML = this.generateRulerHTML(this.uiConfig.width, 'horizontal');

			// Vertikaler Ruler (links)
			if (!rulerVertical) {
				rulerVertical = document.createElement('div');
				rulerVertical.id = 'rulerVertical';
				rulerVertical.className = 'ruler ruler-vertical';
				canvasWrapper.insertBefore(rulerVertical, canvasWrapper.firstChild.nextSibling);
			}
			rulerVertical.style.display = 'block';
			rulerVertical.style.height = `${this.uiConfig.height * zoomFactor}px`;
			// Top-Offset anpassen basierend auf Tab-Höhe und Zoom
			const topOffset = this.tabHeight * zoomFactor;
			rulerVertical.style.top = `${topOffset}px`;

			rulerVertical.innerHTML = this.generateRulerHTML(this.uiConfig.height, 'vertical');
		} else {
			if (rulerHorizontal) rulerHorizontal.style.display = 'none';
			if (rulerVertical) rulerVertical.style.display = 'none';
		}
	}

	generateRulerHTML(size, orientation) {
		let html = '';
		const zoomFactor = this.uiConfig.zoom / 100;

		for (let i = 0; i <= size; i += 10) {
			const position = i * zoomFactor;
			if (orientation === 'horizontal') {
				html += `<div class="ruler-mark" style="left: ${position}px">${i}</div>`;
			} else {
				html += `<div class="ruler-mark" style="top: ${position}px">${i}</div>`;
			}
		}

		return html;
	}

	updateTabs() {
		const tabBar = document.getElementById('tabBar');
		if (!tabBar) return;

		tabBar.innerHTML = '';
		this.uiConfig.pages.forEach((page, index) => {
			const button = document.createElement('button');
			button.className = `tab-button ${index === this.uiConfig.currentPage ? 'active' : ''}`;
			// Kurze Beschriftung: "S. 1", "S. 2", ... falls Standardnamen
			const pageLong = window.i18n ? window.i18n.t('page_long') : 'Seite';
			const pageShort = window.i18n ? window.i18n.t('page_short') : 'S.';
			const shortName = page.name?.startsWith(pageLong)
				? page.name.replace(pageLong, pageShort)
				: page.name;
			button.textContent = shortName;
			button.dataset.page = index;
			tabBar.appendChild(button);
		});
	}

	updatePageSelect() {
		const select = document.getElementById('pageSelect');
		if (!select) return;

		select.innerHTML = '';
		this.uiConfig.pages.forEach((page, index) => {
			const option = document.createElement('option');
			option.value = index;
			const pageLong = window.i18n ? window.i18n.t('page_long') : 'Seite';
			const pageShort = window.i18n ? window.i18n.t('page_short') : 'S.';
			const shortName = page.name?.startsWith(pageLong)
				? page.name.replace(pageLong, pageShort)
				: page.name;
			option.textContent = shortName;
			if (index === this.uiConfig.currentPage) {
				option.selected = true;
			}
			select.appendChild(option);
		});
	}

	getParameterPrefix(type) {
		const prefixes = {
			'FillPattern': 'Fill: ',
			'PenColor': 'Pen: ',
			'LineType': 'Line: ',
			'BuildingMaterial': 'BM: ',
			'Profile': 'Prof: ',
			'Material': 'Mat: '
		};
		return prefixes[type] || '';
	}

	getShadowClass(type) {
		if (!type) return 'shadow-inner';
		const selectionTypes = ['fillpattern', 'pencolor', 'linetype', 'buildingmaterial', 'profile', 'material'];
		if (selectionTypes.includes(type.toLowerCase())) {
			return 'shadow-outer';
		}
		return 'shadow-inner';
	}

	getInfieldIcon(type) {
		if (!type) return null;
		const t = type.toLowerCase();

		const icons = {
			'fillpattern': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 2l12 12M2 6l8 8M6 2l8 8M10 2l4 4M2 10l4 4" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`,
			'pencolor': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 2l2.5 4v7h-5v-7L8 2z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M8 2.5l1 2.5h-2l1-2.5z" fill="currentColor"/></svg>`,
			'linetype': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 5h12M2 11h4m3 0h4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
			'buildingmaterial': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 2l6 3.5v7L8 16l-6-3.5v-7L8 2z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M8 2v7m0 0l6-3.5M8 9l-6-3.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4 11.5l4 2.5 4-2.5" stroke="currentColor" stroke-width="1" fill="none" opacity="0.6"/></svg>`,
			'profile': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 3h10v2.5H9.5v5H13V13H3v-2.5h3.5v-5H3V3z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`,
			'material': `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 3h10v4.5H3V3zm2.5 4.5v5.5a1 1 0 001 1h3a1 1 0 001-1v-5.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3 4.2h10M6 8.5v3M10 8.5v3" stroke="currentColor" stroke-width="1" opacity="0.6" fill="none"/></svg>`,
			'array': `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="3" width="10" height="10" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1.2"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1.2"/></svg>`
		};

		return icons[t] || null;
	}

	checkIfArray(defaultValueJson) {
		if (!defaultValueJson) return false;
		try {
			const data = JSON.parse(defaultValueJson);
			return Array.isArray(data);
		} catch (e) {
			return false;
		}
	}

	renderCurrentPage() {
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;

		pageContent.innerHTML = '';

		// 1. Render Template Structure (Frame, Tabs etc. as non-editable elements)
		this.renderTemplateStructure(pageContent);

		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (!currentPage) return;

		currentPage.elements.forEach(element => {
			const el = this.createElementElement(element);
			pageContent.appendChild(el);
		});

		// Custom Guides nach Page-Render wiederherstellen
		this.renderGuides();

		// Subtabs nach Render aktualisieren (abhängig von Parametern)
		this.updateSubTabs();
	}

	getSubTabCountForPage(pageIndex) {
		if (!this.parameters || !this.parameters.length) return 0;
		const p = this.parameters.find(p => p.gdl_name === 'nTabs_sub');
		if (!p || !p.default_value_json) return 0;
		try {
			const data = JSON.parse(p.default_value_json);
			if (Array.isArray(data)) {
				return parseInt(data[pageIndex] || 0) || 0;
			}
			if (typeof data === 'object' && data !== null) {
				const vals = Object.values(data);
				return parseInt(vals[pageIndex] || 0) || 0;
			}
		} catch (e) {
			return 0;
		}
		return 0;
	}

	updateSubTabs() {
		const bar = document.getElementById('subTabBar');
		if (!bar) return;

		const pageIndex = this.uiConfig.currentPage;
		const count = this.getSubTabCountForPage(pageIndex);

		bar.innerHTML = '';
		if (!count || count <= 1) {
			bar.style.display = 'none';
			return;
		}

		bar.style.display = 'flex';
		const current = this.subTabState?.[pageIndex] ?? 0;

		for (let i = 0; i < count; i++) {
			const btn = document.createElement('button');
			btn.className = `sub-tab-button ${i === current ? 'active' : ''}`;
			btn.dataset.subtab = i;
			// Kurzform wie bei Hauptseiten
			const pageShort = window.i18n ? window.i18n.t('page_short') : 'S.';
			btn.textContent = `${pageShort} ${i + 1}`;
			bar.appendChild(btn);
		}
	}



	renderTemplateStructure(container) {
		// Delegate to current template if available
		if (this.currentTemplate && typeof this.currentTemplate.renderPreview === 'function') {
			this.currentTemplate.renderPreview(container, this.uiConfig, this.parameters);
			return;
		}

		// Fallback: Legacy / Default Rendering (Prisma-like)
		const getParamVal = (name, fallback) => {
			const p = this.parameters.find(p => p.gdl_name === name);
			if (!p || !p.default_value_json) return fallback;
			try { return JSON.parse(p.default_value_json); } catch (e) { return p.default_value_json; }
		};

		const nTabs = parseInt(getParamVal('nTabs', this.uiConfig.pages.length));
		// TabTitles can be an array ["a", "b"] or object {"1": "a", "2": "b"} (if imported from GDL Dictionary/Array)
		let rawTabTitles = getParamVal('TabTitles', null);
		let tabTitles = [];
		if (Array.isArray(rawTabTitles)) {
			tabTitles = rawTabTitles;
		} else if (typeof rawTabTitles === 'object' && rawTabTitles !== null) {
			tabTitles = Object.values(rawTabTitles);
		} else if (rawTabTitles !== null) {
			tabTitles = [rawTabTitles]; // Single value
		} else {
			tabTitles = this.uiConfig.pages.map(p => p.name);
		}

		// SubTabs Parameters
		let rawNTabsSub = getParamVal('nTabs_sub', null);
		let nTabsSub = [];
		if (Array.isArray(rawNTabsSub)) nTabsSub = rawNTabsSub;
		else if (typeof rawNTabsSub === 'object' && rawNTabsSub !== null) nTabsSub = Object.values(rawNTabsSub);
		else nTabsSub = new Array(nTabs).fill(0); // Default 0

		let rawSubTabTitles = getParamVal('subTabTitles', null);
		let subTabTitles = []; // 2D Array logic
		if (Array.isArray(rawSubTabTitles)) subTabTitles = rawSubTabTitles;
		// Object support for 2D params? Usually GDL arrays are just arrays in JSON here if fixed by backend.

		const uiWidth = this.uiConfig.width;
		const uiHeight = this.uiConfig.height;
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

		const pageIndex = this.uiConfig.currentPage;
		const subCountVal = nTabsSub[pageIndex] ? parseInt(nTabsSub[pageIndex]) : 0;
		const currentSubTabs = subCountVal > 1 ? subCountVal : 0;
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
			const isCurrent = (i === this.uiConfig.currentPage);
			const pageLong = window.i18n ? window.i18n.t('page_long') : 'Seite';
			const title = tabTitles[i] || `${pageLong} ${i + 1}`;

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
			// Aktiven Subtab aus Web-UI-State lesen (Default: 0)
			let currentSubPage = 0;
			if (this.subTabState && typeof this.subTabState[pageIndex] === 'number') {
				currentSubPage = Math.max(0, Math.min(currentSubTabs - 1, this.subTabState[pageIndex]));
			}

			const mySubTitles = (subTabTitles && subTabTitles[this.uiConfig.currentPage]) ? subTabTitles[this.uiConfig.currentPage] : [];

			for (let j = 0; j < currentSubTabs; j++) {
				const isCurrentSub = (j === currentSubPage);
				const subTitle = (mySubTitles && mySubTitles[j]) ? mySubTitles[j] : `Sub ${j + 1}`; // 0-based in array, GDL 1-based

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
	}

	createElementElement(element) {
		const div = document.createElement('div');
		div.className = `ui-element ${element.type.toLowerCase().replace('_', '-')}`;
		div.dataset.elementId = element.id;
		div.style.left = `${element.x}px`;
		div.style.top = `${element.y}px`;
		div.style.width = `${element.width}px`;
		div.style.height = `${element.height}px`;

		if (element.id === this.selectedElement?.id) {
			div.classList.add('selected');
		}

		// Resize-Handles hinzufügen (für alle Elemente)
		this.addResizeHandles(div, element);

		// UI_INFIELD spezifisch
		if (element.type === 'UI_INFIELD') {
			const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
			const valuesData = param ? this.getValuesData(param) : null;

			const type = param ? param.gdl_type : '';
			const gdlName = param ? param.gdl_name : (element.paramName || '');
			const isArray = param && this.checkIfArray(param.default_value_json);

			// Apply Shadow Class
			if (isArray) {
				div.classList.add('shadow-outer'); // Always protruding button for arrays
			} else {
				div.classList.add(this.getShadowClass(type));
			}

			// Check if Array (Special case)
			if (isArray) {
				div.style.backgroundColor = 'white';
				div.style.display = 'flex';
				div.style.alignItems = 'center';
				div.style.justifyContent = 'center';

				const iconSvg = this.getInfieldIcon('array');
				const iconContainer = document.createElement('div');
				iconContainer.style.width = '16px';
				iconContainer.style.height = '16px';
				iconContainer.style.color = '#333';
				iconContainer.innerHTML = iconSvg;
				div.appendChild(iconContainer);

			} else if (param && type === 'Boolean') {
				div.style.backgroundColor = 'rgb(236, 236, 236)'; // Same as canvas as requested
				div.style.paddingLeft = '2px';
				div.style.display = 'flex';
				div.style.alignItems = 'center';

				const isChecked = param.default_value_json === '1' || param.default_value_json === 'true' || param.default_value_json === '1.0';

				// Nur die Checkbox selber weiß (16x16px), der Rest des Infields wie der Canvas
				const checkboxPart = document.createElement('div');
				checkboxPart.style.width = '16px';
				checkboxPart.style.height = '16px';
				checkboxPart.style.backgroundColor = 'white';
				checkboxPart.style.border = '1px solid #ccc';
				checkboxPart.style.display = 'flex';
				checkboxPart.style.alignItems = 'center';
				checkboxPart.style.justifyContent = 'center';
				checkboxPart.style.fontSize = '14px';
				checkboxPart.style.color = '#333';
				checkboxPart.textContent = isChecked ? '✓' : '';

				div.appendChild(checkboxPart);

			} else if (valuesData) {
				// VALUES or VALUES{2}
				const prefix = this.getParameterPrefix(type);
				let displayValue = '';

				if (param && param.default_value_json) {
					const currentValue = param.default_value_json;
					if (valuesData.type === 'VALUES2') {
						const index = parseInt(currentValue) - 1;
						displayValue = (index >= 0 && index < valuesData.lines.length) ? valuesData.lines[index] : currentValue;
					} else {
						displayValue = currentValue;
					}
				} else if (valuesData.lines.length > 0) {
					displayValue = valuesData.lines[0];
				}

				const input = document.createElement('input');
				input.type = 'text';
				input.value = prefix + displayValue;
				input.readOnly = true;
				input.style.pointerEvents = 'none';

				if (element.uiStyle && this.uiStyles[element.uiStyle]) {
					const style = this.uiStyles[element.uiStyle];
					input.style.fontFamily = style.font;
					input.style.fontWeight = style.weight;
					input.style.fontSize = `${style.size}px`;
				}
				div.appendChild(input);

			} else {
				// Standard text input
				const displayValue = param ? this.getParameterDisplayValue(param) : (element.paramName || '');

				const input = document.createElement('input');
				input.type = 'text';
				input.value = displayValue;
				input.placeholder = 'Parameter-Name';
				input.readOnly = true;
				input.style.pointerEvents = 'none';

				const shadowClass = this.getShadowClass(type);
				// Shadow Class already applied at the start of infield block? 
				// Wait, I applied it at the very start of the `if (element.type === 'UI_INFIELD')` block now.
				// Let's check where I added `div.classList.add(this.getShadowClass(type));`. 

				// UI_STYLE anwenden
				if (element.uiStyle && this.uiStyles[element.uiStyle]) {
					const style = this.uiStyles[element.uiStyle];
					input.style.fontFamily = style.font;
					input.style.fontWeight = style.weight;
					input.style.fontSize = `${style.size}px`;

					// Height only fixed for standard inputs (shadow-inner types)
					if (shadowClass === 'shadow-inner') {
						element.height = style.height;
						div.style.height = `${style.height}px`;
					}
				}
				div.appendChild(input);
			}

			// NEU: Icon hinzufügen falls vorhanden
			const iconSvg = this.getInfieldIcon(type);
			if (iconSvg) {
				const iconContainer = document.createElement('div');
				iconContainer.className = 'ui-infield-icon';
				iconContainer.innerHTML = iconSvg;
				div.appendChild(iconContainer);

				// Eingabefeld Platz für Icon lassen
				const input = div.querySelector('input');
				if (input) {
					input.style.paddingRight = '20px';
				}
			}
		}

		// UI_INFIELD_IMAGE spezifisch
		if (element.type === 'UI_INFIELD_IMAGE') {
			div.style.backgroundColor = 'white';
			div.style.border = '1px solid #ccc';
			div.style.display = 'flex';
			div.style.alignItems = 'center';
			div.style.justifyContent = 'space-between';
			div.style.padding = '2px';
			div.style.position = 'relative';

			// Get parameter to load first image
			const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
			let firstImageName = element.imageName || ''; // Default from element property

			if (param && param.ui_code) {
				try {
					const uiCode = typeof param.ui_code === 'string' ? JSON.parse(param.ui_code) : param.ui_code;
					if (uiCode.type === 'VALUES2_IMAGE' && uiCode.images && uiCode.images.length > 0) {
						// Use first image from parameter's images array
						firstImageName = uiCode.images[0] || firstImageName;
					}
				} catch (e) {
					console.error('Error parsing ui_code for UI_INFIELD_IMAGE:', e);
				}
			}

			// Image container (left side)
			const imgContainer = document.createElement('div');
			imgContainer.style.flex = '1';
			imgContainer.style.display = 'flex';
			imgContainer.style.alignItems = 'center';
			imgContainer.style.justifyContent = 'center';
			imgContainer.style.height = '100%';

			if (firstImageName && this.currentObject && this.currentObject.project_id) {
				// Display the image via backend API
				const img = document.createElement('img');
				const projectId = this.currentObject.project_id;
				img.src = `${this.API_BASE_URL}/images/makros/serve?projectId=${encodeURIComponent(projectId)}&image=${encodeURIComponent(firstImageName)}`;
				img.style.maxWidth = '100%';
				img.style.maxHeight = '100%';
				img.style.objectFit = 'contain';
				img.style.pointerEvents = 'none';
				img.onerror = () => {
					// Fallback: show placeholder text
					imgContainer.innerHTML = '';
					const span = document.createElement('span');
					span.textContent = firstImageName;
					span.style.fontSize = '9px';
					span.style.color = '#666';
					span.style.textAlign = 'center';
					span.style.wordBreak = 'break-all';
					span.style.padding = '2px';
					imgContainer.appendChild(span);
				};
				imgContainer.appendChild(img);
			} else {
				// No image: show placeholder
				const span = document.createElement('span');
				span.textContent = '🖼️';
				span.style.fontSize = '16px';
				span.style.color = '#999';
				imgContainer.appendChild(span);
			}

			// Chevron icon (right side)
			const chevron = document.createElement('div');
			chevron.style.width = '12px';
			chevron.style.display = 'flex';
			chevron.style.alignItems = 'center';
			chevron.style.justifyContent = 'center';
			chevron.style.color = '#666';
			chevron.style.fontSize = '14px';
			chevron.style.fontWeight = 'bold';
			chevron.style.pointerEvents = 'none';
			chevron.innerHTML = '›';

			div.appendChild(imgContainer);
			div.appendChild(chevron);
		}

		// UI_RADIOBUTTON spezifisch
		if (element.type === 'UI_RADIOBUTTON') {
			div.style.backgroundColor = 'transparent';
			div.style.border = 'none';

			const circle = document.createElement('div');
			circle.className = 'radio-circle';

			// Show dot if parameter value matches radioValue
			if (element.gdlParam) {
				const param = this.parameters.find(p => p.gdl_name === element.gdlParam);
				if (param) {
					const currentVal = String(param.default_value_json || '');
					const radioVal = String(element.radioValue || '1');
					if (currentVal === radioVal) {
						circle.classList.add('selected');
					}
				}
			} else {
				// Fallback if no parameter linked
				circle.classList.add('selected');
			}
			div.appendChild(circle);

			const label = document.createElement('div');
			label.className = 'radio-label';
			label.textContent = element.buttonText || 'Radiobutton';

			// UI_STYLE anwenden
			if (element.uiStyle && this.uiStyles[element.uiStyle]) {
				const style = this.uiStyles[element.uiStyle];
				label.style.fontFamily = style.font;
				label.style.fontWeight = style.weight;
				label.style.fontSize = `${style.size}px`;
			}

			div.appendChild(label);
		}

		// UI_OUTFIELD spezifisch
		if (element.type === 'UI_OUTFIELD') {
			const text = element.outfieldText || 'Text';
			const textDiv = document.createElement('div');
			textDiv.className = 'ui-outfield-text';
			textDiv.textContent = text;
			textDiv.style.height = '100%';
			textDiv.style.display = 'flex';
			textDiv.style.alignItems = 'flex-start';
			textDiv.style.justifyContent = 'flex-start';

			// Text-Ausrichtung
			if (element.textAlign === 1) {
				textDiv.style.justifyContent = 'flex-end';
			} else if (element.textAlign === 2) {
				textDiv.style.justifyContent = 'center';
			} else {
				textDiv.style.justifyContent = 'flex-start';
			}

			// UI_STYLE anwenden
			if (element.uiStyle && this.uiStyles[element.uiStyle]) {
				const style = this.uiStyles[element.uiStyle];
				textDiv.style.fontFamily = style.font;
				textDiv.style.fontWeight = style.weight;
				textDiv.style.fontSize = `${style.size}px`;
			}

			// Ausgegrauter Text
			if (element.textGrayed) {
				textDiv.style.color = '#999';
				textDiv.style.opacity = '0.6';
			}

			div.appendChild(textDiv);

			// 4 Begrenzungspunkte als Dots entfernen (wie angefordert)
			// this.addCornerDots(div);
		}

		// UI_BUTTON spezifisch
		if (element.type === 'UI_BUTTON') {
			div.classList.add('shadow-outer');
			div.style.backgroundColor = 'white';
			div.style.display = 'flex';
			div.style.alignItems = 'center';
			div.style.justifyContent = 'center';
			div.style.padding = '0 5px';

			const text = element.buttonText || element.paramName || 'Button';
			const textDiv = document.createElement('div');
			textDiv.textContent = text;
			textDiv.style.width = '100%';
			textDiv.style.textAlign = 'center';
			textDiv.style.color = '#000'; // Neu: Schwarz
			textDiv.style.overflow = 'hidden';
			textDiv.style.textOverflow = 'ellipsis';
			textDiv.style.whiteSpace = 'nowrap';
			textDiv.style.position = 'relative';

			if (element.uiStyle && this.uiStyles[element.uiStyle]) {
				const style = this.uiStyles[element.uiStyle];
				textDiv.style.fontFamily = style.font;
				textDiv.style.fontWeight = style.weight;
				textDiv.style.fontSize = `${style.size}px`;
			}

			div.appendChild(textDiv);

			// Neu: Weblink Icon
			const linkIcon = document.createElement('div');
			linkIcon.style.position = 'absolute';
			linkIcon.style.right = '4px';
			linkIcon.style.top = '50%';
			linkIcon.style.transform = 'translateY(-50%)';
			linkIcon.style.display = 'flex';
			linkIcon.style.alignItems = 'center';
			linkIcon.style.color = '#000';
			linkIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
			div.appendChild(linkIcon);
		}

		// UI_SEPARATOR spezifisch
		if (element.type === 'UI_SEPARATOR') {
			div.style.border = 'none';
			div.style.backgroundColor = 'transparent';

			const line = document.createElement('div');
			line.className = 'ui-separator-line';
			line.style.position = 'absolute';
			line.style.backgroundColor = 'red';

			// Determine if it's a line or a box
			const isBox = element.width !== 0 && element.height !== 0;

			if (isBox) {
				line.style.left = '0';
				line.style.top = '0';
				line.style.width = '100%';
				line.style.height = '100%';
				line.style.backgroundColor = 'transparent';
				line.style.border = '1px solid red';
			} else if (element.width === 0) {
				// Vertical
				line.style.left = '0';
				line.style.top = '0';
				line.style.width = '1px';
				line.style.height = '100%';
			} else {
				// Horizontal
				line.style.left = '0';
				line.style.top = '0';
				line.style.width = '100%';
				line.style.height = '1px';
			}

			div.appendChild(line);
		}

		// UI_PICT spezifisch
		if (element.type === 'UI_PICT') {
			const isTransparent = element.mask === 1;

			if (isTransparent) {
				div.style.backgroundColor = 'transparent';
				div.style.border = 'none';
			} else {
				div.style.backgroundColor = 'white';
				div.style.border = '1px solid #ccc';
			}

			div.style.overflow = 'hidden';
			div.style.display = 'flex';
			div.style.alignItems = 'center';
			div.style.justifyContent = 'center';

			if (element.imageName && this.currentObject && this.currentObject.project_id) {
				// Display the actual image via backend API
				const img = document.createElement('img');
				const projectId = this.currentObject.project_id;
				img.src = `${this.API_BASE_URL}/images/makros/serve?projectId=${encodeURIComponent(projectId)}&image=${encodeURIComponent(element.imageName)}`;
				img.style.maxWidth = '100%';
				img.style.maxHeight = '100%';
				img.style.objectFit = 'contain';
				img.style.pointerEvents = 'none'; // Prevent image from interfering with drag
				img.alt = element.imageName;

				// Handle image load errors
				img.onerror = () => {
					img.style.display = 'none';
					const errorText = document.createElement('div');
					errorText.innerHTML = `<span style="font-size: 24px;">❌</span><br><small style="font-size: 10px; color: #999;">${element.imageName}</small>`;
					errorText.style.textAlign = 'center';
					div.appendChild(errorText);
				};

				div.appendChild(img);
			} else if (element.imageName) {
				// No project - show error
				const errorPlaceholder = document.createElement('div');
				errorPlaceholder.innerHTML = `<span style="font-size: 24px;">❌</span><br><small style="font-size: 10px; color: #999;">${element.imageName}</small>`;
				errorPlaceholder.style.textAlign = 'center';
				errorPlaceholder.style.pointerEvents = 'none';
				div.appendChild(errorPlaceholder);
			} else {
				// No image selected - show placeholder
				const placeholder = document.createElement('div');
				placeholder.textContent = '🖼️';
				placeholder.style.fontSize = '32px';
				placeholder.style.color = '#ccc';
				placeholder.style.pointerEvents = 'none';
				div.appendChild(placeholder);
			}
		}

		// Event Listeners für Drag & Drop auf Canvas
		// Wichtig: Event auf dem div, nicht auf Child-Elementen
		div.addEventListener('mousedown', (e) => {
			// Verhindere Drag wenn auf Resize-Handle geklickt wird
			if (e.target.classList.contains('resize-handle') || e.target.classList.contains('corner-dot')) {
				return; // Wird bereits in handleElementMouseDown behandelt
			}
			// Verhindere Drag wenn auf Input oder Text geklickt wird
			if (e.target.tagName === 'INPUT' || e.target.closest('.ui-outfield-text')) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.handleElementMouseDown(e, element);
		});

		return div;
	}

	addResizeHandles(elementDiv, element) {
		// Prüfe Typ
		const isOutfield = element.type === 'UI_OUTFIELD';
		const isSeparator = element.type === 'UI_SEPARATOR';
		const isInfieldImage = element.type === 'UI_INFIELD_IMAGE';
		const isPict = element.type === 'UI_PICT';
		const isLine = isSeparator && (element.width === 0 || element.height === 0);

		const handles = [
			// Ecken
			{ class: 'nw', cursor: 'nwse-resize', show: isSeparator },
			{ class: 'ne', cursor: 'nesw-resize', show: false },
			{ class: 'sw', cursor: 'nesw-resize', show: false },
			{ class: 'se', cursor: 'nwse-resize', show: isSeparator },

			// Kanten Oben/Unten - Outfield, Button, UI_INFIELD_IMAGE und UI_PICT
			{ class: 'n', cursor: 'ns-resize', show: isOutfield || element.type === 'UI_BUTTON' || isInfieldImage || isPict },
			{ class: 's', cursor: 'ns-resize', show: isOutfield || element.type === 'UI_BUTTON' || isInfieldImage || isPict },

			// Kanten Links/Rechts
			{ class: 'w', cursor: 'ew-resize', show: !isSeparator },
			{ class: 'e', cursor: 'ew-resize', show: !isSeparator }
		];

		handles.forEach(handle => {
			if (!handle.show) return;

			const handleDiv = document.createElement('div');
			handleDiv.className = `resize-handle resize-handle-${handle.class}`;
			handleDiv.dataset.handle = handle.class; // Fixed: use handle.class not handle.data
			handleDiv.style.cursor = handle.cursor;

			// WICHTIG: Expliziter Listener für Resize-Start
			handleDiv.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation(); // Bubbling verhindern, damit nicht Element-Drag startet
				this.handleElementMouseDown(e, element);
			});

			elementDiv.appendChild(handleDiv);
		});
	}

	addCornerDots(elementDiv) {
		// 4 Dots an den Ecken für UI_OUTFIELD
		const corners = ['nw', 'ne', 'sw', 'se'];
		corners.forEach(corner => {
			const dot = document.createElement('div');
			dot.className = `corner-dot corner-dot-${corner}`;
			elementDiv.appendChild(dot);
		});
	}

	getParameterDisplayValue(param) {
		const typePrefixes = {
			'FillPattern': 'Fill: ',
			'PenColor': 'Pen: ',
			'LineType': 'Line: ',
			'BuildingMaterial': 'BM: ',
			'Profile': 'Prof: ',
			'Material': 'Mat: '
		};
		const prefix = typePrefixes[param.gdl_type] || '';

		// Zeige den Parameter-Wert statt Namen
		if (param.default_value_json) {
			try {
				const defaultValue = JSON.parse(param.default_value_json);
				if (defaultValue === null || defaultValue === undefined) {
					return prefix + param.gdl_name; // Fallback wenn kein Wert
				}
				if (typeof defaultValue === 'object') {
					// Für Arrays oder Objekte
					if (Array.isArray(defaultValue)) {
						return prefix + defaultValue.join(', ');
					}
					return prefix + JSON.stringify(defaultValue);
				}
				return prefix + String(defaultValue);
			} catch (e) {
				// Wenn kein JSON, versuche als String
				if (param.default_value_json.trim()) {
					return prefix + param.default_value_json;
				}
			}
		}
		// Fallback: Zeige Parameter-Namen wenn kein Wert vorhanden
		return prefix + param.gdl_name;
	}

	snapToGrid(value) {
		// Enforce integer coordinates
		return Math.round(value);
	}

	snapToGuidesOnly(val, size, axis) {
		const guides = this.uiConfig.guides[axis];
		const threshold = 10;
		let bestSnap = val;
		let minDist = Infinity;

		guides.forEach(guidePos => {
			if (guidePos <= 0) return;
			const distStart = Math.abs(val - guidePos);
			if (distStart < threshold && distStart < minDist) {
				bestSnap = guidePos;
				minDist = distStart;
			}
			const distEnd = Math.abs((val + size) - guidePos);
			if (distEnd < threshold && distEnd < minDist) {
				bestSnap = guidePos - size;
				minDist = distEnd;
			}
		});
		return bestSnap;
	}

	snapToGridAndEndpoints(x, y, element) {
		let snappedX = this.snapToGuidesOnly(x, element.width, 'x');
		let snappedY = this.snapToGuidesOnly(y, element.height, 'y');
		return { x: snappedX, y: snappedY };
	}

	updateElementDisplay() {
		if (!this.selectedElement) return;

		const elementDiv = document.querySelector(`[data-element-id="${this.selectedElement.id}"]`);
		if (!elementDiv) return;

		const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
			el => el.id === this.selectedElement.id
		);
		if (!element) return;

		// Update UI_INFIELD Anzeige
		if (element.type === 'UI_INFIELD') {
			const input = elementDiv.querySelector('input');
			if (input) {
				const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
				const displayValue = param ? this.getParameterDisplayValue(param) : (element.paramName || '');
				input.value = displayValue;
			}
		}

		// Update UI_OUTFIELD Anzeige
		if (element.type === 'UI_OUTFIELD') {
			const textDiv = elementDiv.querySelector('.ui-outfield-text');
			if (textDiv) {
				textDiv.textContent = element.outfieldText || 'Text';
			}
		}

		// Update UI_RADIOBUTTON Anzeige
		if (element.type === 'UI_RADIOBUTTON') {
			const label = elementDiv.querySelector('.radio-label');
			if (label) {
				label.textContent = element.buttonText || 'Radiobutton';
			}
		}
	}

	handleToolboxDragStart(e) {
		const uiType = e.target.closest('.toolbox-item').dataset.uiType;
		console.log('Drag Start:', uiType);
		if (!uiType) return;

		e.dataTransfer.effectAllowed = 'copy';
		e.dataTransfer.setData('uiType', uiType);
		e.target.closest('.toolbox-item').classList.add('dragging');
	}

	handleToolboxDragEnd(e) {
		e.target.closest('.toolbox-item')?.classList.remove('dragging');
	}

	handleCanvasDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	handleCanvasDrop(e) {
		e.preventDefault();
		const uiType = e.dataTransfer.getData('uiType');
		console.log('Drop:', uiType);
		if (!uiType) return;

		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;

		const rect = pageContent.getBoundingClientRect();
		const zoomFactor = this.uiConfig.zoom / 100;

		// Calculate position in canvas coordinates (account for zoom)
		const x = (e.clientX - rect.left) / zoomFactor;
		const y = (e.clientY - rect.top) / zoomFactor;

		// Snap to Grid
		const snappedX = this.snapToGrid(x);
		const snappedY = this.snapToGrid(y);

		this.createElement(uiType, snappedX, snappedY);
	}

	snapToGrid(value) {
		// Old: return Math.round(value / this.uiConfig.gridSize) * this.uiConfig.gridSize;
		// Now: no grid snapping, just raw value (will get overridden by snapToGuides if nearby)
		return value;
	}

	snapToGuidesOnly(val, size, axis) {
		// Achse-Werte
		const guides = this.uiConfig.guides[axis];
		const threshold = 10; // 10px Fangbereich (unscaled units)

		let bestSnap = val;
		let minDist = Infinity;

		guides.forEach(guidePos => {
			if (guidePos <= 0) return;

			// Prüfe linke/obere Kante
			const distStart = Math.abs(val - guidePos);
			if (distStart < threshold && distStart < minDist) {
				bestSnap = guidePos;
				minDist = distStart;
			}

			// Prüfe rechte/untere Kante
			const distEnd = Math.abs((val + size) - guidePos);
			if (distEnd < threshold && distEnd < minDist) {
				bestSnap = guidePos - size;
				minDist = distEnd;
			}
		});

		return bestSnap;
	}

	createElement(type, x, y) {
		const element = {
			id: `element_${++this.elementCounter}`,
			type: type,
			x: Math.max(0, x),
			y: Math.max(0, y),
			width: 200,
			height: 20,
			paramName: '',
			gdlParam: '',
			uiStyle: '2,0', // Default UI_STYLE
			isEditable: true
		};

		// Verwende gespeicherte Default-Größen
		if (this.defaultSizes[type]) {
			element.width = this.defaultSizes[type].width;
			element.height = this.defaultSizes[type].height;
		}

		// UI_INFIELD spezifische Defaults
		if (type === 'UI_INFIELD') {
			element.uiStyle = '2,0';
			// Höhe aus UI_STYLE setzen (überschreibt Default)
			if (this.uiStyles[element.uiStyle]) {
				element.height = this.uiStyles[element.uiStyle].height;
			}
		}

		// UI_INFIELD_IMAGE spezifische Defaults
		if (type === 'UI_INFIELD_IMAGE') {
			element.imageMethod = 2;
			element.imageCount = 3;
			element.imageRows = 3;
			element.cellX = 30;
			element.cellY = 30;
			element.imageX = 30;
			element.imageY = 30;
			element.imageName = ''; // First image to display on canvas
		}

		// UI_OUTFIELD spezifische Defaults
		if (type === 'UI_OUTFIELD') {
			element.outfieldText = '';
			element.textAlign = 0; // Linksbündig
			element.textGrayed = false;
			element.uiStyle = '2,0'; // Default UI_STYLE auch für OUTfield
		}

		// UI_SEPARATOR spezifische Defaults
		if (type === 'UI_SEPARATOR') {
			element.width = 200;
			element.height = 0;
			element.x2 = element.x + element.width;
			element.y2 = element.y + element.height;
		}

		// UI_RADIOBUTTON spezifische Defaults
		if (type === 'UI_RADIOBUTTON') {
			element.radioValue = '1';
			element.buttonText = 'Radiobutton';
			element.uiStyle = '2,0';
		}

		// UI_BUTTON spezifische Defaults
		if (type === 'UI_BUTTON') {
			element.buttonId = 0;
			element.linkUrl = '';
			element.tooltipText = '';
		}

		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (currentPage) {
			currentPage.elements.push(element);
			this.renderCurrentPage();
			this.selectElement(element);
			// Auto-save so the new element is not lost if the user navigates away
			if (this.saveTimeout) clearTimeout(this.saveTimeout);
			this.saveTimeout = setTimeout(() => this.saveUIDesign(), 500);
		}
	}

	handleElementMouseDown(e, element) {

		// Prüfe ob Resize-Handle geklickt wurde
		if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
			const handle = e.target.classList.contains('resize-handle') ? e.target : e.target.closest('.resize-handle');
			this.isResizing = true;
			this.resizeHandle = handle.dataset.handle;
			this.selectElement(element);
			this.dragStartPos = { x: e.clientX, y: e.clientY };
			this.elementStartSize = { width: element.width, height: element.height };
			this.elementStartPos = { x: element.x, y: element.y };

			this.boundHandleResizeMove = this.handleResizeMove.bind(this);
			this.boundHandleResizeEnd = this.handleResizeEnd.bind(this);
			document.addEventListener('mousemove', this.boundHandleResizeMove);
			document.addEventListener('mouseup', this.boundHandleResizeEnd);
			return;
		}

		this.selectElement(element);

		// Start Drag - funktioniert immer wenn auf Element geklickt wird
		this.isDragging = true;

		// Finde Element-Div zuverlässig
		let elementDiv = e.target.closest('.ui-element');
		if (!elementDiv && e.currentTarget) {
			elementDiv = e.currentTarget;
		}
		if (!elementDiv) {
			console.error('Element-Div nicht gefunden');
			this.isDragging = false;
			return;
		}

		// Speichere Startpositionen für Delta-Berechnung
		this.dragStartMousePos = { x: e.clientX, y: e.clientY };
		this.dragStartElementPos = { x: element.x, y: element.y };

		// Verwende bound functions für korrektes this
		this.boundHandleMouseMove = this.handleElementMouseMove.bind(this);
		this.boundHandleMouseUp = this.handleElementMouseUp.bind(this);

		document.addEventListener('mousemove', this.boundHandleMouseMove);
		document.addEventListener('mouseup', this.boundHandleMouseUp);

		// Verhindere Text-Selektion während Drag
		e.preventDefault();
		e.stopPropagation();
	}

	handleElementMouseMove(e) {
		if (!this.isDragging || !this.selectedElement) {
			return;
		}

		// Calculate delta in screen pixels
		const screenDeltaX = e.clientX - this.dragStartMousePos.x;
		const screenDeltaY = e.clientY - this.dragStartMousePos.y;

		// Convert delta to canvas units (account for zoom)
		const zoomFactor = this.uiConfig.zoom / 100;
		const canvasDeltaX = screenDeltaX / zoomFactor;
		const canvasDeltaY = screenDeltaY / zoomFactor;

		// Apply delta to initial element position
		let x = this.dragStartElementPos.x + canvasDeltaX;
		let y = this.dragStartElementPos.y + canvasDeltaY;

		// Snap to Guides
		x = this.snapToGuidesOnly(x, this.selectedElement.width, 'x');
		y = this.snapToGuidesOnly(y, this.selectedElement.height, 'y');

		// Begrenze auf Canvas
		const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
			el => el.id === this.selectedElement.id
		);
		if (!element) return;

		x = Math.max(0, Math.min(x, this.uiConfig.width - element.width));
		y = Math.max(0, Math.min(y, this.uiConfig.height - element.height));

		this.updateElementProperty('x', x, false);
		this.updateElementProperty('y', y, false);

		// Synchronisiere X1/Y1/X2/Y2 für Separator
		if (element.type === 'UI_SEPARATOR') {
			element.x2 = element.x + element.width;
			element.y2 = element.y + element.height;

			const x1Input = document.getElementById('propSeparatorX1');
			const y1Input = document.getElementById('propSeparatorY1');
			const x2Input = document.getElementById('propSeparatorX2');
			const y2Input = document.getElementById('propSeparatorY2');

			if (x1Input) x1Input.value = element.x;
			if (y1Input) y1Input.value = element.y;
			if (x2Input) x2Input.value = element.x2;
			if (y2Input) y2Input.value = element.y2;
		}
	}

	handleResizeMove(e) {
		if (!this.isResizing || !this.selectedElement || !this.resizeHandle) return;

		const deltaX = e.clientX - this.dragStartPos.x;
		const deltaY = e.clientY - this.dragStartPos.y;

		const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
			el => el.id === this.selectedElement.id
		);
		if (!element) return;

		let newWidth = this.elementStartSize.width;
		let newHeight = this.elementStartSize.height;
		let newX = this.elementStartPos.x;
		let newY = this.elementStartPos.y;

		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;
		const rect = pageContent.getBoundingClientRect();
		const zoomFactor = this.uiConfig.zoom / 100;

		// Berechne Delta in Canvas-Koordinaten (berücksichtige Zoom)
		const canvasDeltaX = deltaX / zoomFactor;
		const canvasDeltaY = deltaY / zoomFactor;

		// Prüfe ob Höhe fixiert ist (UI_INFIELD mit UI_STYLE, aber nur bei editierbaren Feldern)
		let isHeightFixed = false;
		if (element.type === 'UI_INFIELD' && element.uiStyle && this.uiStyles[element.uiStyle]) {
			const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
			const isSystemField = param && !this.editableTypes.some(t => t.toLowerCase() === param.gdl_type.toLowerCase());
			const isArray = param && this.checkIfArray(param.default_value_json);
			// Höhe ist fixiert nur wenn es ein editierbares Feld ist UND kein Array
			isHeightFixed = !isSystemField && !isArray;
		}

		const minSize = element.type === 'UI_SEPARATOR' ? 0 : 1;

		switch (this.resizeHandle) {
			case 'se': // Süd-Ost (bottom-right)
				newWidth = Math.max(minSize, this.elementStartSize.width + canvasDeltaX);
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'sw': // Süd-West (bottom-left)
				newWidth = Math.max(minSize, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'ne': // Nord-Ost (top-right)
				newWidth = Math.max(minSize, this.elementStartSize.width + canvasDeltaX);
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
			case 'nw': // Nord-West (top-left)
				newWidth = Math.max(minSize, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
			case 'e': // Ost (right)
				newWidth = Math.max(minSize, this.elementStartSize.width + canvasDeltaX);
				break;
			case 'w': // West (left)
				newWidth = Math.max(minSize, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				break;
			case 's': // Süd (bottom)
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'n': // Nord (top)
				if (!isHeightFixed) {
					newHeight = Math.max(minSize, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
		}

		// Wenn Höhe fixiert, verwende UI_STYLE Höhe
		if (isHeightFixed) {
			newHeight = this.uiStyles[element.uiStyle].height;
		}

		// Snap to Guides
		newX = this.snapToGuidesOnly(newX, newWidth, 'x');
		newY = this.snapToGuidesOnly(newY, newHeight, 'y');

		// Snap Width/Height to guides?
		// Wenn wir die Größe ändern, wollen wir vielleicht, dass die Kante am Guide fängt.
		// Das ist komplexer, weil wir wissen müssen, welche Kante bewegt wird.

		// Einfacher Ansatz: Snap resulting edges
		if (this.resizeHandle.includes('e')) {
			// Rechte Kante bewegt -> snap right edge
			const rightEdge = newX + newWidth;
			const snappedRight = this.snapToGuidesOnly(rightEdge, 0, 'x');
			newWidth = snappedRight - newX;
		}
		if (this.resizeHandle.includes('w')) {
			// Linke Kante bewegt -> snap left edge (newX)
			const snappedLeft = this.snapToGuidesOnly(newX, 0, 'x');
			const diff = newX - snappedLeft;
			newX = snappedLeft;
			newWidth += diff;
		}
		if (this.resizeHandle.includes('s')) {
			const bottomEdge = newY + newHeight;
			const snappedBottom = this.snapToGuidesOnly(bottomEdge, 0, 'y');
			newHeight = snappedBottom - newY;
		}
		if (this.resizeHandle.includes('n')) {
			const snappedTop = this.snapToGuidesOnly(newY, 0, 'y');
			const diff = newY - snappedTop;
			newY = snappedTop;
			newHeight += diff;
		}

		// Begrenze auf Canvas
		if (newX < 0) {
			newWidth += newX;
			newX = 0;
		}
		if (newY < 0) {
			newHeight += newY;
			newY = 0;
		}
		if (newX + newWidth > this.uiConfig.width) {
			newWidth = this.uiConfig.width - newX;
		}
		if (newY + newHeight > this.uiConfig.height) {
			newHeight = this.uiConfig.height - newY;
		}

		// Für UI_INFIELD: Höhe durch UI_STYLE bestimmt (nur bei editierbaren Feldern)
		if (element.type === 'UI_INFIELD' && element.uiStyle && this.uiStyles[element.uiStyle]) {
			const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
			const isSystemField = param && !this.editableTypes.some(t => t.toLowerCase() === param.gdl_type.toLowerCase());
			// Nur bei editierbaren Feldern die Höhe fixieren
			if (!isSystemField) {
				newHeight = this.uiStyles[element.uiStyle].height;
			}
		}

		// Snapping für perfekt gerade Linien bei UI_SEPARATOR
		if (element.type === 'UI_SEPARATOR') {
			const snapThreshold = 8; // Erhöht auf 8px für besseres "Snapping"
			if (Math.abs(newWidth) < snapThreshold) newWidth = 0;
			if (Math.abs(newHeight) < snapThreshold) newHeight = 0;
		}

		this.updateElementProperty('width', newWidth, false);
		this.updateElementProperty('height', newHeight, false);
		this.updateElementProperty('x', newX, false);
		this.updateElementProperty('y', newY, false);

		// Synchronisiere alle Inputs (inkl. Breite/Höhe) während des Drags
		if (this.selectedElement && this.selectedElement.id === element.id) {
			const wInput = document.getElementById('propWidth');
			const hInput = document.getElementById('propHeight');
			if (wInput) wInput.value = Math.round(newWidth);
			if (hInput) hInput.value = Math.round(newHeight);
		}

		// Synchronisiere X1/Y1/X2/Y2 für Separator
		if (element.type === 'UI_SEPARATOR') {
			element.x2 = element.x + element.width;
			element.y2 = element.y + element.height;

			const x1Input = document.getElementById('propSeparatorX1');
			const y1Input = document.getElementById('propSeparatorY1');
			const x2Input = document.getElementById('propSeparatorX2');
			const y2Input = document.getElementById('propSeparatorY2');

			if (x1Input) x1Input.value = element.x;
			if (y1Input) y1Input.value = element.y;
			if (x2Input) x2Input.value = element.x2;
			if (y2Input) y2Input.value = element.y2;
		}
	}

	handleResizeEnd(e) {
		if (this.isResizing) {
			this.isResizing = false;
			this.resizeHandle = null;
			if (this.boundHandleResizeMove) {
				document.removeEventListener('mousemove', this.boundHandleResizeMove);
			}
			if (this.boundHandleResizeEnd) {
				document.removeEventListener('mouseup', this.boundHandleResizeEnd);
			}
			this.boundHandleResizeMove = null;
			this.boundHandleResizeEnd = null;

			// Speichere neue Default-Größe
			if (this.selectedElement) {
				const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
					el => el.id === this.selectedElement.id
				);
				if (element) {
					this.defaultSizes[element.type] = {
						width: element.width,
						height: element.height
					};
				}
			}

			this.renderCurrentPage();
			if (this.selectedElement) {
				this.selectElement(this.selectedElement);
			}

			// Speichere nach Resize
			this.saveUIDesign();
		}
	}

	snapToGridAndEndpoints(x, y, element) {
		// Snap to Grid
		let snappedX = this.snapToGrid(x);
		let snappedY = this.snapToGrid(y);

		// Snap to Endpoints anderer Elemente (nur für UI_INFIELD)
		if (element.type === 'UI_INFIELD') {
			const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
			if (currentPage) {
				const snapDistance = 5; // Pixel-Toleranz für Snap
				const snapOffset = 1; // 1px Abstand beim Einrasten

				for (const otherElement of currentPage.elements) {
					if (otherElement.id === element.id) continue;

					// Snap zu linkem Rand
					if (Math.abs(snappedX - otherElement.x) < snapDistance) {
						snappedX = otherElement.x - snapOffset;
					}
					// Snap zu rechtem Rand
					if (Math.abs(snappedX - (otherElement.x + otherElement.width)) < snapDistance) {
						snappedX = otherElement.x + otherElement.width + snapOffset;
					}
					// Snap zu oberem Rand
					if (Math.abs(snappedY - otherElement.y) < snapDistance) {
						snappedY = otherElement.y - snapOffset;
					}
					// Snap zu unterem Rand
					if (Math.abs(snappedY - (otherElement.y + otherElement.height)) < snapDistance) {
						snappedY = otherElement.y + otherElement.height + snapOffset;
					}
				}
			}
		}

		return { x: snappedX, y: snappedY };
	}

	handleElementMouseUp(e) {
		if (this.isDragging) {
			this.isDragging = false;
			if (this.boundHandleMouseMove) {
				document.removeEventListener('mousemove', this.boundHandleMouseMove);
			}
			if (this.boundHandleMouseUp) {
				document.removeEventListener('mouseup', this.boundHandleMouseUp);
			}
			this.boundHandleMouseMove = null;
			this.boundHandleMouseUp = null;

			// Speichere automatisch nach Drag (mit Debounce)
			if (this.saveTimeout) {
				clearTimeout(this.saveTimeout);
			}
			this.saveTimeout = setTimeout(() => {
				this.saveUIDesign();
			}, 500);
		}
	}

	handleCanvasClick(e) {
		// Wenn auf Canvas geklickt wird (nicht auf Element), deselektiere
		if (e.target.id === 'pageContent' || e.target.classList.contains('current-page-content')) {
			this.selectElement(null);
		}
	}

	selectElement(element) {
		this.selectedElement = element;
		this.renderCurrentPage();
		this.updatePropertiesPanel();
	}

	updateElementProperty(property, value, render = true) {
		if (!this.selectedElement) return;

		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (!currentPage) return;

		const element = currentPage.elements.find(el => el.id === this.selectedElement.id);
		if (!element) return;

		switch (property) {
			case 'x':
				element.x = Math.max(0, Math.min(value, this.uiConfig.width - element.width));
				element.x = this.snapToGrid(element.x);
				break;
			case 'y':
				element.y = Math.max(0, Math.min(value, this.uiConfig.height - element.height));
				element.y = this.snapToGrid(element.y);
				break;
			case 'width':
				const minWidth = element.type === 'UI_SEPARATOR' ? 0 : 1;
				element.width = Math.max(minWidth, value);
				element.width = this.snapToGrid(element.width);
				// Stelle sicher, dass Element nicht außerhalb des Canvas ist
				if (element.x + element.width > this.uiConfig.width) {
					element.x = this.uiConfig.width - element.width;
				}
				// Speichere als Default für diesen Typ
				this.defaultSizes[element.type] = {
					...this.defaultSizes[element.type],
					width: element.width
				};
				break;
			case 'height':
				if (element.type === 'UI_INFIELD') {
					const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
					const isSystemField = param && !this.editableTypes.some(t => t.toLowerCase() === param.gdl_type.toLowerCase());
					const isArray = param && this.checkIfArray(param.default_value_json);

					if (!isSystemField && !isArray && element.uiStyle && this.uiStyles[element.uiStyle]) {
						element.height = this.uiStyles[element.uiStyle].height;
					} else if (isSystemField || isArray) {
						element.height = Math.max(1, value);
						element.height = this.snapToGrid(element.height);
					} else {
						element.height = 20;
					}
					const heightInput = document.getElementById('propHeight');
					if (heightInput) heightInput.value = element.height;

					if (!render) {
						const elementDiv = document.querySelector(`[data-element-id="${element.id}"]`);
						if (elementDiv) elementDiv.style.height = `${element.height}px`;
					}
				} else {
					const minHeight = element.type === 'UI_SEPARATOR' ? 0 : 1;
					element.height = Math.max(minHeight, value);
					element.height = this.snapToGrid(element.height);

					if (element.y + element.height > this.uiConfig.height) {
						element.y = this.uiConfig.height - element.height;
					}

					if (!element.uiStyle || element.type !== 'UI_INFIELD') {
						this.defaultSizes[element.type] = {
							...this.defaultSizes[element.type],
							height: element.height
						};
					}
				}
				break;
			case 'paramName':
				// Removed paramName handling for UI_INFIELD as requested
				element.paramName = value;
				break;
			case 'gdlParam':
				element.gdlParam = value;
				// Update Anzeige wenn Parameter geändert wird
				this.updateElementDisplay();
				break;
			case 'uiStyle':
				element.uiStyle = value;
				// Update Höhe basierend auf UI_STYLE
				if (this.uiStyles[value]) {
					element.height = this.uiStyles[value].height;
					// Breite wird nur bei GDL-Code-Generierung angepasst (Länge = Länge - 2)
				}
				// Re-render um UI_STYLE anzuwenden
				if (render) {
					this.renderCurrentPage();
					this.selectElement(element);
				}
				break;
			case 'outfieldText':
				element.outfieldText = value;
				break;
			case 'textAlign':
				element.textAlign = value;
				break;
			case 'textGrayed':
				element.textGrayed = value;
				break;
			case 'buttonText':
				element.buttonText = value;
				this.updateElementDisplay();
				break;
			case 'radioValue':
				element.radioValue = value;
				break;
			case 'imageName':
				element.imageName = value;
				break;
			case 'mask':
				element.mask = value;
				break;
			case 'buttonId':
				element.buttonId = value;
				break;
			case 'linkUrl':
				element.linkUrl = value;
				break;
			case 'tooltipText':
				element.tooltipText = value;
				break;
			case 'useOriginalSize':
				element.useOriginalSize = value;
				break;
			case 'x1':
				element.x = value;
				this.updateSeparatorByCoordinates(element);
				break;
			case 'y1':
				element.y = value;
				this.updateSeparatorByCoordinates(element);
				break;
			case 'x2':
				element.x2 = value;
				this.updateSeparatorByCoordinates(element);
				break;
			case 'y2':
				element.y2 = value;
				this.updateSeparatorByCoordinates(element);
				break;
		}

		if (render) {
			this.renderCurrentPage();
			this.selectElement(element); // Aktualisiere Selection
		} else {
			// Update nur das Element visuell ohne Re-Render
			const elementDiv = document.querySelector(`[data-element-id="${element.id}"]`);
			if (elementDiv) {
				elementDiv.style.left = `${element.x}px`;
				elementDiv.style.top = `${element.y}px`;
				elementDiv.style.width = `${element.width}px`;
				elementDiv.style.height = `${element.height}px`;
			}
		}

		// Debounced auto-save: Eigenschaftsaenderungen nach 800ms sichern
		if (this.saveTimeout) clearTimeout(this.saveTimeout);
		this.saveTimeout = setTimeout(() => this.saveUIDesign(), 800);
	}

	updateSeparatorByCoordinates(element) {
		if (element.type !== 'UI_SEPARATOR') return;

		// Wenn x2/y2 noch nicht gesetzt sind (altes Element oder frisch erstellt), initialisiere sie
		if (element.x2 === undefined) element.x2 = element.x + element.width;
		if (element.y2 === undefined) element.y2 = element.y + element.height;

		// Berechne Breite/Höhe aus Koordinaten
		element.width = Math.abs(element.x2 - element.x);
		element.height = Math.abs(element.y2 - element.y);

		// Synchronisiere propPosX/Y/Width/Height Inputs falls dieses Element ausgewählt ist
		if (this.selectedElement && this.selectedElement.id === element.id) {
			const posX = document.getElementById('propPosX');
			const posY = document.getElementById('propPosY');
			const width = document.getElementById('propWidth');
			const height = document.getElementById('propHeight');

			if (posX) posX.value = element.x;
			if (posY) posY.value = element.y;
			if (width) width.value = element.width;
			if (height) height.value = element.height;
		}
	}

	deleteSelectedElement() {
		if (!this.selectedElement) return;

		if (!confirm('Element wirklich löschen?')) return;

		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (currentPage) {
			currentPage.elements = currentPage.elements.filter(el => el.id !== this.selectedElement.id);
			this.selectElement(null);
			this.renderCurrentPage();
			this.updateStatus('Element gelöscht');
		}
	}

	updatePropertiesPanel() {
		const propsSection = document.getElementById('elementProperties');
		const noSelection = document.querySelector('.no-selection');
		const propHeader = document.getElementById('propHeader');

		if (!propsSection || !noSelection) return;

		if (!this.selectedElement) {
			propsSection.classList.add('hidden');
			noSelection.classList.remove('hidden');
			// Moment, der User sagte: "Wenn nichts im Canvas ausgewählt ist, bitte 'Eigenschaften' entfernen." 
			// Und "Wenn etwas ausgewählt ist, dann bitte den Text 'Kein Element ausgewählt...' entfernen"
			// Das impliziert:
			// Nichts ausgewählt -> Header weg.
			// Etwas ausgewählt -> Info-Text weg.

			if (propHeader) propHeader.classList.add('hidden');
			return;
		}

		// Etwas ist ausgewählt
		if (propHeader) propHeader.classList.remove('hidden');
		propsSection.classList.remove('hidden');
		noSelection.classList.add('hidden');

		// Aktualisiere Felder
		const propType = document.getElementById('propType');
		if (propType) propType.textContent = this.selectedElement.type;
		document.getElementById('propPosX').value = this.selectedElement.x;
		document.getElementById('propPosY').value = this.selectedElement.y;
		document.getElementById('propWidth').value = this.selectedElement.width;
		document.getElementById('propHeight').value = this.selectedElement.height;
		document.getElementById('propUiStyle').value = this.selectedElement.uiStyle || '0,0';

		// 1. Alle spezifischen Panels verstecken
		const infieldProps = document.getElementById('infieldProps');
		const infieldImageProps = document.getElementById('infieldImageProps');
		const outfieldProps = document.getElementById('outfieldProps');
		const buttonProps = document.getElementById('buttonProps');
		const pictProps = document.getElementById('pictProps');
		const separatorProps = document.getElementById('separatorProps');
		const uiStyleProps = document.getElementById('uiStyleProps');

		if (infieldProps) infieldProps.style.display = 'none';
		if (infieldImageProps) infieldImageProps.style.display = 'none';
		if (outfieldProps) outfieldProps.style.display = 'none';
		if (buttonProps) buttonProps.style.display = 'none';
		if (pictProps) pictProps.style.display = 'none';
		if (separatorProps) separatorProps.style.display = 'none';
		if (uiStyleProps) uiStyleProps.style.display = 'none';
		const radiobuttonProps = document.getElementById('radiobuttonProps');
		if (radiobuttonProps) radiobuttonProps.style.display = 'none';

		// 2. Felder befüllen und nur relevante Panels einblenden
		const type = this.selectedElement.type;

		if (type === 'UI_INFIELD') {
			if (infieldProps) infieldProps.style.display = 'block';
			if (uiStyleProps) uiStyleProps.style.display = 'block';

			const gdlParamSelect = document.getElementById('propGdlParam');
			if (gdlParamSelect) {
				gdlParamSelect.value = this.selectedElement.gdlParam || '';
			}
			this.updateParameterValueControls();

		} else if (type === 'UI_INFIELD_IMAGE') {
			if (infieldImageProps) infieldImageProps.style.display = 'block';

			// GDL Parameter dropdown
			const gdlParamImageSelect = document.getElementById('propGdlParamImage');
			if (gdlParamImageSelect) {
				// Clear and populate
				while (gdlParamImageSelect.children.length > 1) {
					gdlParamImageSelect.removeChild(gdlParamImageSelect.lastChild);
				}
				// Only show Integer parameters with VALUES2_IMAGE
				this.parameters.filter(p => {
					if (p.gdl_type !== 'Integer') return false;
					if (!p.ui_code) return false;
					try {
						const uiCode = typeof p.ui_code === 'string' ? JSON.parse(p.ui_code) : p.ui_code;
						return uiCode.type === 'VALUES2_IMAGE';
					} catch (e) {
						return false;
					}
				}).forEach(param => {
					const option = document.createElement('option');
					option.value = param.gdl_name;
					option.textContent = `${param.gdl_name}`;
					gdlParamImageSelect.appendChild(option);
				});
				gdlParamImageSelect.value = this.selectedElement.gdlParam || '';
			}

			// Load image settings
			document.getElementById('propImageMethod').value = this.selectedElement.imageMethod || 2;
			document.getElementById('propImageCount').value = this.selectedElement.imageCount || 3;
			document.getElementById('propImageRows').value = this.selectedElement.imageRows || 3;
			document.getElementById('propCellX').value = this.selectedElement.cellX || 30;
			document.getElementById('propCellY').value = this.selectedElement.cellY || 30;
			document.getElementById('propImageX').value = this.selectedElement.imageX || 30;
			document.getElementById('propImageY').value = this.selectedElement.imageY || 30;

			// First image dropdown
			const firstImageSelect = document.getElementById('propFirstImage');
			if (firstImageSelect) {
				while (firstImageSelect.children.length > 1) {
					firstImageSelect.removeChild(firstImageSelect.lastChild);
				}
				this.imageList.forEach(img => {
					const option = document.createElement('option');
					option.value = img;
					option.textContent = img;
					firstImageSelect.appendChild(option);
				});
				firstImageSelect.value = this.selectedElement.imageName || '';
			}

		} else if (type === 'UI_OUTFIELD') {
			if (outfieldProps) outfieldProps.style.display = 'block';
			if (uiStyleProps) uiStyleProps.style.display = 'block';

			const outfieldTextInput = document.getElementById('propOutfieldText');
			if (outfieldTextInput) {
				outfieldTextInput.value = this.selectedElement.outfieldText || '';
			}
			const textAlignSelect = document.getElementById('propTextAlign');
			if (textAlignSelect) {
				textAlignSelect.value = this.selectedElement.textAlign || 0;
			}
			const textGrayedCheckbox = document.getElementById('propTextGrayed');
			if (textGrayedCheckbox) {
				textGrayedCheckbox.checked = !!this.selectedElement.textGrayed;
			}

		} else if (type === 'UI_BUTTON') {
			if (buttonProps) buttonProps.style.display = 'block';
			if (uiStyleProps) uiStyleProps.style.display = 'block';

			const buttonText = document.getElementById('propButtonText');
			if (buttonText) buttonText.value = this.selectedElement.buttonText || '';

			const buttonParam = document.getElementById('propButtonParam');
			if (buttonParam) {
				while (buttonParam.children.length > 1) {
					buttonParam.removeChild(buttonParam.lastChild);
				}
				this.parameters.forEach(param => {
					const option = document.createElement('option');
					option.value = param.gdl_name;
					option.textContent = `${param.gdl_name} (${param.gdl_type})`;
					buttonParam.appendChild(option);
				});
				buttonParam.value = this.selectedElement.gdlParam || '';
			}

			// Fields for UI_BUTTON UI_LINK
			const buttonId = document.getElementById('propButtonId');
			if (buttonId) buttonId.value = this.selectedElement.buttonId || 0;
			const buttonUrl = document.getElementById('propButtonUrl');
			if (buttonUrl) buttonUrl.value = this.selectedElement.linkUrl || '';
			const buttonTooltip = document.getElementById('propButtonTooltip');
			if (buttonTooltip) buttonTooltip.value = this.selectedElement.tooltipText || '';

		} else if (type === 'UI_PICT') {
			if (pictProps) pictProps.style.display = 'block';

			// Update preview
			this.updatePictImagePreview(this.selectedElement.imageName);

			const maskSelect = document.getElementById('propPictMask');
			if (maskSelect) maskSelect.value = this.selectedElement.mask || 0;
			const autoDetectCheckbox = document.getElementById('propPictAutoDetect');
			if (autoDetectCheckbox) autoDetectCheckbox.checked = !!this.selectedElement.useOriginalSize;

		} else if (type === 'UI_SEPARATOR') {
			if (separatorProps) separatorProps.style.display = 'block';
		} else if (type === 'UI_RADIOBUTTON') {
			if (radiobuttonProps) radiobuttonProps.style.display = 'block';
			if (uiStyleProps) uiStyleProps.style.display = 'block';

			const radioParam = document.getElementById('propRadioParam');
			if (radioParam) {
				// Dropdown für Radio-Parameter (Nur Integer!)
				while (radioParam.children.length > 1) {
					radioParam.removeChild(radioParam.lastChild);
				}
				this.parameters.forEach(param => {
					if (param.gdl_type === 'Integer') {
						const option = document.createElement('option');
						option.value = param.gdl_name;
						option.textContent = `${param.gdl_name} (${param.gdl_type})`;
						radioParam.appendChild(option);
					}
				});
				radioParam.value = this.selectedElement.gdlParam || '';
			}

			const radioValue = document.getElementById('propRadioValue');
			if (radioValue) radioValue.value = this.selectedElement.radioValue || '1';

			const radioText = document.getElementById('propRadioText');
			if (radioText) radioText.value = this.selectedElement.buttonText || 'Radiobutton';
		}
	}

	updateStatus(message) {
		const statusMessage = document.querySelector('.status-message');
		if (statusMessage) {
			statusMessage.textContent = `Status: ${message}`;
		}
	}

	async saveUIDesign() {
		if (!this.currentGdlObjectId) {
			this.updateStatus('Kein Objekt ausgewählt. Bitte wählen Sie ein Objekt über die Objektverwaltung.');
			return;
		}

		try {
			// 1. Speichere Config in localStorage als Backup
			const storageKey = `uiDesign_${this.currentGdlObjectId}`;
			localStorage.setItem(storageKey, JSON.stringify(this.uiConfig));

			// 2. Generiere den aktuellen UI-Script Code
			const uiScriptCode = this.generateInterfaceScript();

			// 3. Generiere Master und Parameter Scripts (für den Fall, dass sie leer sind)
			const masterScriptCode = this.generateMasterScript();
			const paramScriptCode = this.generateParameterScript();

			// 4. Sende an Backend (Speichere Scripts und UI-Config in der DB)
			const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					script_ui: uiScriptCode,
					script_master: masterScriptCode,
					script_parameter: paramScriptCode,
					ui_config: JSON.stringify(this.uiConfig)
				})
			});

			const result = await response.json();

			if (result.success) {
				// Keep currentObject in sync so loadUIDesign() on the same instance
				// reads the new state and not the stale state from the initial fetch.
				if (this.currentObject) {
					this.currentObject.ui_config = JSON.stringify(this.uiConfig);
				}
				this.updateStatus('Design & UI-Script gespeichert');
			} else {
				throw new Error(result.message || 'Serverfehler beim Speichern');
			}
		} catch (error) {
			console.error('Fehler beim Speichern:', error);
			this.updateStatus('Fehler beim Speichern: ' + error.message);
		}
	}

	updateElementCounter() {
		let maxId = 0;
		if (this.uiConfig.pages) {
			this.uiConfig.pages.forEach(page => {
				if (page.elements) {
					page.elements.forEach(el => {
						if (el.id && el.id.startsWith('element_')) {
							const idNum = parseInt(el.id.split('_')[1]);
							if (!isNaN(idNum) && idNum > maxId) {
								maxId = idNum;
							}
						}
					});
				}
			});
		}
		this.elementCounter = maxId;
		console.log('Element Counter updated to:', this.elementCounter);
	}

	loadUIDesign() {
		if (!this.currentGdlObjectId) {
			this.currentGdlObjectId = localStorage.getItem('currentGdlObjectId');
			if (!this.currentGdlObjectId) {
				return; // Kein Objekt ausgewählt
			}
		}

		try {
			this.lastDesignSource = 'none';
			// 1. Versuch: Aus Datenbank (via this.currentObject geladen in loadParameters)
			let saved = null;
			let source = 'Datenbank';

			if (this.currentObject && this.currentObject.ui_config) {
				saved = this.currentObject.ui_config;
			} else {
				// 2. Versuch: Aus localStorage (Fallback/Backup)
				const storageKey = `uiDesign_${this.currentGdlObjectId}`;
				saved = localStorage.getItem(storageKey);
				source = 'lokalem Speicher';
			}

			if (saved) {
				const loadedConfig = JSON.parse(saved);
				// Merge mit aktueller Konfiguration
				this.uiConfig = {
					...this.uiConfig,
					...loadedConfig,
					currentPage: this.uiConfig.currentPage // Aktuelle Seite beibehalten
				};

				// Stelle sicher, dass pages Array existiert
				if (!this.uiConfig.pages || this.uiConfig.pages.length === 0) {
					this.uiConfig.pages = [{ name: 'Seite 1', elements: [] }];
				}

				this.updateElementCounter(); // Update Counter based on loaded elements
				this.updateConfigInputs(); // Update Inputs mit geladenen Werten
				this.updateUI();
				this.updatePropertiesPanel(); // Properties Panel nach Load aktualisieren
				this.updateStatus(`Design aus ${source} geladen`);
				this.lastDesignSource = source;
				this.updateDebugOverlay({ stage: 'design-loaded' });

				// Wenn Design nur lokal vorhanden ist, einmalig in DB spiegeln → gleiche Darstellung in allen Browsern/Instanzen
				if (
					source === 'lokalem Speicher' &&
					this.currentGdlObjectId &&
					this.currentObject &&
					(!this.currentObject.ui_config || this.currentObject.ui_config === '' || this.currentObject.ui_config === 'null')
				) {
					fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ui_config: saved })
					})
						.then(r => r.json())
						.then(res => {
							if (res && res.success) {
								this.currentObject.ui_config = saved;
								this.updateStatus('Design in DB synchronisiert (aus lokalem Speicher)');
								this.updateDebugOverlay({ syncedToDb: 'yes' });
							} else {
								this.updateDebugOverlay({ syncedToDb: 'no' });
							}
						})
						.catch(() => {
							this.updateDebugOverlay({ syncedToDb: 'error' });
						});
				}
			} else {
				this.updateDebugOverlay({ stage: 'no-design-found' });
			}
		} catch (error) {
			console.error('Fehler beim Laden des Designs:', error);
			this.updateStatus('Fehler beim Laden des Designs');
			this.lastDesignSource = 'error';
			this.updateDebugOverlay({ stage: 'design-error' });
		}
	}

	updateConfigInputs() {
		const uiWidthInput = document.getElementById('uiWidth');
		const uiHeightInput = document.getElementById('uiHeight');
		const pageCountInput = document.getElementById('pageCount');
		const platformSelect = document.getElementById('platformSelect');
		const zoomSlider = document.getElementById('zoomSlider');
		const zoomLabel = document.getElementById('zoomLabel');

		if (uiWidthInput) uiWidthInput.value = this.uiConfig.width;
		if (uiHeightInput) uiHeightInput.value = this.uiConfig.height;
		if (pageCountInput && this.uiConfig.pages) pageCountInput.value = this.uiConfig.pages.length;
		if (platformSelect) platformSelect.value = this.uiConfig.platform;
		if (zoomSlider) zoomSlider.value = this.uiConfig.zoom;
		if (zoomLabel) zoomLabel.textContent = `${this.uiConfig.zoom}%`;
	}

	async generateAndDownloadGDL() {
		if (!this.currentGdlObjectId) return;

		// 1. Speichern (damit DB aktuell ist)
		await this.saveUIDesign();

		this.updateStatus('Bereite Download vor...');

		try {
			// 2. Lade das komplette Objekt inkl. aller Scripts vom Backend
			const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}`);
			const result = await response.json();

			if (!result.success || !result.data) {
				throw new Error('Konnte Objekt-Daten nicht laden');
			}

			const obj = result.data;

			// 3. ZIP erstellen
			const zip = new JSZip();

			// Scripte hinzufügen (Leere Strings falls null)
			// FIXED: Removed duplicate entries - each file should be added only once
			// If DB has content, use it; otherwise generate it on the fly
			zip.file("1-Master.gdl", obj.script_master || this.generateMasterScript() || "");
			zip.file("2-2D.gdl", obj.script_2d || "");
			zip.file("3-3D.gdl", obj.script_3d || "");
			zip.file("4-Properties.gdl", obj.script_properties || "");
			zip.file("5-Interface.gdl", obj.script_ui || this.generateInterfaceScript() || "");
			zip.file("6-Parameter.gdl", obj.script_parameter || this.generateParameterScript() || "");
			zip.file("7-MigrationForward.gdl", obj.script_migration_forward || "");
			zip.file("8-MigrationBackward.gdl", obj.script_migration_backward || "");

			// 4. Download auslösen
			const content = await zip.generateAsync({ type: "blob" });
			const url = URL.createObjectURL(content);

			const a = document.createElement('a');
			a.href = url;
			a.download = `${obj.name.replace('.gsm', '')}_Scripts.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			this.updateStatus('Skripte als ZIP heruntergeladen');

		} catch (error) {
			console.error('Fehler beim ZIP-Download:', error);
			this.updateStatus('Fehler beim Download: ' + error.message);
		}
	}

	// Helper für GDL Header
	generateScriptHeader(name) {
		const spacer = '-'.repeat(70);
		const spacedName = name.split('').join('  ');

		let code = `! ${spacer} !\n`;
		code += `! -------- ${spacedName.padEnd(51, ' ')} ${'-'.repeat(10)} !\n`;
		code += `! ${spacer} !\n\n`;
		return code;
	}

	generateScriptEnd() {
		let code = `! ${'-'.repeat(28)} E N D ${'-'.repeat(35)} !\n`;
		code += `! ${'-'.repeat(28)} E N D ${'-'.repeat(35)} !\n\n`;
		code += `END  ! -- END -- END -- END -- END -- END -- END -- END -- END -- END -- !\n\n`;
		code += `! ${'-'.repeat(28)} E N D ${'-'.repeat(35)} !\n`;
		code += `! ${'-'.repeat(28)} E N D ${'-'.repeat(35)} !\n`;
		return code;
	}

	generateSubroutineWrapper(name, content) {
		const spacer = '-'.repeat(70);
		let code = `! ${spacer} ! \n`;
		code += `! ${spacer} ! \n`;
		code += `"${name}":\n\n`;
		code += content;
		code += `\nRETURN \n\n`;
		code += `! ${spacer} ! \n`;
		code += `! ${spacer} ! \n\n`;
		return code;
	}

	// Helper zur Analyse der ui_code Daten eines Parameters
	getValuesData(param) {
		if (!param.ui_code) return null;
		try {
			const data = JSON.parse(param.ui_code);
			if (data.type === 'VALUES' || data.type === 'VALUES2' || data.type === 'VALUES2_IMAGE') {
				// Parse content lines
				const lines = data.content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
				return { type: data.type, lines: lines };
			}
		} catch (e) {
			return null;
		}
		return null;
	}

	generateMasterScript() {
		let code = this.generateScriptHeader('M a s t e r  -  S c r i p t');

		this.parameters.forEach(param => {
			const valuesData = this.getValuesData(param);
			// Nur VALUES{2} benötigt Arrays im Master Script
			if (valuesData && (valuesData.type === 'VALUES2' || valuesData.type === 'VALUES2_IMAGE')) {
				const baseName = `_${param.gdl_name}`;

				code += `DIM ${baseName}_text[], ${baseName}_pic[], ${baseName}_value[]\n`;
				code += `i = 1\n`;

				// Get image names if VALUES2_IMAGE
				let imageNames = [];
				if (valuesData.type === 'VALUES2_IMAGE') {
					try {
						const uiCode = typeof param.ui_code === 'string' ? JSON.parse(param.ui_code) : param.ui_code;
						imageNames = uiCode.images || [];
					} catch (e) {
						console.error('Error parsing ui_code for image names:', e);
					}
				}

				valuesData.lines.forEach((line, idx) => {
					const cleanLine = line.replace(/"/g, '""');
					const imageName = imageNames[idx] || '';

					code += `${baseName}_text[i] = "${cleanLine}" : ${baseName}_pic[i] = "${imageName}" : ${baseName}_value[i] = i : i = i + 1\n`;
				});
				code += `\n`;
			}
		});

		return code;
	}

	generateParameterScript() {
		let code = this.generateScriptHeader('P a r a m e t e r  -  S c r i p t');

		this.parameters.forEach(param => {
			const valuesData = this.getValuesData(param);
			if (valuesData) {
				if (valuesData.type === 'VALUES') {
					// VALUES "ParamName", 1, 2, 3
					// content contains lines with 1, 2, 3 or Strings "A", "B" etc.
					// VALUES "ParamName", 1, 2, 3
					// content contains lines with 1, 2, 3 or Strings "A", "B" etc.

					// Process lines based on type
					const processedLines = valuesData.lines.map(line => {
						if (param.gdl_type === 'String') {
							// String: Muss in Anführungszeichen.
							// Prüfe ob schon Quotes da sind (Basic Check)
							if (line.startsWith('"') && line.endsWith('"')) {
								return line; // Schon gequoted
							} else if (line.startsWith("'") && line.endsWith("'")) {
								// Convert single to double? GDL supports double.
								return `"${line.slice(1, -1)}"`;
							} else {
								// Wrap in quotes
								return `"${line.replace(/"/g, '""')}"`;
							}
						} else if (['Length', 'Angle', 'RealNum'].includes(param.gdl_type)) {
							// Numeric: Replace comma with dot
							return line.replace(',', '.');
						} else {
							// Integer etc: Leave as is (or minimal cleanup)
							return line;
						}
					});

					const valuesList = processedLines.join(', ');
					code += `VALUES "${param.gdl_name}", ${valuesList}\n`;
				} else if (valuesData.type === 'VALUES2' || valuesData.type === 'VALUES2_IMAGE') {
					// VALUES{2} "ParamName", _param_value, _param_text
					const baseName = `_${param.gdl_name}`;
					code += `VALUES{2} "${param.gdl_name}", ${baseName}_value, ${baseName}_text\n`;
				}
			}
		});

		return code;
	}

	generateInterfaceScript() {
		if (this.currentTemplate && typeof this.currentTemplate.generateScript === 'function') {
			// Helper Functions die vom Template genutzt werden können
			const helperFuncs = {
				generateScriptHeader: this.generateScriptHeader.bind(this),
				generateScriptEnd: this.generateScriptEnd.bind(this),
				generateSubroutineWrapper: this.generateSubroutineWrapper.bind(this),
				getValuesData: this.getValuesData.bind(this)
			};
			return this.currentTemplate.generateScript(this.uiConfig, this.parameters, helperFuncs);
		} else {
			return `! Error: No template selected for script generation\n`;
		}
	}

	updateParameterValueControls() {
		const container = document.getElementById('paramValueContainer');
		const selectControl = document.getElementById('propParamValueSelect');
		const checkboxControl = document.getElementById('propParamValueCheckbox');
		const textControl = document.getElementById('propParamValueText');

		if (!container || !selectControl || !checkboxControl || !textControl) return;

		// Hide all controls initially
		selectControl.style.display = 'none';
		checkboxControl.style.display = 'none';
		textControl.style.display = 'none';

		// Check if we have a selected element with a GDL parameter
		if (!this.selectedElement || !this.selectedElement.gdlParam) {
			container.style.display = 'none';
			return;
		}

		// Find the parameter
		const param = this.parameters.find(p => p.gdl_name === this.selectedElement.gdlParam);
		if (!param) {
			container.style.display = 'none';
			return;
		}

		// Show container
		container.style.display = 'block';

		// Get VALUES data
		const valuesData = this.getValuesData(param);

		// Determine which control to show based on parameter type
		if (param.gdl_type === 'Boolean') {
			// Boolean: Show checkbox
			checkboxControl.style.display = 'inline-block';
			const isChecked = param.default_value_json === '1' || param.default_value_json === 'true' || param.default_value_json === '1.0';
			checkboxControl.checked = isChecked;

		} else if (valuesData && (valuesData.type === 'VALUES' || valuesData.type === 'VALUES2')) {
			// VALUES or VALUES2: Show dropdown
			selectControl.style.display = 'block';

			// Clear and populate options
			selectControl.innerHTML = '';
			valuesData.lines.forEach((line, idx) => {
				const option = document.createElement('option');

				if (valuesData.type === 'VALUES2') {
					// VALUES{2}: Display string, value is index+1
					option.value = idx + 1;
					option.textContent = line;
				} else {
					// VALUES: Display and value are the same
					option.value = line;
					option.textContent = line;
				}

				selectControl.appendChild(option);
			});

			// Set current value
			if (param.default_value_json) {
				selectControl.value = param.default_value_json;
			}

		} else {
			// Other types: Show text input
			textControl.style.display = 'block';
			textControl.value = param.default_value_json || '';
		}
	}
}

// Initialisiere UI Designer wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
	window.uiDesigner = new UIDesigner();

	// Initiale Anpassung der Ruler-Position, wenn CSS geladen ist
	setTimeout(() => {
		if (window.uiDesigner) window.uiDesigner.updateUI();
	}, 100);
});
