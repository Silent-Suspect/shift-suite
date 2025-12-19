import XLSX from 'xlsx';
import path from 'path';

// Path to the file on G: drive
const filePath = "g:\\Meine Ablage\\Apps\\ShiftApp\\Database\\DB-Betriebsstellencodes (Ril 100).xlsx";

try {
    console.log("Reading file:", filePath);
    const workbook = XLSX.readFile(filePath);
    console.log("Sheets found:", workbook.SheetNames);

    workbook.SheetNames.forEach(name => {
        console.log(`\n--- Inspecting Sheet: ${name} ---`);
        const sheet = workbook.Sheets[name];
        // Get range
        const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
        console.log(`Range: ${range.s.r}:${range.s.c} to ${range.e.r}:${range.e.c}`);

        // Read first 20 rows
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null }).slice(0, 20);

        data.forEach((row, index) => {
            // Only print rows that have some data
            if (row && row.some(cell => cell !== null && cell !== "")) {
                console.log(`Row ${index}:`, JSON.stringify(row));
            }
        });
    });

} catch (error) {
    console.error("Error reading file:", error.message);
}
