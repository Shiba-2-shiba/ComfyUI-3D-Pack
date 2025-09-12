import { app } from "/scripts/app.js"

class Visualizer {
    constructor(node, container, visualSrc) {
        this.node = node

        this.iframe = document.createElement('iframe')
        Object.assign(this.iframe, {
            scrolling: "no",
            overflow: "hidden",
        })
        this.iframe.src = "/extensions/ComfyUI-3D-Pack/html/" + visualSrc + ".html"
        container.appendChild(this.iframe)
    }

    // ★★★ここを修正★★★
    updateVisual(filepath) {
        // iframeのコンテンツがロードされるのを待つ
        if (this.iframe.contentWindow) {
            console.log(`[Comfy3D] Posting message to iframe with filepath: ${filepath}`);
            // iframeにファイルパスをメッセージとして送信
            this.iframe.contentWindow.postMessage({
                filepath: filepath
            }, '*'); // '*' はどのオリジンにも送信許可（ローカルなので問題なし）
        } else {
            console.warn("[Comfy3D] iframe.contentWindow not ready, retrying...");
            setTimeout(() => this.updateVisual(filepath), 100);
        }
    }

    remove() {
        this.container.remove()
    }
}

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
    
    // ★★★ここを修正★★★
    node.updateParameters = (params) => {
        // iframeがロード完了してからメッセージを送る保証のため、少し待機
        setTimeout(() => {
             node.visualizer.updateVisual(params.filepath)
        }, 100);
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
    name: "Mr.ForExample.Visualizer.Mesh", // 拡張機能名を変更
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 登録対象を3DMeshのみに絞る
        if (nodeData.name === "[Comfy3D] Preview 3DMesh") {
             registerVisualizer(nodeType, nodeData, "[Comfy3D] Preview 3DMesh", "threeVisualizer");
        }
    },
})
