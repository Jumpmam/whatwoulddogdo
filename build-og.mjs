import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const dogB64 = readFileSync('./assets/dog.png').toString('base64');

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0a0a08"/>
  <rect width="1200" height="630" fill="url(#vg)"/>
  <radialGradient id="vg" cx="50%" cy="35%" r="75%">
    <stop offset="0%" stop-color="#141410"/>
    <stop offset="100%" stop-color="#050504"/>
  </radialGradient>

  <text x="60" y="110" font-family="Familjen Grotesk" font-weight="700" font-size="52" fill="#d8f000">what would</text>
  <text x="60" y="172" font-family="Familjen Grotesk" font-weight="700" font-size="52" fill="#d8f000">dog do</text>

  <text x="60" y="240" font-family="Azeret Mono" font-size="22" fill="#8e8e86">a camera on a padded cell.</text>
  <text x="60" y="272" font-family="Azeret Mono" font-size="22" fill="#8e8e86">he does something at nothing every few seconds.</text>

  <rect x="60" y="330" width="300" height="64" fill="none" stroke="#8e8e8659" stroke-width="1"/>
  <text x="80" y="371" font-family="Azeret Mono" font-weight="700" font-size="22" fill="#d8f000">$WHAT</text>

  <rect x="60" y="418" width="220" height="58" fill="#d8f000"/>
  <text x="170" y="455" font-family="Familjen Grotesk" font-weight="700" font-size="18" letter-spacing="3" fill="#0a0a08" text-anchor="middle">ASK</text>

  <image href="data:image/png;base64,${dogB64}" x="800" y="70" width="340" height="608" preserveAspectRatio="xMidYMax meet"/>
</svg>
`;

const resvg = new Resvg(svg, {
  font: {
    fontFiles: ['./.build-fonts/AzeretMono-Bold.ttf', './.build-fonts/AzeretMono-Regular.ttf', './.build-fonts/FamiljenGrotesk-Bold.ttf'],
    loadSystemFonts: false,
    defaultFontFamily: 'Azeret Mono'
  },
  background: '#0a0a08'
});

const png = resvg.render().asPng();
writeFileSync('./assets/og.png', png);
console.log('og.png written', png.length, 'bytes');
