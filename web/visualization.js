import { app } from "/scripts/app.js"

class Visualizer {
    constructor(node, container, visualSrc) {
        this.node = node;
        this.isReady = false; // iframeの準備状態を管理
        this.pendingFilepath = null; // 保留中のファイルパス

        this.iframe = document.createElement('iframe');
        Object.assign(this.iframe, {
            scrolling: "no",
            overflow: "hidden",
        });
        this.iframe.src = "/extensions/ComfyUI-3D-Pack/html/" + visualSrc + ".html";
        container.appendChild(this.iframe);

        // iframeからの「準備完了」メッセージを待つリスナー
        window.addEventListener('message', (event) => {
            if (event.source === this.iframe.contentWindow && event.data.type === 'iframeReady') {
                console.log('[Comfy3D] Received "ready" message from iframe.');
                this.isReady = true;
                // 保留中のファイルパスがあれば、ここで送信
                if (this.pendingFilepath) {
                    this.updateVisual(this.pendingFilepath);
                    this.pendingFilepath = null;
                }
            }
        });
    }

    updateVisual(filepath) {
        // iframeの準備ができていれば直接送信、できていなければ保留
        if (this.isReady) {
            console.log(`[Comfy3D] iframe is ready. Posting message with filepath: ${filepath}`);
            this.iframe.contentWindow.postMessage({ filepath: filepath }, '*');
        } else {
            console.log(`[Comfy3D] iframe not ready. Storing pending filepath: ${filepath}`);
            this.pendingFilepath = filepath;
        }
    }

    remove() {
        this.container.remove()
    }
}

// createVisualizer関数とregisterVisualizer関数は前回のままで変更ありません
// （ただし、以前のコードをコピー＆ペーストしてください）
function createVisualizer(node, inputName, typeName, inputData, app) {
    node.name = inputName

    const widget = {
        type: typeName,
        name: "preview3d",
        callback: () => {},
        draw : function(ctx, node, widgetWidth, widgetY, widgetHeight) {
            const margin = 30
            const top_offset = LiteGraph.NODE_TITLE_HEIGHT+margin
            const visible = app.canvas.ds.scale > 0.5 && this.type === typeName

            const [x, y] = node.getBounding();
            const [left, top] = app.canvasPosToClientPos([x, y]);
            const width = node.width * app.canvas.ds.scale;
            const height = (node.height - top_offset ) * app.canvas.ds.scale;

            Object.assign(this.visualizer.style, {
                left: `${left}px`,
                top: `${top+(top_offset * app.canvas.ds.scale)}px`,
                width: `${width}px`,
                height: `${height}px`,
                position: "absolute",
                overflow: "hidden",
            })

            Object.assign(this.visualizer.children[0].style, {
                transformOrigin: "50% 50%",
                width: '100%',
                height: '100%',
                border: '0 none',
            })

            this.visualizer.hidden = !visible
        },
    }

    const container = document.createElement('div')
    container.id = `Comfy3D_${inputName}`

    node.visualizer = new Visualizer(node, container, typeName)
    widget.visualizer = container
    widget.parent = node

    document.body.appendChild(widget.visualizer)

    node.addCustomWidget(widget)
    
    // updateParametersからsetTimeoutを削除
    node.updateParameters = (params) => {
        node.visualizer.updateVisual(params.filepath)
    }

    node.onDrawBackground = function (ctx) {
        if (!this.flags.collapsed) {
            node.visualizer.iframe.hidden = false
        } else {
            node.visualizer.iframe.hidden = true
        }
    }

    node.onResize = function () {
        let [w, h] = this.size
        if (w <= 600) w = 600
        if (h <= 500) h = 500
        if (w > 600) { h = w - 100 }
        this.size = [w, h]
    }

    node.onRemoved = () => {
        for (let w in node.widgets) {
            if (node.widgets[w].visualizer) {
                node.widgets[w].visualizer.remove()
            }
        }
    }

    return { widget: widget }
}

function registerVisualizer(nodeType, nodeData, nodeClassName, typeName){
    if (nodeData.name == nodeClassName) {
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = async function() {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined
            let nodeName = `Preview3DNode_${nodeClassName}`
            await createVisualizer.apply(this, [this, nodeName, typeName, {}, app])
            this.setSize([600, 500])
            return r
        }
        nodeType.prototype.onExecuted = async function(message) {
            if (message?.previews) {
                this.updateParameters(message.previews[0])
            }
        }
    }
}

app.registerExtension({
    name: "Mr.ForExample.Visualizer.Mesh",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "[Comfy3D] Preview 3DMesh") {
             registerVisualizer(nodeType, nodeData, "[Comfy3D] Preview 3DMesh", "threeVisualizer");
        }
    },
})
