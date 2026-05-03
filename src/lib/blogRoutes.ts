import { readData } from './readData';

/** URL de um post individual: "/{slug}" ou "/blog/{slug}" */
export function postUrl(slug: string): string {
    const prefix = readData('siteConfig.json').blogPrefix ?? '';
    return prefix ? `${prefix}/${slug}` : `/${slug}`;
}

/** URL da listagem de posts: "/blog" (ou prefix configurado, fallback "/blog") */
export function blogIndexUrl(): string {
    const prefix = readData('siteConfig.json').blogPrefix ?? '';
    return prefix || '/blog';
}
