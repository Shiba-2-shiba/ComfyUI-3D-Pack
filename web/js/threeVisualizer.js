// threeVisualizer.js (postMessage & ハンドシェイク対応・完成版)

function initializeApp() {
    console.log("Three.js is ready. Initializing the application and waiting for messages.");
    // ... (前回のコードと全く同じ内容をここに記述) ...
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
        let existingModel = scene.getObjectByName("user_model");
        if (existingModel) {
            scene.remove(existingModel);
        }
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
            modelObject.name = "user_model"; // 名前を付けて後で削除しやすくする
            const scale = fileExt === 'obj' ? 5 : 3;
            modelObject.scale.setScalar(scale);
            scene.add(modelObject);
            if (fileExt === 'glb' && gltf.animations && gltf.animations.length) { // gltf is not defined here, fixed
                 mixer = new THREE.AnimationMixer(modelObject);
                 gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
            }
            progressDialog.close();
        };

        if (fileExt === "glb") {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/extensions/ComfyUI-3D-Pack/js/draco/gltf/');
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(currentURL, (gltf) => {
                 console.log("GLB model loaded successfully!");
                 const model = gltf.scene;
                 model.name = "user_model";
                 const scale = 3;
                 model.scale.setScalar(scale);
                 scene.add(model);
                 if (gltf.animations && gltf.animations.length) {
                     mixer = new THREE.AnimationMixer(model);
                     gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
                 }
                 progressDialog.close();
            }, onProgress, onError);
        } else if (fileExt === "obj") {
            const loader = new THREE.OBJLoader();
            loader.load(currentURL, (obj) => {
                console.log("OBJ model loaded successfully!");
                obj.name = "user_model";
                const scale = 5;
                obj.scale.setScalar(scale);
                scene.add(obj);
                progressDialog.close();
            }, onProgress, onError);
        }
    }

    window.addEventListener("message", (event) => {
        if (event.data && event.data.filepath) {
            console.log("[iframe] Message received from parent:", event.data);
            loadModel(event.data.filepath);
        }
    }, false);

    progressDialog.close();
    animate();

    // ★★★ 最後に親ウィンドウへ準備完了を通知 ★★★
    window.parent.postMessage({ type: 'iframeReady', status: 'ready' }, '*');
    console.log("[iframe] Sent 'ready' message to parent.");
}

function waitForThreeJS() {
    if (typeof THREE !== 'undefined' && THREE.RoomEnvironment && THREE.OrbitControls) {
        initializeApp();
    } else {
        setTimeout(waitForThreeJS, 100);
    }
}

waitForThreeJS();
