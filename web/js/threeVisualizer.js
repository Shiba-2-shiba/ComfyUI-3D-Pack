// import文はすべて削除されています。

// getRGBValueは、sharedFunctions.jsがHTMLで別途読み込まれることを前提とします。
// import {getRGBValue} from './sharedFunctions.js';

const visualizer = document.getElementById("visualizer");
const container = document.getElementById( 'container' );
const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");
const colorPicker = document.getElementById("color-picker");
const downloadButton = document.getElementById("download-button");

const renderer = new THREE.WebGLRenderer( { antialisias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

const pmremGenerator = new THREE.PMREMGenerator( renderer );

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );
// THREE.RoomEnvironment を使用
scene.environment = pmremGenerator.fromScene( new THREE.RoomEnvironment( renderer ), 0.04 ).texture;

const ambientLight = new THREE.AmbientLight( 0xffffff , 3.0 );

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 100 );
camera.position.set( 5, 2, 8 );
const pointLight = new THREE.PointLight( 0xffffff, 15 );
camera.add( pointLight );

// THREE.OrbitControls を使用
const controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.5, 0 );
controls.update();
controls.enablePan = true;
controls.enableDamping = true;

// Handle window reseize event
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
        renderer.render( scene, camera ); // Force update background color in preview scene
    }
}

const onProgress = function ( xhr ) {
    if ( xhr.lengthComputable ) {
        progressIndicator.value = xhr.loaded / xhr.total * 100;
    }
};
const onError = function ( e ) {
    console.error( e );
};

async function main(filepath="") {
    // Check if file name is valid
    if (/^.+\.[a-zA-Z]+$/.test(filepath)){

        const params = new URLSearchParams({
            filename: filepath,
            type: 'output',
            subfolder: ''
        });
        currentURL = url + '/view?' + params.toString();

        var filepathSplit = filepath.split('.');
        var fileExt = filepathSplit.pop().toLowerCase();
        var filepathNoExt = filepathSplit.join(".");

        if (fileExt == "obj"){
            // THREE.OBJLoader を使用
            const loader = new THREE.OBJLoader();

            var mtlFolderpath = filepath.substring(0, Math.max(filepath.lastIndexOf("/"), filepath.lastIndexOf("\\"))) + "/";
            var mtlFilepath = filepathNoExt.replace(/^.*[\\\/]/, '') + ".mtl";

            // THREE.MTLLoader を使用
            const mtlLoader = new THREE.MTLLoader();
            mtlLoader.setPath(url + '/viewfile?' + new URLSearchParams({"filepath": mtlFolderpath}));
            mtlLoader.load( mtlFilepath, function ( mtl ) {
                mtl.preload();
                loader.setMaterials( mtl );
            }, onProgress, onError );

            loader.load( currentURL, function ( obj ) {
                obj.scale.setScalar( 5 );
                scene.add( obj );
                obj.traverse(node => {
                    if (node.material && node.material.map == null) {
                        node.material.vertexColors = true;
                    }
                  });

            }, onProgress, onError );

        } else if (fileExt == "glb") {
            // THREE.DRACOLoader を使用
            const dracoLoader = new THREE.DRACOLoader();
            // パスを修正
            dracoLoader.setDecoderPath( '/extensions/ComfyUI-3D-Pack/js/draco/gltf/' );
            // THREE.GLTFLoader を使用
            const loader = new THREE.GLTFLoader();
            loader.setDRACOLoader( dracoLoader );

            loader.load( currentURL, function ( gltf ) {
                const model = gltf.scene;
                model.scale.set( 3, 3, 3 );

                scene.add( model );
                mixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => {
                    mixer.clipAction(clip).play();
                });

            }, onProgress, onError );

        } else if (fileExt == "ply") {
            // (PLY ローダーの実装は省略)
        } else {
            throw new Error(`File extension name has to be either .obj, .glb, or .ply, got .${fileExt}`);
        }

        needUpdate = true;
    }

    scene.add( ambientLight );
    scene.add( camera );

    progressDialog.close();

    frameUpdate();
}

main();
