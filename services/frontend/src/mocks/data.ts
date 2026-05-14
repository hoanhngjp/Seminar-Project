// Mock data — Vietnamese music platform demo data
// Used exclusively by MSW handlers in mock mode (VITE_MOCK=true)

// ─────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────

export const MOCK_LISTENER = {
  id: 'user-listener-001',
  userId: 'user-listener-001',
  username: 'nghiep',
  email: 'listener@soundwave.vn',
  displayName: 'Nguyễn Thành Nghiệp',
  role: 'Listener' as const,
  hasCompletedOnboarding: true,
};

export const MOCK_CREATOR = {
  id: 'user-creator-001',
  userId: 'user-creator-001',
  username: 'sontung',
  email: 'creator@soundwave.vn',
  displayName: 'Sơn Tùng M-TP',
  role: 'Creator' as const,
  hasCompletedOnboarding: true,
};

// Default logged-in user (can toggle via login)
export let CURRENT_MOCK_USER = MOCK_LISTENER;

export function setMockUser(email: string) {
  CURRENT_MOCK_USER = email.includes('creator') ? MOCK_CREATOR : MOCK_LISTENER;
}

// ─────────────────────────────────────────────
// Songs
// ─────────────────────────────────────────────

export const MOCK_SONGS = [
  {
    id: 'song-001',
    songId: 'song-001',
    title: 'Lạc Trôi',
    artist: 'Sơn Tùng M-TP',
    album: 'M-TP Collection',
    duration: 245,
    coverUrl: 'https://picsum.photos/seed/lactroi/300/300',
    isExplicit: false,
    genreId: 'genre-vpop',
    mood: 'chill',
    storageKey: 'songs/song-001/audio.mp3',
  },
  {
    id: 'song-002',
    songId: 'song-002',
    title: 'Có Chắc Yêu Là Đây',
    artist: 'Sơn Tùng M-TP',
    album: 'Sky Tour',
    duration: 228,
    coverUrl: 'https://picsum.photos/seed/cochac/300/300',
    isExplicit: false,
    genreId: 'genre-vpop',
    mood: 'energetic',
    storageKey: 'songs/song-002/audio.mp3',
  },
  {
    id: 'song-003',
    songId: 'song-003',
    title: 'Chuyến Xe',
    artist: 'Ngọt',
    album: 'Nước Bọt',
    duration: 210,
    coverUrl: 'https://picsum.photos/seed/chuyenxe/300/300',
    isExplicit: false,
    genreId: 'genre-indie',
    mood: 'melancholic',
    storageKey: 'songs/song-003/audio.mp3',
  },
  {
    id: 'song-004',
    songId: 'song-004',
    title: 'Từ Hôm Nay',
    artist: 'Vũ.',
    album: 'Vũ. Collection',
    duration: 255,
    coverUrl: 'https://picsum.photos/seed/tuhomnay/300/300',
    isExplicit: false,
    genreId: 'genre-indie',
    mood: 'romantic',
    storageKey: 'songs/song-004/audio.mp3',
  },
  {
    id: 'song-005',
    songId: 'song-005',
    title: 'Ngày Mai',
    artist: 'Vũ.',
    album: 'Vũ. Collection',
    duration: 198,
    coverUrl: 'https://picsum.photos/seed/ngaymai/300/300',
    isExplicit: false,
    genreId: 'genre-indie',
    mood: 'hopeful',
    storageKey: 'songs/song-005/audio.mp3',
  },
  {
    id: 'song-006',
    songId: 'song-006',
    title: 'Đưa Nhau Đi Trốn',
    artist: 'Đen Vâu ft. Linh Cáo',
    album: 'Đi Trốn EP',
    duration: 267,
    coverUrl: 'https://picsum.photos/seed/ditrong/300/300',
    isExplicit: false,
    genreId: 'genre-rap',
    mood: 'chill',
    storageKey: 'songs/song-006/audio.mp3',
  },
  {
    id: 'song-007',
    songId: 'song-007',
    title: 'Mang Tiền Về Cho Mẹ',
    artist: 'Đen Vâu ft. Nguyên Thảo',
    album: 'Black Is King',
    duration: 290,
    coverUrl: 'https://picsum.photos/seed/mangtienvemee/300/300',
    isExplicit: false,
    genreId: 'genre-rap',
    mood: 'emotional',
    storageKey: 'songs/song-007/audio.mp3',
  },
  {
    id: 'song-008',
    songId: 'song-008',
    title: 'Là Ai',
    artist: 'Chillies',
    album: 'The Mekong Stories',
    duration: 220,
    coverUrl: 'https://picsum.photos/seed/laai/300/300',
    isExplicit: false,
    genreId: 'genre-indie',
    mood: 'chill',
    storageKey: 'songs/song-008/audio.mp3',
  },
];

// ─────────────────────────────────────────────
// Recommendations (3 types for 3 sections)
// ─────────────────────────────────────────────

export const MOCK_RECOMMENDATIONS = [
  // CONTEXT — Section 1 "Gợi ý sáng nay"
  {
    song_id: 'song-003',
    title: 'Chuyến Xe',
    artist: 'Ngọt',
    thumbnail: 'https://picsum.photos/seed/chuyenxe/300/300',
    reason: { type: 'CONTEXT', text: 'Phù hợp buổi sáng' },
  },
  {
    song_id: 'song-008',
    title: 'Là Ai',
    artist: 'Chillies',
    thumbnail: 'https://picsum.photos/seed/laai/300/300',
    reason: { type: 'CONTEXT', text: 'Nhạc indie buổi sáng' },
  },
  {
    song_id: 'song-004',
    title: 'Từ Hôm Nay',
    artist: 'Vũ.',
    thumbnail: 'https://picsum.photos/seed/tuhomnay/300/300',
    reason: { type: 'CONTEXT', text: 'Giai điệu nhẹ nhàng' },
  },
  // TRENDING — Section 2 "Đang thịnh hành"
  {
    song_id: 'song-001',
    title: 'Lạc Trôi',
    artist: 'Sơn Tùng M-TP',
    thumbnail: 'https://picsum.photos/seed/lactroi/300/300',
    reason: { type: 'TRENDING', text: 'Top 1 tuần này' },
  },
  {
    song_id: 'song-002',
    title: 'Có Chắc Yêu Là Đây',
    artist: 'Sơn Tùng M-TP',
    thumbnail: 'https://picsum.photos/seed/cochac/300/300',
    reason: { type: 'TRENDING', text: 'Trending Việt Nam' },
  },
  {
    song_id: 'song-007',
    title: 'Mang Tiền Về Cho Mẹ',
    artist: 'Đen Vâu',
    thumbnail: 'https://picsum.photos/seed/mangtienvemee/300/300',
    reason: { type: 'TRENDING', text: 'Hot trên mạng xã hội' },
  },
  // PREFERENCE — Section 3 "Vì bạn nghe Indie"
  {
    song_id: 'song-005',
    title: 'Ngày Mai',
    artist: 'Vũ.',
    thumbnail: 'https://picsum.photos/seed/ngaymai/300/300',
    reason: { type: 'PREFERENCE', text: '' },
  },
  {
    song_id: 'song-006',
    title: 'Đưa Nhau Đi Trốn',
    artist: 'Đen Vâu ft. Linh Cáo',
    thumbnail: 'https://picsum.photos/seed/ditrong/300/300',
    reason: { type: 'PREFERENCE', text: '' },
  },
];

// ─────────────────────────────────────────────
// Search results
// ─────────────────────────────────────────────

export const MOCK_SEARCH_RESULTS = [
  // Songs
  { id: 'song-001', name: 'Lạc Trôi',           type: 'song',   score: 0.98, artist: 'Sơn Tùng M-TP',       coverUrl: 'https://picsum.photos/seed/lactroi/300/300',    duration: 245 },
  { id: 'song-002', name: 'Có Chắc Yêu Là Đây', type: 'song',   score: 0.94, artist: 'Sơn Tùng M-TP',       coverUrl: 'https://picsum.photos/seed/cochac/300/300',     duration: 228 },
  { id: 'song-003', name: 'Chuyến Xe',           type: 'song',   score: 0.91, artist: 'Ngọt',                 coverUrl: 'https://picsum.photos/seed/chuyenxe/300/300',   duration: 210 },
  { id: 'song-006', name: 'Đưa Nhau Đi Trốn',   type: 'song',   score: 0.87, artist: 'Đen Vâu ft. Linh Cáo',coverUrl: 'https://picsum.photos/seed/ditrong/300/300',    duration: 267 },
  { id: 'song-007', name: 'Mang Tiền Về Cho Mẹ',type: 'song',   score: 0.82, artist: 'Đen Vâu',              coverUrl: 'https://picsum.photos/seed/mangtienvemee/300/300', duration: 290 },
  // Artists
  { id: 'artist-1', name: 'Sơn Tùng M-TP',      type: 'artist', score: 0.95, coverUrl: 'https://picsum.photos/seed/sontung/300/300' },
  { id: 'artist-2', name: 'Vũ.',                 type: 'artist', score: 0.80, coverUrl: 'https://picsum.photos/seed/vuartist/300/300' },
  { id: 'artist-3', name: 'Ngọt',                type: 'artist', score: 0.75, coverUrl: 'https://picsum.photos/seed/ngotband/300/300' },
  { id: 'artist-4', name: 'Đen Vâu',             type: 'artist', score: 0.70, coverUrl: 'https://picsum.photos/seed/denvau/300/300' },
  { id: 'artist-5', name: 'Chillies',             type: 'artist', score: 0.65, coverUrl: 'https://picsum.photos/seed/chillies/300/300' },
];

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export const MOCK_NOTIFICATIONS = [
  {
    notificationId: 'notif-001',
    message: 'Sơn Tùng M-TP vừa phát hành bài hát mới: "Waiting For You"',
    read: false,
    type: 'new_release' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 min ago
  },
  {
    notificationId: 'notif-002',
    message: 'Ngọt vừa phát hành album mới: "Nước Bọt Vol. 2"',
    read: false,
    type: 'new_release' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    notificationId: 'notif-003',
    message: 'Đen Vâu ft. Linh Cáo — "Đưa Nhau Đi Trốn" đã vượt 10 triệu view!',
    read: true,
    type: 'system' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    notificationId: 'notif-004',
    message: 'Chillies vừa thêm bài hát mới vào thư viện',
    read: true,
    type: 'new_release' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
  },
  {
    notificationId: 'notif-005',
    message: 'Vũ. vừa phát hành single mới: "Từ Hôm Nay"',
    read: true,
    type: 'new_release' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
  },
];

// ─────────────────────────────────────────────
// Analytics (Creator dashboard)
// ─────────────────────────────────────────────

// ─── 7-day stats ─────────────────────────────────────────────────────────────

const STATS_7D_LISTENERS = [
  { date: '2026-05-07', count: 1240 },
  { date: '2026-05-08', count: 1580 },
  { date: '2026-05-09', count: 2100 },
  { date: '2026-05-10', count: 1870 },
  { date: '2026-05-11', count: 2340 },
  { date: '2026-05-12', count: 3100 },
  { date: '2026-05-13', count: 2760 },
];

// ─── 30-day stats ─────────────────────────────────────────────────────────────

const STATS_30D_LISTENERS = [
  { date: '2026-04-14', count: 520 },  { date: '2026-04-15', count: 610 },
  { date: '2026-04-16', count: 780 },  { date: '2026-04-17', count: 690 },
  { date: '2026-04-18', count: 840 },  { date: '2026-04-19', count: 920 },
  { date: '2026-04-20', count: 1050 }, { date: '2026-04-21', count: 980 },
  { date: '2026-04-22', count: 1100 }, { date: '2026-04-23', count: 1240 },
  { date: '2026-04-24', count: 1180 }, { date: '2026-04-25', count: 1320 },
  { date: '2026-04-26', count: 1450 }, { date: '2026-04-27', count: 1380 },
  { date: '2026-04-28', count: 1510 }, { date: '2026-04-29', count: 1670 },
  { date: '2026-04-30', count: 1590 }, { date: '2026-05-01', count: 1760 },
  { date: '2026-05-02', count: 1820 }, { date: '2026-05-03', count: 1700 },
  { date: '2026-05-04', count: 1940 }, { date: '2026-05-05', count: 2080 },
  { date: '2026-05-06', count: 1990 }, { date: '2026-05-07', count: 1240 },
  { date: '2026-05-08', count: 1580 }, { date: '2026-05-09', count: 2100 },
  { date: '2026-05-10', count: 1870 }, { date: '2026-05-11', count: 2340 },
  { date: '2026-05-12', count: 3100 }, { date: '2026-05-13', count: 2760 },
];

export function getMockAnalyticsStats(songId: string, timeRange: '7d' | '30d' = '7d') {
  const listeners = timeRange === '30d' ? STATS_30D_LISTENERS : STATS_7D_LISTENERS;
  return {
    songId,
    dailyListeners: listeners,
    uniqueUsers: timeRange === '30d' ? 28640 : 8420,
    completionRate: 0.72,
  };
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────
// Deterministic pattern: low intro → rises → peak at ~1:48 (index 9) → drops off
// Mirrors the Stitch design "⚠️ Đỉnh bỏ qua" around the 2:00 mark

const HEATMAP_PATTERN = [8, 12, 18, 25, 38, 52, 65, 78, 88, 90, 82, 68, 52, 40, 32, 24, 18, 14, 10, 7];

export function getMockHeatmap(songId: string) {
  return {
    songId,
    dropOffs: HEATMAP_PATTERN.map((count, i) => ({ second: i * 12, count })),
  };
}

// ─────────────────────────────────────────────
// Streaming URL
// ─────────────────────────────────────────────

// A tiny silent MP3 (base64). Enough to make the audio element load successfully.
// Generated from: ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame silence.mp3
const SILENT_MP3_B64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

export function getSilentAudioDataUri() {
  return `data:audio/mpeg;base64,${SILENT_MP3_B64}`;
}

// ─────────────────────────────────────────────
// Party
// ─────────────────────────────────────────────

export const MOCK_PARTY = {
  roomId: 'room-mock-001',
  joinCode: 'ABC123',
  hostId: 'user-listener-001',
  name: 'Phòng của Nghiệp',
  currentSongId: 'song-001',
  playbackPositionSec: 84,
  members: [
    { userId: 'user-listener-001', name: 'Nghiệp',        isHost: true,  avatarUrl: 'https://picsum.photos/seed/user001/100/100' },
    { userId: 'user-creator-001',  name: 'Linh',          isHost: false, avatarUrl: 'https://picsum.photos/seed/user002/100/100' },
    { userId: 'user-member-003',   name: 'Hải',           isHost: false },
  ],
};
