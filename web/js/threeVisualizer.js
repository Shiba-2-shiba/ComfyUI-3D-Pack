console.log("[iframe] threeVisualizer.js script started.");

function initializeApp() {
    console.log("[iframe] STEP 2: Dependencies met. Entering initializeApp().");

    console.log("[iframe] STEP 3: Initializing constants and DOM elements...");
    const visualizer = document.getElementById("visualizer");
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

    console.log("[iframe] STEP 5: Setting up Scene and Environment...");
    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x000000 );
    scene.environment = pmremGenerator.fromScene( new THREE.RoomEnvironment( renderer ), 0.04 ).texture;

    console.log("[iframe] STEP 6: Setting up Lights and Camera...");
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

    function loadModel(filepath) {
        console.log(`loadModel() called with filepath: "${filepath}"`);
        
        // 既存のモデルがあればシーンから削除
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

        if (fileExt === "glb") {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('/extensions/ComfyUI-3D-Pack/js/draco/gltf/');
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader(dracoLoader);
            loader.load(currentURL, (gltf) => {
                 console.log("GLB model loaded successfully!");
                 const model = gltf.scene;
                 model.name = "user_model"; // 名前を付けて後で削除しやすくする
                 model.scale.setScalar(3);
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
                obj.scale.setScalar(5);
                scene.add(obj);
                progressDialog.close();
            }, onProgress, onError);
        } else {
            console.error(`Unsupported file extension: .${fileExt}`);
            progressDialog.close();
        }
    }

    // 親ウィンドウからのメッセージを待機
    window.addEventListener("message", (event) => {
        if (event.data && event.data.filepath) {
            console.log("[iframe] Message received from parent:", event.data);
            loadModel(event.data.filepath);
        }
    }, false);


    console.log("[iframe] STEP 9: Initial setup complete. Starting animation loop.");
    progressDialog.close();
    animate();

    console.log("[iframe] STEP 10: Reached end of initializeApp(). Preparing to send 'ready' message.");
    window.parent.postMessage({ type: 'iframeReady', status: 'ready' }, '*');
    console.log("[iframe] ✅ Sent 'ready' message to parent.");
}


function waitForThreeJS() {
    console.log("[iframe] STEP 1: Checking for Three.js dependencies...");
    const threeLoaded = typeof THREE !== 'undefined';
    // アドオンの存在もチェック
    const addonsLoaded = threeLoaded && THREE.RoomEnvironment && THREE.OrbitControls;

    console.log(`[iframe] Status: THREE=${threeLoaded}, Addons=${addonsLoaded}`);

    if (threeLoaded && addonsLoaded) {
        initializeApp();
    } else {
        // 200ミリ秒後にもう一度チェック
        setTimeout(waitForThreeJS, 200);
    }
}

// 初期化プロセスを開始
waitForThreeJS();
