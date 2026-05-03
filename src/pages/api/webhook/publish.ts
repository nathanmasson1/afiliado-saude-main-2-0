import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

// Project root for dev mode
const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../../../');

function buildMarkdown(data: any): string {
    const { title, description, slug, content, category, tags, image, author } = data;
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
author: "${author || 'Redação'}"
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

        // GitHub API Config (moved up for author fetching)
        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO;
        const repo = `${GITHUB_OWNER}/${GITHUB_REPO}`;

        const githubHeaders: Record<string, string> = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
        };

        // 1.5 Fetch First Author
        let firstAuthor = 'Redação';
        try {
            if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
                const authorsPath = nodePath.join(PROJECT_ROOT, 'src/data/authors.json');
                const authorsData = await fs.readFile(authorsPath, 'utf-8');
                const authorsArray = JSON.parse(authorsData);
                if (Array.isArray(authorsArray) && authorsArray.length > 0 && authorsArray[0].name) {
                    firstAuthor = authorsArray[0].name;
                }
            } else {
                const authorsGithubUrl = `https://api.github.com/repos/${repo}/contents/src/data/authors.json`;
                const authorsRes = await fetch(authorsGithubUrl, { headers: githubHeaders });
                if (authorsRes.ok) {
                    const authorsJsonData = await authorsRes.json();
                    if (authorsJsonData.content) {
                        const decodedContent = Buffer.from(authorsJsonData.content, 'base64').toString('utf-8');
                        const authorsArray = JSON.parse(decodedContent);
                        if (Array.isArray(authorsArray) && authorsArray.length > 0 && authorsArray[0].name) {
                            firstAuthor = authorsArray[0].name;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not read authors.json, defaulting to Redação', e);
        }

        // 2. Parse request payload
        const data = await request.json();
        if (!data.title || !data.content) {
            return new Response(JSON.stringify({ error: 'Missing title or content' }), { status: 400 });
        }
        
        // Inject the first author into the data payload
        data.author = firstAuthor;

        const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const filePath = `src/content/blog/${slug}.md`;

        // 3. Handle External Image Download
        if (data.image && data.image.startsWith('http')) {
            try {
                const imageRes = await fetch(data.image);
                if (imageRes.ok) {
                    const contentType = imageRes.headers.get('content-type') || '';
                    let ext = '.jpg'; // default
                    if (contentType.includes('png')) ext = '.png';
                    else if (contentType.includes('webp')) ext = '.webp';
                    else if (contentType.includes('gif')) ext = '.gif';
                    else if (data.image.toLowerCase().endsWith('.png')) ext = '.png';
                    else if (data.image.toLowerCase().endsWith('.webp')) ext = '.webp';

                    const imgPath = `public/uploads/${Date.now()}-${slug}-cover${ext}`;
                    const imageLocalPath = `/uploads/${Date.now()}-${slug}-cover${ext}`;
                    
                    const arrayBuffer = await imageRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Save Image (Dev vs Prod)
                    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
                        const absImgPath = nodePath.join(PROJECT_ROOT, imgPath);
                        await fs.mkdir(nodePath.dirname(absImgPath), { recursive: true });
                        await fs.writeFile(absImgPath, buffer);
                        console.log(`Imagem salva localmente: ${imgPath}`);
                    } else {
                        const imgGithubUrl = `https://api.github.com/repos/${repo}/contents/${imgPath}`;
                        let imgSha: string | undefined;
                        try {
                            const existingImg = await fetch(imgGithubUrl, { headers: githubHeaders });
                            if (existingImg.ok) {
                                const existingData = await existingImg.json();
                                imgSha = existingData.sha;
                            }
                        } catch (e) {}

                        const writeImgBody: any = {
                            message: `Upload image for post: ${data.title} via Webhook`,
                            content: buffer.toString('base64'),
                        };
                        if (imgSha) writeImgBody.sha = imgSha;

                        const uploadRes = await fetch(imgGithubUrl, {
                            method: 'PUT',
                            headers: { ...githubHeaders, 'Content-Type': 'application/json' },
                            body: JSON.stringify(writeImgBody),
                        });
                        
                        if (!uploadRes.ok) {
                            console.error('Falha ao subir imagem pro GitHub:', await uploadRes.text());
                        }
                    }

                    // Update data to use local path in markdown
                    data.image = imageLocalPath;
                } else {
                    console.error('Falha ao baixar imagem, status:', imageRes.status);
                }
            } catch (imgError) {
                console.error('Erro no download da imagem:', imgError);
            }
        }

        // 4. Save Markdown (Dev vs Prod)
        const markdownContent = buildMarkdown(data);

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

        const githubUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        
        let sha: string | undefined;
        try {
            const existingRes = await fetch(githubUrl, { headers: githubHeaders });
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
            headers: { ...githubHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(writeBody),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(`GitHub API Error: ${errData.message}`);
        }

        const responseData = await res.json();

        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Post and image published to GitHub', 
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
