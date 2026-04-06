import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#140811',
  banner: false,
  transparent: false,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },

  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },

  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false,
    },
  },

  fps: {
    target: 60,
  },

  scene: [Boot, Preloader, MainMenu, MainGame, GameOver],
};

const startGame = (parent: string) => new Game({ ...config, parent });

document.addEventListener('DOMContentLoaded', () => {
  startGame('game-container');
});
