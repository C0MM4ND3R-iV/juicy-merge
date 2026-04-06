import { Scene, GameObjects, Scenes, Structs } from 'phaser';
import * as Phaser from 'phaser';

type GameOverData = {
  score?: number;
  best?: number;
  eventId?: string;
  unlocked?: boolean;
  rewardCode?: string;
  rewardThreshold?: number;
  rewardUnlockedThisRun?: boolean;
  rewardPreviouslyUnlocked?: boolean;
};

type RewardState = 'locked' | 'earned' | 'already-unlocked' | 'missing-code';

type SceneButton = Phaser.GameObjects.Container & {
  redraw: (hovered: boolean) => void;
  setLabel: (value: string) => void;
  setEnabled: (enabled: boolean) => void;
  widthPx: number;
  heightPx: number;
  enabled: boolean;
  styleVariant: 'primary' | 'small';
};

const THEME = {
  bgDark: 0x140811,
  bg: 0x210b18,
  panel: 0x321022,
  panelSoft: 0x4b1835,
  accent: 0xff4fa3,
  accentGlow: 0xff84c2,
  accentWarm: 0xffa457,
  text: '#fff4f8',
  textSoft: '#ffd3e3',
  textMuted: '#f2aaca',
  reward: '#ffe7a6',
  success: '#fff0b5',
  danger: '#ffb3ce',
  stroke: '#7d174f',
};

const cssColor = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

const colorValue = (value: number | string) =>
  typeof value === 'number' ? value : Phaser.Display.Color.HexStringToColor(value).color;

export class GameOver extends Scene {
  private camera!: Phaser.Cameras.Scene2D.Camera;

  private backgroundBottom: GameObjects.Rectangle | null = null;
  private backgroundTop: GameObjects.Rectangle | null = null;
  private topGlow: GameObjects.Ellipse | null = null;
  private bottomGlow: GameObjects.Ellipse | null = null;
  private sideGlowLeft: GameObjects.Ellipse | null = null;
  private sideGlowRight: GameObjects.Ellipse | null = null;

  private card: GameObjects.Graphics | null = null;
  private statsPanel: GameObjects.Graphics | null = null;
  private rewardPanel: GameObjects.Graphics | null = null;
  private dividerLine: GameObjects.Graphics | null = null;

  private titleText: GameObjects.Text | null = null;
  private subText: GameObjects.Text | null = null;
  private scoreLabel: GameObjects.Text | null = null;
  private scoreValue: GameObjects.Text | null = null;
  private bestLabel: GameObjects.Text | null = null;
  private bestValue: GameObjects.Text | null = null;
  private rewardLabelText: GameObjects.Text | null = null;
  private rewardValueText: GameObjects.Text | null = null;
  private footerText: GameObjects.Text | null = null;
  private copyStatusText: GameObjects.Text | null = null;
  private restartButton: SceneButton | null = null;
  private menuButton: SceneButton | null = null;
  private copyButton: SceneButton | null = null;

  private score = 0;
  private best = 0;
  private rewardThreshold = 4000;
  private rewardCode = 'uEZRyCAMHS';
  private rewardUnlockedThisRun = false;
  private rewardPreviouslyUnlocked = false;
  private rewardState: RewardState = 'locked';
  private copyResetTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData): void {
    this.score = Math.max(0, Math.floor(data.score ?? 0));
    this.best = Math.max(this.score, Math.floor(data.best ?? this.score));
    this.rewardThreshold = Math.max(1, Math.floor(data.rewardThreshold ?? 5000));
    this.rewardCode = (data.rewardCode ?? 'XYZ').trim();

    const rewardFromScore = this.score >= this.rewardThreshold;
    const rewardFromBest = this.best >= this.rewardThreshold;
    const previousFlag = data.rewardPreviouslyUnlocked ?? data.unlocked ?? false;

    if (typeof data.rewardUnlockedThisRun === 'boolean') {
      this.rewardUnlockedThisRun = data.rewardUnlockedThisRun;
    } else if (rewardFromScore) {
      const likelyAlreadyUnlocked = previousFlag || (this.best > this.score && this.best >= this.rewardThreshold);
      this.rewardUnlockedThisRun = !likelyAlreadyUnlocked;
    } else {
      this.rewardUnlockedThisRun = false;
    }

    this.rewardPreviouslyUnlocked = previousFlag || (rewardFromBest && !this.rewardUnlockedThisRun);

    const rewardAvailable = rewardFromScore || rewardFromBest || this.rewardUnlockedThisRun || this.rewardPreviouslyUnlocked;

    if (!rewardAvailable) {
      this.rewardState = 'locked';
    } else if (!this.rewardCode) {
      this.rewardState = 'missing-code';
    } else if (this.rewardUnlockedThisRun) {
      this.rewardState = 'earned';
    } else {
      this.rewardState = 'already-unlocked';
    }

    this.backgroundBottom = null;
    this.backgroundTop = null;
    this.topGlow = null;
    this.bottomGlow = null;
    this.sideGlowLeft = null;
    this.sideGlowRight = null;
    this.card = null;
    this.statsPanel = null;
    this.rewardPanel = null;
    this.dividerLine = null;
    this.titleText = null;
    this.subText = null;
    this.scoreLabel = null;
    this.scoreValue = null;
    this.bestLabel = null;
    this.bestValue = null;
    this.rewardLabelText = null;
    this.rewardValueText = null;
    this.footerText = null;
    this.copyStatusText = null;
    this.restartButton = null;
    this.menuButton = null;
    this.copyButton = null;
    this.copyResetTimer?.remove(false);
    this.copyResetTimer = null;
  }

  create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(THEME.bgDark);

    this.buildScene();
    this.refreshLayout();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.copyResetTimer?.remove(false);
      this.copyResetTimer = null;
    });

    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start('Game'));
    this.input.keyboard?.once('keydown-C', () => {
      if (this.rewardState !== 'locked' && this.rewardCode) {
        void this.copyRewardCode();
      }
    });
  }

  private buildScene() {
    const { width, height } = this.scale;
    const copyEnabled = this.rewardState !== 'locked' && !!this.rewardCode;
    const view = this.getViewContent();

    this.backgroundBottom = this.add.rectangle(0, 0, width, height, THEME.bgDark).setOrigin(0);
    this.backgroundTop = this.add.rectangle(0, 0, width, height, THEME.bg).setOrigin(0).setAlpha(0.94);
    this.topGlow = this.add.ellipse(0, 0, 460, 250, THEME.accent, 0.13);
    this.bottomGlow = this.add.ellipse(0, 0, 560, 220, THEME.accentWarm, 0.08);
    this.sideGlowLeft = this.add.ellipse(0, 0, 200, height * 0.9, 0x3b1026, 0.22);
    this.sideGlowRight = this.add.ellipse(0, 0, 200, height * 0.9, 0x2c0d3c, 0.18);

    this.card = this.add.graphics();
    this.statsPanel = this.add.graphics();
    this.rewardPanel = this.add.graphics();
    this.dividerLine = this.add.graphics();

    this.titleText = this.add
      .text(0, 0, view.title, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '42px',
        color: view.titleColor,
        stroke: THEME.stroke,
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, cssColor(view.titleGlow), 10, true, true);

    this.subText = this.add
      .text(0, 0, view.sub, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '17px',
        color: THEME.textSoft,
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5);

    this.scoreLabel = this.add
      .text(0, 0, 'Score', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        color: THEME.textMuted,
      })
      .setOrigin(0.5);

    this.scoreValue = this.add
      .text(0, 0, `${this.score}`, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '38px',
        color: THEME.text,
        stroke: THEME.stroke,
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setShadow(0, 0, cssColor(THEME.accent), 8, true, true);

    this.bestLabel = this.add
      .text(0, 0, 'Best', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        color: THEME.textMuted,
      })
      .setOrigin(0.5);

    this.bestValue = this.add
      .text(0, 0, `${this.best}`, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '30px',
        color: this.best >= this.rewardThreshold ? THEME.reward : THEME.textSoft,
        stroke: THEME.stroke,
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.rewardLabelText = this.add
      .text(0, 0, view.rewardLabel, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15px',
        color: THEME.textMuted,
      })
      .setOrigin(0, 0.5);

    this.rewardValueText = this.add
      .text(0, 0, view.rewardValue, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '24px',
        color: view.rewardValueColor,
        stroke: THEME.stroke,
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5);

    this.footerText = this.add
      .text(0, 0, view.footer, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '15px',
        color: view.footerColor,
        align: 'center',
        wordWrap: { width: 360 },
      })
      .setOrigin(0.5)
      .setAlpha(0.96);

    this.copyStatusText = this.add
      .text(0, 0, '', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13px',
        color: THEME.reward,
      })
      .setOrigin(1, 0.5)
      .setAlpha(0);

    this.copyButton = this.makeButton('Copy', 96, 38, () => {
      void this.copyRewardCode();
    }, 18, 'small');
    this.copyButton.setEnabled(copyEnabled);

    this.restartButton = this.makeButton('Restart', 168, 46, () => {
      this.scene.start('Game');
    }, 22, 'primary');

    this.menuButton = this.makeButton('Main Menu', 168, 46, () => {
      this.scene.start('MainMenu');
    }, 22, 'primary');
  }

  private getViewContent() {
    const remaining = Math.max(0, this.rewardThreshold - this.score);

    switch (this.rewardState) {
      case 'earned':
        return {
          title: 'Reward Earned!',
          titleColor: THEME.reward,
          titleGlow: THEME.accentWarm,
          sub: 'Nice score. You unlocked the reward code on this run.',
          footer: 'Copy the code below, then restart for another run or head back to the menu.',
          footerColor: THEME.reward,
          rewardLabel: '🎁 Reward Code',
          rewardValue: this.rewardCode,
          rewardValueColor: THEME.reward,
          rewardPanelStroke: THEME.reward,
        };

      case 'already-unlocked':
        return {
          title: 'Reward Unlocked',
          titleColor: THEME.reward,
          titleGlow: THEME.accentWarm,
          sub: 'The reward was already unlocked, so this run was all about the high score chase.',
          footer: 'The code stays the same. Copy it again, restart for another run, or head back to the menu.',
          footerColor: THEME.textSoft,
          rewardLabel: '🎁 Reward Code',
          rewardValue: this.rewardCode,
          rewardValueColor: THEME.reward,
          rewardPanelStroke: THEME.reward,
        };

      case 'missing-code':
        return {
          title: 'Reward Ready!',
          titleColor: THEME.reward,
          titleGlow: THEME.accentWarm,
          sub: 'You reached the reward score, but no reward code is configured yet.',
          footer: 'Add a code for this build, then restart for another test run or head back to the menu.',
          footerColor: THEME.textSoft,
          rewardLabel: '🎁 Reward Code',
          rewardValue: 'Code missing',
          rewardValueColor: THEME.danger,
          rewardPanelStroke: THEME.accentGlow,
        };

      case 'locked':
      default:
        return {
          title: 'Blend Failed!',
          titleColor: THEME.text,
          titleGlow: THEME.accent,
          sub: 'Your juice mix overflowed before the reward unlocked.',
          footer:
            remaining > 0
              ? `Reach ${this.rewardThreshold} points to unlock the reward code. ${remaining} more to go.`
              : `Reach ${this.rewardThreshold} points to unlock the reward code.`,
          footerColor: THEME.textMuted,
          rewardLabel: '🎁 Reward Unlock',
          rewardValue: `${this.rewardThreshold} points`,
          rewardValueColor: THEME.textSoft,
          rewardPanelStroke: THEME.accentGlow,
        };
    }
  }

  private makeButton(
    label: string,
    width: number,
    height: number,
    onClick: () => void,
    fontSize: number,
    styleVariant: 'primary' | 'small'
  ): SceneButton {
    const bg = this.add.graphics();
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: `${fontSize}px`,
        color: THEME.text,
      })
      .setOrigin(0.5);

    const button = this.add.container(0, 0, [bg, hit, text]) as SceneButton;
    button.widthPx = width;
    button.heightPx = height;
    button.enabled = true;
    button.styleVariant = styleVariant;

    button.setLabel = (value: string) => {
      text.setText(value);
    };

    button.setEnabled = (enabled: boolean) => {
      button.enabled = enabled;
      hit.disableInteractive();
      if (enabled) {
        hit.setInteractive({ useHandCursor: true });
      }
      button.redraw(false);
    };

    button.redraw = (hovered: boolean) => {
      const isSmall = button.styleVariant === 'small';
      const baseColor = isSmall ? 0xff66b7 : 0xff4fa3;
      const hoverColor = isSmall ? 0xff76c0 : 0xff62b2;
      const fill = hovered && button.enabled ? hoverColor : baseColor;
      const outline = isSmall ? colorValue(THEME.reward) : colorValue(THEME.accentGlow);
      const radius = isSmall ? 18 : 22;

      bg.clear();
      bg.fillStyle(fill, button.enabled ? 1 : 0.38);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
      bg.fillStyle(0xffffff, button.enabled ? 0.15 : 0.08);
      bg.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height * 0.38, radius - 4);
      bg.lineStyle(2, outline, button.enabled ? 0.92 : 0.3);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
      bg.lineStyle(1, 0xffffff, button.enabled ? 0.16 : 0.08);
      bg.strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, radius - 5);

      text.setAlpha(button.enabled ? 1 : 0.5);
    };

    hit
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => button.redraw(true))
      .on('pointerout', () => button.redraw(false))
      .on('pointerdown', () => {
        if (!button.enabled) {
          return;
        }

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

    button.redraw(false);
    return button;
  }

  private async copyRewardCode(): Promise<void> {
    if (!this.rewardCode || this.rewardState === 'locked') {
      return;
    }

    let copied = false;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.rewardCode);
        copied = true;
      } else if (typeof document !== 'undefined') {
        const helper = document.createElement('textarea');
        helper.value = this.rewardCode;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.focus();
        helper.select();
        copied = document.execCommand('copy');
        document.body.removeChild(helper);
      }
    } catch {
      copied = false;
    }

    this.showCopyFeedback(copied);
  }

  private showCopyFeedback(copied: boolean): void {
    this.copyResetTimer?.remove(false);

    if (this.copyButton) {
      this.copyButton.setLabel(copied ? 'Copied' : 'Copy');
      this.copyButton.redraw(false);
    }

    this.copyStatusText
      ?.setText(copied ? 'Copied to clipboard' : 'Clipboard unavailable')
      .setColor(copied ? THEME.reward : THEME.danger)
      .setAlpha(1);

    this.copyResetTimer = this.time.delayedCall(1400, () => {
      this.copyButton?.setLabel('Copy');
      this.copyButton?.redraw(false);
      this.copyStatusText?.setAlpha(0).setText('');
      this.copyResetTimer = null;
    });
  }

  private handleResize(_gameSize: Structs.Size) {
    this.refreshLayout();
  }

  private refreshLayout() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const isPortrait = height >= width;
    const view = this.getViewContent();

    const outerPadding = isPortrait ? 14 : 18;
    const cardW = Math.min(width - outerPadding * 2, isPortrait ? 356 : 560);
    const cardH = Math.min(height - outerPadding * 2, isPortrait ? 450 : 372);
    const cardX = cx - cardW / 2;
    const cardY = cy - cardH / 2;

    const titleFont = isPortrait ? (cardW < 340 ? 36 : 40) : 42;
    const subFont = isPortrait ? 15 : 17;
    const scoreFont = isPortrait ? 34 : 38;
    const bestFont = isPortrait ? 26 : 30;
    const rewardValueFont = this.rewardState === 'locked' ? (isPortrait ? 21 : 24) : isPortrait ? 24 : 27;
    const footerFont = isPortrait ? 14 : 15;

    const statsW = cardW - 42;
    const statsH = isPortrait ? 96 : 104;
    const rewardW = cardW - 42;
    const rewardH = isPortrait ? 68 : 72;

    const titleY = cardY + cardH * 0.13;
    const subY = cardY + cardH * 0.24;
    const statsY = cardY + cardH * 0.43;
    const rewardY = cardY + cardH * 0.625;
    const footerY = cardY + cardH * 0.775;
    const buttonY = cardY + cardH * 0.905;

    this.cameras.resize(width, height);

    this.backgroundBottom?.setSize(width, height);
    this.backgroundTop?.setSize(width, height);

    this.topGlow
      ?.setPosition(cx, height * 0.18)
      .setSize(Math.max(320, width * 0.82), isPortrait ? 230 : 260);

    this.bottomGlow
      ?.setPosition(cx, height * 0.86)
      .setSize(Math.max(340, width * 0.88), 210);

    this.sideGlowLeft
      ?.setPosition(width * 0.08, height * 0.54)
      .setSize(Math.max(140, width * 0.18), height * 0.92);

    this.sideGlowRight
      ?.setPosition(width * 0.92, height * 0.5)
      .setSize(Math.max(140, width * 0.18), height * 0.88);

    if (this.card) {
      this.card.clear();
      this.card.fillStyle(THEME.panel, 0.92);
      this.card.fillRoundedRect(cardX, cardY, cardW, cardH, 28);
      this.card.fillStyle(0xffffff, 0.04);
      this.card.fillRoundedRect(cardX + 8, cardY + 8, cardW - 16, Math.max(56, cardH * 0.18), 22);
      this.card.lineStyle(3, colorValue(THEME.accentGlow), 0.24);
      this.card.strokeRoundedRect(cardX, cardY, cardW, cardH, 28);
      this.card.lineStyle(1, 0xffffff, 0.08);
      this.card.strokeRoundedRect(cardX + 8, cardY + 8, cardW - 16, cardH - 16, 22);
    }

    if (this.statsPanel) {
      this.statsPanel.clear();
      this.statsPanel.fillStyle(THEME.panelSoft, 0.96);
      this.statsPanel.fillRoundedRect(cx - statsW / 2, statsY - statsH / 2, statsW, statsH, 22);
      this.statsPanel.fillStyle(0xffffff, 0.03);
      this.statsPanel.fillRoundedRect(cx - statsW / 2 + 6, statsY - statsH / 2 + 6, statsW - 12, statsH * 0.34, 18);
      this.statsPanel.lineStyle(2, colorValue(THEME.accentGlow), 0.24);
      this.statsPanel.strokeRoundedRect(cx - statsW / 2, statsY - statsH / 2, statsW, statsH, 22);
    }

    if (this.dividerLine) {
      this.dividerLine.clear();
      this.dividerLine.lineStyle(2, colorValue(THEME.accentWarm), 0.2);
      this.dividerLine.beginPath();
      this.dividerLine.moveTo(cx, statsY - statsH * 0.28);
      this.dividerLine.lineTo(cx, statsY + statsH * 0.28);
      this.dividerLine.strokePath();
    }

    if (this.rewardPanel) {
      this.rewardPanel.clear();
      this.rewardPanel.fillStyle(THEME.panelSoft, 0.94);
      this.rewardPanel.fillRoundedRect(cx - rewardW / 2, rewardY - rewardH / 2, rewardW, rewardH, 20);
      this.rewardPanel.fillStyle(0xffffff, 0.025);
      this.rewardPanel.fillRoundedRect(cx - rewardW / 2 + 5, rewardY - rewardH / 2 + 5, rewardW - 10, rewardH * 0.34, 16);
      this.rewardPanel.lineStyle(2, colorValue(view.rewardPanelStroke), this.rewardState === 'locked' ? 0.24 : 0.42);
      this.rewardPanel.strokeRoundedRect(cx - rewardW / 2, rewardY - rewardH / 2, rewardW, rewardH, 20);
    }

    const responsiveTitleFont =
      isPortrait
        ? width < 390
          ? '32px'
          : '36px'
    : titleFont;

    this.titleText
      ?.setText(view.title)
      .setPosition(cx, titleY)
      .setFontSize(responsiveTitleFont)
      .setColor(view.titleColor)
      .setShadow(0, 0, cssColor(view.titleGlow), 10, true, true);

    this.subText
      ?.setText(view.sub)
      .setPosition(cx, subY)
      .setFontSize(subFont)
      .setWordWrapWidth(cardW - 52);

    const statsOffsetX = statsW * 0.24;
    this.scoreLabel?.setPosition(cx - statsOffsetX, statsY - statsH * 0.18).setFontSize(isPortrait ? 15 : 16);
    this.scoreValue?.setPosition(cx - statsOffsetX, statsY + statsH * 0.12).setFontSize(scoreFont);
    this.bestLabel?.setPosition(cx + statsOffsetX, statsY - statsH * 0.18).setFontSize(isPortrait ? 15 : 16);
    this.bestValue?.setPosition(cx + statsOffsetX, statsY + statsH * 0.12).setFontSize(bestFont);

    const rewardLeft = cx - rewardW / 2 + 16;
    const copyButtonBaseWidth = 96;
    const copyButtonDesiredWidth = isPortrait ? 86 : 96;
    const copyButtonScale = copyButtonDesiredWidth / copyButtonBaseWidth;
    const copyButtonVisualWidth = copyButtonBaseWidth * copyButtonScale;
    const copyButtonX = cx + rewardW / 2 - copyButtonVisualWidth / 2 - 12;
    const rewardTextWrap = rewardW - copyButtonVisualWidth - 56;

    this.rewardLabelText
      ?.setText(view.rewardLabel)
      .setPosition(rewardLeft, rewardY - rewardH * 0.18)
      .setFontSize(isPortrait ? 14 : 15);

    this.rewardValueText
      ?.setText(view.rewardValue)
      .setPosition(rewardLeft, rewardY + rewardH * 0.12)
      .setFontSize(rewardValueFont)
      .setColor(view.rewardValueColor)
      .setWordWrapWidth(rewardTextWrap);

    this.copyButton
      ?.setPosition(copyButtonX, rewardY + rewardH * 0.08)
      .setScale(copyButtonScale);
    this.copyButton?.setEnabled(this.rewardState !== 'locked' && !!this.rewardCode);

    this.copyStatusText?.setPosition(cx + rewardW / 2 - 14, rewardY + rewardH * 0.43);

    this.footerText
      ?.setText(view.footer)
      .setPosition(cx, footerY)
      .setFontSize(footerFont)
      .setColor(view.footerColor)
      .setWordWrapWidth(cardW - 60);

    const actionGap = isPortrait ? 12 : 16;
    const actionBaseWidth = 168;
    const actionDesiredWidth = Math.min((cardW - 56 - actionGap) / 2, isPortrait ? 136 : 168);
    const actionScale = actionDesiredWidth / actionBaseWidth;
    const actionVisualWidth = actionBaseWidth * actionScale;
    const actionLeftX = cx - actionVisualWidth / 2 - actionGap / 2;
    const actionRightX = cx + actionVisualWidth / 2 + actionGap / 2;

    this.restartButton?.setPosition(actionLeftX, buttonY).setScale(actionScale);
    this.menuButton?.setPosition(actionRightX, buttonY).setScale(actionScale);
  }
}
