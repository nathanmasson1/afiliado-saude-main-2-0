import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = 'src/content/blog';

function escape(s) {
    return s.replace(/"/g, '\\"');
}

function extractSection(body, headingRe) {
    const m = body.match(headingRe);
    if (!m) return { content: '', remaining: body };
    const start = m.index;
    const afterHeading = start + m[0].length;
    const rest = body.slice(afterHeading);
    const nextH2 = rest.search(/\n##\s+/);
    const end = nextH2 === -1 ? body.length : afterHeading + nextH2;
    return {
        content: body.slice(afterHeading, end).trim(),
        remaining: (body.slice(0, start) + body.slice(end)).replace(/\n{3,}/g, '\n\n').trim(),
    };
}

function parseFaqs(faqText) {
    const faqs = [];
    const re = /###\s+(.+?)\n+([\s\S]*?)(?=\n###\s|$)/g;
    let m;
    while ((m = re.exec(faqText))) {
        faqs.push({ q: m[1].trim(), a: m[2].trim() });
    }
    return faqs;
}

async function processFile(filePath) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const match = raw.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
    if (!match) return false;
    const [, fmStart, fmBody, fmEnd, body] = match;

    // Skip if already has conclusion/faqs in frontmatter
    if (fmBody.match(/^conclusion:/m) || fmBody.match(/^faqs:/m)) {
        console.log(`  skip (already migrated): ${path.basename(filePath)}`);
        return false;
    }

    const verdict = extractSection(body, /##\s+Veredito\s+Final\s*\n/i);
    const faqSec = extractSection(verdict.remaining, /##\s+Perguntas\s+Frequentes\s*\n/i);

    if (!verdict.content && !faqSec.content) {
        console.log(`  skip (nothing to migrate): ${path.basename(filePath)}`);
        return false;
    }

    const newBody = faqSec.remaining;
    const additions = [];
    if (verdict.content) {
        const indented = verdict.content.split('\n').map(l => `  ${l}`).join('\n');
        additions.push(`conclusion: |\n${indented}`);
    }
    if (faqSec.content) {
        const faqs = parseFaqs(faqSec.content);
        if (faqs.length > 0) {
            additions.push('faqs:\n' + faqs.map(f => `  - q: "${escape(f.q)}"\n    a: "${escape(f.a)}"`).join('\n'));
        }
    }

    const newFm = fmBody.trim() + '\n' + additions.join('\n');
    const newRaw = fmStart + newFm + fmEnd + (newBody ? newBody + '\n' : '');

    await fs.writeFile(filePath, newRaw);
    console.log(`  migrated: ${path.basename(filePath)} (verdict: ${!!verdict.content}, faqs: ${!!faqSec.content})`);
    return true;
}

const files = await fs.readdir(BLOG_DIR);
const mdFiles = files.filter(f => f.endsWith('.md')).map(f => path.join(BLOG_DIR, f));

console.log(`Found ${mdFiles.length} markdown files\n`);
let migrated = 0;
for (const f of mdFiles) if (await processFile(f)) migrated++;
console.log(`\n✓ ${migrated} file(s) migrated`);
