import { Scene } from 'phaser';
import { THEME } from '../theme';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Boot bleibt bewusst leichtgewichtig.
  }

  create() {
    this.cameras.main.setBackgroundColor(THEME.bgDark);
    this.scene.start('Preloader');
  }
}
