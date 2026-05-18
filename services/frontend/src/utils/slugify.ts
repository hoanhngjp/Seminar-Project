// Vietnamese diacritics map for browsers that don't fully support NFD combining marks
const VIET_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a', ā: 'a', ă: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e', ē: 'e', ě: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i', ī: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ō: 'o', ơ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u', ū: 'u', ư: 'u',
  ỳ: 'y', ý: 'y', ÿ: 'y',
  đ: 'd',
  // precomposed Vietnamese
  ạ: 'a', ả: 'a', ấ: 'a', ầ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  ắ: 'a', ặ: 'a', ằ: 'a', ẳ: 'a', ẵ: 'a',
  ẹ: 'e', ẻ: 'e', ẽ: 'e', ế: 'e', ề: 'e', ệ: 'e', ể: 'e', ễ: 'e',
  ị: 'i', ỉ: 'i', ĩ: 'i',
  ọ: 'o', ỏ: 'o', ố: 'o', ồ: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ớ: 'o', ờ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ụ: 'u', ủ: 'u', ũ: 'u', ứ: 'u', ừ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ỵ: 'y', ỷ: 'y', ỹ: 'y',
};

export function slugify(text: string): string {
  return text
    .split('')
    .map((c) => VIET_MAP[c] ?? VIET_MAP[c.toLowerCase()] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function songUrl(song: { id: string; title: string }): string {
  return `/songs/${slugify(song.title)}?id=${song.id}`;
}
