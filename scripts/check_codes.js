import fs from 'fs';
import path from 'path';

const codes = ['EWANT', 'FFU', 'NWH', 'RBC'];
const jsonPath = path.resolve('src', 'data', 'ril100.json');

try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Checking ${codes.length} codes against ${data.length} entries...`);

    codes.forEach(searchCode => {
        const found = data.find(station => station.c === searchCode);
        if (found) {
            console.log(`✅ ${searchCode} -> ${found.n}`);
        } else {
            console.log(`❌ ${searchCode} NOT FOUND`);
            // Try partial match
            const partial = data.filter(s => s.c.includes(searchCode));
            if (partial.length > 0) {
                console.log(`   Did you mean? ${partial.map(s => s.c + ' (' + s.n + ')').join(', ')}`);
            }
        }
    });
} catch (e) {
    console.error(e);
}
