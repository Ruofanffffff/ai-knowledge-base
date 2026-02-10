import React, { useState } from 'react';
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { Search, Heart, Share2, MoreHorizontal, Filter, SlidersHorizontal, Image as ImageIcon, Video, Layers, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ArtWork {
  id: string;
  url: string;
  title: string;
  author: string;
  avatar: string;
  likes: number;
  isLiked: boolean;
  prompt: string;
}

const initialArtworks: ArtWork[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1758404196311-70c62a445e9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Neon Cyber City',
    author: 'Alex Chen',
    avatar: '👨‍🎨',
    likes: 1240,
    isLiked: true,
    prompt: 'cyberpunk city street at night, neon lights, rain, futuristic cars, high detail, 8k'
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1635438004811-54b5864e57eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Surreal Dreams',
    author: 'Elena Void',
    avatar: '👩‍🎤',
    likes: 856,
    isLiked: false,
    prompt: 'surreal dreamscape, floating islands, clouds, pastel colors, soft lighting'
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1767256483514-76135f5a0713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Classic Portrait',
    author: 'Da Vinci AI',
    avatar: '🎨',
    likes: 2105,
    isLiked: false,
    prompt: 'oil painting style, renaissance portrait, young woman, mysterious smile, cracked texture'
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1647956450271-2ff54205bebf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Minimal Structure',
    author: 'Less Is More',
    avatar: '⚪',
    likes: 543,
    isLiked: true,
    prompt: 'minimalist architecture, concrete, sharp shadows, blue sky, geometric shapes'
  },
  {
    id: '5',
    url: 'https://images.unsplash.com/photo-1684446116392-051d581d1a77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Abstract Flow',
    author: 'Color Master',
    avatar: '🌈',
    likes: 3420,
    isLiked: false,
    prompt: '3d abstract render, flowing liquid, colorful, glossy finish, studio lighting'
  },
  {
    id: '6',
    url: 'https://images.unsplash.com/photo-1610114586897-20495783e96c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Fantasy Valley',
    author: 'Ghibli Fan',
    avatar: '🎌',
    likes: 1890,
    isLiked: true,
    prompt: 'anime style landscape, green valley, blue sky, fluffy clouds, fantasy castle in distance'
  },
  {
    id: '7',
    url: 'https://images.unsplash.com/photo-1728632286888-04c64f48e506?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Space Odyssey',
    author: 'Star Voyager',
    avatar: '🚀',
    likes: 980,
    isLiked: false,
    prompt: 'sci-fi spaceship, deep space, nebula background, cinematic lighting, detailed hull'
  },
  {
    id: '8',
    url: 'https://images.unsplash.com/photo-1765606290905-b9d377ea4d5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Warrior Spirit',
    author: 'Concept Pro',
    avatar: '⚔️',
    likes: 1560,
    isLiked: false,
    prompt: 'character design, fantasy warrior, intricate armor, glowing sword, dynamic pose'
  },
  {
    id: '9',
    url: 'https://images.unsplash.com/photo-1762115331559-92659819dcf5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Spring Bloom',
    author: 'Nature Lover',
    avatar: '🌸',
    likes: 720,
    isLiked: true,
    prompt: 'watercolor illustration, spring flowers, soft colors, ink outlines, paper texture'
  },
  {
    id: '10',
    url: 'https://images.unsplash.com/photo-1768320521546-be1917266ad4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    title: 'Retro Poster',
    author: 'Vintage Soul',
    avatar: '📻',
    likes: 450,
    isLiked: false,
    prompt: 'vintage poster design, retro typography, distressed texture, muted colors, 70s style'
  },
  // Duplicates for masonry effect
  {
    id: '11',
    url: 'https://images.unsplash.com/photo-1758404196311-70c62a445e9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&sat=-100',
    title: 'Noir City',
    author: 'Alex Chen',
    avatar: '👨‍🎨',
    likes: 890,
    isLiked: false,
    prompt: 'black and white photography, cyberpunk city, noir style, high contrast'
  },
  {
    id: '12',
    url: 'https://images.unsplash.com/photo-1684446116392-051d581d1a77?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&hue=180',
    title: 'Blue Flow',
    author: 'Color Master',
    avatar: '🌈',
    likes: 2100,
    isLiked: true,
    prompt: 'blue liquid, abstract 3d, monochromatic blue, serene'
  },
  {
    id: '13',
    url: 'https://images.unsplash.com/photo-1767256483514-76135f5a0713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&sepia=100',
    title: 'Old Master',
    author: 'Da Vinci AI',
    avatar: '🎨',
    likes: 1500,
    isLiked: false,
    prompt: 'sepia tone, old photograph, portrait, vintage style'
  },
  {
    id: '14',
    url: 'https://images.unsplash.com/photo-1610114586897-20495783e96c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800&blur=20',
    title: 'Dream Valley',
    author: 'Ghibli Fan',
    avatar: '🎌',
    likes: 300,
    isLiked: false,
    prompt: 'blurry dream, soft focus, anime background, mysterious'
  },
];

export function Community() {
  const [artworks, setArtworks] = useState<ArtWork[]>(initialArtworks);
  const [activeTab, setActiveTab] = useState('Top Day');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = ['Top Day', 'Likes', 'Styles', 'Images', 'Videos'];

  const toggleLike = (id: string) => {
    setArtworks(prev => prev.map(art => 
      art.id === id ? { ...art, isLiked: !art.isLiked, likes: art.isLiked ? art.likes - 1 : art.likes + 1 } : art
    ));
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-white overflow-hidden">
      {/* Header / Search */}
      <div className="h-14 md:h-16 px-4 md:px-6 flex items-center gap-2 md:gap-4 bg-white z-20 shrink-0">
        <div className="flex-1 relative max-w-4xl">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 md:w-5 md:h-5" />
           <input 
             type="text" 
             placeholder="搜索提示词、风格或创作者..." 
             className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white border-transparent focus:border-purple-200 border rounded-full pl-10 pr-4 py-2 md:py-2.5 outline-none transition-all placeholder:text-slate-500 text-sm"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
           <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-500">
             <SlidersHorizontal size={14} className="md:w-4 md:h-4" />
           </button>
        </div>
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-slate-900 text-white rounded-full font-medium text-sm hover:bg-slate-800 transition-colors">
              <Wand2 size={14} className="md:w-4 md:h-4" /> <span className="hidden md:inline">开始创作</span>
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pb-2 border-b border-slate-100 flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
         {tabs.map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
               activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
             }`}
           >
             {tab}
           </button>
         ))}
         <div className="h-4 w-px bg-slate-200 mx-2" />
         <button className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2">
            <ImageIcon size={16} /> Styles
         </button>
         <button className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2">
            <Video size={16} /> Videos
         </button>
      </div>

      {/* Masonry Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <ResponsiveMasonry
          columnsCountBreakPoints={{350: 1, 750: 2, 900: 3, 1200: 4, 1600: 5}}
        >
          <Masonry gutter="16px">
            {artworks
              .filter(art => art.title.toLowerCase().includes(searchQuery.toLowerCase()) || art.prompt.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((art) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                key={art.id} 
                className="relative group rounded-xl overflow-hidden cursor-pointer bg-slate-100"
              >
                <img 
                  src={art.url} 
                  alt={art.title} 
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  
                  {/* Top Actions */}
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLike(art.id); }}
                      className={`p-2 rounded-full backdrop-blur-md transition-colors ${art.isLiked ? 'bg-pink-500/20 text-pink-500 hover:bg-pink-500/30' : 'bg-black/20 text-white hover:bg-white/20'}`}
                    >
                      <Heart size={16} fill={art.isLiked ? "currentColor" : "none"} />
                    </button>
                    <button className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-white/20 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  {/* Bottom Info */}
                  <div>
                    <h3 className="text-white font-medium text-sm mb-1 truncate">{art.title}</h3>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <span className="text-lg">{art.avatar}</span>
                          <span className="text-slate-300 text-xs hover:text-white transition-colors">{art.author}</span>
                       </div>
                       <span className="text-slate-300 text-xs">{art.likes}</span>
                    </div>
                    
                    {/* Prompt Hint on Hover (Optional, similar to Midjourney showing command) */}
                    <div className="mt-3 text-[10px] text-slate-400 line-clamp-2 leading-relaxed opacity-80">
                      {art.prompt}
                    </div>
                  </div>

                </div>
              </motion.div>
            ))}
          </Masonry>
        </ResponsiveMasonry>
        
        {/* Infinite Scroll Loader Mock */}
        <div className="py-8 flex justify-center">
           <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
        </div>
      </div>
    </div>
  );
}
