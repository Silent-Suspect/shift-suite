import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = "g:\\Meine Ablage\\Apps\\ShiftApp\\Database\\DB-Betriebsstellencodes (Ril 100).xlsx";
const outDir = path.resolve('src', 'data');
const outFile = path.join(outDir, 'ril100.json');

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

try {
    console.log("Reading Excel file...");
    const workbook = XLSX.readFile(filePath);
    // Assume data is in the first sheet or find the one with data
    const sheetName = workbook.SheetNames[0]; // Based on inspection, data is here
    const sheet = workbook.Sheets[sheetName];

    console.log(`Processing Sheet: ${sheetName}`);

    // Convert to JSON (Array of Arrays)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });

    const stations = [];

    rows.forEach((row, index) => {
        // Assuming structure based on inspection:
        // Index 1: Code (IKA)
        // Index 2: Name (Aachen SwA)
        // Validate: Code must be a string of reasonable length

        if (row && row.length > 2) {
            const code = row[1];
            const name = row[2];

            if (typeof code === 'string' && code.length >= 2 && code.length <= 6 && name) {
                stations.push({
                    c: code,
                    n: name
                });
            }
        }
    });

    console.log(`Extracted ${stations.length} stations.`);

    fs.writeFileSync(outFile, JSON.stringify(stations)); // Minified for size
    console.log(`Saved to ${outFile}`);

} catch (error) {
    console.error("Conversion failed:", error.message);
}
