import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = 'src/content/blog';

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripProductSections(body, productNames) {
    let result = body;
    for (const name of productNames) {
        const escaped = escapeRegex(name.trim());
        // Match: "## {Name}\n" then any content until next "## " or end of file
        const re = new RegExp(`##\\s+${escaped}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`, 'g');
        result = result.replace(re, '');
    }
    // Clean up extra blank lines
    return result.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function parseProductNames(frontmatter) {
    const names = [];
    const re = /^\s*-\s*name:\s*"([^"]+)"/gm;
    let m;
    while ((m = re.exec(frontmatter))) names.push(m[1]);
    return names;
}

async function processFile(filePath) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const match = raw.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    if (!match) {
        console.log(`  skip (no frontmatter): ${filePath}`);
        return false;
    }
    const [, fm, body] = match;
    const productNames = parseProductNames(fm);
    if (productNames.length === 0) {
        console.log(`  skip (no products): ${filePath}`);
        return false;
    }

    // Check if body has any "## {productName}" — if not, already clean
    const hasDuplication = productNames.some(n =>
        new RegExp(`##\\s+${escapeRegex(n.trim())}`, 'i').test(body)
    );
    if (!hasDuplication) {
        console.log(`  ok (already clean): ${path.basename(filePath)}`);
        return false;
    }

    const cleanBody = stripProductSections(body, productNames);
    await fs.writeFile(filePath, fm + cleanBody);
    console.log(`  cleaned: ${path.basename(filePath)} (${productNames.length} products stripped)`);
    return true;
}

const files = await fs.readdir(BLOG_DIR);
const mdFiles = files.filter(f => f.endsWith('.md')).map(f => path.join(BLOG_DIR, f));

console.log(`Found ${mdFiles.length} markdown files\n`);
let cleaned = 0;
for (const f of mdFiles) {
    if (await processFile(f)) cleaned++;
}
console.log(`\n✓ ${cleaned} file(s) cleaned`);
