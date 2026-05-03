/**
 * pexels.ts
 *
 * Utilitário para buscar imagens na API do Pexels.
 * Usado no pós-processamento de posts gerados por IA para inserir
 * fotos temáticas automaticamente (1 a cada ~400 palavras, máx 5).
 *
 * API: https://api.pexels.com/v1/search
 * Docs: https://www.pexels.com/api/documentation/
 */

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

export interface PexelsPhoto {
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    src: {
        original: string;
        large2x: string;
        large: string;
        medium: string;
        small: string;
        portrait: string;
        landscape: string;
        tiny: string;
    };
}

export interface PexelsSearchResponse {
    total_results: number;
    page: number;
    per_page: number;
    photos: PexelsPhoto[];
    next_page?: string;
}

/**
 * Busca fotos no Pexels por termo de pesquisa.
 * Retorna até `perPage` resultados (padrão 5).
 * Usa src.medium para boa qualidade sem excesso de tamanho.
 */
export async function searchPexelsPhotos(
    apiKey: string,
    query: string,
    perPage = 5,
    page = 1
): Promise<PexelsPhoto[]> {
    if (!apiKey?.trim() || !query?.trim()) return [];

    const params = new URLSearchParams({
        query: query.trim(),
        per_page: String(perPage),
        page: String(page),
    });

    const res = await fetch(`${PEXELS_SEARCH_URL}?${params}`, {
        headers: { Authorization: apiKey.trim() },
    });

    if (!res.ok) {
        console.error('\x1b[31m✗ Erro Pexels API:\x1b[0m', res.status, await res.text());
        return [];
    }

    const data = (await res.json()) as PexelsSearchResponse;
    return data.photos ?? [];
}

/**
 * Retorna a URL de uma imagem em tamanho médio (ideal para posts no corpo).
 * Fallback para large ou original se medium não existir.
 */
export function getPhotoUrl(photo: PexelsPhoto): string {
    return photo.src?.medium || photo.src?.large || photo.src?.original || photo.url;
}

/**
 * Retorna a URL em tamanho maior (ideal para thumbnail/cards).
 * Preferência: landscape (formato 16:9) > large > original.
 */
export function getThumbnailUrl(photo: PexelsPhoto): string {
    return photo.src?.landscape || photo.src?.large || photo.src?.original || photo.url;
}
