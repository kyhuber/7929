/* Generates PWA icons from an inline SVG. Run: node scripts/icons.mjs */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Sage field, antique-white house, "7929" — palette from the house itself.
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#8A9A7B"/>
  <g transform="translate(256 236) scale(${1 - pad}) translate(-256 -236)">
    <!-- roof -->
    <path d="M116 236 L256 116 L396 236 Z" fill="#EAE0CF"/>
    <!-- body -->
    <rect x="146" y="236" width="220" height="130" fill="#EAE0CF"/>
    <!-- door -->
    <rect x="232" y="288" width="48" height="78" rx="4" fill="#8A9A7B"/>
  </g>
  <text x="256" y="448" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-size="72"
    font-weight="600" fill="#EAE0CF">7929</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });

const jobs = [
  { file: "public/icons/icon-192.png", size: 192, pad: 0 },
  { file: "public/icons/icon-512.png", size: 512, pad: 0 },
  // maskable: keep art inside the 80% safe zone
  { file: "public/icons/icon-512-maskable.png", size: 512, pad: 0.18 },
  { file: "public/apple-touch-icon.png", size: 180, pad: 0 },
];

for (const { file, size, pad } of jobs) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
