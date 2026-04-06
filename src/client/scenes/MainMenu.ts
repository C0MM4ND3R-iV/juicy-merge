import { Scene, GameObjects, Scenes, Structs } from 'phaser';
import { THEME, colorValue, cssColor } from '../theme';

type MenuButton = Phaser.GameObjects.Container & {
  redraw: (hovered: boolean) => void;
  widthPx: number;
  heightPx: number;
};

export class MainMenu extends Scene {
  private backgroundBottom: GameObjects.Rectangle | null = null;
  private backgroundTop: GameObjects.Rectangle | null = null;
  private topGlow: GameObjects.Ellipse | null = null;
  private bottomGlow: GameObjects.Ellipse | null = null;
  private sideGlowLeft: GameObjects.Ellipse | null = null;
  private sideGlowRight: GameObjects.Ellipse | null = null;
  private card: GameObjects.Graphics | null = null;
  private logo: GameObjects.Image | null = null;
  private title: GameObjects.Text | null = null;
  private subtitle: GameObjects.Text | null = null;
  private sparkleRow: GameObjects.Text | null = null;
  private startButton: MenuButton | null = null;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.backgroundBottom = null;
    this.backgroundTop = null;
    this.topGlow = null;
    this.bottomGlow = null;
    this.sideGlowLeft = null;
    this.sideGlowRight = null;
    this.card = null;
    this.logo = null;
    this.title = null;
    this.subtitle = null;
    this.sparkleRow = null;
    this.startButton = null;
  }

  create() {
    this.buildScene();
    this.refreshLayout();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
  }

  private buildScene() {
    const { width, height } = this.scale;

    this.backgroundBottom = this.add.rectangle(0, 0, width, height, THEME.bgDark).setOrigin(0);
    this.backgroundTop = this.add.rectangle(0, 0, width, height, THEME.bg).setOrigin(0).setAlpha(0.92);

    this.topGlow = this.add.ellipse(0, 0, 420, 260, THEME.accent, 0.12);
    this.bottomGlow = this.add.ellipse(0, 0, 540, 220, THEME.accentWarm, 0.08);
    this.sideGlowLeft = this.add.ellipse(0, 0, 220, height * 0.92, THEME.berry, 0.28);
    this.sideGlowRight = this.add.ellipse(0, 0, 220, height * 0.92, 0x2c0d3c, 0.26);

    this.card = this.add.graphics();

    this.logo = this.add.image(0, 0, 'logo_menu');

    this.title = this.add
      .text(0, 0, 'Drop, merge, and chase the reward.', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '28px',
        color: THEME.text,
        stroke: THEME.stroke,
        strokeThickness: 5,
        align: 'center',
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setShadow(0, 0, cssColor(THEME.accent), 8, true, true);

    this.subtitle = this.add
      .text(0, 0, 'Merge fruits inside the glass, build your score, and reach 4000 points to unlock the reward.', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '18px',
        color: THEME.textSoft,
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5);

    this.sparkleRow = this.add
      .text(0, 0, '🍒   🍓   🍊   🍑', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '26px',
        color: THEME.textMuted,
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    this.startButton = this.makeButton('Start Mixing', () => {
      this.scene.start('Game');
    });
  }

  private makeButton(label: string, onClick: () => void): MenuButton {
    const width = 250;
    const height = 68;
    const bg = this.add.graphics();
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '26px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const button = this.add.container(0, 0, [bg, hit, text]) as MenuButton;
    button.widthPx = width;
    button.heightPx = height;

    button.redraw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0xff62b2 : 0xff4fa3, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 28);
      bg.fillStyle(hovered ? 0xff8bc9 : 0xff7fc0, 0.22);
      bg.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height * 0.42, 24);
      bg.lineStyle(3, colorValue(THEME.accentGlow), 0.95);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 28);
      bg.lineStyle(2, colorValue('#ffffff'), 0.18);
      bg.strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 24);
    };

    button.redraw(false);

    hit.setInteractive({ useHandCursor: true })
      .on('pointerover', () => button.redraw(true))
      .on('pointerout', () => button.redraw(false))
      .on('pointerdown', () => {
        this.tweens.add({
          targets: button,
          scaleX: 0.97,
          scaleY: 0.97,
          yoyo: true,
          duration: 90,
          ease: 'Quad.easeOut',
        });
        onClick();
      });

    this.tweens.add({
      targets: button,
      y: '+=4',
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return button;
  }

  private handleResize(_gameSize: Structs.Size) {
    this.refreshLayout();
  }

  private refreshLayout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    const isPortrait = height >= width;
    const cardW = Math.min(width - 28, isPortrait ? 360 : 560);
    const cardH = Math.min(height - 34, isPortrait ? 468 : 400);
    const cx = width / 2;
    const cy = height / 2;
    const logoSize = isPortrait ? Math.min(cardW * 0.74, 235) : Math.min(cardW * 0.42, 225);

    this.backgroundBottom?.setSize(width, height);
    this.backgroundTop?.setSize(width, height);

    this.topGlow
      ?.setPosition(width * 0.5, height * 0.17)
      .setSize(Math.max(340, width * 0.8), isPortrait ? 250 : 300);

    this.bottomGlow
      ?.setPosition(width * 0.52, height * 0.84)
      .setSize(Math.max(360, width * 0.9), 220);

    this.sideGlowLeft
      ?.setPosition(width * 0.08, height * 0.52)
      .setSize(Math.max(160, width * 0.22), height * 0.92);

    this.sideGlowRight
      ?.setPosition(width * 0.92, height * 0.5)
      .setSize(Math.max(160, width * 0.22), height * 0.88);

    if (this.card) {
      this.card.clear();
      this.card.fillStyle(THEME.panel, 0.88);
      this.card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 32);
      this.card.fillStyle(0xffffff, 0.03);
      this.card.fillRoundedRect(cx - cardW / 2 + 8, cy - cardH / 2 + 8, cardW - 16, cardH * 0.3, 28);
      this.card.lineStyle(3, colorValue(THEME.accentGlow), 0.22);
      this.card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 32);
      this.card.lineStyle(1, 0xffffff, 0.09);
      this.card.strokeRoundedRect(cx - cardW / 2 + 9, cy - cardH / 2 + 9, cardW - 18, cardH - 18, 26);
    }

    this.logo
      ?.setPosition(cx, cy - cardH * (isPortrait ? 0.3 : 0.28))
      .setDisplaySize(logoSize, logoSize);

    this.title
      ?.setPosition(cx, cy + cardH * (isPortrait ? -0.10 : -0.07))
      .setWordWrapWidth(cardW - 52)
      .setFontSize(isPortrait ? '27px' : '30px');

    this.subtitle
      ?.setPosition(cx, cy + cardH * (isPortrait ? 0.07 : 0.10))
      .setWordWrapWidth(cardW - 56)
      .setFontSize(isPortrait ? '16px' : '18px');

    this.sparkleRow
      ?.setPosition(cx, cy + cardH * (isPortrait ? 0.19 : 0.19))
      .setFontSize(isPortrait ? '23px' : '25px');

    if (this.startButton) {
      const buttonScale = isPortrait ? Math.min(0.96, cardW / 320) : Math.min(0.96, cardW / 460);
      this.startButton.setPosition(cx, cy + cardH * (isPortrait ? 0.34 : 0.35));
      this.startButton.setScale(buttonScale);
    }
  }
}