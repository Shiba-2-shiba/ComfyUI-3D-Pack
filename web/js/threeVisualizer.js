// threeVisualizer.js (postMessage対応・完成版)

function initializeApp() {
    console.log("Three.js is ready. Initializing the application and waiting for messages.");
    
    const container = document.getElementById( 'container' );
    const progressDialog = document.getElementById("progress-dialog");
    const progressIndicator = document.getElementById("progress-indicator");
    const colorPicker = document.getElementById("color-picker");
    const downloadButton = document.getElementById("download-button");

    const renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    const pmremGenerator = new THREE.PMREMGenerator( renderer );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );
    scene.environment = pmremGenerator.fromScene( new THREE.RoomEnvironment( renderer ), 0.04 ).texture;

    const ambientLight = new THREE.AmbientLight( 0xffffff , 3.0 );
    scene.add(ambientLight);

    const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 100 );
    camera.position.set( 5, 2, 8 );
    scene.add(camera);

    const pointLight = new THREE.PointLight( 0xffffff, 15 );
    camera.add( pointLight );

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

    const clock = new THREE.Clock();
    let mixer;
    let currentURL;
    const url = location.protocol + '//' + location.host;

    downloadButton.addEventListener('click', e => {
        if (currentURL) window.open(currentURL, '_blank');
    });

    // 継続的なレンダリングループ
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

    function loadModel(filepath) {
        console.log(`loadModel() called with filepath: "${filepath}"`);

        // 前のモデルをクリア
        while(scene.children.length > 0){ 
            const child = scene.children[0];
            if (child.isLight || child.isCamera) {
                 scene.remove(child); // Keep lights and camera initially added
            } else {
                scene.remove(child);
            }
        }
        // 再度ライトとカメラを追加
        scene.add(ambientLight);
        scene.add(camera);

        if (!filepath || !/^.+\.[a-zA-Z]+$/.test(filepath)) {
            console.log("Filepath is empty or invalid, skipping load.");
            progressDialog.close();
            return;
        }

        progressDialog.open = true;
        
        const params = new URLSearchParams({ filename: filepath, type: 'output', subfolder: '' });
        currentURL = url + '/view?' + params.toString();
        console.log("Attempting to load model from URL:", currentURL);
        
        const fileExt = filepath.split('.').pop().toLowerCase();

        const loaderCallback = (modelObject) => {
            console.log("Model loaded successfully!");
            const scale = fileExt === 'obj' ? 5 : 3;
            modelObject.scale.setScalar(scale);
            scene.add(modelObject);

            if (fileExt === 'glb' && modelObject.animations && modelObject.animations.length) {
                mixer = new THREE.AnimationMixer(modelObject);
                modelObject.animations.forEach((clip) => {
                    mixer.clipAction(clip).play();
                });
            }
            if (fileExt === 'obj') {
                modelObject.traverse(node => {
                    if (node.material && node.material.map == null) {
                        node.material.vertexColors = true;
                    }
                });
            }
            progressDialog.close();
        };

        if (fileExt === "glb") {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/extensions/ComfyUI-3D-Pack/js/draco/gltf/');
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(currentURL, (gltf) => loaderCallback(gltf.scene), onProgress, onError);
        } else if (fileExt === "obj") {
            const mtlPath = filepath.substring(0, filepath.lastIndexOf('.')) + ".mtl";
            const mtlLoader = new THREE.MTLLoader();
            mtlLoader.load(mtlPath, (materials) => {
                materials.preload();
                const objLoader = new THREE.OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.load(currentURL, loaderCallback, onProgress, onError);
            }, undefined, () => { // MTL not found, load OBJ without materials
                 const objLoader = new THREE.OBJLoader();
                 objLoader.load(currentURL, loaderCallback, onProgress, onError);
            });
        }
    }

    // ★★★ 親ウィンドウからのメッセージを待機 ★★★
    window.addEventListener("message", (event) => {
        // 必要であれば送信元のオリジンをチェック
        // if (event.origin !== "http://example.com") return;

        if (event.data && event.data.filepath) {
            console.log("[iframe] Message received from parent:", event.data);
            loadModel(event.data.filepath);
        }
    }, false);

    progressDialog.close();
    animate(); // レンダリングループを開始
}

// Three.jsの準備が完了するまで待つ
function waitForThreeJS() {
    if (typeof THREE !== 'undefined' && THREE.RoomEnvironment && THREE.OrbitControls) {
        initializeApp();
    } else {
        setTimeout(waitForThreeJS, 100);
    }
}

waitForThreeJS();
