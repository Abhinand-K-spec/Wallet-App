const Tesseract = require('tesseract.js');
const path = require('path');

async function run() {
  const filePath = path.join(__dirname, '../public/uploads/proof_1782462664166_9867.jpeg');
  console.log("Analyzing file:", filePath);
  
  try {
    const result = await Tesseract.recognize(filePath, 'eng');
    console.log("=== EXTRACTED TEXT ===");
    console.log(result.data.text);
    console.log("======================");
  } catch (err) {
    console.error("Error during OCR:", err);
  }
}

run();
