// Icon.jsx — единый плоский одноцветный иконсет поверх lucide-react.
// Использование: <Icon name="chat" size={20} />
// Цвет наследуется через currentColor — задавай через style/color родителя.
import {
  MessageCircle, Users, Search, Pin, PinOff, Trash2, Send, Bell, BellOff,
  Settings, Paperclip, Pencil, Mic, Ban, LogOut, X, Reply, BookOpen,
  Eye, EyeOff, MoreVertical, MoreHorizontal, ArrowLeft, ArrowRight, Check,
  CheckCheck, Plus, UserPlus, UserMinus, UserX, Image as ImageIcon, Film,
  Music, File, Link as LinkIcon, Share2, Copy, Phone, Mail, Lock, Unlock,
  AlertCircle, Info, HelpCircle, Star, Sparkles, Forward, Archive,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Play, Pause, Volume2,
  VolumeX, Camera, Edit3, Smile, Heart, Flag, Filter, Download, Upload,
  RefreshCw, Loader, Calendar, Clock, MapPin, Home, User, Hash,
  Bookmark, BookmarkPlus, Inbox, Box,
} from 'lucide-react';

const MAP = {
  chat: MessageCircle, chats: MessageCircle, message: MessageCircle,
  contacts: Users, users: Users, group: Users,
  search: Search,
  pin: Pin, unpin: PinOff,
  trash: Trash2, delete: Trash2,
  send: Send,
  bell: Bell, notifications: Bell, 'bell-off': BellOff,
  settings: Settings, gear: Settings,
  attach: Paperclip, paperclip: Paperclip,
  pencil: Pencil, edit: Edit3,
  mic: Mic, voice: Mic,
  ban: Ban, block: Ban,
  logout: LogOut,
  close: X, x: X,
  reply: Reply,
  book: BookOpen, guide: BookOpen,
  eye: Eye, 'eye-off': EyeOff,
  dots: MoreVertical, 'dots-h': MoreHorizontal, more: MoreVertical,
  back: ArrowLeft, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight,
  check: Check, 'check-double': CheckCheck,
  plus: Plus, add: Plus,
  'user-plus': UserPlus, 'user-add': UserPlus,
  'user-minus': UserMinus, 'user-remove': UserMinus,
  'user-x': UserX,
  image: ImageIcon, photo: ImageIcon, gallery: ImageIcon,
  video: Film, film: Film,
  music: Music, audio: Music,
  file: File, document: File,
  link: LinkIcon, url: LinkIcon,
  share: Share2,
  copy: Copy,
  phone: Phone,
  mail: Mail, email: Mail,
  lock: Lock, unlock: Unlock,
  alert: AlertCircle, warning: AlertCircle,
  info: Info,
  help: HelpCircle, question: HelpCircle,
  star: Star,
  sparkle: Sparkles, moments: Sparkles,
  forward: Forward,
  archive: Archive,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  play: Play, pause: Pause,
  volume: Volume2, 'volume-off': VolumeX, mute: VolumeX,
  camera: Camera,
  smile: Smile, emoji: Smile,
  heart: Heart, like: Heart,
  flag: Flag, report: Flag,
  filter: Filter,
  download: Download,
  upload: Upload,
  refresh: RefreshCw, reload: RefreshCw,
  loader: Loader, spinner: Loader,
  calendar: Calendar, date: Calendar,
  clock: Clock, time: Clock,
  pin_map: MapPin, location: MapPin,
  home: Home,
  user: User, profile: User,
  hash: Hash, tag: Hash,
  bookmark: Bookmark, saved: Bookmark, talk: Bookmark,
  'bookmark-plus': BookmarkPlus,
  inbox: Inbox, waitlist: Inbox,
  box: Box, archive_box: Box,
};

export default function Icon({ name, size = 20, stroke = 1.75, color, style, className, ...rest }) {
  const Cmp = MAP[name];
  if (!Cmp) {
    if (typeof console !== 'undefined') console.warn('Icon: unknown name', name);
    return null;
  }
  return (
    <Cmp
      size={size}
      strokeWidth={stroke}
      color={color}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      className={className}
      {...rest}
    />
  );
}
