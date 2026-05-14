const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const csvFilePath = path.join(__dirname, '..', 'merged_output.csv');
const outputFilePath = path.join(__dirname, 'src', 'data', 'sample_data.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'src', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Extracting sample data...');

const csvFile = fs.readFileSync(csvFilePath, 'utf8');

Papa.parse(csvFile, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    preview: 10000, // Increased to 10000 contacts
    complete: function (results) {
        fs.writeFileSync(outputFilePath, JSON.stringify(results.data, null, 2));
        console.log(`Successfully extracted ${results.data.length} rows to ${outputFilePath}`);
    }
});
