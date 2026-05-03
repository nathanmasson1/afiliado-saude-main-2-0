import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

// Project root for dev mode
const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../../../');

function buildMarkdown(data: any): string {
    const { title, description, slug, content, category, tags, image } = data;
    const pubDate = new Date().toISOString();

    const tagsStr = Array.isArray(tags) && tags.length > 0
        ? `\n  - ` + tags.map(t => `"${t}"`).join(`\n  - `)
        : ' []';

    return `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description ? description.replace(/"/g, '\\"') : ''}"
pubDate: ${pubDate}
image: "${image || ''}"
category: "${category || 'blog'}"
tags:${tagsStr}
draft: false
---

${content}
`;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        // 1. Authentication
        const WEBHOOK_SECRET = import.meta.env.WEBHOOK_SECRET;
        const authHeader = request.headers.get('Authorization');

        if (WEBHOOK_SECRET) {
            if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
            }
        } else {
            console.warn('⚠️ WEBHOOK_SECRET not defined in environment variables. Webhook is unprotected.');
        }

        // 2. Parse request payload
        const data = await request.json();
        if (!data.title || !data.content) {
            return new Response(JSON.stringify({ error: 'Missing title or content' }), { status: 400 });
        }

        const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const filePath = `src/content/blog/${slug}.md`;
        const markdownContent = buildMarkdown(data);

        // 3. Save logic (Dev vs Prod)
        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO;

        // Dev mode (Local Filesystem)
        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            const absPath = nodePath.join(PROJECT_ROOT, filePath);
            await fs.mkdir(nodePath.dirname(absPath), { recursive: true });
            await fs.writeFile(absPath, markdownContent, 'utf-8');
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Post created locally', 
                path: filePath 
            }), { status: 200 });
        }

        // Production mode (GitHub API)
        const repo = `${GITHUB_OWNER}/${GITHUB_REPO}`;
        const githubUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
        };

        // Check if file exists to get SHA
        let sha: string | undefined;
        try {
            const existingRes = await fetch(githubUrl, { headers });
            if (existingRes.ok) {
                const existingData = await existingRes.json();
                sha = existingData.sha;
            }
        } catch (e) {}

        const writeBody: any = {
            message: `Publish post: ${data.title} via Webhook`,
            content: Buffer.from(markdownContent).toString('base64'),
        };
        if (sha) writeBody.sha = sha;

        const res = await fetch(githubUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(writeBody),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(`GitHub API Error: ${errData.message}`);
        }

        const responseData = await res.json();

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Post published to GitHub', 
            path: filePath,
            sha: responseData.content?.sha
        }), { status: 200 });

    } catch (err: any) {
        console.error('Webhook Error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Internal Server Error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
