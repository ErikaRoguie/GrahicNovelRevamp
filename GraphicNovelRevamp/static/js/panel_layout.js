class PanelLayout {
    constructor() {
        this.layouts = {
            '2x2': [
                {x: 0, y: 0, w: 0.5, h: 0.5},
                {x: 0.5, y: 0, w: 0.5, h: 0.5},
                {x: 0, y: 0.5, w: 0.5, h: 0.5},
                {x: 0.5, y: 0.5, w: 0.5, h: 0.5}
            ],
            '3x2': [
                {x: 0, y: 0, w: 0.33, h: 0.5},
                {x: 0.33, y: 0, w: 0.33, h: 0.5},
                {x: 0.66, y: 0, w: 0.33, h: 0.5},
                {x: 0, y: 0.5, w: 0.5, h: 0.5},
                {x: 0.5, y: 0.5, w: 0.5, h: 0.5}
            ]
        };
    }

    createMarvelPanel(options) {
        const panel = new fabric.Rect({
            left: options.left,
            top: options.top,
            width: options.width,
            height: options.height,
            fill: 'white',
            stroke: '#ED1D24', // Marvel Red
            strokeWidth: 5,
            rx: 10, // Rounded corners
            ry: 10,
            shadow: new fabric.Shadow({
                color: 'rgba(0,0,0,0.5)',
                blur: 15,
                offsetX: 8,
                offsetY: 8
            }),
            strokeLineJoin: 'round',
            strokeLineCap: 'round',
            selectable: true,
            hasControls: true,
            hasBorders: true,
            padding: 10,
            opacity: 0
        });

        return panel;
    }

    async applyLayout(layoutName, canvas) {
        console.log(`Applying ${layoutName} layout`);
        const layout = this.layouts[layoutName];
        if (!layout) return;

        canvas.clear();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Create and add panels with animation
        for (let index = 0; index < layout.length; index++) {
            const panel = layout[index];
            const panelObj = this.createMarvelPanel({
                left: panel.x * canvasWidth + 10,
                top: panel.y * canvasHeight + 10,
                width: (panel.w * canvasWidth) - 20,
                height: (panel.h * canvasHeight) - 20
            });

            canvas.add(panelObj);

            // Animate panel appearance
            await new Promise(resolve => {
                panelObj.animate({
                    opacity: 1,
                    scaleX: 1,
                    scaleY: 1
                }, {
                    duration: 500,
                    delay: index * 200,
                    easing: fabric.util.ease.easeOutElastic,
                    onChange: canvas.renderAll.bind(canvas),
                    onComplete: resolve
                });
            });
        }

        canvas.renderAll();
        console.log('Layout applied successfully');
    }
}
