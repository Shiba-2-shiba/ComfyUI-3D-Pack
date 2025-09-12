// threeVisualizer.js (デバッグログ追加・完成版)

function initializeApp() {
    console.log("Three.js is ready. Initializing the application.");
    
    const visualizer = document.getElementById("visualizer");
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

    const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 100 );
    camera.position.set( 5, 2, 8 );
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

    var lastTimestamp = "";
    var needUpdate = false;
    let mixer;
    let currentURL;
    var url = location.protocol + '//' + location.host;

    downloadButton.addEventListener('click', e => {
        window.open(currentURL, '_blank');
    });

    function frameUpdate() {
        var filepath = visualizer.getAttribute("filepath");
        var timestamp = visualizer.getAttribute("timestamp");
        if (timestamp == lastTimestamp){
            if (needUpdate){
                controls.update();
                if (mixer !== undefined) {
                    const delta = clock.getDelta();
                    mixer.update(delta);
                }
                renderer.render( scene, camera );
            }
            requestAnimationFrame( frameUpdate );
        } else {
            needUpdate = false;
            scene.clear();
            progressDialog.open = true;
            lastTimestamp = timestamp;
            main(filepath);
        }

        var color = getRGBValue(colorPicker.value, true);
        if (color[0] != scene.background.r || color[1] != scene.background.g || color[2] != scene.background.b){
            scene.background.setStyle(colorPicker.value);
            renderer.render( scene, camera );
        }
    }

    const onProgress = function ( xhr ) {
        if ( xhr.lengthComputable ) {
            progressIndicator.value = xhr.loaded / xhr.total * 100;
        }
    };
    const onError = function ( e ) {
        console.error("Loader Error:", e);
    };

    async function main(filepath="") {
        console.log(`main() called with filepath: "${filepath}"`);

        if (/^.+\.[a-zA-Z]+$/.test(filepath)){
            const params = new URLSearchParams({
                filename: filepath,
                type: 'output',
                subfolder: ''
            });
            currentURL = url + '/view?' + params.toString();
            
            console.log("Attempting to load model from URL:", currentURL);

            var filepathSplit = filepath.split('.');
            var fileExt = filepathSplit.pop().toLowerCase();
            var filepathNoExt = filepathSplit.join(".");

            if (fileExt == "obj"){
                console.log("Using OBJLoader.");
                const loader = new THREE.OBJLoader();
                var mtlFolderpath = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"))) + "/";
                var mtlFilepath = filepathNoExt.replace(/^.*[\\\/]/, '') + ".mtl";
                const mtlLoader = new THREE.MTLLoader();
                mtlLoader.setPath(url + '/viewfile?' + new URLSearchParams({"filepath": mtlFolderpath}));
                mtlLoader.load( mtlFilepath, function ( mtl ) {
                    mtl.preload();
                    loader.setMaterials( mtl );
                }, onProgress, onError );
                loader.load( currentURL, function ( obj ) {
                    console.log("OBJ model loaded successfully!");
                    obj.scale.setScalar( 5 );
                    scene.add( obj );
                    obj.traverse(node => {
                        if (node.material && node.material.map == null) {
                            node.material.vertexColors = true;
                        }
                    });
                }, onProgress, onError );

            } else if (fileExt == "glb") {
                console.log("Using GLTFLoader.");
                const dracoLoader = new THREE.DRACOLoader();
                dracoLoader.setDecoderPath( '/extensions/ComfyUI-3D-Pack/js/draco/gltf/' );
                const loader = new THREE.GLTFLoader();
                loader.setDRACOLoader( dracoLoader );

                loader.load( currentURL, function ( gltf ) {
                    console.log("GLB model loaded successfully!", gltf);
                    const model = gltf.scene;
                    model.scale.set( 3, 3, 3 );
                    scene.add( model );
                    mixer = new THREE.AnimationMixer(model);
                    gltf.animations.forEach((clip) => {
                        mixer.clipAction(clip).play();
                    });
                }, onProgress, onError );
            } else {
                 console.error(`Unsupported file extension: .${fileExt}`);
            }
            needUpdate = true;
        } else {
            console.log("Filepath is empty or invalid, skipping load.");
        }

        scene.add( ambientLight );
        scene.add( camera );
        
        console.log("Closing progress dialog.");
        progressDialog.close();

        frameUpdate();
    }
    
    main();
}

function waitForThreeJS() {
    if (typeof THREE !== 'undefined' && THREE.RoomEnvironment && THREE.OrbitControls) {
        initializeApp();
    } else {
        setTimeout(waitForThreeJS, 100);
    }
}

waitForThreeJS();
