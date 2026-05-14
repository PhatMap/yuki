import type { Character, Chapter, Story, StoryBranch, WorldNote } from "./types";

export const stories: Story[] = [
  {
    id: "story-1",
    title: "Thiên Kiếm Lưu Vân",
    description:
      "Một thiếu niên bị trục xuất khỏi tông môn, sau đó phát hiện kiếm hồn cổ đại trong cơ thể.",
    genre: "xianxia",
    tone: "epic",
    canonAdherence: "inspired-only",
    isFanwork: false,
    createdAt: "2026-05-14",
    updatedAt: "2026-05-14",
  },
  {
    id: "story-2",
    title: "Học Viện Bóng Đêm",
    description:
      "Một học viện bí mật nơi học sinh điều tra các vụ mất tích liên quan đến quái vật.",
    genre: "mystery",
    tone: "dark",
    canonAdherence: "completely-different",
    isFanwork: false,
    createdAt: "2026-05-14",
    updatedAt: "2026-05-14",
  },
];

export const characters: Character[] = [
  {
    id: "char-1",
    storyId: "story-1",
    name: "Lâm Vân",
    role: "Main Character",
    personality: "Trầm tĩnh, cố chấp, trọng lời hứa.",
    goal: "Tìm ra sự thật về kiếm hồn trong cơ thể.",
  },
  {
    id: "char-2",
    storyId: "story-1",
    name: "Mộ Thanh Hàn",
    role: "Mentor",
    personality: "Lạnh lùng, lý trí, che giấu quá khứ.",
    goal: "Ngăn Lâm Vân đi vào con đường cũ của mình.",
  },
];

export const chapters: Chapter[] = [
  {
    id: "chapter-1",
    storyId: "story-1",
    title: "Chương 1: Bị trục xuất",
    content:
      "Đêm mưa phủ xuống Thanh Vân Tông. Lâm Vân quỳ trước đại điện, trên vai vẫn còn vết máu chưa khô...",
    order: 1,
    createdAt: "2026-05-14",
  },
];

export const branches: StoryBranch[] = [
  {
    id: "branch-1",
    storyId: "story-1",
    name: "Nhánh báo thù",
    description:
      "Lâm Vân không tha thứ cho tông môn và chọn con đường trả thù.",
    divergencePoint: "Sau khi bị trục xuất khỏi Thanh Vân Tông.",
  },
];

export const worldNotes: WorldNote[] = [
  {
    id: "world-1",
    storyId: "story-1",
    title: "Hệ thống tu luyện",
    content: "Luyện Khí → Trúc Cơ → Kim Đan → Nguyên Anh → Hóa Thần.",
    category: "power-system",
  },
];
