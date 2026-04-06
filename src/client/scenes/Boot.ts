import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Boot bleibt bewusst leichtgewichtig.
  }

  create() {
    this.cameras.main.setBackgroundColor(0x140811);

    this.registry.set('theme', {
      bgDark: 0x140811,
      bg: 0x210b18,
      panel: 0x321022,
      panelSoft: 0x4a1733,
      accent: 0xff4fa3,
      accentGlow: 0xff84c2,
      accentWarm: 0xffa457,
      text: '#fff4f8',
      textSoft: '#ffd3e3',
      textMuted: '#f3aac6',
      stroke: '#7c174f',
    });

    this.scene.start('Preloader');
  }
}
