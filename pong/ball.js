console.log('ball.js is working');
export class Ball {
  constructor(x, y, radius, speed) {
    this.radius = radius;
    this.position = {
      x: x,
      y: y
    };
    this.velocity = {
      x: speed.x,
      y: speed.y
    };
  }
}