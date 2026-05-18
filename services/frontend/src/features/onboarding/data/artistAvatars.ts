// Artist avatar URLs for onboarding ArtistGrid.
// IDs match artists table in music_db (SeedData.sql).
// Hosted on Cloudinary smart-music/artists/.

export interface ArtistAvatar {
  id: string;       // artist.Id in music_db
  name: string;     // artist.StageName
  imageUrl: string;
}

export const ALL_ARTISTS: ArtistAvatar[] = [
  {
    id: 'a0000001-0000-0000-0000-000000000002',
    name: 'Sơn Tùng M-TP',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129407/smart-music/artists/son-tung-mtp.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000001',
    name: 'Vũ.',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129421/smart-music/artists/vu.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000003',
    name: 'Ngọt',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129400/smart-music/artists/ngot.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000004',
    name: 'TaynguyenSound',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129408/smart-music/artists/taynguyen-sound.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000005',
    name: 'The Aaron Smith Experience',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129411/smart-music/artists/the-aaron-smith-experience.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000006',
    name: 'Miki Matsubara',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129397/smart-music/artists/miki-matsubara.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000007',
    name: 'Low G',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129394/smart-music/artists/low-g.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000008',
    name: 'Thắng',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129412/smart-music/artists/thang.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000009',
    name: 'Dick',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129392/smart-music/artists/dick.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000010',
    name: 'Tùng TeA',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129419/smart-music/artists/tung-tea.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000011',
    name: 'PC',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129404/smart-music/artists/pc.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000012',
    name: 'Trang',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129416/smart-music/artists/trang.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000013',
    name: 'Dear Jane',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129363/smart-music/artists/dear-jane.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000014',
    name: 'Night Tempo',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129403/smart-music/artists/night-tempo.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000015',
    name: 'Tofu',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129414/smart-music/artists/tofu.jpg',
  },
  {
    id: 'a0000001-0000-0000-0000-000000000016',
    name: 'NewoulZ',
    imageUrl: 'https://res.cloudinary.com/dd9umsxtf/image/upload/v1779129398/smart-music/artists/newoulz.jpg',
  },
];

/** Returns a stable random 8-artist sample for the onboarding screen.
 *  Seeded by day so the same user sees the same set within a session. */
export function getOnboardingArtists(): ArtistAvatar[] {
  const seed = Math.floor(Date.now() / 86_400_000);
  const shuffled = [...ALL_ARTISTS].sort((a, b) => {
    const ha = cyrb(a.id + seed) - cyrb(b.id + seed);
    return ha;
  });
  return shuffled.slice(0, 8);
}

function cyrb(str: string | number): number {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
