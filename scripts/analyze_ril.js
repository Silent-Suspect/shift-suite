import fs from 'fs';
import path from 'path';

const jsonPath = path.resolve('src', 'data', 'ril100.json');

try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Total Codes: ${data.length}`);

    // 1. Check for single letter codes
    const singleLetter = data.filter(s => s.c.length === 1);
    console.log(`\nSingle Letter Codes: ${singleLetter.length}`);
    if (singleLetter.length > 0) console.log(singleLetter.map(s => `${s.c} (${s.n})`).join(', '));

    // 2. Check for shortest codes
    const sortedByLen = [...data].sort((a, b) => a.c.length - b.c.length);
    console.log(`Shortest Code: "${sortedByLen[0].c}" (Length: ${sortedByLen[0].c.length})`);

    // 3. Analyze Codes with Spaces
    const withSpace = data.filter(s => s.c.includes(' '));
    console.log(`\nCodes with Spaces: ${withSpace.length}`);

    let prefixOneChar = 0;
    let suffixOneChar = 0;
    let otherPattern = 0;

    withSpace.forEach(s => {
        const parts = s.c.split(' ');
        if (parts.length < 2) return;

        const p1 = parts[0];
        const p2 = parts[1];

        if (p1.length === 1) prefixOneChar++;
        if (p2.length === 1) suffixOneChar++;
        if (p1.length > 1 && p2.length > 1) otherPattern++;
    });

    console.log(`Pattern Analysis (of ${withSpace.length} codes with spaces):`);
    console.log(`- Suffix Pattern (XXX A): ${suffixOneChar}`);
    console.log(`- Prefix Pattern (A XXX): ${prefixOneChar}`);
    console.log(`- Multi-Word Pattern (XXX YYY): ${otherPattern}`);

    if (prefixOneChar > 0) {
        console.log("\nWARNING: Found Prefix-Style codes (A XXX):");
        console.log(withSpace.filter(s => s.c.split(' ')[0].length === 1).slice(0, 10));
    } else {
        console.log("\n✅ Hypothesis confirmed: No 1-letter prefixes found.");
    }

} catch (e) {
    console.error(e);
}
