import {
  FileText,
  File,
  BookOpen,
  ClipboardList,
  Settings,
  Wrench,
  Users,
  Building2,
  ShieldCheck,
  Gauge,
  BarChart3,
  Calendar,
  Mail,
  Phone,
  Globe,
  Database,
  Cpu,
  Package,
  Truck,
  GraduationCap,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react'

/**
 * Bo icon co san cho admin chon. Cot `icon` trong DB giu chinh cai khoa o day.
 * Dung danh sach co dinh thay vi import dong ca thu vien de goi build khong phinh to.
 */
export const ICONS = {
  'file-text': FileText,
  file: File,
  'book-open': BookOpen,
  'clipboard-list': ClipboardList,
  settings: Settings,
  wrench: Wrench,
  users: Users,
  building: Building2,
  shield: ShieldCheck,
  gauge: Gauge,
  chart: BarChart3,
  calendar: Calendar,
  mail: Mail,
  phone: Phone,
  globe: Globe,
  database: Database,
  cpu: Cpu,
  package: Package,
  truck: Truck,
  education: GraduationCap,
  idea: Lightbulb,
  warning: AlertTriangle,
}

export const ICON_KEYS = Object.keys(ICONS)

export function iconComponent(name) {
  return ICONS[name] ?? null
}
