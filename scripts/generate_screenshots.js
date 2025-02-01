const fs = require('fs');
const sharp = require('sharp');

async function generateScreenshots() {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync('./icons/screenshot_examples.svg');
    
    // Generate screenshot with exact dimensions (1280x800)
    await sharp(svgBuffer)
      .resize(1280, 800, {
        fit: 'contain',
        background: { r: 248, g: 249, b: 250 } // #f8f9fa background
      })
      .png({ quality: 80 }) // Optimize PNG size
      .toFile('./store_assets/screenshot_1.png');
    
    console.log('Successfully generated screenshot_1.png');
    
    // Verify the dimensions
    const metadata = await sharp('./store_assets/screenshot_1.png').metadata();
    console.log(`Screenshot dimensions: ${metadata.width}x${metadata.height}`);
    
    // Get file size
    const stats = fs.statSync('./store_assets/screenshot_1.png');
    console.log(`Screenshot size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
  } catch (error) {
    console.error('Error generating screenshots:', error);
  }
}

generateScreenshots(); 