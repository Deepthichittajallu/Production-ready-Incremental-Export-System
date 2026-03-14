const fs = require('fs');
const path = require('path');

/**
 * Writes data to a CSV file
 * @param {string} filename - The name of the CSV file
 * @param {Array} headers - Array of column headers
 * @param {Array} rows - Array of row objects
 * @returns {Promise<void>}
 */
async function writeCSV(filename, headers, rows) {
  const outputDir = process.env.OUTPUT_DIR || './output';
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filePath = path.join(outputDir, filename);
  const writeStream = fs.createWriteStream(filePath);
  
  return new Promise((resolve, reject) => {
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    
    // Write header row
    writeStream.write(headers.join(',') + '\n');
    
    // Write data rows
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape quotes and wrap in quotes if contains comma or quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      writeStream.write(values.join(',') + '\n');
    }
    
    writeStream.end();
  });
}

module.exports = { writeCSV };
