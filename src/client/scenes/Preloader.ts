import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { THEME, colorValue } from '../theme';

export class Preloader extends Scene {
  private progressRing!: Phaser.GameObjects.Graphics;
  private progressRingBg!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Graphics;
  private shine!: Phaser.GameObjects.Ellipse;

  constructor() {
    super('Preloader');
  }

  preload() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(THEME.bgDark);

    this.add.rectangle(0, 0, width, height, THEME.bgDark).setOrigin(0);
    this.add.ellipse(width * 0.28, height * 0.18, width * 0.72, 240, 0xff4fa3, 0.12);
    this.add.ellipse(width * 0.76, height * 0.78, width * 0.68, 220, 0xff9c5f, 0.08);
    this.add.ellipse(width * 0.5, height * 0.58, width * 1.05, height * 0.85, THEME.bg, 0.7);

    const cx = width / 2;
    const cy = height / 2;
    const ringRadius = Math.max(42, Math.min(width, height) * 0.08);
    const panelW = Math.min(width - 32, 360);
    const panelH = Math.min(height - 48, 320);

    this.panel = this.add.graphics();
    this.panel.fillStyle(THEME.panel, 0.92);
    this.panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 28);
    this.panel.lineStyle(3, colorValue(THEME.accentGlow), 0.22);
    this.panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 28);
    this.panel.lineStyle(1, 0xffffff, 0.08);
    this.panel.strokeRoundedRect(cx - panelW / 2 + 8, cy - panelH / 2 + 8, panelW - 16, panelH - 16, 22);

    this.shine = this.add.ellipse(cx, cy - panelH * 0.3, panelW * 0.72, 84, 0xffffff, 0.05);

    this.add
      .text(cx, cy - panelH * 0.33, 'Juicy Merge', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: `${Math.round(Math.max(22, panelW * 0.088))}px`,
        color: THEME.text,
        stroke: THEME.stroke,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, THEME.accent, 10, true, true);

    this.add
      .text(cx, cy - panelH * 0.2, 'Loading the blender...', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.round(Math.max(13, panelW * 0.04))}px`,
        color: THEME.textMuted,
      })
      .setOrigin(0.5);

    this.progressRingBg = this.add.graphics();
    this.progressRing = this.add.graphics();

    this.progressText = this.add
      .text(cx, cy + 2, '0%', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: `${Math.round(ringRadius * 0.62)}px`,
        color: THEME.text,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cx, cy + ringRadius * 1.9, 'Preparing juicy assets...', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${Math.round(Math.max(13, ringRadius * 0.28))}px`,
        color: THEME.textSoft,
      })
      .setOrigin(0.5)
      .setAlpha(0.95);

    const drawProgress = (progress: number) => {
      this.progressRingBg.clear();
      this.progressRing.clear();

      this.progressRingBg.lineStyle(10, 0xffffff, 0.09);
      this.progressRingBg.beginPath();
      this.progressRingBg.arc(
        cx,
        cy,
        ringRadius,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(270),
        false
      );
      this.progressRingBg.strokePath();

      this.progressRing.lineStyle(10, THEME.accent, 1);
      this.progressRing.beginPath();
      this.progressRing.arc(
        cx,
        cy,
        ringRadius,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * progress),
        false
      );
      this.progressRing.strokePath();

      this.progressText.setText(`${Math.round(progress * 100)}%`);
    };

    drawProgress(0);

    this.load.on('progress', (progress: number) => {
      drawProgress(progress);
    });

    this.load.on('complete', () => {
      this.statusText.setText('Ready');
      this.tweens.add({
        targets: [this.panel, this.shine, this.progressRing, this.progressRingBg, this.progressText, this.statusText],
        alpha: { from: 1, to: 0 },
        duration: 280,
        ease: 'Sine.easeInOut',
      });
    });

    this.load.setPath('../assets');
    this.load.image('logo_menu', 'logo_menu.png');
    this.load.image('glass_half', 'glass_half.png');

    this.load.image(`fruits_Blueberry`, `fruits/blueberry.png`);
    this.load.image(`fruits_Strawberry`, `fruits/strawberry.png`);
    this.load.image(`fruits_Orange`, `fruits/orange.png`);
    this.load.image(`fruits_Apple`, `fruits/apple.png`);
    this.load.image(`fruits_Pear`, `fruits/pear.png`);
    this.load.image(`fruits_Peach`, `fruits/peach.png`);
    this.load.image(`fruits_Melon`, `fruits/melon.png`);
    this.load.image(`fruits_Watermelon`, `fruits/watermelon.png`);

    this.load.audio('sfx_merge', 'sfx/merge.wav');
    this.load.audio('sfx_drop', 'sfx/drop.wav');
    this.load.audio('sfx_gameover', 'sfx/game_over.wav');
    this.load.audio('music_bgm', 'sfx/bgm.mp3');
  }

  create() {
    this.scene.start('MainMenu');
  }
}
