const fs = require('fs');
const sharp = require('sharp');

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  // Generate extension icons
  const iconBuffer = fs.readFileSync('icon.svg');
  
  for (const size of sizes) {
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(`icon${size}.png`);
    
    console.log(`Generated ${size}x${size} icon`);
  }

  // Generate promotional tile
  const promoBuffer = fs.readFileSync('promo_tile.svg');
  await sharp(promoBuffer)
    .resize(440, 280)
    .png()
    .toFile('promo_tile.png');
  
  console.log('Generated promotional tile');
}

generateIcons().catch(console.error); 