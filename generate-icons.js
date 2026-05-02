const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "public");
const bg = "#1A1A1A";
const fg = "#EF9F27";

function svgForSize(size) {
  const fontSize = Math.round(size * 0.22);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text
    x="50%"
    y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    fill="${fg}"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    letter-spacing="0.02em"
  >FUELED</text>
</svg>`.trim();
}

async function writeIcon(size, filename) {
  const out = path.join(publicDir, filename);
  await sharp(Buffer.from(svgForSize(size)))
    .png()
    .toFile(out);
  console.log(`Wrote ${filename}`);
}

async function main() {
  await writeIcon(192, "icon-192.png");
  await writeIcon(512, "icon-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
