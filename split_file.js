const fs = require('fs');
const path = require('path');

const filePath = 'c:/SAUauto/TestCase_FillTester.html';
const cssPath = 'c:/SAUauto/styles.css';
const jsPath = 'c:/SAUauto/scripts.js';

try {
  let htmlContent = fs.readFileSync(filePath, 'utf8');

  // Extract CSS
  const styleStartStr = '<style>';
  const styleEndStr = '</style>';
  const styleStart = htmlContent.indexOf(styleStartStr);
  const styleEnd = htmlContent.indexOf(styleEndStr, styleStart);

  if (styleStart !== -1 && styleEnd !== -1) {
    const cssContent = htmlContent.substring(styleStart + styleStartStr.length, styleEnd).trim();
    fs.writeFileSync(cssPath, cssContent + '\n', 'utf8');
    
    // Replace with link tag
    htmlContent = htmlContent.substring(0, styleStart) + 
                  '<link rel="stylesheet" href="styles.css" />' + 
                  htmlContent.substring(styleEnd + styleEndStr.length);
  }

  // Extract JS
  // The bottom script is exactly "<script>" without attributes
  const scriptStartStr = '<script>\n';
  const scriptEndStr = '</script>';
  const scriptStart = htmlContent.indexOf(scriptStartStr);
  const scriptEnd = htmlContent.lastIndexOf(scriptEndStr); // Using lastIndexOf to be safe

  if (scriptStart !== -1 && scriptEnd !== -1) {
    const jsContent = htmlContent.substring(scriptStart + scriptStartStr.length, scriptEnd).trim();
    fs.writeFileSync(jsPath, jsContent + '\n', 'utf8');
    
    // Replace with script tag
    htmlContent = htmlContent.substring(0, scriptStart) + 
                  '<script src="scripts.js"></script>' + 
                  htmlContent.substring(scriptEnd + scriptEndStr.length);
  }

  fs.writeFileSync(filePath, htmlContent, 'utf8');
  console.log('Successfully split the file into HTML, CSS, and JS.');

} catch (err) {
  console.error('Error:', err);
}
