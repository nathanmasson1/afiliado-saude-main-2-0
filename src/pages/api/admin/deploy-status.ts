/**
 * deploy-status.ts — Verifica status do deploy via GitHub Deployments API
 *
 * O Vercel publica deployment statuses nos commits do GitHub.
 * Este endpoint verifica o status mais recente sem precisar de token Vercel.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const token = (import.meta.env.GITHUB_TOKEN ?? '').trim();
        const owner = (import.meta.env.GITHUB_OWNER ?? '').trim();
        const repo  = (import.meta.env.GITHUB_REPO ?? '').trim();

        if (!token || !owner || !repo) {
            return new Response(JSON.stringify({ state: 'idle' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
        };

        // Get latest deployment
        const deploymentsRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=1&environment=Production`,
            { headers }
        );

        if (!deploymentsRes.ok) {
            return new Response(JSON.stringify({ state: 'idle' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        }

        const deployments = await deploymentsRes.json() as any[];
        if (deployments.length === 0) {
            return new Response(JSON.stringify({ state: 'idle' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        }

        const deployment = deployments[0];

        // Get statuses for this deployment
        const statusRes = await fetch(deployment.statuses_url, { headers });
        if (!statusRes.ok) {
            return new Response(JSON.stringify({ state: 'idle' }), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            });
        }

        const statuses = await statusRes.json() as any[];
        const latest = statuses[0]; // Most recent status

        if (!latest) {
            return new Response(JSON.stringify({
                state: 'building',
                updatedAt: deployment.created_at,
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Map GitHub deployment status to our states
        let state: string = 'idle';
        if (latest.state === 'pending' || latest.state === 'in_progress' || latest.state === 'queued') {
            state = 'building';
        } else if (latest.state === 'success') {
            // Only show "ready" if deployment was in the last 5 minutes
            const deployedAt = new Date(latest.created_at).getTime();
            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
            state = deployedAt > fiveMinAgo ? 'ready' : 'idle';
        } else if (latest.state === 'failure' || latest.state === 'error') {
            const deployedAt = new Date(latest.created_at).getTime();
            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
            state = deployedAt > fiveMinAgo ? 'error' : 'idle';
        }

        return new Response(JSON.stringify({
            state,
            url: latest.target_url || latest.log_url || '',
            updatedAt: latest.created_at,
            environment: deployment.environment,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch {
        return new Response(JSON.stringify({ state: 'idle' }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });
    }
};
