/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Instagram, MessageCircle, Send, Globe, 
  Lock, Clock, ExternalLink, ShieldCheck,
  Camera, Calendar, ShoppingBag, Settings, X, ChevronRight, ChevronLeft, Plus, Trash2,
  ArrowRight, LogOut, User as UserIcon, Play, Video, FileEdit, Music, Volume2, VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, logout, syncUserProfile, UserProfile, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy, setDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Global Configuration & Data
 */
const INSTAGRAM_URL = "https://www.instagram.com/konjo_grit/";
const ADMIN_EMAIL = "butangas199@gmail.com";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, setError?: (msg: string) => void) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (setError) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('permission-denied')) {
      setError("PROHIBITED ACTION: PERMISSION DENIED");
    } else {
      setError(errorMsg);
    }
  }
  // We don't want to crash the whole app if some action fails
}

const LOCALE_SETTINGS = {
  KO: { label: '한국어', currency: '₩', rateKey: 'krw' },
  EN: { label: 'English', currency: '$', rateKey: 'usd' },
  FR: { label: 'Français', currency: '€', rateKey: 'eur' },
  JP: { label: '日本語', currency: '¥', rateKey: 'jpy' },
  CH: { label: '简体中文', currency: '¥', rateKey: 'cny' },
};

const TRANSLATIONS: Record<string, any> = {
  KO: {
    portfolio: 'Portfolio',
    drop: 'Drop',
    booking: 'Booking',
    guestMode: 'GUEST MODE',
    vipAccess: 'VIP ACCESS',
    explore: 'EXPLORE ARCHIVE',
    limitedDrop: 'Limited Drop',
    dropDesc: '모든 제품은 인스타그램(@konjo_grit) 드랍 일정에 맞춰 한정 판매됩니다.',
    reservation: 'Reservation',
    resDesc: '원활한 작업을 위해 모든 상담은 예약제로 운영됩니다.\n인스타그램 DM(@konjo_grit) 또는 하단 상담 채널로 연락주세요.',
    connect: '상담 메신저 연결하기',
    management: 'Management',
    siteConfig: 'Site Config',
    prodManager: 'Product Manager',
    vipWhitelist: 'VIP Whitelist',
    autoResponse: 'Automatic Response Template',
    login: '로그인',
    logout: '로그아웃',
    addPortfolio: '포트폴리오 추가',
    edit: '수정',
  },
  EN: {
    portfolio: 'Portfolio',
    drop: 'Drop',
    booking: 'Booking',
    guestMode: 'GUEST MODE',
    vipAccess: 'VIP ACCESS',
    explore: 'EXPLORE ARCHIVE',
    limitedDrop: 'Limited Drop',
    dropDesc: 'All products are sold in limited quantities according to the Instagram (@konjo_grit) drop schedule.',
    reservation: 'Reservation',
    resDesc: 'All consultations are by appointment only for smooth work.\nPlease contact us via Instagram DM (@konjo_grit) or the consultation channel below.',
    connect: 'Connect to Messenger',
    management: 'Management',
    siteConfig: 'Site Config',
    prodManager: 'Product Manager',
    vipWhitelist: 'VIP Whitelist',
    autoResponse: 'Automatic Response Template',
    login: 'LOGIN',
    logout: 'LOGOUT',
    addPortfolio: 'ADD PORTFOLIO',
    edit: 'EDIT',
  },
  FR: {
    portfolio: 'Portfolio',
    drop: 'Drop',
    booking: 'Réservation',
    guestMode: 'MODE INVITÉ',
    vipAccess: 'ACCÈS VIP',
    explore: 'EXPLORER L\'ARCHIVE',
    limitedDrop: 'Édition Limitée',
    dropDesc: 'Tous les produits sont vendus en quantités limitées selon le calendrier de Instagram (@konjo_grit).',
    reservation: 'Réservation',
    resDesc: 'Toutes les consultations se font uniquement sur rendez-vous.\nVeuillez nous contacter via Instagram DM (@konjo_grit) 또는 le canal ci-dessous.',
    connect: 'Contacter le Messager',
    management: 'Gestion',
    siteConfig: 'Configuration',
    prodManager: 'Gestionnaire de Produits',
    vipWhitelist: 'Liste Blanche VIP',
    autoResponse: 'Modèle de Réponse Automatique',
  },
  JP: {
    portfolio: 'ポートフォリオ',
    drop: 'ドロップ',
    booking: '予約',
    guestMode: 'ゲストモード',
    vipAccess: 'VIPアクセス',
    explore: 'アーカイブを探索',
    limitedDrop: 'リミテッドドロップ',
    dropDesc: 'すべての製品は、Instagram（@konjo_grit）のドロップスケジュールに従って限定販売されます。',
    reservation: '予約',
    resDesc: '円滑な作業のため、すべての相談は予約制で運営されます。\nInstagram DM（@konjo_grit）または下段の相談チャネルにお問い合わせください。',
    connect: 'メッセンジャーに接続',
    management: '管理',
    siteConfig: 'サイト設定',
    prodManager: '製品管理',
    vipWhitelist: 'VIPホワイトリスト',
    autoResponse: '自動応答テンプレート',
  },
  CH: {
    portfolio: '作品集',
    drop: '发布',
    booking: '预约',
    guestMode: '访客模式',
    vipAccess: 'VIP访问',
    explore: '探索档案',
    limitedDrop: '限量发布',
    dropDesc: '所有产品均根据 Instagram (@konjo_grit) 发布时间表限量销售。',
    reservation: '预约',
    resDesc: '为了确保工作顺利进行，所有咨询均实行预约制。\n请通过 Instagram DM (@konjo_grit) 或下方的咨询渠道与我们联系。',
    connect: '连接到信使',
    management: '管理',
    siteConfig: '网站配置',
    prodManager: '产品管理',
    vipWhitelist: 'VIP 白名单',
    autoResponse: '自动回复模板',
  },
};

/**
 * Background Music Component (Hidden YouTube Player)
 */
const BackgroundMusic = ({ url, isAdmin }: { url: string | undefined | null, isAdmin?: boolean }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!url) {
    if (isAdmin) {
      return (
        <div className="fixed top-8 right-10 md:right-48 z-[100] opacity-20 hover:opacity-100 transition-opacity">
          <span className="text-[7px] tracking-widest text-white/50 bg-white/5 px-3 py-1 border border-white/10 uppercase italic">
            Audio Not Set
          </span>
        </div>
      );
    }
    return null;
  }

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const id = getYouTubeId(url);
  if (!id) return null;

  return (
    <div 
      className="fixed bottom-8 left-8 z-[100]"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="hidden pointer-events-none opacity-0 w-0 h-0 overflow-hidden">
        <iframe 
          src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${id}&enablejsapi=1`}
          allow="autoplay; encrypted-media"
          title="Background Music"
          key={id}
        />
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className={`relative group flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-700 backdrop-blur-md ${!isMuted ? 'border-neon/30 bg-neon/5' : 'border-white/5 bg-black/20 hover:border-white/20'}`}
        >
          {/* Subtle Ring Animation when playing */}
          {!isMuted && (
            <motion.div 
              className="absolute inset-0 rounded-full border border-neon/50"
              animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
          )}

          <div className="relative z-10 flex items-center justify-center">
            {isMuted ? (
              <VolumeX size={12} className="text-white/20 group-hover:text-white/60 transition-colors" />
            ) : (
              <div className="flex items-end gap-[1.5px] h-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: ["40%", "100%", "40%"] }}
                    transition={{ 
                      duration: 0.8, 
                      repeat: Infinity, 
                      delay: i * 0.15,
                      ease: "easeInOut"
                    }}
                    className="w-[1px] bg-neon shadow-[0_0_5px_rgba(0,255,153,0.3)]" 
                  />
                ))}
              </div>
            )}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="pointer-events-none"
            >
              <div className="flex flex-col border-l border-white/10 pl-4 py-1">
                <span className={`text-[7px] tracking-[0.4em] uppercase font-bold italic leading-none ${!isMuted ? 'text-neon' : 'text-white/20'}`}>
                  {isMuted ? 'AUDIO SYSTEM MUTED' : 'KONJO AUDITORY LINK'}
                </span>
                {!isMuted && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[5px] tracking-[0.2em] text-white/10 uppercase mt-1.5"
                  >
                    Processing stream signal...
                  </motion.span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Floating Consultation Component
 */
const FloatingConsultation = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const snsLinks = [
    { icon: <Instagram size={22}/>, label: 'Instagram DM', link: INSTAGRAM_URL, color: 'hover:text-neon' },
    { icon: <MessageCircle size={22}/>, label: 'KakaoTalk', link: "#", color: 'hover:text-[#FEE500]' },
    { icon: <Send size={22}/>, label: 'Telegram', link: "#", color: 'hover:text-[#0088cc]' },
    { icon: <MessageCircle size={22}/>, label: 'WeChat', link: "#", color: 'hover:text-[#07C160]' },
    { icon: <ExternalLink size={22}/>, label: 'Messenger', link: "#", color: 'hover:text-[#0084FF]' },
  ];

  return (
    <div 
      className="fixed bottom-8 right-8 z-[100] flex flex-col items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex flex-col-reverse items-center">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full bg-black border ${isOpen ? 'border-neon ring-4 ring-neon/20' : 'border-white/20'} flex items-center justify-center text-white transition-all shadow-2xl group hover:border-neon z-20`}
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isOpen ? <X size={24} className="text-neon" /> : <MessageCircle size={24} className="group-hover:text-neon text-white/70" />}
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="flex flex-col gap-4 overflow-hidden px-2 pb-2"
            >
              {snsLinks.map((sns, idx) => (
                <motion.div 
                  key={idx} 
                  className="group relative flex items-center justify-center"
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ duration: 0.2, delay: (snsLinks.length - 1 - idx) * 0.05 }}
                >
                  <span className="absolute right-16 opacity-0 group-hover:opacity-100 transition-all text-[8px] tracking-widest text-neon bg-black/90 px-3 py-1.5 border border-neon/30 whitespace-nowrap uppercase italic font-bold">
                    {sns.label}
                  </span>
                  <a 
                    href={sns.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`bg-surface p-3.5 rounded-full border border-white/10 text-offwhite transition-all hover:scale-110 shadow-2xl ${sns.color}`}
                  >
                    {React.cloneElement(sns.icon as React.ReactElement, { size: 18 })}
                  </a>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {!isOpen && (
        <div className="h-8 w-[1px] bg-neon/20 mx-auto mt-2 animate-pulse" />
      )}
    </div>
  );
};

/**
 * Drop Card Component
 */
const DropCard = ({ product, locale, userStatus, isAdmin, onEdit, onDelete, onImageClick }: { product: any, locale: string, userStatus: string, isAdmin: boolean, onEdit?: (p: any) => void, onDelete?: (id: string) => void, onImageClick?: (url: string, gallery?: string[]) => void }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const isVIP = userStatus === 'VIP';
  const targetDate = new Date(isVIP ? product.vipDropDate : product.dropDate);

  const validImages = (product.images || []).filter((img: string) => img && img.trim() !== '');
  const displayImages = validImages.length > 0 ? validImages : [product.image];

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setIsLive(true);
        setTimeLeft("COLLECTION LIVE");
        clearInterval(timer);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${d}D ${h}H ${m}M ${s}S`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const currency = (LOCALE_SETTINGS as any)[locale].currency;
  const rateKey = (LOCALE_SETTINGS as any)[locale].rateKey;

  return (
    <motion.div 
      layout
      className="group relative bg-surface border border-white/5 overflow-hidden transition-all hover:border-neon/40"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {isVIP && (
        <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10 flex items-center gap-2 bg-neon text-black px-2 py-1 text-[7px] md:text-[9px] font-black tracking-widest">
          <ShieldCheck size={10} className="md:w-[12px]" /> VIP EARLY
        </div>
      )}
      
      {isAdmin && (
        <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10 flex gap-1 md:gap-2">
          <button 
            onClick={() => onEdit?.(product)}
            className="p-1.5 md:p-2 bg-black/60 text-neon hover:bg-neon hover:text-black transition-all border border-neon/30"
          >
            <Settings size={12} className="md:w-[14px]" />
          </button>
          <button 
             onClick={() => onDelete?.(product.id)}
             className="p-1.5 md:p-2 bg-black/60 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
          >
            <Trash2 size={12} className="md:w-[14px]" />
          </button>
        </div>
      )}

      <div 
        className="aspect-[1/1] md:aspect-[4/5] overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700 cursor-zoom-in relative"
        onClick={() => onImageClick?.(displayImages[currentImgIdx], displayImages)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImgIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            <MediaRenderer 
              url={displayImages[currentImgIdx]} 
              alt={product.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
            />
          </motion.div>
        </AnimatePresence>

        {displayImages.length > 1 && (
          <>
            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIdx((prev) => (prev - 1 + displayImages.length) % displayImages.length);
                }}
                className="p-1 bg-black/40 text-white hover:bg-neon hover:text-black transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIdx((prev) => (prev + 1) % displayImages.length);
                }}
                className="p-1 bg-black/40 text-white hover:bg-neon hover:text-black transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {displayImages.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-1 h-1 rounded-full transition-all ${idx === currentImgIdx ? 'bg-neon w-3' : 'bg-white/30'}`}
                />
              ))}
            </div>

            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[7px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Camera size={8} /> {displayImages.length}
            </div>
          </>
        )}
      </div>
      <div className="p-3 md:p-5 lg:p-6 space-y-3 md:space-y-4 lg:space-y-6">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-[10px] md:text-xs lg:text-sm text-white font-light tracking-tighter leading-tight w-2/3 truncate md:whitespace-normal md:line-clamp-2">{product.name}</h3>
          <p className="text-neon font-bold text-[9px] md:text-xs lg:text-sm leading-none whitespace-nowrap">
            {currency}{product.prices?.[rateKey] || "0"}
          </p>
        </div>

        {product.description && (
          <p className="hidden md:block text-[9px] lg:text-[10px] text-offwhite/40 leading-relaxed tracking-widest uppercase line-clamp-2 lg:line-clamp-3 font-light">
            {product.description}
          </p>
        )}

        <div className="pt-3 md:pt-4 lg:pt-6 border-t border-white/10 flex flex-col gap-3 md:gap-5">
          <div className="flex items-center gap-2 md:gap-3 text-[7px] md:text-[9px] lg:text-[11px] tracking-[0.2em] text-offwhite/50 uppercase">
            <Clock size={10} className="text-neon md:w-3 md:h-3 lg:w-3.5 lg:h-3.5" /> {timeLeft}
          </div>
          <motion.button 
            whileHover={isLive ? { scale: 1.02 } : {}}
            whileTap={isLive ? { scale: 0.98 } : {}}
            disabled={!isLive}
            onClick={() => window.open(product.instaLink, '_blank')}
            className={`w-full py-2.5 md:py-4 lg:py-5 text-[8px] md:text-[9px] lg:text-[10px] tracking-[0.2em] md:tracking-[0.4em] font-bold transition-all
              ${isLive ? 'bg-neon text-black hover:bg-white' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
          >
            {isLive ? 'RELEASED' : 'PENDING'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const DynamicCalendar = ({ schedules, isAdmin, onAdd, onDelete }: { schedules: any[], isAdmin: boolean, onAdd: (d: string) => void, onDelete: (id: string) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfMonth + 1;
    if (day < 1 || day > daysInMonth) return null;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const daySchedules = schedules.filter(s => s.date === dateStr);
    return { day, dateStr, daySchedules };
  });

  return (
    <div className="bg-black/40 backdrop-blur-md p-4 md:p-10 border border-white/5 rounded-sm shadow-2xl">
      <div className="flex justify-between items-center mb-12">
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-black tracking-[0.4em] text-white italic">
            {year}. {String(month + 1).padStart(2, '0')}
          </h3>
          <div className="h-[2px] w-8 bg-neon" />
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="px-4 py-3 bg-white/5 hover:bg-neon hover:text-black transition-all rounded-sm border border-white/5"><ChevronLeft size={16} /></button>
          <button onClick={nextMonth} className="px-4 py-3 bg-white/5 hover:bg-neon hover:text-black transition-all rounded-sm border border-white/5"><ChevronRight size={16} /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 w-full">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
          <div key={d} className={`bg-black py-3 md:py-4 text-[8px] md:text-[9px] tracking-[0.2em] font-black italic ${d === 'SUN' ? 'text-neon' : 'text-white/30'}`}>
            {d}
          </div>
        ))}
        {days.map((d, i) => (
          <div 
            key={i} 
            onClick={() => d && isAdmin && onAdd(d.dateStr)}
            className={`min-h-[100px] md:min-h-[160px] bg-black p-2 md:p-3 flex flex-col items-start gap-1 md:gap-2 transition-all relative group/cell
              ${d ? 'hover:bg-white/[0.02]' : 'bg-transparent'} 
              ${d && isAdmin ? 'cursor-pointer' : ''}`}
          >
            {d && (
              <>
                <div className="flex justify-between items-start w-full">
                  <span className={`text-[10px] md:text-sm font-black italic transition-colors duration-500 ${d.daySchedules.length > 0 ? 'text-neon' : 'text-white/10 group-hover/cell:text-white/40'}`}>
                    {String(d.day).padStart(2, '0')}
                  </span>
                  {d.daySchedules.length > 0 && (
                    <div className="w-1 h-1 bg-neon shadow-[0_0_8px_rgba(0,255,153,0.3)] rounded-full animate-pulse md:hidden" />
                  )}
                </div>
                
                <div className="flex flex-col gap-1 w-full mt-1">
                  {d.daySchedules.map((s, idx) => (
                    <div 
                      key={idx} 
                      className="group relative flex items-center h-5 md:h-7 bg-white/[0.03] border-l border-neon/50 pl-1.5 md:pl-2 pr-1 transition-all hover:bg-white/5"
                    >
                      <span className="text-[6px] md:text-[8px] font-black text-neon uppercase tracking-wider truncate w-full group-hover:text-white transition-colors">
                        {s.title === 'BOOKED' || s.title === 'RESERVED' ? 'RESERVED' : s.title}
                      </span>
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                          className="absolute -right-1 -top-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-20"
                        >
                          <X size={6} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {isAdmin && d && (
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-neon/0 group-hover/cell:bg-neon/30 transition-all duration-500" />
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
  </div>
);
};

/**
 * Media Renderer Component
 */
const MediaRenderer = ({ url, type, className, alt = "", referrerPolicy = "no-referrer", controls = false }: { url: string | undefined | null, type?: 'image' | 'video', className?: string, alt?: string, referrerPolicy?: any, controls?: boolean }) => {
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isMediaLoaded) {
      // Increase delay to 6.5 seconds to hide YouTube initial watermarks/logo
      const timer = setTimeout(() => setIsReady(true), 6500);
      return () => clearTimeout(timer);
    }
  }, [isMediaLoaded]);

  if (!url) return null;
  
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('shorts/');
  const isVideo = type === 'video' || isYouTube || url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm');

  if (isVideo) {
    // Robust YouTube support
    const getYouTubeId = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    };

    const id = getYouTubeId(url);
    if (id) {
      return (
        <div className={`relative ${className} overflow-hidden bg-black flex items-center justify-center`}>
          {!isReady && (
            <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center gap-6 transition-opacity duration-700">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-[0.5px] border-white/5" />
                <motion.div 
                  className="absolute inset-0 border-t border-neon"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1 h-1 bg-neon shadow-[0_0_10px_rgba(0,255,153,0.5)]" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[7px] tracking-[0.6em] text-neon/60 uppercase font-black italic">
                  Konjo Archive
                </span>
                <span className="text-[5px] tracking-[0.3em] text-white/20 uppercase">
                  Establishing secure visual link...
                </span>
              </div>
            </div>
          )}
          <iframe 
            src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}${controls ? '&controls=1' : '&controls=0'}&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&enablejsapi=1`} 
            className={`w-full h-full transition-all duration-[2000ms] ease-out ${isReady ? 'opacity-100 scale-100' : 'opacity-0 scale-110'} ${!controls ? 'pointer-events-none scale-[1.15]' : ''}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={alt}
            onLoad={() => setIsMediaLoaded(true)}
          />
        </div>
      );
    }
    return (
      <div className={`relative ${className} overflow-hidden bg-black flex items-center justify-center`}>
        {!isReady && (
          <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center gap-4 transition-opacity duration-700">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border border-white/5 animate-pulse" />
              <div className="absolute inset-1 border-b border-neon/50 animate-bounce" />
            </div>
          </div>
        )}
        <video 
          src={url} 
          autoPlay 
          muted={!controls} 
          loop 
          playsInline 
          controls={controls}
          className={`w-full h-full object-cover transition-all duration-[2000ms] ease-out ${isReady ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
          onLoadedData={() => setIsMediaLoaded(true)}
        />
      </div>
    );
  }
  return (
    <img 
      src={url} 
      alt={alt} 
      referrerPolicy={referrerPolicy}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?q=80&w=1000&auto=format&fit=crop";
      }}
      className={className} 
    />
  );
};
export default function App() {
  const [page, setPage] = useState('home');
  const [locale, setLocale] = useState('KO');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedImg, setSelectedImg] = useState<{url: string, type: 'image' | 'video', gallery?: string[]} | null>(null);

  // Firestore Data States
  const [siteContent, setSiteContent] = useState<any>({
    heroTitle: "KONJO",
    heroDesc: "Premium Tattoo Artistry & Conceptual Garments Archive.",
    awards: "2024 SEOUL TATTOO CONVENTION GOLD\n2023 PARIS ART EXPO FEATURED\nGLOBAL CREATIVE DIRECTOR\nCONCEPTUAL GARMENTS DESIGNER\nBLACKWORK SPECIALIST\nSEOUL FASHION WEEK COLLAB\nWORLD TATTOO TOUR 2022\nART BASEL MIAMI EXHIBITOR\nMASTER OF MODERN TATTOOING\nCONVICTION THROUGH INK",
    heroMediaUrl: "https://images.unsplash.com/photo-1590201772372-897d0f338600?auto=format&fit=crop&q=80",
    heroMediaType: "image",
    mobileDividerImageUrl: "",
    logoImageUrl: "",
    logoText: "根性",
    logoSubtext: "KONJO",
    footerText: "QUIET LUXURY, LOUD IMPACT.",
    bgMusicUrl: ""
  });
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // Safety timeout to ensure loading screen resolves
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // 1. Auth & Profile
    let unsubscribeAuth: () => void;
    try {
      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        setAuthError(null);
        if (currentUser) {
          try {
            const profile = await syncUserProfile(currentUser);
            setUserProfile(profile);

            const profileRef = doc(db, 'users', currentUser.uid);
            const unsubProfile = onSnapshot(profileRef, (d) => {
              if (d.exists()) {
                setUserProfile({ uid: d.id, ...d.data() } as UserProfile);
              }
            }, (err) => {
              handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`, setAuthError);
            });
          } catch (error: any) {
            console.error("Profile sync error", error);
            setAuthError(error.message || "Failed to sync user profile");
          }
        } else {
          setUserProfile(null);
        }
        setLoading(false);
        clearTimeout(loadingTimeout);
      });
    } catch (e: any) {
      console.error("Auth init error", e);
      setLoading(false);
      setAuthError("Auth system initialization failed");
    }

    // 2. Portfolio Items
    const qPortfolio = query(collection(db, 'portfolio'), orderBy('createdAt', 'desc'));
    const unsubscribePortfolio = onSnapshot(qPortfolio, (snapshot) => {
      setPortfolioItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'portfolio', setAuthError));

    // 3. Schedules
    const unsubscribeSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      setSchedules(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'schedules', setAuthError));

    // 4. Site Content (CMS)
    const unsubscribeContent = onSnapshot(doc(db, 'settings', 'content'), (snapshot) => {
      if (snapshot.exists()) setSiteContent((prev: any) => ({ ...prev, ...snapshot.data() }));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/content', setAuthError));

    // 5. Products
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products', setAuthError));

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      unsubscribePortfolio();
      unsubscribeSchedules();
      unsubscribeContent();
      unsubscribeProducts();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (error: any) {
      console.error("Login failed", error);
      setAuthError(error.message || "Login failed");
    }
  };

  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ image: '', title: '', videoUrl: '' });

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    image: '',
    images: [] as string[],
    instaLink: INSTAGRAM_URL,
    krw: '',
    usd: '',
    dropDate: new Date().toISOString().slice(0, 16),
    vipDropDate: new Date().toISOString().slice(0, 16)
  });

  // URL Helper to try and resolve direct image links from common page URLs
  const resolveDirectImageUrl = (url: string) => {
    let handled = url.trim();
    
    // Handle Imgur Page to Direct (excluding albums)
    if (handled.includes('imgur.com/') && !handled.includes('imgur.com/a/') && !handled.includes('i.imgur.com')) {
      const id = handled.split('/').pop()?.split('?')[0];
      if (id) handled = `https://i.imgur.com/${id}.jpg`;
    }
    
    return handled;
  };

  const isImgurAlbum = newPortfolio.image.includes('imgur.com/a/');

  // Admin Actions
  const handleUpdateContent = async (newContent: any) => {
    try {
      await setDoc(doc(db, 'settings', 'content'), newContent, { merge: true });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, 'settings/content', setAuthError); }
  };

  const handleAddPortfolio = async () => {
    if (newPortfolio.image && newPortfolio.title) {
      try {
        const data: any = {
          image: newPortfolio.image,
          title: newPortfolio.title,
          createdAt: serverTimestamp()
        };
        if (newPortfolio.videoUrl) data.videoUrl = newPortfolio.videoUrl;
        
        await addDoc(collection(db, 'portfolio'), data);
        setNewPortfolio({ image: '', title: '', videoUrl: '' });
        setIsAddingPortfolio(false);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'portfolio', setAuthError);
      }
    }
  };

  const handleDeletePortfolio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'portfolio', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `portfolio/${id}`, setAuthError);
      }
    }
  };

  const handleAddSchedule = async (date: string) => {
    const title = prompt(`${date} 일정을 입력하세요:`);
    if (title) {
      try {
        await addDoc(collection(db, 'schedules'), {
          date,
          title,
          type: 'EVENT',
          createdBy: user?.uid
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'schedules', setAuthError);
      }
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm("일정을 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `schedules/${id}`, setAuthError);
      }
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProduct = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Clean price strings (remove commas)
      const cleanKrw = productForm.krw.toString().replace(/[^0-9]/g, '');
      const cleanUsd = productForm.usd.toString().replace(/[^0-9.]/g, '');

      const data = {
        name: productForm.name,
        description: productForm.description,
        image: productForm.image || (productForm.images && productForm.images.find(img => img)) || '',
        images: (productForm.images || []).filter(img => img && img.trim() !== ''),
        instaLink: productForm.instaLink,
        prices: {
          krw: cleanKrw,
          usd: cleanUsd,
          eur: (Number(cleanUsd) * 0.9).toFixed(0),
          jpy: (Number(cleanKrw) * 0.11).toFixed(0),
          cny: (Number(cleanKrw) * 0.0053).toFixed(0),
        },
        dropDate: productForm.dropDate,
        vipDropDate: productForm.vipDropDate,
        createdAt: editingProduct ? editingProduct.createdAt : serverTimestamp()
      };

      if (editingProduct) {
        await setDoc(doc(db, 'products', editingProduct.id), data);
      } else {
        await addDoc(collection(db, 'products'), data);
      }
      
      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        image: '',
        images: [],
        instaLink: INSTAGRAM_URL,
        krw: '',
        usd: '',
        dropDate: new Date().toISOString().slice(0, 16),
        vipDropDate: new Date().toISOString().slice(0, 16)
      });
    } catch (e) {
      console.error("Save Product Error:", e);
      handleFirestoreError(e, OperationType.WRITE, 'products', setAuthError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("제품을 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `products/${id}`, setAuthError);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "240px" }}
            transition={{ duration: 3 }}
            className="h-[1px] bg-neon shadow-[0_0_10px_rgba(204,255,0,0.8)]"
          />
          <span className="text-neon text-[8px] tracking-[0.8em] font-light mt-4 uppercase animate-pulse">Initializing Archive</span>
        </div>
        {authError && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-[10px] tracking-widest uppercase bg-red-500/10 px-4 py-2 border border-red-500/30"
          >
            Connection issue: {authError}
          </motion.p>
        )}
      </div>
    );
  }

  const userStatus = userProfile?.role || 'NORMAL';

  return (
    <div className="min-h-screen bg-black text-offwhite font-sans selection:bg-neon selection:text-black">
      
      {authError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-red-500/10 border border-red-500/50 backdrop-blur-xl p-4 rounded-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-red-500" />
              <p className="text-[10px] tracking-widest text-red-500 uppercase">{authError}</p>
            </div>
            <button onClick={() => setAuthError(null)} className="text-red-500/50 hover:text-red-500">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Background Music */}
      <BackgroundMusic url={siteContent.bgMusicUrl} isAdmin={isAdmin} />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[90] bg-black/70 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 md:h-24 flex justify-between items-center">
          <div className="flex items-center gap-6 md:gap-16">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-black tracking-[0.5em] md:tracking-[0.7em] text-white cursor-pointer flex flex-col items-center" 
              onClick={() => window.location.reload()}
            >
              {siteContent.logoImageUrl ? (
                <img 
                  src={siteContent.logoImageUrl} 
                  alt="Logo" 
                  className="h-8 md:h-10 w-auto object-contain"
                  onError={(e) => {
                    // Fallback if image fails
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <>
                  <span className="text-lg md:text-xl leading-none">{siteContent.logoText || '根性'}</span>
                  <span className="text-[8px] md:text-[10px] tracking-[0.4em] mt-1 font-light opacity-60">{siteContent.logoSubtext || 'KONJO'}</span>
                </>
              )}
            </motion.h1>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-10 text-[10px] tracking-[0.3em] uppercase text-offwhite/40">
              {['portfolio', 'drop', 'booking'].map((item) => (
                <button 
                  key={item}
                  onClick={() => setPage(item)} 
                  className={`hover:text-neon transition-colors relative py-1 ${page === item && 'text-neon'}`}
                >
                  {TRANSLATIONS[locale][item]}
                  {page === item && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 w-full h-[1px] bg-neon" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            {/* Mobile simplified status */}
            <div className="hidden sm:block">
              {user && (
                <div 
                  className={`text-[8px] md:text-[9px] px-3 md:px-4 py-1 border transition-all tracking-widest ${userStatus === 'VIP' ? 'border-neon text-neon shadow-[0_0_15px_rgba(204,255,0,0.3)]' : 'border-white/10 text-white/20'}`}
                >
                  {userStatus === 'VIP' ? (TRANSLATIONS[locale] as any).vipAccess : (TRANSLATIONS[locale] as any).guestMode}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 md:gap-6">
              {user ? (
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="hidden lg:block text-[10px] tracking-widest text-offwhite/60">
                    {user.displayName}
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-white/20 hover:text-neon transition-colors"
                    title={(TRANSLATIONS[locale] as any).logout}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] text-neon border border-neon/30 px-3 md:px-6 py-1.5 md:py-2 hover:bg-neon hover:text-black transition-all"
                >
                  <UserIcon size={12} md:size={14} /> {(TRANSLATIONS[locale] as any).login}
                </button>
              )}
              
              <div className="flex items-center gap-1 md:gap-2 border-l border-white/10 pl-4 md:pl-8">
                <Globe size={12} md:size={14} className="text-neon" />
                <select 
                  value={locale} 
                  onChange={(e) => setLocale(e.target.value)}
                  className="bg-transparent text-[8px] md:text-[10px] tracking-widest text-offwhite border-none outline-none cursor-pointer uppercase focus:ring-0"
                >
                  {Object.keys(LOCALE_SETTINGS).map(lang => (
                    <option key={lang} value={lang} className="bg-[#121212]">{lang}</option>
                  ))}
                </select>
              </div>
              
              {isAdmin && (
                <button onClick={() => setPage('admin')} className="text-offwhite/20 hover:text-neon transition-colors ml-2">
                  <Settings size={16} md:size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="md:hidden flex justify-center gap-0 border-t border-white/5 bg-black/80 backdrop-blur-md">
          {['portfolio', 'drop', 'booking'].map((item) => (
            <button 
              key={item}
              onClick={() => setPage(item)} 
              className={`flex-1 py-4 text-[10px] tracking-[0.2em] font-bold uppercase transition-all flex flex-col items-center gap-1 ${page === item ? 'text-neon bg-neon/10' : 'text-offwhite/40 hover:text-offwhite'}`}
            >
              {TRANSLATIONS[locale][item]}
              {page === item && (
                <motion.div layoutId="mobile-nav-mark" className="h-[2px] bg-neon w-6" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        <AnimatePresence mode="wait">
          {page === 'home' && (
            <motion.section 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-[90vh] flex flex-col justify-center px-6 md:px-10 py-20 relative overflow-hidden"
            >
              <div className="relative z-10 w-full max-w-7xl mx-auto space-y-12 md:space-y-24">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(204,255,0,0.03)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
                
                {/* Main Title Area */}
                <div className="relative">
                  <motion.h2 
                    initial={{ letterSpacing: '0.4em', opacity: 0, y: 20 }}
                    animate={{ letterSpacing: '0.1em', opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="text-[12vw] md:text-[14vw] font-black leading-none text-white select-none whitespace-nowrap uppercase italic"
                  >
                    {siteContent.heroTitle}<span className="text-neon">.</span>
                  </motion.h2>
                  
                  <motion.div 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: '100%' }}
                    transition={{ delay: 0.8, duration: 1 }}
                    className="h-[1px] bg-white/10 mt-4 md:mt-8"
                  />
                </div>

                {/* Mobile Divider Image Slot */}
                {siteContent.mobileDividerImageUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="md:hidden w-full aspect-[2/3] bg-surface relative overflow-hidden border border-white/5"
                  >
                    <MediaRenderer 
                      url={siteContent.mobileDividerImageUrl} 
                      className="w-full h-full object-cover transition-transform duration-[3s] hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/80" />
                    <div className="absolute bottom-6 left-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-neon animate-pulse" />
                        <span className="text-[7px] tracking-[.3em] font-black text-white/40 uppercase italic">Visual Interlude</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-20 items-start">
                  {/* Left Column: Awards & Career */}
                  <div className="md:col-span-12 lg:col-span-4 order-1 lg:order-1">
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-[1px] w-8 bg-neon" />
                        <span className="text-[10px] tracking-[0.4em] font-black text-neon uppercase italic">Accreditation & Archive</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-10 gap-y-2 max-h-[300px] lg:max-h-none overflow-y-auto pr-4 custom-scrollbar lg:overflow-visible">
                        {(siteContent?.awards || "").split('\n').map((line: string, i: number) => (
                          <motion.p 
                            key={i} 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            whileHover={{ opacity: 1, x: 5, color: '#ccff00' }}
                            transition={{ delay: 1.2 + i * 0.05 }}
                            className="text-[9px] md:text-[10px] lg:text-[11px] text-white tracking-[0.15em] uppercase font-light border-l border-white/5 pl-4 transition-all cursor-default whitespace-nowrap overflow-hidden text-ellipsis"
                          >
                            {line}
                          </motion.p>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Right Column: Visual & Desc */}
                  <div className="md:col-span-12 lg:col-span-8 space-y-12 order-2 lg:order-2">
                    <div className="flex flex-col md:flex-row lg:flex-row gap-12 items-start">
                      <div className="flex-1 space-y-8">
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                          className="max-w-xl text-[10px] md:text-[12px] lg:text-[13px] text-offwhite/50 leading-relaxed md:leading-loose tracking-[0.15em] md:tracking-[0.2em] uppercase font-light"
                        >
                          {(siteContent?.heroDesc || "").split('\n').map((line: string, i: number) => (
                            <React.Fragment key={i}>{line}<br/></React.Fragment>
                          ))}
                        </motion.p>

                        {/* Featured Media */}
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.4 }}
                          className="relative w-full aspect-video md:aspect-[21/9] bg-surface border border-white/5 group overflow-hidden"
                        >
                          <MediaRenderer 
                            url={siteContent.heroMediaUrl} 
                            type={siteContent.heroMediaType || 'image'} 
                            className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                          <div className="absolute bottom-4 left-4 flex items-center gap-2">
                             <div className="w-1 h-1 bg-neon rounded-full animate-ping" />
                             <span className="text-[7px] tracking-[.4em] font-bold text-white/30 uppercase italic">Spotlight visual</span>
                          </div>
                        </motion.div>
                      </div>

                      {/* Admin Controls */}
                      {isAdmin && (
                        <div className="flex flex-row md:flex-col gap-4">
                          <button 
                            onClick={() => {
                              const url = prompt("Hero Media URL:", siteContent.heroMediaUrl);
                              const type = prompt("Type (image/video):", siteContent.heroMediaType || 'image');
                              const a = prompt("Awards (Separate by newline):", siteContent.awards);
                              if (url && (type === 'image' || type === 'video')) {
                                handleUpdateContent({ heroMediaUrl: url, heroMediaType: type, awards: a });
                              }
                            }}
                            className="p-3 border border-neon/20 text-neon/40 hover:text-neon transition-all hover:bg-neon/5"
                            title="Edit Media & Awards"
                          >
                            <Settings size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              const h = prompt("Title:", siteContent.heroTitle);
                              const d = prompt("Description:", siteContent.heroDesc);
                              const a = prompt("Awards:", siteContent.awards);
                              if (h !== null && d !== null) handleUpdateContent({ heroTitle: h, heroDesc: d, awards: a });
                            }}
                            className="p-3 border border-neon/20 text-neon/40 hover:text-neon transition-all hover:bg-neon/5"
                            title="Edit Title & Description"
                          >
                            <FileEdit size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <motion.button 
                      onClick={() => setPage('portfolio')} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.6 }}
                      className="group flex items-center gap-6 text-[10px] tracking-[0.5em] text-white hover:text-neon transition-all"
                    >
                      {TRANSLATIONS[locale].explore} <ChevronRight size={14} className="group-hover:translate-x-3 transition-transform text-neon" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {page === 'portfolio' && (
            <motion.section 
              key="portfolio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 md:px-10 pt-28 md:pt-36 pb-20"
            >
              <div className="flex justify-between items-center mb-6 md:mb-16">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white uppercase italic">Archive</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingPortfolio(!isAddingPortfolio)}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 text-[8px] md:text-[10px] font-bold tracking-widest transition-colors ${isAddingPortfolio ? 'bg-red-500 text-white' : 'bg-neon text-black hover:bg-white'}`}
                  >
                    {isAddingPortfolio ? <X size={12} /> : <Plus size={12} />} 
                    {isAddingPortfolio ? 'CANCEL' : TRANSLATIONS[locale].addPortfolio}
                  </button>
                )}
              </div>

              {isAdmin && isAddingPortfolio && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12 p-6 md:p-8 bg-surface border border-neon/20 grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
                >
                  <div className="space-y-4 col-span-full md:col-span-1">
                    <label className="text-[10px] tracking-widest text-white/40 uppercase">Preview</label>
                    <div className="aspect-[3/4] bg-black border border-white/10 flex items-center justify-center overflow-hidden">
                      {newPortfolio.image ? (
                        <img 
                          src={newPortfolio.image} 
                          alt="Preview" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).classList.add('hidden');
                          }}
                        />
                      ) : (
                        <Camera size={24} className="text-white/10" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-6 md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40 uppercase">Image URL (Cover)</label>
                        <input 
                          type="text" 
                          placeholder="https://..."
                          value={newPortfolio.image}
                          onChange={(e) => setNewPortfolio({...newPortfolio, image: resolveDirectImageUrl(e.target.value)})}
                          onBlur={(e) => setNewPortfolio({...newPortfolio, image: resolveDirectImageUrl(e.target.value)})}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none h-12"
                        />
                        {isImgurAlbum ? (
                          <p className="text-[8px] text-red-500 uppercase tracking-tight">앨범 링크 불가</p>
                        ) : (
                          <p className="text-[7px] text-white/20 tracking-wider uppercase mt-1">※ Instagram links are not supported for display. Use direct links (Imgur, etc).</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40 uppercase">Video URL (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="YouTube or direct MP4 link"
                          value={newPortfolio.videoUrl}
                          onChange={(e) => setNewPortfolio({...newPortfolio, videoUrl: e.target.value})}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none h-12"
                        />
                        <p className="text-[8px] text-white/30 tracking-tight">Full video view when clicked</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] tracking-widest text-white/40 uppercase">Title</label>
                      <input 
                        type="text" 
                        placeholder="ITEM TITLE"
                        value={newPortfolio.title}
                        onChange={(e) => setNewPortfolio({...newPortfolio, title: e.target.value})}
                        className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                      />
                    </div>
                    <button 
                      onClick={handleAddPortfolio}
                      className="w-full bg-neon text-black h-12 text-[10px] font-black tracking-widest hover:bg-white transition-all disabled:opacity-30"
                      disabled={!newPortfolio.image || !newPortfolio.title || isImgurAlbum}
                    >
                      CONFIRM & PUBLISH
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 md:gap-3">
                {portfolioItems.map((item, i) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative aspect-[1/1] md:aspect-[3/4] bg-surface overflow-hidden cursor-pointer"
                    onClick={() => {
                      if (item.videoUrl) {
                        setSelectedImg({ url: item.videoUrl, type: 'video' });
                      } else {
                        setSelectedImg({ url: item.image, type: 'image' });
                      }
                    }}
                  >
                    <MediaRenderer 
                      url={item.image} 
                      type="image" 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000" 
                      alt={item.title} 
                    />
                    {item.videoUrl && (
                      <div className="absolute top-2 right-2 md:top-4 md:right-4 text-neon pointer-events-none drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]">
                        <Play size={10} className="md:w-4 md:h-4" fill="currentColor" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 md:p-8">
                      <div className="flex justify-between items-end">
                        <p className="text-neon text-[7px] md:text-[9px] tracking-[0.1em] md:tracking-[0.3em] font-bold uppercase italic truncate pr-2">
                          {item.title}
                        </p>
                        {isAdmin && (
                          <button onClick={(e) => handleDeletePortfolio(item.id, e)} className="text-red-500 hover:scale-110 transition-transform">
                            <Trash2 size={12} className="md:w-4 md:h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {page === 'drop' && (
            <motion.section 
              key="drop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-6 md:px-10 pt-28 md:pt-36 pb-24"
            >
              <div className="mb-24 flex justify-between items-end">
                <div className="space-y-4">
                  <h2 className="text-7xl font-black tracking-tighter text-white uppercase italic">{TRANSLATIONS[locale].limitedDrop}</h2>
                  <div className="flex items-center gap-4">
                    <div className="h-[1px] w-12 bg-neon" />
                    <p className="text-offwhite/30 text-[10px] tracking-[0.4em] uppercase">{TRANSLATIONS[locale].dropDesc}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setIsAddingProduct(!isAddingProduct);
                      setEditingProduct(null);
                    }}
                    className={`flex items-center gap-3 px-6 h-12 text-[10px] font-black tracking-widest transition-all ${isAddingProduct ? 'bg-red-500 text-white' : 'bg-neon text-black hover:bg-white'}`}
                  >
                    {isAddingProduct ? <X size={16} /> : <Plus size={16} />}
                    {isAddingProduct ? 'CANCEL' : 'ADD NEW PRODUCT'}
                  </button>
                )}
              </div>

              {isAdmin && isAddingProduct && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-24 p-10 bg-surface border border-neon/20"
                >
                  <h3 className="text-neon text-[10px] tracking-[0.3em] font-bold uppercase italic mb-10 flex items-center gap-3">
                    <ShieldCheck size={14} /> {editingProduct ? 'EDIT PRODUCT' : 'CREATE NEW DROP'}
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="space-y-6">
                      <div className="aspect-[3/4] bg-black border border-white/10 flex items-center justify-center overflow-hidden relative group">
                        {(productForm.images && productForm.images.find(img => img)) ? (
                          <img 
                            src={productForm.images.find(img => img)} 
                            alt="Main Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : productForm.image ? (
                          <img 
                            src={productForm.image} 
                            alt="Main Preview" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <Camera size={32} className="text-white/10" />
                        )}
                        <div className="absolute top-2 left-2 bg-neon text-black text-[7px] px-1.5 py-0.5 font-black uppercase">Main Thumbnail</div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase font-black italic">Gallery Images (Max 8)</label>
                          <span className="text-[8px] text-white/20">{(productForm.images ? productForm.images.length : 0)} / 8</span>
                        </div>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {[...Array(8)].map((_, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-white/20 w-4 font-mono">0{idx + 1}</span>
                                <input 
                                  type="text" 
                                  placeholder={`Image URL ${idx + 1}`}
                                  value={(productForm.images && productForm.images[idx]) || ''}
                                  onChange={(e) => {
                                    const newImages = [...(productForm.images || [])];
                                    newImages[idx] = resolveDirectImageUrl(e.target.value);
                                    // Remove empty slots if they are at the end, but keep the current one being edited
                                    setProductForm({ ...productForm, images: newImages });
                                  }}
                                  className="flex-1 bg-black border border-white/10 px-3 py-2 text-[10px] text-white focus:border-neon outline-none"
                                />
                                {(productForm.images && productForm.images[idx]) && (
                                  <button 
                                    onClick={() => {
                                      const newImages = (productForm.images || []).filter((_, i) => i !== idx);
                                      setProductForm({ ...productForm, images: newImages });
                                    }}
                                    className="text-red-500 hover:text-red-400"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[7px] text-white/20 tracking-wider uppercase italic">※ The first image will be used as the main thumbnail.</p>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Product Name</label>
                          <input 
                            type="text" 
                            placeholder="KONJO 'VOID' HOODIE"
                            value={productForm.name}
                            onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Instagram Link</label>
                          <input 
                            type="text" 
                            value={productForm.instaLink}
                            onChange={(e) => setProductForm({...productForm, instaLink: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40 uppercase">Description</label>
                        <textarea 
                          placeholder="Product storytelling, details, material info..."
                          value={productForm.description}
                          onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                          className="w-full bg-black border border-white/10 p-4 text-xs text-white focus:border-neon outline-none h-32 leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-black">
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Price (KRW)</label>
                          <input 
                            type="text" 
                            placeholder="129,000"
                            value={productForm.krw}
                            onChange={(e) => setProductForm({...productForm, krw: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Price (USD)</label>
                          <input 
                            type="text" 
                            placeholder="95"
                            value={productForm.usd}
                            onChange={(e) => setProductForm({...productForm, usd: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Release Date (Public)</label>
                          <input 
                            type="datetime-local" 
                            value={productForm.dropDate}
                            onChange={(e) => setProductForm({...productForm, dropDate: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] tracking-widest text-white/40 uppercase">Release Date (VIP EARLY)</label>
                          <input 
                            type="datetime-local" 
                            value={productForm.vipDropDate}
                            onChange={(e) => setProductForm({...productForm, vipDropDate: e.target.value})}
                            className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleSaveProduct}
                        disabled={!productForm.name || (!productForm.image && (!productForm.images || productForm.images.filter(img => img).length === 0)) || isSaving}
                        className="w-full bg-neon text-black h-14 text-[10px] font-black tracking-[0.5em] hover:bg-white transition-all disabled:opacity-30 flex items-center justify-center gap-4"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black animate-spin rounded-full" />
                        ) : (
                          editingProduct ? 'UPDATE PRODUCT ARCHIVE' : 'BRING TO ARCHIVE'
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {products.length > 0 ? (
                  products.map(product => (
                    <DropCard 
                      key={product.id} 
                      product={product} 
                      locale={locale} 
                      userStatus={userStatus} 
                      isAdmin={isAdmin}
                      onImageClick={(url, gallery) => setSelectedImg({ url, type: 'image', gallery })}
                      onEdit={(p) => {
                        setEditingProduct(p);
                        setProductForm({
                          name: p.name || '',
                          description: p.description || '',
                          image: p.image || '',
                          images: p.images || [],
                          instaLink: p.instaLink || INSTAGRAM_URL,
                          krw: p.prices?.krw || '',
                          usd: p.prices?.usd || '',
                          dropDate: p.dropDate || new Date().toISOString().slice(0, 16),
                          vipDropDate: p.vipDropDate || new Date().toISOString().slice(0, 16)
                        });
                        setIsAddingProduct(true);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      onDelete={handleDeleteProduct}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-32 text-center border border-dashed border-white/10">
                    <p className="text-[10px] tracking-[0.5em] text-white/20 uppercase italic">No Drops Available Yet.</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {page === 'booking' && (
            <motion.section 
              key="booking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-7xl mx-auto pt-28 md:pt-36 pb-20 md:pb-32 px-4 md:px-10"
            >
              <div className="text-center mb-24 space-y-8">
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white uppercase italic">{TRANSLATIONS[locale].reservation}</h2>
                <div className="h-[1px] w-12 bg-neon mx-auto" />
                <p className="text-offwhite/40 text-[10px] tracking-widest leading-loose whitespace-pre-line">
                  {TRANSLATIONS[locale].resDesc}
                </p>
              </div>
              
              <DynamicCalendar 
                schedules={schedules} 
                isAdmin={isAdmin} 
                onAdd={handleAddSchedule}
                onDelete={handleDeleteSchedule}
              />

              <div className="mt-10">
                <button 
                  onClick={() => window.open(INSTAGRAM_URL, '_blank')}
                  className="w-full py-5 bg-neon text-black font-black text-[11px] tracking-[0.5em] hover:bg-white transition-colors uppercase flex items-center justify-center gap-3"
                >
                  {TRANSLATIONS[locale].connect} <ArrowRight size={16} />
                </button>
              </div>
            </motion.section>
          )}

          {page === 'admin' && (
            <motion.section 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-10 pt-20 flex flex-col md:flex-row gap-12 max-w-7xl mx-auto"
            >
              <div className="w-full md:w-64 space-y-10 border-r border-white/5 pr-0 md:pr-10">
                <h3 className="text-neon tracking-[0.3em] text-[10px] font-bold uppercase italic">{TRANSLATIONS[locale].management}</h3>
                <ul className="space-y-8 text-offwhite/40 text-[10px] tracking-widest uppercase">
                  <li className="text-white flex items-center gap-3 cursor-pointer"><Settings size={14} className="text-neon" /> {TRANSLATIONS[locale].siteConfig}</li>
                  <li onClick={() => setPage('drop')} className="hover:text-white cursor-pointer transition-colors flex items-center gap-3"><ShoppingBag size={14} /> {TRANSLATIONS[locale].prodManager}</li>
                  <li className="hover:text-white cursor-pointer transition-colors flex items-center gap-3"><ShieldCheck size={14} /> {TRANSLATIONS[locale].vipWhitelist}</li>
                </ul>
              </div>

              <div className="flex-1 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h4 className="text-neon text-[10px] tracking-[0.3em] font-bold uppercase italic">Hero Content</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40">HERO TITLE</label>
                        <input 
                          type="text"
                          value={siteContent.heroTitle || ''}
                          onChange={(e) => handleUpdateContent({ heroTitle: e.target.value })}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40">HERO DESCRIPTION</label>
                        <textarea 
                          value={siteContent.heroDesc || ''}
                          onChange={(e) => handleUpdateContent({ heroDesc: e.target.value })}
                          className="w-full bg-black border border-white/10 p-4 text-xs text-white focus:border-neon outline-none h-24"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-neon text-[10px] tracking-[0.3em] font-bold uppercase italic">Hero Media</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40">MEDIA URL (Direct Image or YouTube/MP4)</label>
                        <input 
                          type="text"
                          value={siteContent.heroMediaUrl || ''}
                          onChange={(e) => handleUpdateContent({ heroMediaUrl: e.target.value })}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40">MEDIA TYPE</label>
                        <select 
                          value={siteContent.heroMediaType || 'image'}
                          onChange={(e) => handleUpdateContent({ heroMediaType: e.target.value })}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                        >
                          <option value="image">IMAGE</option>
                          <option value="video">VIDEO (YouTube / MP4)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40">BACKGROUND MUSIC (YouTube URL)</label>
                        <input 
                          type="text"
                          value={siteContent.bgMusicUrl || ''}
                          onChange={(e) => handleUpdateContent({ bgMusicUrl: e.target.value })}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                        <p className="text-[7px] text-white/20 tracking-wider uppercase">※ Instagram links are not supported for audio. Use YouTube.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] tracking-widest text-white/40 uppercase">Mobile Divider Image (Hero-History)</label>
                        <input 
                          type="text"
                          value={siteContent.mobileDividerImageUrl || ''}
                          onChange={(e) => handleUpdateContent({ mobileDividerImageUrl: e.target.value })}
                          className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                          placeholder="https://..."
                        />
                        <p className="text-[7px] text-white/20 tracking-wider uppercase">※ Only visible on mobile devices between Hero and History.</p>
                      </div>

                      <div className="space-y-6 pt-4 border-t border-white/5">
                        <h4 className="text-neon text-[10px] tracking-[0.3em] font-bold uppercase italic">Site Branding</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] tracking-widest text-white/40 uppercase">Logo Image URL (Overrides Text)</label>
                            <input 
                              type="text"
                              value={siteContent.logoImageUrl || ''}
                              onChange={(e) => handleUpdateContent({ logoImageUrl: e.target.value })}
                              className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                              placeholder="https://..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] tracking-widest text-white/40 uppercase">Logo Main Text</label>
                              <input 
                                type="text"
                                value={siteContent.logoText || ''}
                                onChange={(e) => handleUpdateContent({ logoText: e.target.value })}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                                placeholder="根性"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] tracking-widest text-white/40 uppercase">Logo Subtext</label>
                              <input 
                                type="text"
                                value={siteContent.logoSubtext || ''}
                                onChange={(e) => handleUpdateContent({ logoSubtext: e.target.value })}
                                className="w-full bg-black border border-white/10 px-4 py-3 text-xs text-white focus:border-neon outline-none"
                                placeholder="KONJO"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-surface p-8 border border-white/5 space-y-6">
                  <h4 className="text-neon text-[10px] tracking-[0.3em] font-bold uppercase italic flex items-center gap-2">
                    <MessageCircle size={14} /> {TRANSLATIONS[locale].autoResponse}
                  </h4>
                  <textarea 
                    className="w-full bg-black border border-white/10 p-5 text-[11px] text-offwhite/70 leading-relaxed h-32 focus:border-neon outline-none transition-colors font-mono"
                    defaultValue={`[KONJO] 안녕하세요. 문의주셔서 감사합니다.\n보내주신 도안과 부위 확인 후 인스타그램(@konjo_grit) DM을 통해 예약 절차를 안내해 드리겠습니다.\n\n예약금 안내: [신한 110-XXX-XXXXXX]`}
                    onBlur={(e) => handleUpdateContent({ autoResponse: e.target.value })}
                  />
                  <p className="text-[8px] text-white/20 uppercase tracking-widest italic">※ Changes are saved automatically on blur.</p>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-10 mt-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] tracking-[0.3em] text-white/20">
        <p>© 2026 KONJO STUDIO. SEOUL / PARIS / TOKYO</p>
        <div className="flex gap-10 items-center italic">
          {isAdmin && (
            <button 
              onClick={() => {
                const t = prompt("Footer text:", siteContent.footerText);
                if (t) handleUpdateContent({ footerText: t });
              }}
              className="text-neon/30 hover:text-neon"
            >
              <Settings size={12} />
            </button>
          )}
          <span className="text-neon/40 border-l border-neon/20 pl-4">{siteContent.footerText}</span>
        </div>
      </footer>

      {/* Floating UI & Lightbox */}
      <FloatingConsultation />
      
      <AnimatePresence>
        {selectedImg && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-10" 
            onClick={() => setSelectedImg(null)}
          >
            <div className="relative w-full max-w-6xl flex items-center justify-center">
              {/* Previous Button */}
              {selectedImg.gallery && selectedImg.gallery.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIdx = selectedImg.gallery!.indexOf(selectedImg.url);
                    const prevIdx = (currentIdx - 1 + selectedImg.gallery!.length) % selectedImg.gallery!.length;
                    setSelectedImg({ ...selectedImg, url: selectedImg.gallery![prevIdx] });
                  }}
                  className="absolute left-0 md:-left-20 z-10 p-4 text-white/50 hover:text-neon transition-colors"
                >
                  <ChevronLeft size={48} />
                </button>
              )}

              <motion.div
                key={selectedImg.url}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full h-full max-h-[85vh] flex items-center justify-center relative shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="md:h-full w-full flex items-center justify-center">
                  <MediaRenderer 
                    url={selectedImg.url} 
                    type={selectedImg.type} 
                    controls={true}
                    className="max-w-full max-h-full object-contain" 
                    alt="Full View" 
                  />
                </div>
              </motion.div>

              {/* Next Button */}
              {selectedImg.gallery && selectedImg.gallery.length > 1 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIdx = selectedImg.gallery!.indexOf(selectedImg.url);
                    const nextIdx = (currentIdx + 1) % selectedImg.gallery!.length;
                    setSelectedImg({ ...selectedImg, url: selectedImg.gallery![nextIdx] });
                  }}
                  className="absolute right-0 md:-right-20 z-10 p-4 text-white/50 hover:text-neon transition-colors"
                >
                  <ChevronRight size={48} />
                </button>
              )}
            </div>

            {/* Gallery Thumbnails Overlay */}
            {selectedImg.gallery && selectedImg.gallery.length > 1 && (
              <div className="mt-8 flex gap-2 overflow-x-auto pb-2 px-4 max-w-full custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                {selectedImg.gallery.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedImg({ ...selectedImg, url: img })}
                    className={`w-12 h-16 md:w-16 md:h-20 border-2 transition-all shrink-0 ${selectedImg.url === img ? 'border-neon' : 'border-white/10 opacity-40 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt={`Thumb ${idx}`} />
                  </button>
                ))}
              </div>
            )}

            <button className="absolute top-10 right-10 text-white/50 hover:text-neon transition-colors">
              <X size={40} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

