// [iframe] threeVisualizer.js script started.

document.addEventListener('DOMContentLoaded', (event) => {
    console.log('[iframe] DOMContentLoaded event fired. All scripts should be loaded.');

    if (typeof THREE === 'undefined') {
        console.error('[iframe] FATAL: THREE.js is not loaded even after DOMContentLoaded.');
        const progressDialog = document.getElementById("progress-dialog");
        if (progressDialog) {
            progressDialog.innerHTML = "<p>Error: Failed to load 3D library.</p>";
        }
        return;
    }
    initializeApp();
});


function initializeApp() {
    console.log("[iframe] STEP 2: Dependencies met. Entering initializeApp().");
    console.log("[iframe] STEP 3: Initializing constants and DOM elements...");
    const container = document.getElementById( 'container' );
    const progressDialog = document.getElementById("progress-dialog");
    const progressIndicator = document.getElementById("progress-indicator");
    const colorPicker = document.getElementById("color-picker");
    const downloadButton = document.getElementById("download-button");
    console.log("[iframe] STEP 4: Setting up THREE.js Renderer...");
    const renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );
    console.log("[iframe] STEP 5: Setting up Scene and Lights (Replaced RoomEnvironment)...");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x8d8d8d, 3 );
    hemiLight.position.set( 0, 20, 0 );
    scene.add( hemiLight );
    const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
    dirLight.position.set( 5, 10, 7.5 );
    scene.add( dirLight );
    console.log("[iframe] STEP 6: Setting up Camera...");
    const ambientLight = new THREE.AmbientLight( 0xffffff , 3.0 );
    scene.add(ambientLight);
    const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 100 );
    camera.position.set( 5, 2, 8 );
    scene.add(camera);
    const pointLight = new THREE.PointLight( 0xffffff, 15 );
    camera.add( pointLight );
    console.log("[iframe] STEP 7: Setting up OrbitControls...");
    const controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0.5, 0 );
    controls.update();
    controls.enablePan = true;
    controls.enableDamping = true;
    window.onresize = function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( window.innerWidth, window.innerHeight );
    };
    console.log("[iframe] STEP 8: Defining functions (animate, loadModel, etc.)...");
    const clock = new THREE.Clock();
    let mixer;
    let currentURL;
    const url = location.protocol + '//' + location.host;
    downloadButton.addEventListener('click', e => {
        if (currentURL) window.open(currentURL, '_blank');
    });
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        if (mixer) {
            mixer.update(clock.getDelta());
        }
        const color = getRGBValue(colorPicker.value, true);
        if (scene.background.r !== color[0] || scene.background.g !== color[1] || scene.background.b !== color[2]) {
            scene.background.setRGB(color[0], color[1], color[2]);
        }
        renderer.render(scene, camera);
    }
    const onProgress = (xhr) => {
        if (xhr.lengthComputable) {
            progressIndicator.value = xhr.loaded / xhr.total * 100;
        }
    };
    const onError = (e) => console.error("Loader Error:", e);

    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 修正箇所 START ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    function loadModel(filepath) {
        console.log(`loadModel() called with original absolute filepath: "${filepath}"`);
        let existingModel = scene.getObjectByName("user_model");
        if (existingModel) {
            scene.remove(existingModel);
        }
        if (!filepath || !/^.+\.[a-zA-Z]+$/.test(filepath)) {
            console.log("Filepath is empty or invalid, skipping load.");
            if(progressDialog) progressDialog.close();
            return;
        }

        // --- APIリクエスト形式を修正するロジック ---
        let params;
        const knownDirs = ["output", "input", "temp"];
        let foundDir = false;

        for (const dir of knownDirs) {
            const separator = `/${dir}/`;
            if (filepath.includes(separator)) {
                const parts = filepath.split(separator);
                const relativePath = parts.pop(); // 例: "Hun2-1/mesh.glb"

                // **ここからが新しいロジック**
                const lastSlashIndex = relativePath.lastIndexOf('/');
                let subfolder = '';
                let filename = relativePath;

                if (lastSlashIndex !== -1) {
                    // "/"が見つかった場合、それを基準にsubfolderとfilenameを分割
                    subfolder = relativePath.substring(0, lastSlashIndex);
                    filename = relativePath.substring(lastSlashIndex + 1);
                }
                // **新しいロジックはここまで**

                params = new URLSearchParams({
                    filename: filename,   // 修正後: "mesh.glb"
                    type: dir,
                    subfolder: subfolder  // 修正後: "Hun2-1"
                });
                console.log(`Path converted to relative: filename=${filename}, subfolder=${subfolder}, type=${dir}`);
                foundDir = true;
                break;
            }
        }

        if (!foundDir) {
            console.error("Could not determine relative path from known directories (output, input, temp). Using original path as fallback.");
            params = new URLSearchParams({ filename: filepath, type: 'output', subfolder: '' });
        }
        // --- ロジックここまで ---
        
        if(progressDialog) progressDialog.open = true;
        
        currentURL = url + '/view?' + params.toString();
        console.log("Attempting to load model from URL:", currentURL);
        
        const fileExt = filepath.split('.').pop().toLowerCase();
        if (fileExt === "glb") {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/extensions/ComfyUI-3D-Pack/js/draco/gltf/');
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(currentURL, (gltf) => {
                 console.log("GLB model loaded successfully!");
                 const model = gltf.scene;
                 model.name = "user_model";
                 model.scale.setScalar(3);
                 scene.add(model);
                 if (gltf.animations && gltf.animations.length) {
                     mixer = new THREE.AnimationMixer(model);
                     gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
                 }
                 if(progressDialog) progressDialog.close();
            }, onProgress, onError);
        } else if (fileExt === "obj") {
            const loader = new THREE.OBJLoader();
            loader.load(currentURL, (obj) => {
                console.log("OBJ model loaded successfully!");
                obj.name = "user_model";
                obj.scale.setScalar(5);
                scene.add(obj);
                if(progressDialog) progressDialog.close();
            }, onProgress, onError);
        } else {
            console.error(`Unsupported file extension: .${fileExt}`);
            if(progressDialog) progressDialog.close();
        }
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 修正箇所 END ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    window.addEventListener("message", (event) => {
        if (event.data && event.data.filepath) {
            console.log("[iframe] Message received from parent:", event.data);
            loadModel(event.data.filepath);
        }
    }, false);

    console.log("[iframe] STEP 9: Initial setup complete. Starting animation loop.");
    if(progressDialog) progressDialog.close();
    animate();
    console.log("[iframe] STEP 10: Reached end of initializeApp(). Preparing to send 'ready' message.");
    window.parent.postMessage({ type: 'iframeReady', status: 'ready' }, '*');
    console.log("[iframe] ✅ Sent 'ready' message to parent.");
}
