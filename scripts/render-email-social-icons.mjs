import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const dir = path.join(process.cwd(), 'public', 'email');
const size = 72;
const iconSize = 34;
const names = ['instagram', 'linkedin', 'facebook'];

for (const name of names) {
  let svg = fs.readFileSync(path.join(dir, `${name}.svg`), 'utf8');
  svg = svg
    .replace(/fill="[^"]*"/g, 'fill="#ffffff"')
    .replace('<svg', '<svg fill="#ffffff"');

  const icon = await sharp(Buffer.from(svg)).resize(iconSize, iconSize).png().toBuffer();

  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#08304c"/></svg>`
  );

  await sharp(circle)
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(path.join(dir, `${name}.png`));

  console.log(`wrote ${name}.png`);
}
