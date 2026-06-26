const Tesseract = require('tesseract.js');
const path = require('path');

async function run() {
  console.log("Starting Tesseract test...");
  try {
    // We can use a dummy/test image if available or just run a basic initialization check
    console.log("Tesseract loaded:", typeof Tesseract.recognize);
  } catch (err) {
    console.error(err);
  }
}

run();
