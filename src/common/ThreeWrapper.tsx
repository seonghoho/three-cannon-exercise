import * as CANNON from 'cannon-es';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

const ThreeWrapper = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [physicsWorld, setPhysicsWorld] = useState<CANNON.World | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    setPhysicsWorld(world);
  }, []);

  useEffect(() => {
    if (!physicsWorld) return;
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x87ceeb);
    setScene(newScene);
  }, [physicsWorld]);

  useEffect(() => {
    if (!scene || !physicsWorld || !mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 🎥 카메라 설정
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
    camera.position.set(0, 3, 8);
    cameraRef.current = camera;

    // 🖼️ 렌더러 설정
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 🏞️ OrbitControls 추가
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 부드러운 감속 효과
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controlsRef.current = controls;

    // 💡 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // 🟩 바닥 추가
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x008000 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const groundMaterial = new CANNON.Material('ground');

    const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: groundMaterial,
    });
    // rotate ground body by 90 degrees
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    physicsWorld.addBody(floorBody);

    // // 🔴 박스 추가
    // const geometry = new THREE.BoxGeometry(1, 1, 1);
    // const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    // const cube = new THREE.Mesh(geometry, material);
    // cube.castShadow = true;
    // scene.add(cube);

    // const body = new CANNON.Body({
    //   mass: 1,
    //   shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
    // });
    // physicsWorld.addBody(body);

    ///////////////////////////////////////////////

    // 차량 차체 생성
    const chassisShape = new CANNON.Box(new CANNON.Vec3(2, 0.5, 1));
    const chassisBody = new CANNON.Body({ mass: 1200 });
    chassisBody.addShape(chassisShape);
    // 처음 생성되는 위치 (여기서 떨어짐)
    chassisBody.position.set(0, 5, 0);
    // physicsWorld.addBody(chassisBody);

    // Three.js 차체
    const chassisGeometry = new THREE.BoxGeometry(4, 1, 2);
    const chassisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
    scene.add(chassisMesh);

    // Raycast 차량 설정
    const vehicle = new CANNON.RaycastVehicle({ chassisBody });

    const wheelOptions = {
      radius: 0.5,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 25,
      suspensionRestLength: 0.2,
      frictionSlip: 1.4,
      dampingRelaxation: 2.0,
      dampingCompression: 4.0,
      maxSuspensionForce: 10000,
      rollInfluence: 0.01, // 낮으면 회전 시 지면과의 마찰을 충분히 반영 못함
      axleLocal: new CANNON.Vec3(0, 0, 1),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const wheelMeshes: THREE.Mesh[] = [];
    const wheelPositions = [
      new CANNON.Vec3(-1.2, -0.3, 0.8), // 왼쪽 앞
      new CANNON.Vec3(-1.2, -0.3, -0.8), // 왼쪽 뒤
      new CANNON.Vec3(1.2, -0.3, 0.8), // 오른쪽 앞
      new CANNON.Vec3(1.2, -0.3, -0.8), // 오른쪽 뒤
    ];

    // Add wheels
    wheelPositions.forEach((pos) => {
      wheelOptions.chassisConnectionPointLocal = pos;
      vehicle.addWheel(wheelOptions);
      // Create wheel meshes
      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 100);
      const wheelMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      scene.add(wheelMesh);

      // wheelMesh.rotation.x = Math.PI / 2; // X축 기준 회전
      // wheelMesh.rotateZ(Math.PI / 2);
      wheelMeshes.push(wheelMesh);
    });

    vehicle.addToWorld(physicsWorld);

    // Wheel bodies
    const wheelBodies: CANNON.Body[] = [];
    const wheelMaterial = new CANNON.Material('wheel');
    for (let i = 0; i < 4; i++) {
      const cylinderShape = new CANNON.Cylinder(0.4, 0.4, 0.5, 100);
      const wheelBody = new CANNON.Body({
        mass: 10,
        material: wheelMaterial,
      });
      wheelBody.type = CANNON.Body.DYNAMIC;
      wheelBody.collisionFilterGroup = 0; // turn off collisions

      const quaternion = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0);

      wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion);
      wheelBodies.push(wheelBody);
      physicsWorld.addBody(wheelBody);
    }

    // Synchronize wheel positions with Three.js
    physicsWorld.addEventListener('postStep', () => {
      for (let i = 0; i < vehicle.wheelInfos.length; i++) {
        vehicle.updateWheelTransform(i);
        const transform = vehicle.wheelInfos[i].worldTransform;
        const wheelBody = wheelBodies[i];
        // 🚨 Cannon 바퀴 좌표 복사
        wheelBody.position.copy(transform.position);
        wheelBody.quaternion.copy(transform.quaternion);
        // console.log(wheelBody.quaternion);
        // console.log(wheelMeshes[i].quaternion);
        // const quat = new CANNON.Quaternion().copy(wheelBody.quaternion);

        // CANNON.Quaternion → THREE.Quaternion 변환
        wheelMeshes[i].quaternion.set(
          transform.quaternion.x,
          transform.quaternion.y,
          transform.quaternion.z,
          transform.quaternion.w,
        );
        // 추가 회전 보정 (-Math.PI / 2만큼 회전)
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); // Z축 기준 90도 회전
        wheelMeshes[i].quaternion.multiply(quaternion);

        wheelMeshes[i].position.copy(wheelBodies[i].position);
        // wheelMeshes[i].position.copy(wheelBody.position);
        // wheelMeshes[i].quaternion.copy(wheelBody.quaternion);
      }
    });

    // Define interactions between wheels and ground
    const wheel_ground = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
      friction: 0.7, //도로 마찰력
      restitution: 0.1, // 반발력
      contactEquationStiffness: 100000,
      // contactEquationRelaxation: 3,
    });
    physicsWorld.addContactMaterial(wheel_ground);

    // 🎬 애니메이션 루프
    const animate = () => {
      requestAnimationFrame(animate);
      physicsWorld.step(1 / 60);
      // cube.position.set(body.position.x, body.position.y, body.position.z);

      chassisMesh.position.copy(chassisBody.position);
      chassisMesh.quaternion.copy(chassisBody.quaternion);

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Keybindings
    // Add force on keydown
    document.addEventListener('keydown', (event) => {
      const maxSteerVal = 0.5;
      const maxForce = 1000;
      const brakeForce = 1000000;

      switch (event.key) {
        case 'w':
        case 'ArrowUp':
          vehicle.applyEngineForce(-maxForce, 2);
          vehicle.applyEngineForce(-maxForce, 3);
          break;

        case 's':
        case 'ArrowDown':
          vehicle.applyEngineForce(maxForce, 2);
          vehicle.applyEngineForce(maxForce, 3);
          break;

        case 'a':
        case 'ArrowLeft':
          vehicle.setSteeringValue(maxSteerVal, 0);
          vehicle.setSteeringValue(maxSteerVal, 1);
          break;

        case 'd':
        case 'ArrowRight':
          vehicle.setSteeringValue(-maxSteerVal, 0);
          vehicle.setSteeringValue(-maxSteerVal, 1);
          break;

        case 'b':
          vehicle.setBrake(brakeForce, 0);
          vehicle.setBrake(brakeForce, 1);
          vehicle.setBrake(brakeForce, 2);
          vehicle.setBrake(brakeForce, 3);
          break;
      }
    });

    // Reset force on keyup
    document.addEventListener('keyup', (event) => {
      switch (event.key) {
        case 'w':
        case 'ArrowUp':
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          break;

        case 's':
        case 'ArrowDown':
          vehicle.applyEngineForce(0, 2);
          vehicle.applyEngineForce(0, 3);
          break;

        case 'a':
        case 'ArrowLeft':
          vehicle.setSteeringValue(0, 0);
          vehicle.setSteeringValue(0, 1);
          break;

        case 'd':
        case 'ArrowRight':
          vehicle.setSteeringValue(0, 0);
          vehicle.setSteeringValue(0, 1);
          break;

        case 'b':
          vehicle.setBrake(0, 0);
          vehicle.setBrake(0, 1);
          vehicle.setBrake(0, 2);
          vehicle.setBrake(0, 3);
          break;
      }
    });

    // 📏 화면 크기 조절 이벤트
    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      rendererRef.current.setSize(newWidth, newHeight);
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [scene, physicsWorld]);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }}></div>;
};

export default ThreeWrapper;
