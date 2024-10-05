let scene, camera, renderer, earth, debrisGroup, controls, raycaster, mouse;
let debrisData = [];

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // إضافة التحكم في الكاميرا
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;

    // إنشاء الأرض
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const texture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg');
    const material = new THREE.MeshPhongMaterial({ map: texture });
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    debrisGroup = new THREE.Group();
    scene.add(debrisGroup);

    // إضافة الإضاءة
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 3, 5);
    scene.add(pointLight);

    // إعداد Raycaster للتفاعل مع النفايات
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    loadDebrisData(); // تحميل البيانات من API
    setupGUI();
    animate();

    // إضافة مستمع لحدث النقر
    window.addEventListener('click', onMouseClick, false);
}

function loadDebrisData() {
    const apiUrl = 'https://data.nasa.gov/resource/b67r-rgxc.json'; // عنوان API الخاص بالكويكبات
    axios.get(apiUrl)
        .then(response => {
            console.log('API response:', response.data);
            if (response.data && response.data.length > 0) {
                debrisData = response.data;
                createDebris();
                document.getElementById('info').textContent = `Loaded ${debrisData.length} Near-Earth comets`;
            } else {
                throw new Error('No valid data found');
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            document.getElementById('info').textContent = 'An error occurred while loading data. Please try again later.';
        });
}

function createDebris() {
    console.log('Creating debris objects');
    debrisGroup.clear();
    debrisData.forEach(comet => {
        const debris = createDebrisObject(comet);
        debrisGroup.add(debris);
    });
    console.log(`Created ${debrisGroup.children.length} debris objects`);
}

function createDebrisObject(comet) {
    const geometry = new THREE.SphereBufferGeometry(0.01, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: getColorByType(comet.object_name) });
    const debris = new THREE.Mesh(geometry, material);

    // نستخدم موقعًا عشوائيًا حول الأرض
    const radius = 1.1 + Math.random() * 0.5; // بين 1.1 و 1.6 مرة من نصف قطر الأرض
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;

    debris.position.setFromSpherical(new THREE.Spherical(radius, theta, phi));
    debris.userData = comet;

    return debris;
}

function getColorByType(objectName) {
    if (objectName && typeof objectName === 'string') {
        const hash = objectName.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        return new THREE.Color(`hsl(${hash % 360}, 100%, 50%)`);
    }
    return new THREE.Color(0xffffff);
}

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(debrisGroup.children);

    if (intersects.length > 0) {
        const debris = intersects[0].object;
        showDebrisDetails(debris.userData);
    } else {
        hideDebrisDetails();
    }
}

function showDebrisDetails(comet) {
    const detailsElement = document.getElementById('details');
    detailsElement.innerHTML = `
        <h3>Object: ${comet.object || 'unknown'}</h3>
        <p>Epoch (TDB): ${comet.epoch_tdb || 'unavailable'}</p>
        <p>Eccentricity: ${comet.e || 'unavailable'}</p>
        <p>Inclination (degrees): ${comet.i_deg || 'unavailable'}</p>
        <p>Semi-major axis (AU): ${comet.q_au_2 || 'unavailable'}</p>
    `;
    detailsElement.style.display = 'block';
}

function hideDebrisDetails() {
    document.getElementById('details').style.display = 'none';
}

function setupGUI() {
    const gui = new dat.GUI();
    const filters = {
        minAltitude: 0,
        maxAltitude: 100000,
        applyFilters: function () {
            const filteredDebris = debrisData.filter(comet => {
                const altitude = Math.sqrt(
                    Math.pow(comet.q_au_1, 2) +
                    Math.pow(comet.q_au_2, 2)
                ) - 6371; // Subtract Earth's radius
                return altitude >= this.minAltitude && altitude <= this.maxAltitude;
            });
            debrisGroup.clear();
            filteredDebris.forEach(comet => {
                const debris = createDebrisObject(comet);
                debrisGroup.add(debris);
            });
        }
    };

    gui.add(filters, 'minAltitude', 0, 100000).name('Minimum altitude (km)');
    gui.add(filters, 'maxAltitude', 0, 100000).name('Maximum altitude (km)');
    gui.add(filters, 'applyFilters').name('filter application');
}

function animate() {
    requestAnimationFrame(animate);

    earth.rotation.y += 0.001;
    debrisGroup.rotation.y += 0.0005;

    controls.update();
    renderer.render(scene, camera);
}

init();

window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
