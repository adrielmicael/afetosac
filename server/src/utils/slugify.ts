/**
 * Converte string para slug URL-friendly
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Separa acentos
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Espaços para hífens
    .replace(/[^\w\-]+/g, '') // Remove caracteres especiais
    .replace(/\-\-+/g, '-'); // Múltiplos hífens para um
}
