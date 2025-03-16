import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true; // Enable shadow maps in the renderer
document.body.appendChild( renderer.domElement );

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft warm sunset light
scene.add(ambientLight);

for (let i = -1; i <= 1; i += 2) {
    var light = new THREE.PointLight(0xffffff, 25, 100);
    light.position.set(i * 10, 1, 2.5);
    light.shadow.radius = 1; // Soften the shadow

    light.castShadow = true; // Enable shadows for the light
    scene.add(light);
0
}


// Create the field
const fieldGeometry = new THREE.PlaneGeometry( 10, 5 );
const fieldMaterial = new THREE.MeshStandardMaterial( { color: 0x00cd00, side: THREE.DoubleSide } );
const field = new THREE.Mesh( fieldGeometry, fieldMaterial );
field.receiveShadow = true; // Enable shadows for the field
scene.add( field );

// Create the walls
const wallGeometry = new THREE.BoxGeometry( 10, 0.1, 1 );
const wallMaterial = new THREE.MeshStandardMaterial( { color: 0xffffff } );

const upperWall = new THREE.Mesh( wallGeometry, wallMaterial );
upperWall.position.y = 2.5;
upperWall.castShadow = true; // Enable shadows for the wall
upperWall.receiveShadow = true; // Enable shadows for the wall
scene.add( upperWall );

const lowerWall = new THREE.Mesh( wallGeometry, wallMaterial );
lowerWall.position.y = -2.5;
lowerWall.castShadow = true; // Enable shadows for the wall
lowerWall.receiveShadow = true; // Enable shadows for the wall	
scene.add( lowerWall );

// Create paddles
const paddleGeometry = new THREE.BoxGeometry( 0.2, 1, 1 );
const paddleMaterial = new THREE.MeshStandardMaterial( { color: 0x555555 } );

const leftPaddle = new THREE.Mesh( paddleGeometry, paddleMaterial );
leftPaddle.position.set(-4.5, 0, 0);
leftPaddle.castShadow = true; // Enable shadows for the paddle
scene.add( leftPaddle );

const rightPaddle = new THREE.Mesh( paddleGeometry, paddleMaterial );
rightPaddle.position.x = 4.5;
rightPaddle.castShadow = true; // Enable shadows for the paddle
scene.add( rightPaddle );

const material = new THREE.LineBasicMaterial({ color: 0xffffff });
const points = [];

points.push( new THREE.Vector3( 0, -2.5, -0 ) );
points.push( new THREE.Vector3( 0, 2.5, 0 ) );

const geometry = new THREE.BufferGeometry().setFromPoints( points );
const middleLine = new THREE.Line(geometry, material);
scene.add( middleLine );

const middleCircle = new THREE.CircleGeometry( 0.05 );
const circleMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff } );
const circle = new THREE.Mesh( middleCircle, circleMaterial );
circle.position.set(0, 0, 0);
scene.add( circle );

const middleRing = new THREE.RingGeometry( 0.5, 0.51, 32 );
const ringMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, side: THREE.DoubleSide } );
const ring = new THREE.Mesh( middleRing, ringMaterial );
ring.position.set(0, 0, 0);
scene.add( ring );

const rightGoal = new THREE.LineBasicMaterial({ color: 0xffffff });
const rightGoalPoints = [];
rightGoalPoints.push( new THREE.Vector3( 5, -2.5, -0 ) );
rightGoalPoints.push( new THREE.Vector3( 5, -1.5, 0 ) );
rightGoalPoints.push( new THREE.Vector3( 3.6, -1.5, 0 ) );
rightGoalPoints.push( new THREE.Vector3( 3.6, 1.5, 0 ) );
rightGoalPoints.push( new THREE.Vector3( 5, 1.5, 0 ) );
rightGoalPoints.push( new THREE.Vector3( 5, 2.5, 0 ) );
rightGoalPoints.push( new THREE.Vector3( 5, 2.5, 0 ) );
const rightGoalGeometry = new THREE.BufferGeometry().setFromPoints( rightGoalPoints );
const rightGoalLine = new THREE.Line(rightGoalGeometry, rightGoal);
scene.add( rightGoalLine );

const leftGoal = new THREE.LineBasicMaterial({ color: 0xffffff });
const leftGoalPoints = [];
leftGoalPoints.push( new THREE.Vector3( -5, -2.5, -0 ) );
leftGoalPoints.push( new THREE.Vector3( -5, -1.5, 0 ) );
leftGoalPoints.push( new THREE.Vector3( -3.6, -1.5, 0 ) );
leftGoalPoints.push( new THREE.Vector3( -3.6, 1.5, 0 ) );
leftGoalPoints.push( new THREE.Vector3( -5, 1.5, 0 ) );
leftGoalPoints.push( new THREE.Vector3( -5, 2.5, 0 ) );
leftGoalPoints.push( new THREE.Vector3( -5, 2.5, 0 ) );
const leftGoalGeometry = new THREE.BufferGeometry().setFromPoints( leftGoalPoints );
const leftGoalLine = new THREE.Line(leftGoalGeometry, leftGoal);
scene.add( leftGoalLine );

// Create the ball
const ballGeometry = new THREE.SphereGeometry( 0.2, 32, 32 );
const ballMaterial = new THREE.MeshStandardMaterial( { color: 0xdedede } );
const ball = new THREE.Mesh( ballGeometry, ballMaterial );
ball.castShadow = true; // Enable shadows for the ball
scene.add( ball );

let ballSpeed = new THREE.Vector3(0.01, 0.01, 0); // Initial ball speed

// Handle user inputs
const keys = {};
window.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});

function resetBall() {
    ball.position.set(0, 0, 0.1);
    ballSpeed.set(0, 0, 0);
    setTimeout(() => {
        ballSpeed.set(0.01, 0.01, 0); // Release the ball after 3 seconds
    }, 3000);
}

function animate() {
    requestAnimationFrame( animate );

    // Move paddles
    if (keys['w'] && leftPaddle.position.y < 2.0) leftPaddle.position.y += 0.1;
    if (keys['s'] && leftPaddle.position.y > -2.0) leftPaddle.position.y -= 0.1;
    if (keys['ArrowUp'] && rightPaddle.position.y < 2.0) rightPaddle.position.y += 0.1;
    if (keys['ArrowDown'] && rightPaddle.position.y > -2.0) rightPaddle.position.y -= 0.1;

    // Move ball
    ball.position.add(ballSpeed);

    // Ball collision with walls
    if (ball.position.y >= 2.3 || ball.position.y <= -2.3) {
        ballSpeed.y = -ballSpeed.y;
    }

    // Ball collision with paddles
    if (ball.position.x <= leftPaddle.position.x + 0.2 && ball.position.y <= leftPaddle.position.y + 0.5 && ball.position.y >= leftPaddle.position.y - 0.5) {
        ballSpeed.x = -ballSpeed.x;
    }
    if (ball.position.x >= rightPaddle.position.x - 0.2 && ball.position.y <= rightPaddle.position.y + 0.5 && ball.position.y >= rightPaddle.position.y - 0.5) {
        ballSpeed.x = -ballSpeed.x;
    }

    // Ball leaves the field
    if (ball.position.x >= 6 || ball.position.x <= -6) {
        resetBall();
    }

    renderer.render( scene, camera );
}

// Set camera to an isometric view
camera.position.set(0, -2.5, 5); // Adjust these values as needed
camera.lookAt(0, 0, 0);

resetBall();
animate();