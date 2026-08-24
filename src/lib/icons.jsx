import React from 'react'
import {
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, RotateCw, RefreshCw,
  Check, CircleCheck, X, Plus, Minus, ChevronDown, ChevronRight, Menu, Circle, MoreHorizontal,
  Calendar, CalendarDays, Clock, Hourglass, Timer,
  ClipboardList, ClipboardCheck, FileText, File, Files, Folder, FolderKanban, Package,
  BookOpen, Scroll, NotebookPen, SquarePen, Pencil, Trash2,
  Shield, TriangleAlert, Siren, Lock, LockOpen, Eye, EyeOff,
  Star, Trophy, Target, PartyPopper, Sparkles, Flame, Heart, ThumbsUp,
  MapPin, Home, Building2, DoorOpen, TreePalm,
  Search, Bell, MessageSquare, Mail, Megaphone, Send, Phone, Smartphone,
  Users, User, UserPlus, UsersRound, Handshake, Baby, Briefcase, PersonStanding,
  Rocket, Zap, Bus, Plane, Car,
  ChartColumn, TrendingUp, ChartPie,
  Pill, Syringe, Bandage, Stethoscope, HeartPulse,
  CreditCard, PoundSterling, Wallet, Receipt,
  Palette, Settings, Wrench, Puzzle, Compass, SlidersHorizontal,
  Paperclip, Link as LinkIcon, Pin, Tag, Tags,
  Camera, Image as ImageIcon, Images,
  Download, Upload, Printer, Share2,
  GraduationCap, Sprout, Dumbbell, CloudRain, Sun,
  Smile, Meh, Hand, Lightbulb, Info, CircleHelp, LogOut, LogIn,
} from 'lucide-react'

// One place that decides what an icon means, so a glyph is not redefined in
// forty files.
//
// Two resolution paths, on purpose:
//
//   ICONS  semantic names ('registers', 'safeguarding') -- what new code uses.
//   EMOJI  the raw glyph ('📋', '🛡️') -- what existing code already passes.
//
// The emoji table is what makes a 130-file migration tractable. A config array
// full of `icon: '📅'` starts rendering a real icon the moment its render site
// goes through <Icon>, with no need to rewrite the config in the same commit.
// Rewriting both ends at once is where a codemod this size goes wrong: miss one
// render site and the screen prints the word "calendar" where an icon should be.
//
// Anything unresolved falls through to rendering as-is, so an unconverted
// screen -- or an org's own emoji in their data -- looks exactly as it did.

const ICONS = {
  // Delivery
  calendar: Calendar, sessions: Rocket, projects: FolderKanban,
  registers: ClipboardCheck, mentoring: Handshake,
  // People
  children: Users, volunteers: Heart, newsletter: Mail,
  // Safety
  safeguarding: Shield, risk: TriangleAlert, forms: FileText, medical: Pill,
  // Insights
  insights: ChartColumn, reports: TrendingUp, impact: Sprout, fundraising: PoundSterling,
  // Operations
  operations: Wrench, payments: CreditCard, resources: CalendarDays, events: Plane,
  messaging: MessageSquare, gallery: ImageIcon, hr: Briefcase, parents: UsersRound,
  templates: Files,
  // Chrome
  home: Home, today: Zap, settings: Settings, branding: Palette,
  add: Plus, search: Search, bell: Bell, help: CircleHelp,
  signout: LogOut, chevron: ChevronRight,
  // Register tools
  print: Printer, import: Upload, export: Download, fields: Puzzle,
  history: RotateCw, addChild: UserPlus, groups: Tags,
  // Common actions
  check: Check, close: X, edit: Pencil, delete: Trash2, view: Eye,
  lock: Lock, location: MapPin, clock: Clock, star: Star,
}

// Raw glyph -> component. Covers the glyphs actually present in the codebase.
const EMOJI = {
  // arrows and controls
  '→': ArrowRight, '←': ArrowLeft, '↑': ArrowUp, '↓': ArrowDown,
  '↗': ArrowUpRight, '↻': RotateCw, '🔄': RefreshCw,
  '▾': ChevronDown, '▸': ChevronRight, '☰': Menu,
  '●': Circle, '🔴': Circle,
  '✓': Check, '✔': Check, '✅': CircleCheck, '☑': CircleCheck,
  '✕': X, '✖': X, '❌': X, '✗': X,
  '➕': Plus, '✚': Plus, '➖': Minus, '⋯': MoreHorizontal,

  // time
  '📅': Calendar, '🗓️': CalendarDays, '🗓': CalendarDays,
  '🕐': Clock, '⏰': Clock, '⏱️': Timer, '⏳': Hourglass,

  // documents
  '📋': ClipboardList, '📝': SquarePen, '📄': File, '📃': File,
  '📁': Folder, '📂': Folder, '📦': Package, '📚': BookOpen, '📖': BookOpen,
  '📜': Scroll, '🗒️': NotebookPen, '✏️': Pencil, '✏': Pencil,
  '🗑️': Trash2, '🗑': Trash2,

  // safety
  '🛡️': Shield, '🛡': Shield, '⚠️': TriangleAlert, '⚠': TriangleAlert,
  '🚨': Siren, '🔒': Lock, '🔓': LockOpen, '👁': Eye, '👁️': Eye, '🙈': EyeOff,

  // sentiment and status
  '⭐': Star, '★': Star, '🌟': Star, '🏆': Trophy, '🎯': Target,
  '🎉': PartyPopper, '✨': Sparkles, '🔥': Flame,
  '❤️': Heart, '❤': Heart, '💜': Heart, '👍': ThumbsUp,
  '🙂': Smile, '😊': Smile, '😐': Meh, '👋': Hand,
  '💡': Lightbulb, 'ℹ️': Info, '❓': CircleHelp, '❔': CircleHelp,

  // places
  '📍': MapPin, '🏠': Home, '🏢': Building2, '🚪': DoorOpen, '🏖️': TreePalm,

  // comms
  '🔍': Search, '🔎': Search, '🔔': Bell, '💬': MessageSquare, '🗨️': MessageSquare,
  '✉️': Mail, '📧': Mail, '📨': Mail, '📬': Mail, '📤': Send,
  '📣': Megaphone, '📢': Megaphone, '📞': Phone, '📱': Smartphone,

  // people
  '👥': Users, '👤': User, '🧒': Baby, '👧': Baby, '👦': Baby,
  '🤝': Handshake, '🧑‍💼': Briefcase, '👨‍👩‍👧': UsersRound, '🏃': PersonStanding,

  // movement
  '🚀': Rocket, '⚡': Zap, '🚌': Bus, '✈️': Plane, '🚗': Car,

  // data
  '📊': ChartColumn, '📈': TrendingUp, '📉': TrendingUp,  '🥧': ChartPie,

  // health
  '💊': Pill, '💉': Syringe, '🩹': Bandage, '🩺': Stethoscope, '🫀': HeartPulse,

  // money
  '💳': CreditCard, '💷': PoundSterling, '💰': Wallet, '🧾': Receipt,

  // tools
  '🎨': Palette, '⚙️': Settings, '🛠️': Wrench, '🔧': Wrench,
  '🧩': Puzzle, '🧭': Compass, '🎛️': SlidersHorizontal,

  // attachments
  '📎': Paperclip, '🔗': LinkIcon, '📌': Pin, '🏷️': Tag, '🏷': Tag,

  // media
  '📷': Camera, '📸': Camera, '🖼️': ImageIcon, '🖼': ImageIcon, '🎞️': Images,

  // transfer
  '📥': Download, '⬇️': Download, '⬇': Download, '⬆️': Upload,
  '🖨': Printer, '🖨️': Printer, '📡': Share2,

  // misc domain
  '🎓': GraduationCap, '🌱': Sprout, '⚽': Dumbbell, '🏅': Trophy,
  '🌧️': CloudRain, '🌦️': CloudRain, '⛈️': CloudRain, '☀️': Sun,
  '🔑': LogIn,
}

/**
 * <Icon name="registers" />  or  <Icon name="📋" />
 *
 * Colour comes from `currentColor`, so an icon inherits whatever the
 * surrounding button or link is already doing rather than needing a colour
 * passed at every call site.
 */
// Named tones instead of a colour at every call site.
//
// `brand` reads the CSS variable the org's palette publishes, so an icon
// follows the organisation's colour without the component needing to know
// which org it is in or subscribe to anything.
//
// The semantic tones exist so brand colour does not swallow meaning: a warning
// triangle in a charity's brand purple stops reading as a warning. Colour that
// carries information keeps its own.
const TONES = {
  inherit: undefined,
  brand: 'var(--org-primary)',
  brandInk: 'var(--org-ink)',       // brand-coloured text on white, contrast-safe
  onBrand: 'var(--org-on-primary)', // sitting on top of the brand colour
  danger: '#DC2626',
  warn: '#B45309',
  ok: '#15803D',
  muted: 'var(--text3, #94A3B8)',
}

export default function Icon({ name, size = '1em', strokeWidth = 1.75, tone = 'inherit', style, ...rest }) {
  const Cmp = ICONS[name] || EMOJI[name]
  if (!Cmp) {
    // Unmapped: an unconverted screen, or genuinely the org's own text.
    return <span style={style} {...rest}>{name}</span>
  }
  return (
    <Cmp
      // 1em, not a fixed pixel size. Most of these replaced a glyph sitting
      // inline in text -- "Continue →", "✓ Saved" -- where the surrounding
      // font-size was already the thing controlling how big it looked. A fixed
      // 18px would tower over 11px caption text and shrink inside a 60px
      // celebration mark. Call sites that want a specific size still pass one.
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      // SVG aligns to the baseline by default, which sits an icon slightly low
      // against the text it follows.
      style={{
        flexShrink: 0,
        verticalAlign: '-0.125em',
        ...(TONES[tone] ? { color: TONES[tone] } : null),
        ...style,
      }}
      {...rest}
    />
  )
}

export const isMappedIcon = (name) => !!(ICONS[name] || EMOJI[name])
