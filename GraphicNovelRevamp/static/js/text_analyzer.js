class TextAnalyzer {
    constructor() {
        this.MIN_WORDS_PER_PANEL = 10;
        this.MAX_WORDS_PER_PANEL = 50;
        this.MIN_PANELS = 1;
        this.MAX_PANELS = 6;
        this.feedbackElement = document.createElement('div');
        this.feedbackElement.className = 'alert alert-info mt-2';
        this.feedbackElement.style.display = 'none';
        document.getElementById('text-input').parentNode.appendChild(this.feedbackElement);
    }

    showFeedback(message, type = 'info') {
        this.feedbackElement.textContent = message;
        this.feedbackElement.className = `alert alert-${type} mt-2`;
        this.feedbackElement.style.display = 'block';
        setTimeout(() => {
            this.feedbackElement.style.display = 'none';
        }, 5000);
    }

    analyzeText(text) {
        console.log('Starting text analysis...');
        try {
            if (!text || text.trim().length === 0) {
                this.showFeedback('Please enter some text to create panels.', 'warning');
                return { success: false, error: 'Empty text input' };
            }

            const scenes = this.splitIntoScenes(text);
            console.log(`Detected ${scenes.length} scenes`);
            
            const panelCount = this.calculateOptimalPanelCount(scenes);
            console.log(`Calculated optimal panel count: ${panelCount}`);
            
            const panels = this.distributeScenesIntoPanels(scenes, panelCount);
            this.showFeedback(`Created ${panelCount} panels from your story.`, 'success');
            
            return {
                success: true,
                panels: panels,
                totalPanels: panelCount
            };
        } catch (error) {
            console.error('Error analyzing text:', error);
            this.showFeedback(error.message || 'Failed to analyze text. Please check your input.', 'danger');
            return {
                success: false,
                error: error.message,
                panels: [],
                totalPanels: 0
            };
        }
    }

    async splitIntoScenes(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid text input');
        }

        try {
            // Get AI scene suggestions
            const response = await fetch('/suggest_scenes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                throw new Error('Failed to get scene suggestions');
            }

            const aiSuggestions = await response.json();
            
            // Enhanced scene detection with AI suggestions and indicators
            const sceneIndicators = /\b(?:later|meanwhile|suddenly|after|before|at|in|then|next|finally|eventually|soon|when|while)\b|\.\s+|\?\s+|\!\s+|;\s+|\n+/gi;
            let scenes = text.split(sceneIndicators)
                .map(scene => scene.trim())
                .filter(scene => scene.length > 0);
            
            if (scenes.length === 0) {
                scenes = [text];
            }

            // Merge very short scenes and enhance with AI suggestions
            const mergedScenes = scenes.reduce((acc, scene, index) => {
                const wordCount = scene.split(/\s+/).length;
                const suggestion = aiSuggestions.scenes?.[index] || {};
                
                if (wordCount < this.MIN_WORDS_PER_PANEL && acc.length > 0) {
                    const lastScene = acc[acc.length - 1];
                    lastScene.text += ' ' + scene;
                    lastScene.visualization = {
                        ...lastScene.visualization,
                        ...suggestion
                    };
                } else {
                    acc.push({
                        text: scene,
                        visualization: suggestion
                    });
                }
                return acc;
            }, []);

            console.log(`Scene detection complete. Found ${mergedScenes.length} distinct scenes`);
            return mergedScenes;
        } catch (error) {
            console.error('Error in scene detection:', error);
            // Fallback to basic scene detection
            const scenes = text.split(sceneIndicators)
                .map(scene => scene.trim())
                .filter(scene => scene.length > 0)
                .map(scene => ({
                    text: scene,
                    visualization: {
                        composition: 'default',
                        mood: 'neutral',
                        visual_elements: ['basic panel layout']
                    }
                }));
            return scenes.length > 0 ? scenes : [{
                text: text,
                visualization: {
                    composition: 'default',
                    mood: 'neutral',
                    visual_elements: ['basic panel layout']
                }
            }];
        }
    }

    calculateOptimalPanelCount(scenes) {
        const totalWords = scenes.reduce((count, scene) => {
            return count + scene.split(/\s+/).length;
        }, 0);

        // Calculate panel count based on word count and min/max words per panel
        let panelCount = Math.ceil(totalWords / this.MAX_WORDS_PER_PANEL);
        panelCount = Math.max(panelCount, Math.ceil(scenes.length / 2));
        panelCount = Math.min(panelCount, 6); // Maximum 6 panels per page

        return panelCount;
    }

    distributeScenesIntoPanels(scenes, panelCount) {
        const panels = [];
        const scenesPerPanel = Math.ceil(scenes.length / panelCount);

        for (let i = 0; i < scenes.length; i += scenesPerPanel) {
            const panelScenes = scenes.slice(i, i + scenesPerPanel);
            panels.push({
                text: panelScenes.join(' '),
                position: this.calculateTextPosition(i, panelCount)
            });
        }

        return panels;
    }

    calculateTextPosition(panelIndex, totalPanels) {
        // Calculate optimal position for speech bubbles based on panel position
        const positions = [
            { x: 0.2, y: 0.2 }, // Top left
            { x: 0.8, y: 0.2 }, // Top right
            { x: 0.2, y: 0.8 }, // Bottom left
            { x: 0.8, y: 0.8 }, // Bottom right
            { x: 0.5, y: 0.5 }, // Center
            { x: 0.5, y: 0.2 }  // Top center
        ];

        return positions[panelIndex % positions.length];
    }
}
