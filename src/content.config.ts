import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const productSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  review: z.string().optional(),
  price: z.string().optional(),
  originalPrice: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  affiliateLink: z.string().url(),
  store: z.enum(['amazon', 'hotmart', 'eduzz', 'monetizze', 'mercado-livre', 'shopee', 'outro']).default('outro'),
  image: z.string().optional(),
  badge: z.string().optional(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    category: z.string().default('reviews'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),

    // Affiliate fields
    affiliateLink: z.string().optional(),
    products: z.array(productSchema).default([]),
    rating: z.number().min(0).max(10).optional(),
    badge: z.enum(['top-pick', 'best-value', 'editor-choice']).optional(),
    priceRange: z.string().optional(),

    // Review structured fields (rendered separately from body)
    conclusion: z.string().optional(),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),

    // Display options
    author: z.string().default('SeuBlog'),
    showToc: z.boolean().default(true),
    showDisclosure: z.boolean().default(true),
  }),
});

export const collections = { blog };
