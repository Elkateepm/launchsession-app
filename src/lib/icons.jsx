import React from 'react'
import {
  Calendar, CalendarDays, Rocket, FolderKanban, ClipboardCheck, Handshake,
  Users, Heart, Mail, Shield, TriangleAlert, FileText, Pill,
  ChartColumn, TrendingUp, Sprout, PoundSterling,
  Wrench, CreditCard, Plane, MessageSquare, Image as ImageIcon,
  Briefcase, UsersRound, Files, Settings, Palette,
  Home, Zap, Plus, Search, Bell, CircleHelp, LogOut, ChevronRight,
  Printer, Upload, Download, Puzzle, History, UserPlus, Tags,
  Check, X, Pencil, Trash2, Eye, Lock, MapPin, Clock, Star,
} from 'lucide-react'

// One place that decides what an icon means, so a glyph is not redefined in
// forty files.
//
// The migration off emoji is incremental by design: `name` falls through to
// being rendered as-is when it is not in the map. A screen that has not been
// converted yet passes its emoji straight through and looks exactly as it did,
// so this can move module by module rather than in one 130-file commit nobody
// can review.
const ICONS = {
  // Delivery
  calendar: Calendar,
  sessions: Rocket,
  projects: FolderKanban,
  registers: ClipboardCheck,
  mentoring: Handshake,

  // People
  children: Users,
  volunteers: Heart,
  newsletter: Mail,

  // Safety
  safeguarding: Shield,
  risk: TriangleAlert,
  forms: FileText,
  medical: Pill,

  // Insights
  insights: ChartColumn,
  reports: TrendingUp,
  impact: Sprout,
  fundraising: PoundSterling,

  // Operations
  operations: Wrench,
  payments: CreditCard,
  resources: CalendarDays,
  events: Plane,
  messaging: MessageSquare,
  gallery: ImageIcon,
  hr: Briefcase,
  parents: UsersRound,
  templates: Files,

  // Chrome
  home: Home,
  today: Zap,
  settings: Settings,
  branding: Palette,
  add: Plus,
  search: Search,
  bell: Bell,
  help: CircleHelp,
  signout: LogOut,
  chevron: ChevronRight,

  // Register tools
  print: Printer,
  import: Upload,
  export: Download,
  fields: Puzzle,
  history: History,
  addChild: UserPlus,
  groups: Tags,

  // Common actions
  check: Check,
  close: X,
  edit: Pencil,
  delete: Trash2,
  view: Eye,
  lock: Lock,
  location: MapPin,
  clock: Clock,
  star: Star,
}

/**
 * <Icon name="registers" />
 *
 * Renders a Lucide icon when the name is mapped, and the raw value otherwise so
 * unconverted screens keep working. Colour comes from `currentColor`, so an
 * icon inherits whatever the surrounding button or link is already doing
 * instead of needing a colour passed at every call site.
 */
export default function Icon({ name, size = 18, strokeWidth = 1.75, style, ...rest }) {
  const Cmp = ICONS[name]
  if (!Cmp) {
    // Not converted yet (or a genuine emoji, like an org's own branding).
    return <span style={style} {...rest}>{name}</span>
  }
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  )
}

export const isMappedIcon = (name) => !!ICONS[name]
