export function formatToolTitle(toolName: string, catName?: string, aiTitle?: string): string {
  if (aiTitle) return `${aiTitle} | AI Tools Directory`;
  // Fallback formula if AI title is missing
  if (catName) {
    return `${toolName} — Best ${catName} AI Tool | AI Tools Directory`;
  }
  return `${toolName} — AI Tool Directory`;
}

export function formatCategoryTitle(categoryName: string, page: number = 1): string {
  const base = `${categoryName} AI Tools — Free & Paid Options ${new Date().getFullYear()} | AI Tools Directory`;
  return page > 1 ? `${base} (Page ${page})` : base;
}

export function formatFilterTitle(categoryName: string, pricing: string, page: number = 1): string {
  const capPricing = pricing.charAt(0).toUpperCase() + pricing.slice(1);
  const base = `${capPricing} ${categoryName} AI Tools — Top Options ${new Date().getFullYear()}`;
  return page > 1 ? `${base} (Page ${page})` : base;
}

export function truncateDescription(text: string, length: number = 150): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + '...';
}
