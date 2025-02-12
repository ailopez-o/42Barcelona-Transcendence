console.log('paddle.js is working');

export class Paddle {
  constructor(x, y, width, height, speed) {
    this.width = width;
    this.height = height;
    this.position = {
      x: x,
      y: y
    };
    this.velocity = {
      y: 0
    };
    this.maxSpeed = speed;
  }
}