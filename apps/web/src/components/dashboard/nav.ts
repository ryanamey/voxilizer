import {
  AudioWaveformIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  ListMusicIcon,
  MicIcon,
  MusicIcon,
  PianoIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Sections that exist in the navigation but are not built yet. */
  soon?: boolean;
}

/** Single source of truth for dashboard sections (sidebar, overview cards, page titles). */
export const NAV_MAIN: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
    description: "Your studio at a glance.",
  },
  {
    title: "Grit Lab",
    href: "/dashboard/grit-lab",
    icon: AudioWaveformIcon,
    description: "Design a vocal tone, hear it on any note, and save it to your library.",
  },
  {
    title: "Melody Studio",
    href: "/dashboard/melody-studio",
    icon: ListMusicIcon,
    description: "Write a vocal line with your saved tones and see its vocal load.",
  },
  {
    title: "Vocal Tuner",
    href: "/dashboard/vocal-tuner",
    icon: PianoIcon,
    description: "Pick a note on the piano, sing it, and see in real time how close you are.",
  },
  {
    title: "Songs",
    href: "/dashboard/songs",
    icon: MusicIcon,
    description: "All your saved melodies and tone maps.",
    soon: true,
  },
  {
    title: "Lessons",
    href: "/dashboard/lessons",
    icon: BookOpenIcon,
    description: "Step-by-step training, stage by stage.",
    soon: true,
  },
  {
    title: "Progress",
    href: "/dashboard/progress",
    icon: LineChartIcon,
    description: "Daily check-ins and effect time.",
    soon: true,
  },
  {
    title: "Voice Profile",
    href: "/dashboard/voice-profile",
    icon: MicIcon,
    description: "Record five vowels once so playback sounds like you.",
    soon: true,
  },
];

export const NAV_SECONDARY: NavItem[] = [
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    description: "Account and preferences.",
    soon: true,
  },
];

export const ALL_NAV = [...NAV_MAIN, ...NAV_SECONDARY];
