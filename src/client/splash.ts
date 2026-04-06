import { requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;
const titleElement = document.getElementById('title') as HTMLHeadingElement;
const subtitleElement = document.getElementById('subtitle') as HTMLParagraphElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

function init() {
  titleElement.textContent = 'Juicy Merge';
  subtitleElement.textContent =
    'Merge matching fruits inside the glass, build bigger blends, and hit 4000 points to unlock the juicy reward.';

  startButton.textContent = 'Start Game';
}

init();