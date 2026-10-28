import {
  AudioWaveformIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  MicIcon,
  MusicIcon,
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
    description: "Design a tone and a melody, hear it, and see its vocal load.",
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
