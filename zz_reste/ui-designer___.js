// UI Designer JavaScript
// Verwaltet den UI-Designer mit Drag & Drop, Grid-System und Element-Management

class UIDesigner {
	constructor() {
		this.uiConfig = {
			width: 444,
			height: 266,
			pages: [{ name: 'Seite 1', elements: [] }],
			currentPage: 0,
			platform: 'windows',
			gridSize: 1, // Snap-to-Grid Größe
			zoom: 100 // Zoom-Level in Prozent
		};
		
		// UI_STYLE Definitionen
		this.uiStyles = {
			'0,0': { height: 16, font: 'Arial', weight: 'bold', size: 11 },
			'0,1': { height: 16, font: 'Arial', weight: 'black', size: 11 },
			'1,0': { height: 11, font: 'Arial', weight: 'bold', size: 9 },
			'1,1': { height: 11, font: 'Arial', weight: 'black', size: 9 },
			'2,0': { height: 20, font: 'Arial', weight: 'bold', size: 11 },
			'2,1': { height: 20, font: 'Arial', weight: 'bold', size: 11 }
		};
		
		// Editierbare Parameter-Typen für UI_INFIELD
		this.editableTypes = ['LENGTH', 'ANGLE', 'REAL', 'INTEGER', 'STRING'];
		
		this.selectedElement = null;
		this.draggedElement = null;
		this.isDragging = false;
		this.isResizing = false;
		this.resizeHandle = null;
		this.dragOffset = { x: 0, y: 0 };
		this.elementCounter = 0;
		this.parameters = []; // Wird später aus API geladen
		this.currentGdlObjectId = null; // Aktuelles Objekt
		this.saveTimeout = null; // Timeout für Auto-Save
		
		// Default-Werte für Element-Typen
		this.defaultSizes = {
			'UI_INFIELD': { width: 200, height: 20 },
			'UI_OUTFIELD': { width: 200, height: 20 }
		};
		
		// API Base URL
		this.API_BASE_URL = 'http://localhost:8888/gdl-ui-studio/backend/public/api';
		
		this.init();
	}
	
	init() {
		this.setupEventListeners();
		this.loadParameters();
		this.loadUIDesign(); // Lade gespeichertes Design
		this.updateUI();
	}
	
	setupEventListeners() {
		// UI-Konfiguration
		document.getElementById('applyConfigBtn')?.addEventListener('click', () => this.applyConfig());
		document.getElementById('addPageBtn')?.addEventListener('click', () => this.addPage());
		document.getElementById('pageSelect')?.addEventListener('change', (e) => this.switchPage(parseInt(e.target.value)));
		document.getElementById('platformSelect')?.addEventListener('change', (e) => {
			this.uiConfig.platform = e.target.value;
			this.updateUI();
		});
		
		// Header-Buttons
		document.getElementById('saveBtn')?.addEventListener('click', () => this.saveUIDesign());
		document.getElementById('loadBtn')?.addEventListener('click', () => this.loadUIDesign());
		document.getElementById('generateGdlBtn')?.addEventListener('click', () => this.generateAndDownloadGDL());
		document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadGDLCode());
		
		// Zoom Control
		document.getElementById('zoomSelect')?.addEventListener('change', (e) => {
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
						// Prüfe ob auf Resize-Handle geklickt wurde
						if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
							const elementDiv = e.target.closest('.ui-element');
							if (elementDiv) {
								const elementId = elementDiv.dataset.elementId;
								const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
									el => el.id === elementId
								);
								if (element) {
									e.preventDefault();
									e.stopPropagation();
									this.handleResizeStart(e, element);
								}
							}
							return;
						}
			
						// Prüfe ob auf Element geklickt wurde (aber nicht auf Input/Text/Corner-Dots)
						let elementDiv = e.target.closest('.ui-element');
						if (!elementDiv) {
							if (e.target.parentElement && e.target.parentElement.classList.contains('ui-element')) {
								elementDiv = e.target.parentElement;
							} else {
								return;
							}
						}
			
						const elementId = elementDiv.dataset.elementId;
						if (!elementId) return;
			
						const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
							el => el.id === elementId
						);
						if (!element) return;
			
						// Verhindere Drag wenn auf Input oder Text geklickt wird
						if (e.target.tagName === 'INPUT' || 
							e.target.closest('.ui-outfield-text') || 
							e.target.closest('.corner-dot')) {
							return;
						}
			
						e.preventDefault();
						e.stopPropagation();
						this.handleElementMouseDown(e, element);
					}, true);
				}
			
				// Globale Mouse-Events für Drag & Resize
				document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
				document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
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
			const value = parseInt(e.target.value) || 1;
			this.updateElementProperty('width', value);
		});
		document.getElementById('propHeight')?.addEventListener('input', (e) => {
			const value = parseInt(e.target.value) || 1;
			this.updateElementProperty('height', value);
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
		document.getElementById('deleteElementBtn')?.addEventListener('click', () => this.deleteSelectedElement());
		
		// Tab-Klicks für Seitenwechsel
		document.getElementById('tabBar')?.addEventListener('click', (e) => {
			if (e.target.classList.contains('tab-button')) {
				const pageIndex = parseInt(e.target.dataset.page);
				this.switchPage(pageIndex);
			}
		});
	}
	
	// ========== NEUE METHODE: Element Drag Start ==========
	handleElementMouseDown(e, element) {
		this.selectElement(element);
		this.isDragging = true;
		this.draggedElement = element;
	
		const elementDiv = document.querySelector(`[data-element-id="${element.id}"]`);
		if (!elementDiv) return;
	
		const rect = elementDiv.getBoundingClientRect();
		const pageContentRect = document.getElementById('pageContent').getBoundingClientRect();
		
		const zoomFactor = this.uiConfig.zoom / 100;
		
		this.dragOffset = {
			x: (e.clientX - rect.left) / zoomFactor,
			y: (e.clientY - rect.top) / zoomFactor
		};
	}
	
	// ========== NEUE METHODE: Resize Start ==========
	handleResizeStart(e, element) {
		this.selectElement(element);
		this.isResizing = true;
		this.draggedElement = element;
		
		// Ermittle welcher Handle geklickt wurde
		const handle = e.target.closest('.resize-handle');
		if (handle) {
			if (handle.classList.contains('resize-handle-nw')) this.resizeHandle = 'nw';
			else if (handle.classList.contains('resize-handle-ne')) this.resizeHandle = 'ne';
			else if (handle.classList.contains('resize-handle-sw')) this.resizeHandle = 'sw';
			else if (handle.classList.contains('resize-handle-se')) this.resizeHandle = 'se';
			else if (handle.classList.contains('resize-handle-n')) this.resizeHandle = 'n';
			else if (handle.classList.contains('resize-handle-s')) this.resizeHandle = 's';
			else if (handle.classList.contains('resize-handle-w')) this.resizeHandle = 'w';
			else if (handle.classList.contains('resize-handle-e')) this.resizeHandle = 'e';
		}
	
		const rect = document.querySelector(`[data-element-id="${element.id}"]`).getBoundingClientRect();
		const zoomFactor = this.uiConfig.zoom / 100;
	
		this.dragOffset = {
			x: e.clientX / zoomFactor,
			y: e.clientY / zoomFactor,
			startX: element.x,
			startY: element.y,
			startWidth: element.width,
			startHeight: element.height
		};
	}
	
	// ========== NEUE METHODE: Mouse Move ==========
	handleMouseMove(e) {
		if (this.isDragging && this.draggedElement) {
			const pageContentRect = document.getElementById('pageContent').getBoundingClientRect();
			const zoomFactor = this.uiConfig.zoom / 100;
	
			let newX = (e.clientX - pageContentRect.left) / zoomFactor - this.dragOffset.x;
			let newY = (e.clientY - pageContentRect.top) / zoomFactor - this.dragOffset.y;
	
			// Grid-Snapping
			newX = Math.round(newX / this.uiConfig.gridSize) * this.uiConfig.gridSize;
			newY = Math.round(newY / this.uiConfig.gridSize) * this.uiConfig.gridSize;
	
			// Begrenzung auf Canvas
			newX = Math.max(0, Math.min(newX, this.uiConfig.width - this.draggedElement.width));
			newY = Math.max(0, Math.min(newY, this.uiConfig.height - this.draggedElement.height));
	
			this.draggedElement.x = newX;
			this.draggedElement.y = newY;
	
			this.updateElementDisplay();
			this.updatePropertiesPanel();
		}
	
		if (this.isResizing && this.draggedElement) {
			const zoomFactor = this.uiConfig.zoom / 100;
			const deltaX = (e.clientX / zoomFactor) - this.dragOffset.x;
			const deltaY = (e.clientY / zoomFactor) - this.dragOffset.y;
	
			let newX = this.dragOffset.startX;
			let newY = this.dragOffset.startY;
			let newWidth = this.dragOffset.startWidth;
			let newHeight = this.dragOffset.startHeight;
	
			// Resize basierend auf Handle
			switch (this.resizeHandle) {
				case 'se':
					newWidth = this.dragOffset.startWidth + deltaX;
					newHeight = this.dragOffset.startHeight + deltaY;
					break;
				case 'ne':
					newWidth = this.dragOffset.startWidth + deltaX;
					newHeight = this.dragOffset.startHeight - deltaY;
					newY = this.dragOffset.startY + deltaY;
					break;
				case 'sw':
					newWidth = this.dragOffset.startWidth - deltaX;
					newHeight = this.dragOffset.startHeight + deltaY;
					newX = this.dragOffset.startX + deltaX;
					break;
				case 'nw':
					newWidth = this.dragOffset.startWidth - deltaX;
					newHeight = this.dragOffset.startHeight - deltaY;
					newX = this.dragOffset.startX + deltaX;
					newY = this.dragOffset.startY + deltaY;
					break;
				case 'e':
					newWidth = this.dragOffset.startWidth + deltaX;
					break;
				case 'w':
					newWidth = this.dragOffset.startWidth - deltaX;
					newX = this.dragOffset.startX + deltaX;
					break;
				case 's':
					newHeight = this.dragOffset.startHeight + deltaY;
					break;
				case 'n':
					newHeight = this.dragOffset.startHeight - deltaY;
					newY = this.dragOffset.startY + deltaY;
					break;
			}
	
			// Min-Größen
			newWidth = Math.max(10, newWidth);
			newHeight = Math.max(10, newHeight);
	
			// Grid-Snapping
			newX = Math.round(newX / this.uiConfig.gridSize) * this.uiConfig.gridSize;
			newY = Math.round(newY / this.uiConfig.gridSize) * this.uiConfig.gridSize;
			newWidth = Math.round(newWidth / this.uiConfig.gridSize) * this.uiConfig.gridSize;
			newHeight = Math.round(newHeight / this.uiConfig.gridSize) * this.uiConfig.gridSize;
	
			// Begrenzung auf Canvas
			newX = Math.max(0, Math.min(newX, this.uiConfig.width - newWidth));
			newY = Math.max(0, Math.min(newY, this.uiConfig.height - newHeight));
	
			this.draggedElement.x = newX;
			this.draggedElement.y = newY;
			this.draggedElement.width = newWidth;
			this.draggedElement.height = newHeight;
	
			this.updateElementDisplay();
			this.updatePropertiesPanel();
		}
	}
	
	// ========== NEUE METHODE: Mouse Up ==========
	handleMouseUp(e) {
		if (this.isDragging || this.isResizing) {
			this.isDragging = false;
			this.isResizing = false;
			this.draggedElement = null;
			this.resizeHandle = null;
			this.saveUIDesign(); // Auto-Save nach Drag/Resize
		}
	}


	async loadParameters() {
		// Lade aktuelles Objekt aus localStorage
		this.currentGdlObjectId = localStorage.getItem('currentGdlObjectId');
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
				const obj = objResult.data;
				this.updateProjectName(obj.name || 'Unbenannt');
			}
		} catch (error) {
			console.error('Fehler beim Laden der Objekt-Info:', error);
		}
		
		// Lade Parameter aus API
		try {
			const response = await fetch(`${this.API_BASE_URL}/objects/${this.currentGdlObjectId}/parameters`);
			const result = await response.json();
			if (result.success && result.data) {
				this.parameters = result.data;
				this.updateParameterSelect();
				this.updateStatus(`Parameter geladen: ${this.parameters.length} Parameter verfügbar`);
			}
		} catch (error) {
			console.error('Fehler beim Laden der Parameter:', error);
			this.updateStatus('Fehler beim Laden der Parameter');
		}
	}
	
	updateProjectName(name) {
		const projectNameElement = document.querySelector('.project-name');
		if (projectNameElement) {
			projectNameElement.textContent = `Objekt: ${name}`;
		}
	}
	
	updateParameterSelect() {
		const select = document.getElementById('propGdlParam');
		if (!select) return;
	
		// Speichere aktuellen Wert
		const currentValue = select.value;
	
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
	
		// Stelle vorherigen Wert wieder her falls vorhanden
		if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
			select.value = currentValue;
		}
	}
	
	applyConfig() {
		const width = parseInt(document.getElementById('uiWidth').value);
		const height = parseInt(document.getElementById('uiHeight').value);
		const pageCount = parseInt(document.getElementById('pageCount').value);
		
		if (width < 100 || width > 2000 || height < 100 || height > 2000) {
			alert('Breite und Höhe müssen zwischen 100 und 2000 Pixeln liegen.');
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
		this.updateStatus('Konfiguration übernommen');
		this.saveUIDesign(); // Speichere nach Konfiguration
	}
	
	addPage() {
		const pageNumber = this.uiConfig.pages.length + 1;
		this.uiConfig.pages.push({
			name: `Seite ${pageNumber}`,
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
		const dialogFrame = document.getElementById('uiDialogFrame');
		if (dialogFrame) {
			dialogFrame.style.width = `${this.uiConfig.width}px`;
			dialogFrame.style.height = `${this.uiConfig.height}px`;
		}
		
		// Update Tabs
		this.updateTabs();
		
		// Update Seitenauswahl
		this.updatePageSelect();
		
		// Render aktuelle Seite
		this.renderCurrentPage();
		
		// Update Properties Panel
		this.updatePropertiesPanel();
		
		// Update Grid Info
		document.getElementById('gridSize').textContent = `${this.uiConfig.gridSize}px`;
		
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
		canvasContainer.style.height = `${this.uiConfig.height * zoomFactor}px`;
		
		// Maßstabsleiste bei Zoom >= 200%
		this.updateRulers();
		
		// Update Zoom Select
		const zoomSelect = document.getElementById('zoomSelect');
		if (zoomSelect) {
			zoomSelect.value = this.uiConfig.zoom;
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
			
			// Horizontaler Ruler (oben)
			if (!rulerHorizontal) {
				rulerHorizontal = document.createElement('div');
				rulerHorizontal.id = 'rulerHorizontal';
				rulerHorizontal.className = 'ruler ruler-horizontal';
				canvasWrapper.insertBefore(rulerHorizontal, canvasWrapper.firstChild);
			}
			rulerHorizontal.style.display = 'block';
			rulerHorizontal.style.width = `${this.uiConfig.width * zoomFactor}px`;
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
			button.textContent = page.name;
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
			option.textContent = page.name;
			if (index === this.uiConfig.currentPage) {
				option.selected = true;
			}
			select.appendChild(option);
		});
	}
	
	renderCurrentPage() {
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;
		
		pageContent.innerHTML = '';
		
		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (!currentPage) return;
		
		currentPage.elements.forEach(element => {
			const el = this.createElementElement(element);
			pageContent.appendChild(el);
		});
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
			const displayValue = param ? this.getParameterDisplayValue(param) : (element.paramName || '');
			
			const input = document.createElement('input');
			input.type = 'text';
			input.value = displayValue;
			input.placeholder = 'Parameter-Name';
			input.readOnly = true;
			input.style.pointerEvents = 'none';
			
			// Prüfe ob editierbar oder Systemauswahl
			const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
			
			// UI_STYLE anwenden
			if (element.uiStyle && this.uiStyles[element.uiStyle]) {
				const style = this.uiStyles[element.uiStyle];
				input.style.fontFamily = style.font;
				input.style.fontWeight = style.weight;
				input.style.fontSize = `${style.size}px`;
				// Höhe nur bei editierbaren Feldern aus UI_STYLE setzen
				if (!isSystemField) {
					if (element.height !== style.height) {
						element.height = style.height;
					}
					div.style.height = `${style.height}px`;
				}
			}
			
			if (isSystemField) {
				div.classList.add('system-field');
				input.style.backgroundColor = '#e0e0e0';
				input.style.cursor = 'default';
			}
			
			div.appendChild(input);
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
			
			// Ausgegrauter Text
			if (element.textGrayed) {
				textDiv.style.color = '#999';
				textDiv.style.opacity = '0.6';
			}
			
			div.appendChild(textDiv);
			
			// 4 Begrenzungspunkte als Dots hinzufügen
			this.addCornerDots(div);
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
		// Für UI_INFIELD: Höhe nur änderbar wenn Systemfeld (nicht editierbar)
		let isHeightFixed = false;
		if (element.type === 'UI_INFIELD') {
			const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
			const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
			// Höhe ist fixiert wenn: UI_STYLE vorhanden UND es ist ein editierbares Feld (kein Systemfeld)
			isHeightFixed = element.uiStyle && !isSystemField;
		}
		
		const handles = [
			{ class: 'nw', cursor: 'nwse-resize', data: 'nw', hideIfHeightFixed: true }, // top-left
			{ class: 'ne', cursor: 'nesw-resize', data: 'ne', hideIfHeightFixed: true }, // top-right
			{ class: 'sw', cursor: 'nesw-resize', data: 'sw', hideIfHeightFixed: true }, // bottom-left
			{ class: 'se', cursor: 'nwse-resize', data: 'se', hideIfHeightFixed: true }, // bottom-right
			{ class: 'n', cursor: 'ns-resize', data: 'n', hideIfHeightFixed: true }, // top
			{ class: 's', cursor: 'ns-resize', data: 's', hideIfHeightFixed: true }, // bottom
			{ class: 'w', cursor: 'ew-resize', data: 'w', hideIfHeightFixed: false }, // left
			{ class: 'e', cursor: 'ew-resize', data: 'e', hideIfHeightFixed: false }  // right
		];
		
		handles.forEach(handle => {
			if (isHeightFixed && handle.hideIfHeightFixed) {
				return; // Überspringe Höhe-Handles für UI_INFIELD mit UI_STYLE (nur bei editierbaren Feldern)
			}
			
			const handleDiv = document.createElement('div');
			handleDiv.className = `resize-handle resize-handle-${handle.class}`;
			handleDiv.dataset.handle = handle.data;
			handleDiv.style.cursor = handle.cursor;
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
		// Zeige den Parameter-Wert statt Namen
		if (param.default_value_json) {
			try {
				const defaultValue = JSON.parse(param.default_value_json);
				if (defaultValue === null || defaultValue === undefined) {
					return param.gdl_name; // Fallback wenn kein Wert
				}
				if (typeof defaultValue === 'object') {
					// Für Arrays oder Objekte
					if (Array.isArray(defaultValue)) {
						return defaultValue.join(', ');
					}
					return JSON.stringify(defaultValue);
				}
				return String(defaultValue);
			} catch (e) {
				// Wenn kein JSON, versuche als String
				if (param.default_value_json.trim()) {
					return param.default_value_json;
				}
			}
		}
		// Fallback: Zeige Parameter-Namen wenn kein Wert vorhanden
		return param.gdl_name;
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
	}
	
	handleToolboxDragStart(e) {
		const uiType = e.target.closest('.toolbox-item').dataset.uiType;
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
		if (!uiType) return;
		
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;
		
		const rect = pageContent.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		
		// Snap to Grid
		const snappedX = this.snapToGrid(x);
		const snappedY = this.snapToGrid(y);
		
		this.createElement(uiType, snappedX, snappedY);
	}
	
	snapToGrid(value) {
		return Math.round(value / this.uiConfig.gridSize) * this.uiConfig.gridSize;
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
		
		// UI_OUTFIELD spezifische Defaults
		if (type === 'UI_OUTFIELD') {
			element.outfieldText = '';
			element.textAlign = 0; // Linksbündig
			element.textGrayed = false;
			element.uiStyle = '2,0'; // Default UI_STYLE auch für OUTfield
		}
		
		const currentPage = this.uiConfig.pages[this.uiConfig.currentPage];
		if (currentPage) {
			currentPage.elements.push(element);
			this.renderCurrentPage();
			this.selectElement(element);
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
		
		const rect = elementDiv.getBoundingClientRect();
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) {
			this.isDragging = false;
			return;
		}
		
		const pageRect = pageContent.getBoundingClientRect();
		
		// Korrekte Offset-Berechnung: Mausposition relativ zum Element
		// Berücksichtige Zoom
		const zoomFactor = this.uiConfig.zoom / 100;
		this.dragOffset = {
			x: (e.clientX - rect.left) / zoomFactor,
			y: (e.clientY - rect.top) / zoomFactor
		};
		
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
		
		const pageContent = document.getElementById('pageContent');
		if (!pageContent) return;
		
		const rect = pageContent.getBoundingClientRect();
		const zoomFactor = this.uiConfig.zoom / 100;
		
		// Berechne Position in Canvas-Koordinaten (berücksichtige Zoom)
		let x = (e.clientX - rect.left) / zoomFactor - this.dragOffset.x;
		let y = (e.clientY - rect.top) / zoomFactor - this.dragOffset.y;
		
		// Snap to Grid und Snap to Endpoints
		const snapped = this.snapToGridAndEndpoints(x, y, this.selectedElement);
		x = snapped.x;
		y = snapped.y;
		
		// Begrenze auf Canvas
		const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
			el => el.id === this.selectedElement.id
		);
		if (!element) return;
		
		x = Math.max(0, Math.min(x, this.uiConfig.width - element.width));
		y = Math.max(0, Math.min(y, this.uiConfig.height - element.height));
		
		this.updateElementProperty('x', x, false);
		this.updateElementProperty('y', y, false);
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
			const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
			// Höhe ist fixiert nur wenn es ein editierbares Feld ist (kein Systemfeld)
			isHeightFixed = !isSystemField;
		}
		
		switch (this.resizeHandle) {
			case 'se': // Süd-Ost (bottom-right)
				newWidth = Math.max(1, this.elementStartSize.width + canvasDeltaX);
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'sw': // Süd-West (bottom-left)
				newWidth = Math.max(1, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'ne': // Nord-Ost (top-right)
				newWidth = Math.max(1, this.elementStartSize.width + canvasDeltaX);
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
			case 'nw': // Nord-West (top-left)
				newWidth = Math.max(1, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
			case 'e': // Ost (right)
				newWidth = Math.max(1, this.elementStartSize.width + canvasDeltaX);
				break;
			case 'w': // West (left)
				newWidth = Math.max(1, this.elementStartSize.width - canvasDeltaX);
				newX = this.elementStartPos.x + canvasDeltaX;
				break;
			case 's': // Süd (bottom)
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height + canvasDeltaY);
				}
				break;
			case 'n': // Nord (top)
				if (!isHeightFixed) {
					newHeight = Math.max(1, this.elementStartSize.height - canvasDeltaY);
					newY = this.elementStartPos.y + canvasDeltaY;
				}
				break;
		}
		
		// Wenn Höhe fixiert, verwende UI_STYLE Höhe
		if (isHeightFixed) {
			newHeight = this.uiStyles[element.uiStyle].height;
		}
		
		// Snap to Grid
		newWidth = this.snapToGrid(newWidth);
		newHeight = this.snapToGrid(newHeight);
		newX = this.snapToGrid(newX);
		newY = this.snapToGrid(newY);
		
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
			const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
			// Nur bei editierbaren Feldern die Höhe fixieren
			if (!isSystemField) {
				newHeight = this.uiStyles[element.uiStyle].height;
			}
		}
		
		this.updateElementProperty('width', newWidth, false);
		this.updateElementProperty('height', newHeight, false);
		this.updateElementProperty('x', newX, false);
		this.updateElementProperty('y', newY, false);
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
				element.width = Math.max(1, value);
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
				// Für UI_INFIELD: Höhe wird durch UI_STYLE bestimmt (nur bei editierbaren Feldern)
				if (element.type === 'UI_INFIELD') {
					const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
					const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
					
					// Nur bei editierbaren Feldern die Höhe aus UI_STYLE setzen
					if (!isSystemField && element.uiStyle && this.uiStyles[element.uiStyle]) {
						element.height = this.uiStyles[element.uiStyle].height;
					} else if (isSystemField) {
						// Systemfelder können Höhe ändern
						element.height = Math.max(1, value);
						element.height = this.snapToGrid(element.height);
					} else {
						element.height = 20; // Fallback
					}
					// Update auch das Input-Feld
					const heightInput = document.getElementById('propHeight');
					if (heightInput) {
						heightInput.value = element.height;
					}
					if (!render) {
						const elementDiv = document.querySelector(`[data-element-id="${element.id}"]`);
						if (elementDiv) {
							elementDiv.style.height = `${element.height}px`;
						}
					}
					break;
				}
				element.height = Math.max(1, value);
				element.height = this.snapToGrid(element.height);
				// Stelle sicher, dass Element nicht außerhalb des Canvas ist
				if (element.y + element.height > this.uiConfig.height) {
					element.y = this.uiConfig.height - element.height;
				}
				// Speichere als Default für diesen Typ (nur wenn nicht UI_INFIELD mit UI_STYLE)
				if (element.type !== 'UI_INFIELD' || !element.uiStyle) {
					this.defaultSizes[element.type] = {
						...this.defaultSizes[element.type],
						height: element.height
					};
				}
				break;
			case 'paramName':
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
		const noSelection = document.querySelector('.no-selection');
		const elementProperties = document.getElementById('elementProperties');
		const infieldProps = document.getElementById('infieldProps');
		const outfieldProps = document.getElementById('outfieldProps');
		
		if (!this.selectedElement) {
			if (noSelection) noSelection.style.display = 'block';
			if (elementProperties) elementProperties.classList.add('hidden');
			return;
		}
		
		if (noSelection) noSelection.style.display = 'none';
		if (elementProperties) elementProperties.classList.remove('hidden');
		
		// Update Property Values
		const element = this.uiConfig.pages[this.uiConfig.currentPage]?.elements.find(
			el => el.id === this.selectedElement.id
		);
		if (!element) return;
		
		document.getElementById('propType').textContent = element.type;
		document.getElementById('propPosX').value = element.x;
		document.getElementById('propPosY').value = element.y;
		document.getElementById('propWidth').value = element.width;
		document.getElementById('propHeight').value = element.height;
		
		// UI_INFIELD spezifisch
		if (element.type === 'UI_INFIELD') {
			if (infieldProps) infieldProps.style.display = 'block';
			if (outfieldProps) outfieldProps.classList.add('hidden');
			
			document.getElementById('propParamName').value = element.paramName || '';
			
			// UI_STYLE (für beide Typen sichtbar)
			const uiStyleProps = document.getElementById('uiStyleProps');
			const uiStyleSelect = document.getElementById('propUiStyle');
			if (uiStyleProps) uiStyleProps.style.display = 'block';
			if (uiStyleSelect) {
				uiStyleSelect.value = element.uiStyle || '2,0';
			}
			
			// Verstecke OUTfield Properties bei INfield
			const outfieldProps = document.getElementById('outfieldProps');
			if (outfieldProps) {
				outfieldProps.classList.add('hidden');
				outfieldProps.style.display = 'none';
			}
			
			// Höhe deaktivieren (wird durch UI_STYLE bestimmt) - nur bei editierbaren Feldern
			const heightInput = document.getElementById('propHeight');
			if (heightInput) {
				const param = element.gdlParam ? this.parameters.find(p => p.gdl_name === element.gdlParam) : null;
				const isSystemField = param && !this.editableTypes.includes(param.gdl_type);
				
				if (!isSystemField && element.uiStyle && this.uiStyles[element.uiStyle]) {
					heightInput.disabled = true;
					heightInput.value = this.uiStyles[element.uiStyle].height;
					heightInput.title = 'Höhe wird durch UI_STYLE bestimmt';
				} else {
					heightInput.disabled = false;
					heightInput.value = element.height;
					heightInput.title = '';
				}
			}
		}
		
		// UI_OUTFIELD spezifisch
		if (element.type === 'UI_OUTFIELD') {
			if (infieldProps) infieldProps.style.display = 'none';
			if (outfieldProps) outfieldProps.classList.remove('hidden');
			
			document.getElementById('propOutfieldText').value = element.outfieldText || '';
			document.getElementById('propTextAlign').value = element.textAlign || 0;
			document.getElementById('propTextGrayed').checked = element.textGrayed || false;
			
			// Höhe aktivieren
			const heightInput = document.getElementById('propHeight');
			if (heightInput) {
				heightInput.disabled = false;
				heightInput.title = '';
			}
		}
		
		// GDL Parameter
		const gdlParamSelect = document.getElementById('propGdlParam');
		if (gdlParamSelect) {
			gdlParamSelect.value = element.gdlParam || '';
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
			// Speichere in localStorage als Backup
			const storageKey = `uiDesign_${this.currentGdlObjectId}`;
			localStorage.setItem(storageKey, JSON.stringify(this.uiConfig));
			
			// Versuche auch im Backend zu speichern (wenn API vorhanden)
			// TODO: Backend API für UI-Designs implementieren
			// const response = await fetch(`${this.API_BASE_URL}/gdl-objects/${this.currentGdlObjectId}/ui-design`, {
			// 	method: 'PUT',
			// 	headers: { 'Content-Type': 'application/json' },
			// 	body: JSON.stringify(this.uiConfig)
			// });
			
			this.updateStatus('Design gespeichert');
		} catch (error) {
			console.error('Fehler beim Speichern:', error);
			this.updateStatus('Fehler beim Speichern');
		}
	}
	
	loadUIDesign() {
		if (!this.currentGdlObjectId) {
			this.currentGdlObjectId = localStorage.getItem('currentGdlObjectId');
			if (!this.currentGdlObjectId) {
				return; // Kein Objekt ausgewählt
			}
		}
		
		try {
			// Lade aus localStorage
			const storageKey = `uiDesign_${this.currentGdlObjectId}`;
			const saved = localStorage.getItem(storageKey);
			
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
				
				this.updateUI();
				this.updateStatus('Design geladen');
			}
		} catch (error) {
			console.error('Fehler beim Laden:', error);
			this.updateStatus('Fehler beim Laden');
		}
	}
	
	generateAndDownloadGDL() {
		const gdlCode = this.generateGDLCode();
		if (!gdlCode) {
			this.updateStatus('Kein GDL-Code zu generieren');
			return;
		}
		
		// Speichere vor dem Download
		this.saveUIDesign();
		
		// Download als .gdl Datei
		const blob = new Blob([gdlCode], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'ui_design.gdl';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		
		this.updateStatus('GDL-Code generiert und heruntergeladen');
	}
	
	downloadGDLCode() {
		this.generateAndDownloadGDL();
	}
	
	// Export für GDL-Syntax
	generateGDLCode() {
		let code = '';
		let currentUiStyle = null;
		
		this.uiConfig.pages.forEach((page, pageIndex) => {
			// Seiten-Trenner
			if (pageIndex > 0) {
				code += `\n! Seite ${pageIndex + 1}\n`;
			}
			
			page.elements.forEach(element => {
				// UI_STYLE setzen wenn nötig (für beide Typen: UI_INFIELD und UI_OUTFIELD)
				if (element.uiStyle) {
					const [style1, style2] = element.uiStyle.split(',');
					const styleKey = `${style1},${style2}`;
					if (currentUiStyle !== styleKey) {
						code += `UI_STYLE ${style1}, ${style2}\n`;
						currentUiStyle = styleKey;
					}
				}
				
				if (element.type === 'UI_INFIELD') {
					// Syntax: UI_INFIELD "A", pos_x, pos_y, länge, höhe
					// Länge = Länge - 2 (laut UI_STYLE Definition)
					const paramName = element.paramName || 'A';
					const adjustedWidth = Math.max(1, element.width - 2);
					code += `UI_INFIELD "${paramName}", ${element.x}, ${element.y}, ${adjustedWidth}, ${element.height}\n`;
				}
				
				if (element.type === 'UI_OUTFIELD') {
					// Syntax: UI_OUTFIELD "Text", x_pos, y_pos, länge, höhe, flag
					// flag = j1 + 2*j2 + 4*j3
					const text = element.outfieldText || '';
					let flag = 0;
					
					// j1, j2 für Text-Ausrichtung
					if (element.textAlign === 1) {
						flag += 1; // Rechtsbündig
					} else if (element.textAlign === 2) {
						flag += 2; // Zentriert
					}
					// j3 für ausgegrauten Text
					if (element.textGrayed) {
						flag += 4;
					}
					
					code += `UI_OUTFIELD "${text}", ${element.x}, ${element.y}, ${element.width}, ${element.height}, ${flag}\n`;
				}
			});
		});
		return code;
	}
}

// Initialisiere UI Designer wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
	window.uiDesigner = new UIDesigner();
});
