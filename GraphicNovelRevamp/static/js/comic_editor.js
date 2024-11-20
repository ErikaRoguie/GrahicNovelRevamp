class ComicEditor {
    constructor() {
        console.log('Starting ComicEditor initialization...');
        // Initialize core properties
        this.canvas = null;
        this.panels = [];
        this.currentPanel = 0;
        this.zIndexCounter = 1000;
        this.isProcessing = false;
        this.backgrounds = new Set();
        this.previewImage = null;
        
        // Initialize state management
        this.state = {
            currentBackground: null,
            isUploading: false,
            hasUnsavedChanges: false
        };
        
        // Initialize background categories
        this.backgroundCategories = {
            'Featured': [],
            'City': [],
            'Indoor': [],
            'Nature': [],
            'Fantasy': []
        };
        
        // Initialize undo/redo stacks
        this.undoStack = [];
        this.redoStack = [];
        
        // Initialize auto-save properties
        this.autoSaveInterval = null;
        this.lastSavedState = null;
        this.AUTO_SAVE_INTERVAL = 120000; // 2 minutes
        
        // Create loading indicator before any async operations
        this.loadingIndicator = this.createLoadingIndicator();
        
        // Initialize text analyzer
        this.textAnalyzer = null;
        
        // Initialize editor after DOM is fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEditor().catch(error => {
                console.error('Failed to initialize editor:', error);
                this.showError('Failed to initialize editor. Please refresh the page.');
            }));
        } else {
            this.initializeEditor().catch(error => {
                console.error('Failed to initialize editor:', error);
                this.showError('Failed to initialize editor. Please refresh the page.');
            });
        }
        
        // Setup auto-save when constructed
        this.setupAutoSave();
    }

    createLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'loading-indicator';
        indicator.innerHTML = `
            <div class="spinner-border text-marvel" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">Processing...</div>
        `;
        indicator.style.display = 'none';
        document.querySelector('.comic-container').appendChild(indicator);
        return indicator;
    }

    async initializeEditor() {
        console.log('Starting editor initialization...');
        try {
            // Check Fabric.js availability
            if (typeof fabric === 'undefined') {
                throw new Error('Fabric.js library not loaded. Please refresh the page.');
            }

            // Get and validate canvas element
            const canvasElement = document.getElementById('comic-canvas');
            if (!canvasElement) {
                throw new Error('Canvas element not found in the DOM');
            }

            console.log('Initializing Fabric.js canvas with enhanced settings...');
            this.canvas = new fabric.Canvas('comic-canvas', {
                preserveObjectStacking: true,
                selection: true,
                width: 800,
                height: 600,
                renderOnAddRemove: true,
                stateful: true
            });

            // Validate canvas initialization
            if (!this.canvas || !this.canvas.getContext()) {
                throw new Error('Canvas context initialization failed');
            }

            // Initialize components
            this.textAnalyzer = new TextAnalyzer();
            
            // Set up canvas event handlers
            this.canvas.on('object:added', () => {
                console.log('Object added to canvas');
                this.saveState();
            });

            this.canvas.on('object:modified', () => {
                console.log('Object modified on canvas');
                this.saveState();
            });

            // Initialize the editor components
            await this.initialize();
            
            console.log('Editor initialization complete');
        } catch (error) {
            console.error('Error in initializeEditor:', error);
            this.showError(`Failed to initialize comic editor: ${error.message}`);
            throw error;
        }
    }

    initialize() {
        this.canvas.setDimensions({
            width: 800,
            height: 600
        });
        this.setupEventListeners();
        this.loadBackgrounds();
        this.setupUndoRedo();
        this.setupAutoSave(); // Set up auto-save functionality
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger mt-2';
        errorDiv.textContent = message;
        document.querySelector('.comic-container').appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    setupEventListeners() {
        const textInput = document.getElementById('text-input');
        const textFileInput = document.getElementById('text-file');
        const videoFileInput = document.getElementById('video-file');
        const storyUrlInput = document.getElementById('story-url');
        const importStoryButton = document.getElementById('import-story');
        let debounceTimeout;

        // Set up layout buttons
        document.querySelectorAll('.layout-btn').forEach(button => {
            button.addEventListener('click', () => {
                const layout = button.dataset.layout;
                new PanelLayout().applyLayout(layout, this.canvas);
            });
        });

        // Set up export button
        document.getElementById('export-image').addEventListener('click', () => {
            const dataURL = this.canvas.toDataURL();
            const link = document.createElement('a');
            link.download = 'comic-export.png';
            link.href = dataURL;
            link.click();
        });

        textInput.addEventListener('input', (e) => {
            console.log('Text input event triggered');
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                if (!this.isProcessing) {
                    this.updatePanelText(e.target.value);
                }
            }, 800);
        });

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
        });

        document.getElementById('add-panel').addEventListener('click', () => {
            if (!this.isProcessing) {
                console.log('Add panel clicked');
                this.saveState();
                this.addNewPanel();
            }
        });

        document.getElementById('save-comic').addEventListener('click', () => {
            if (!this.isProcessing) {
                console.log('Save comic clicked');
                this.saveComic();
            }
        });

        this.canvas.on('object:modified', () => {
            if (!this.isProcessing) {
                this.saveState();
                this.canvas.renderAll();
            }
        });

        textFileInput.addEventListener('change', async (e) => {
            if (!this.isProcessing && e.target.files.length > 0) {
                await this.handleTextFileUpload(e.target.files[0]);
            }
        });

        videoFileInput.addEventListener('change', async (e) => {
            if (!this.isProcessing && e.target.files.length > 0) {
                await this.handleVideoFileUpload(e.target.files[0]);
            }
        });

        importStoryButton.addEventListener('click', async () => {
            const url = storyUrlInput.value.trim();
            if (!this.isProcessing && url) {
                await this.handleUrlImport(url);
            }
        });

        storyUrlInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const url = storyUrlInput.value.trim();
                if (!this.isProcessing && url) {
                    await this.handleUrlImport(url);
                }
            }
        });
    }

    addNewPanel() {
        const panel = new fabric.Rect({
            left: 10 + (this.panels.length * 20),
            top: 10 + (this.panels.length * 20),
            width: 200,
            height: 200,
            fill: 'white',
            stroke: '#ED1D24',
            strokeWidth: 5,
            rx: 12,
            ry: 12,
            shadow: new fabric.Shadow({
                color: 'rgba(0,0,0,0.5)',
                blur: 15,
                offsetX: 8,
                offsetY: 8
            }),
            strokeLineJoin: 'round',
            strokeLineCap: 'round'
        });

        this.panels.push(panel);
        this.canvas.add(panel);
        this.canvas.renderAll();
        console.log('New panel added');
    }

    updatePanelText(text) {
        // Validate input text
        if (!text || typeof text !== 'string') {
            this.showError('Invalid text input provided');
            return;
        }

        if (this.isProcessing) {
            console.log('Panel update in progress, skipping...');
            return;
        }

        if (!this.canvas || !this.textAnalyzer) {
            this.showError('Comic editor not properly initialized');
            return;
        }
        
        console.log('Updating panel text with:', text.substring(0, 50) + '...');
        this.isProcessing = true;
        document.body.style.cursor = 'wait';
        
        try {
            // Save current state before modifications
            this.saveState();
            
            // Analyze text with validation
            if (!this.textAnalyzer || typeof this.textAnalyzer.analyzeText !== 'function') {
                throw new Error('Text analyzer not properly initialized');
            }
            
            const analysis = this.textAnalyzer.analyzeText(text);
            
            if (!analysis || !analysis.success) {
                console.error('Text analysis failed:', analysis?.error || 'Unknown error');
                throw new Error(analysis?.error || 'Failed to analyze text');

            this.fadeOutCurrentPanels(() => {
                this.createPanelsFromAnalysis(analysis);
                this.isProcessing = false;
                document.body.style.cursor = 'default';
                console.log('Panel update completed successfully');
            });
        } catch (error) {
            console.error('Error updating panel text:', error);
            this.isProcessing = false;
            document.body.style.cursor = 'default';
            this.showError('Failed to update panels. Please try again.');
        }
    }

    async createPanelsFromAnalysis(analysis) {
        console.log('Creating panels from analysis. Total panels:', analysis.totalPanels);
        this.showLoading(true);
        
        try {
            // Validate analysis input
            if (!analysis || !analysis.panels || !Array.isArray(analysis.panels)) {
                throw new Error('Invalid analysis data structure');
            }

            if (analysis.panels.length === 0) {
                throw new Error('No panels to create from analysis');
            }

            if (!this.canvas || !this.canvas.getContext) {
                throw new Error('Canvas not properly initialized');
            }

            const layout = new PanelLayout();
            if (!layout || typeof layout.applyLayout !== 'function') {
                throw new Error('Failed to initialize panel layout');
            }

            const layoutName = analysis.totalPanels <= 4 ? '2x2' : '3x2';
            await layout.applyLayout(layoutName, this.canvas);

            for (let index = 0; index < analysis.panels.length; index++) {
                const panel = analysis.panels[index];
                
                // Validate panel data
                if (!panel || typeof panel.text !== 'string' || !panel.position) {
                    console.error(`Invalid panel data at index ${index}:`, panel);
                    continue;
                }

                const fabricPanel = this.canvas.getObjects()[index];
                if (!fabricPanel) {
                    console.error(`Panel ${index} not found in canvas objects`);
                    continue;
                }

                // Set panel properties
                fabricPanel.set({
                    opacity: 0,
                    selectable: true,
                    hasControls: true,
                    hasBorders: true,
                    zIndex: this.zIndexCounter++
                });

                // Animate panel appearance
                await new Promise(resolve => {
                    fabricPanel.set({
                        scaleX: 0.9,
                        scaleY: 0.9
                    });
                    fabricPanel.animate({
                        opacity: 1,
                        scaleX: 1,
                        scaleY: 1
                    }, {
                        duration: 600,
                        easing: fabric.util.ease.easeOutElastic,
                        onChange: this.canvas.renderAll.bind(this.canvas),
                        onComplete: resolve
                    });
                });

                // Create speech bubble path
                const createSpeechBubble = (text, x, y, width, height) => {
                    const path = new fabric.Path('M 0 0 Q 0 0 0 0', {
                        left: x,
                        top: y,
                        fill: 'white',
                        stroke: '#000000',
                        strokeWidth: 2,
                        opacity: 0
                    });

                    const tailX = x + width / 2;
                    const tailY = y + height;
                    const controlPoints = [
                        'M', x, y + 20,
                        'Q', x, y, x + 20, y,
                        'L', x + width - 20, y,
                        'Q', x + width, y, x + width, y + 20,
                        'L', x + width, y + height - 20,
                        'Q', x + width, y + height, x + width - 20, y + height,
                        'L', tailX + 20, y + height,
                        'L', tailX, y + height + 20,
                        'L', tailX - 20, y + height,
                        'L', x + 20, y + height,
                        'Q', x, y + height, x, y + height - 20,
                        'L', x, y + 20
                    ];

                    path.set({ path: controlPoints });
                    return path;
                };

                // Create speech bubble and text
                const bubbleWidth = fabricPanel.width * 0.85;
                const bubbleHeight = 100;
                const bubbleX = fabricPanel.left + (fabricPanel.width * panel.position.x) - bubbleWidth/2;
                const bubbleY = fabricPanel.top + (fabricPanel.height * panel.position.y) - bubbleHeight/2;

                const speechBubble = createSpeechBubble(
                    panel.text,
                    bubbleX,
                    bubbleY,
                    bubbleWidth,
                    bubbleHeight
                );

                const textBox = new fabric.Textbox(panel.text, {
                    left: bubbleX + 15,
                    top: bubbleY + 15,
                    fontSize: 16,
                    width: bubbleWidth - 30,
                    textAlign: 'center',
                    fill: '#000000',
                    fontFamily: 'Comic Sans MS, cursive, sans-serif',
                    lineHeight: 1.4,
                    opacity: 0,
                    selectable: true,
                    hasControls: true,
                    hasBorders: false,
                    breakWords: true,
                    splitByGrapheme: false
                });

                // Add speech bubble and text to canvas
                this.canvas.add(speechBubble);
                this.canvas.add(textBox);

                this.canvas.add(textBox);
                
                // Animate text appearance
                await new Promise(resolve => {
                    textBox.animate('opacity', 1, {
                        duration: 500,
                        delay: 200,
                        onChange: this.canvas.renderAll.bind(this.canvas),
                        onComplete: resolve
                    });
                });
            }

            this.canvas.renderAll();
            console.log('Panel creation complete');
        } catch (error) {
            console.error('Error creating panels:', error);
            this.showError('Failed to create panels: ' + error.message);
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        if (show) {
            this.loadingIndicator.style.display = 'flex';
        } else {
            this.loadingIndicator.style.display = 'none';
        }
    }

    fadeOutCurrentPanels(callback) {
        const objects = this.canvas.getObjects();
        let fadeOutCount = 0;
        
        if (objects.length === 0) {
            callback();
            return;
        }

        objects.forEach(obj => {
            obj.animate({
                opacity: 0,
                scaleX: obj.scaleX * 0.9,
                scaleY: obj.scaleY * 0.9
            }, {
                duration: 400,
                easing: fabric.util.ease.easeOutCubic,
                onChange: this.canvas.renderAll.bind(this.canvas),
                onComplete: () => {
                    fadeOutCount++;
                    if (fadeOutCount === objects.length) {
                        this.canvas.clear();
                        callback();
                    }
                }
            });
        });
    }

    setupUndoRedo() {
        this.undoStack = [];
        this.redoStack = [];
    }

    saveState() {
        const currentState = JSON.stringify(this.canvas.toJSON());
        this.undoStack.push(currentState);
        this.redoStack = []; // Clear redo stack when new action is performed
    }

    undo() {
        if (this.undoStack.length === 0 || this.isProcessing) return;
        
        const currentState = JSON.stringify(this.canvas.toJSON());
        this.redoStack.push(currentState);
        
        const previousState = this.undoStack.pop();
        this.loadState(previousState);
    }

    redo() {
        if (this.redoStack.length === 0 || this.isProcessing) return;
        
        const currentState = JSON.stringify(this.canvas.toJSON());
        this.undoStack.push(currentState);
        
        const nextState = this.redoStack.pop();
        this.loadState(nextState);
    }

    loadState(stateJson) {
        this.canvas.loadFromJSON(JSON.parse(stateJson), () => {
            this.canvas.renderAll();
        });
    }

    // Auto-save functionality implementation

    setupAutoSave() {
        // Auto-save every 2 minutes
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.saveComic(true);
            }
        }, 120000);
    }

    hasUnsavedChanges() {
        const currentState = JSON.stringify(this.canvas.toJSON());
        return currentState !== this.lastSavedState;
    }

    async saveComic(isAutoSave = false) {
        const title = document.getElementById('comic-title').value;
        if (!title && !isAutoSave) {
            this.showError('Please enter a title for your comic.');
            return;
        }

        const currentState = JSON.stringify(this.canvas.toJSON());
        
        // Skip if no changes since last save
        if (currentState === this.lastSavedState && !isAutoSave) {
            this.showFeedback('No changes to save', 'info');
            return;
        }

        const data = {
            title: title || 'Untitled Comic',
            content: currentState,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch('/save_comic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (result.success) {
                this.lastSavedState = currentState;
                if (!isAutoSave) {
                    this.showFeedback('Comic saved successfully!', 'success');
                }
            } else {
                throw new Error(result.error || 'Failed to save comic');
            }
        } catch (error) {
            console.error('Error saving comic:', error);
            if (!isAutoSave) {
                this.showError('Failed to save comic. Please try again.');
            }
        }
    }

    showFeedback(message, type = 'info') {
        const feedback = document.createElement('div');
        feedback.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
        feedback.style.zIndex = '9999';
        feedback.textContent = message;
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 3000);
    }

    async handleTextFileUpload(file) {
        if (!file) {
            this.showError('No file selected');
            return;
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.txt')) {
            this.showError('Please upload a valid text file (.txt)');
            return;
        }

        this.showLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Validate file size (max 5MB)
            try {
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('File size exceeds 5MB limit');
                }

                const response = await fetch('/upload_text', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                const result = await response.json();
                if (!result.success || !result.content) {
                    throw new Error(result.error || 'Invalid response from server');
                }

                return result;
            } catch (error) {
                console.error('Error processing file:', error);
                this.showError(error.message);
                throw error;
            }
    async handleUrlImport(url) {
        console.log('Starting URL content import...');
        if (!url) {
            this.showError('Please enter a valid URL');
            return;
        }

        try {
            // Show loading state
            this.showLoading(true);
            const urlInput = document.getElementById('story-url');
            urlInput.disabled = true;

            // Validate URL format
            try {
                new URL(url);
            } catch (e) {
                throw new Error('Invalid URL format');
            }

            // Send request to backend
            const response = await fetch('/import_url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !result.content) {
                throw new Error(result.error || 'Failed to import content');
            }

            // Update text input and process content
            const textInput = document.getElementById('text-input');
            textInput.value = result.content;
            await this.updatePanelText(result.content);

            // Show success message
            this.showFeedback('Content imported successfully!', 'success');
            urlInput.value = '';

        } catch (error) {
            console.error('Error importing content:', error);
            this.showError(`Failed to import content: ${error.message}`);
        } finally {
            this.showLoading(false);
            document.getElementById('story-url').disabled = false;
        }
    }

            const textInput = document.getElementById('text-input');
            if (!textInput) {
                throw new Error('Text input element not found');
            }

            textInput.value = result.content;
            await this.updatePanelText(result.content);
            this.showFeedback('Text file processed successfully!', 'success');

        } catch (error) {
            console.error('Error uploading text file:', error);
            this.showError('Failed to process text file: ' + error.message);
            throw error; // Re-throw for upstream handling
        } finally {
            this.showLoading(false);
        }
    }

    async handleVideoFileUpload(file) {
        console.log('Starting video file upload process...');
        const progressBar = document.getElementById('upload-progress');
        const progressBarInner = progressBar?.querySelector('.progress-bar');
        
        try {
            if (!this.canvas) {
                throw new Error('Canvas not initialized');
            }

            if (!progressBar || !progressBarInner) {
                throw new Error('Progress bar elements not found');
            }

            if (!file?.type.startsWith('video/')) {
                throw new Error('Invalid video file format');
            }

            progressBar.classList.remove('d-none');
            this.showLoading(true);

            const formData = new FormData();
            formData.append('file', file);

            console.log('Uploading video file to server...');
            const response = await fetch('/upload_video', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !Array.isArray(result.frames)) {
                throw new Error(result.error || 'Invalid response from server');
            }

            console.log(`Successfully processed video into ${result.frames.length} frames`);
            await this.createPanelsFromFrames(result.frames);
            this.showFeedback('Video processed successfully!', 'success');
            return true;

        } catch (error) {
            console.error('Error in handleVideoFileUpload:', error);
            this.showError(`Failed to process video file: ${error.message}`);
            throw error;
        } finally {
            if (progressBar) progressBar.classList.add('d-none');
            if (progressBarInner) progressBarInner.style.width = '0%';
            this.showLoading(false);
        }
    }

    async createPanelsFromFrames(frames) {
        console.log('Creating panels from video frames...');
        if (!this.canvas) {
            throw new Error('Canvas not initialized');
        }

        await new Promise((resolve) => this.fadeOutCurrentPanels(resolve));

        for (let index = 0; index < frames.length; index++) {
            const frameData = frames[index];
            const url = `data:image/jpeg;base64,${frameData}`;
            
            try {
                await new Promise((resolve, reject) => {
                    fabric.Image.fromURL(url, (img) => {
                        if (!img) {
                            reject(new Error('Failed to load frame image'));
                            return;
                        }

                        const panel = new fabric.Rect({
                            left: 10 + (index * 20),
                            top: 10 + (index * 20),
                            width: 400,
                            height: 300,
                            fill: 'white',
                            stroke: '#ED1D24',
                            strokeWidth: 5,
                            zIndex: this.zIndexCounter++
                        });

                        console.log(`Creating panel ${index + 1} at position (${panel.left}, ${panel.top})`);

                        try {
                            img.scaleToWidth(panel.width);
                            img.scaleToHeight(panel.height);
                            img.set({
                                left: panel.left,
                                top: panel.top,
                                zIndex: this.zIndexCounter++
                            });

                            this.canvas.add(panel);
                            this.canvas.add(img);
                            this.canvas.renderAll();
                            resolve();
                        } catch (err) {
                            reject(err);
                        } finally {
                            URL.revokeObjectURL(url);
                        }
                    });
                });
            } catch (error) {
                console.error(`Error creating panel ${index + 1}:`, error);
                this.showError(`Failed to create panel ${index + 1}`);
            }
        }
        console.log('Finished creating panels from video frames');
    }

    async loadBackgrounds() {
        try {
            const container = document.getElementById('background-library');
            const uploadInput = document.getElementById('background-upload');
            
            if (!container || !uploadInput) {
                throw new Error('Required DOM elements not found');
            }
            
            // Clear existing backgrounds
            container.innerHTML = '';
            this.backgrounds.clear();

            // Create category containers
            const categories = {
                'Featured': [],
                'City': [],
                'Indoor': [],
                'Nature': [],
                'Fantasy': []
            };

            // Add LEGO Harry Potter background to Fantasy category
            const harryPotterImg = this.createBackgroundThumbnail({
                src: '/static/backgrounds/LEGO-Harry-Potter-Years-1-4.webp',
                filename: 'LEGO-Harry-Potter-Years-1-4.webp',
                category: 'Fantasy',
                alt: 'LEGO Harry Potter Background'
            });
            setTimeout(() => {
                const fantasyContainer = document.getElementById('fantasy-backgrounds');
                if (fantasyContainer) {
                    fantasyContainer.appendChild(harryPotterImg);
                    this.backgrounds.add('LEGO-Harry-Potter-Years-1-4.webp');
                }
            }, 100);

            // Create category sections
            Object.keys(categories).forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'background-category';
                categoryDiv.innerHTML = `
                    <h6 class="category-title">${category}</h6>
                    <div class="background-grid" id="${category.toLowerCase()}-backgrounds"></div>
                `;
                container.appendChild(categoryDiv);
            });

            // Add default background to Featured category
            const defaultImg = this.createBackgroundThumbnail({
                src: '/static/backgrounds/default.svg',
                filename: 'default.svg',
                category: 'Featured',
                alt: 'Default Background'
            });
            document.getElementById('featured-backgrounds').appendChild(defaultImg);
            this.backgrounds.add('default.svg');
            
            // Setup background upload handler
            uploadInput.addEventListener('change', async (e) => {
                if (!e.target.files.length) return;
                
                const file = e.target.files[0];
                if (!this.validateBackgroundFile(file)) {
                    this.showError('Invalid file type. Please upload SVG or image files only.');
                    uploadInput.value = '';
                    return;
                }
                
                if (this.state.isUploading) {
                    this.showError('Upload in progress. Please wait.');
                    return;
                }
                
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                    this.state.isUploading = true;
                    this.showLoading(true);
                    
                    try {
                        const response = await fetch('/upload_background', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Upload failed: ${response.status}`);
                        }
                        
                        const result = await response.json();
                        if (!result.success) {
                            throw new Error(result.error);
                        }

                        // Add new background to library
                        const categoryContainer = document.getElementById('fantasy-backgrounds');
                        if (!categoryContainer) {
                            throw new Error('Background category container not found');
                        }

                        const thumbnail = this.createBackgroundThumbnail({
                            src: result.path,
                            filename: result.filename,
                            category: 'Fantasy',
                            alt: result.filename
                        });
                        
                        categoryContainer.appendChild(thumbnail);
                        this.backgrounds.add(result.filename);
                        this.state.hasUnsavedChanges = true;
                        
                        // Clear input
                        uploadInput.value = '';
                        this.showFeedback('Background uploaded successfully!', 'success');
                    } catch (error) {
                        console.error('Error uploading background:', error);
                        this.showError(`Failed to upload background: ${error.message}`);
                    } finally {
                        this.state.isUploading = false;
                        this.showLoading(false);
                    }
                });
            } catch (error) {
                console.error('Error initializing backgrounds:', error);
                this.showError('Failed to initialize background library');
            }
        }
    }

    createBackgroundThumbnail({ src, filename, category, alt }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'background-thumbnail';
        
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || filename;
        img.dataset.category = category;
        
        // Add preview functionality
        img.addEventListener('mouseenter', () => {
            this.previewBackground(src);
        });
        
        img.addEventListener('mouseleave', () => {
            this.removeBackgroundPreview();
        });
        
        img.addEventListener('click', () => {
            this.setBackground(filename);
        });
        
        wrapper.appendChild(img);
        return wrapper;
    }

    previewBackground(src) {
        if (!this.canvas) return;
        
        fabric.Image.fromURL(src, (img) => {
            const scaleX = this.canvas.width / img.width;
            const scaleY = this.canvas.height / img.height;
            const scale = Math.max(scaleX, scaleY);
            
            img.scale(scale);
            img.set({
                originX: 'left',
                originY: 'top',
                left: 0,
                top: 0,
                opacity: 0.5
            });
            
            this.previewImage = img;
            this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
        });
    }

    removeBackgroundPreview() {
        if (this.previewImage && this.canvas) {
            this.canvas.setBackgroundImage(null, this.canvas.renderAll.bind(this.canvas));
            this.previewImage = null;
        }
    }
    
    validateBackgroundFile(file) {
        const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
        return allowedTypes.includes(file.type);
    }

    setBackground(backgroundUrl) {
        fabric.Image.fromURL(`/static/backgrounds/${backgroundUrl}`, (img) => {
            const scaleX = this.canvas.width / img.width;
            const scaleY = this.canvas.height / img.height;
            const scale = Math.max(scaleX, scaleY);
            
            img.scale(scale);
            img.set({
                originX: 'left',
                originY: 'top',
                left: 0,
                top: 0
            });
            
            this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas));
            this.saveState();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.comicEditor = new ComicEditor();
});
