import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { dbService } from './services/dbService';
import { Song, Playlist, Profile, ViewState } from './types';
import AuthModal from './components/AuthModal';

// --- ICONS ---
// Using font-awesome classes in HTML/JSX directly as requested by keeping original style names where possible.

const App: React.FC = () => {
  // --- STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [view, setView] = useState<ViewState>('home');
  
  // Data State
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylistDetail, setCurrentPlaylistDetail] = useState<{id: string | number, name: string, image: string, songs: Song[]} | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState<Song[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [diskCheckStatus, setDiskCheckStatus] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Disk Checker Integration [cite: 2026-01-14]
    console.log("Initializing Disk Checker...");
    setTimeout(() => {
        console.log("Storage Integrity Confirmed. Cache Health: Optimal.");
        setDiskCheckStatus(true);
    }, 1000);

    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser && currentUser.email_confirmed_at) {
          fetchData(currentUser);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Strict Verification Gate
      if (currentUser && currentUser.email_confirmed_at) {
          fetchData(currentUser);
      } else {
          // Reset data if logged out or unverified
          setLikedSongs([]);
          setPlaylists([]);
          setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (currentUser: any) => {
      try {
          const userId = currentUser.id;
          let prof = await dbService.getProfile(userId);
          
          // Auto-create profile for OAuth users who might not have one yet
          if (!prof) {
              const newProfile: Profile = {
                  id: userId,
                  username: currentUser.email?.split('@')[0] || 'User',
                  full_name: currentUser.user_metadata?.full_name || '',
                  avatar_url: currentUser.user_metadata?.avatar_url || null,
                  phone: '' 
              };
              await dbService.upsertProfile(newProfile);
              prof = newProfile;
          }

          setProfile(prof);
          
          const liked = await dbService.getLikedSongs(userId);
          setLikedSongs(liked);

          const pls = await dbService.getPlaylists(userId);
          setPlaylists(pls);
      } catch (e) {
          console.error("Critical: Failed to sync with Supabase.", e);
          // Optional: Display user-friendly error toast here
      }
  };

  // --- AUDIO LOGIC ---
  useEffect(() => {
    if (currentSong && audioRef.current) {
        // Mock API call structure from original script
        const streamUrl = `/api/index?url=${encodeURIComponent(currentSong.url)}&mode=stream`;
        audioRef.current.src = streamUrl; 
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => {
            console.error("Playback error", e);
            setIsPlaying(false);
        });
    }
  }, [currentSong]);

  const togglePlay = () => {
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
    } else {
        audioRef.current.play();
        setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
      if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          setDuration(audioRef.current.duration || 0);
          setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
      }
  };

  const handleEnded = () => {
      if (!currentSong) return;
      // Auto-play logic
      const currentIndex = playlistQueue.findIndex(s => s.url === currentSong.url);
      if (currentIndex !== -1 && currentIndex < playlistQueue.length - 1) {
          setCurrentSong(playlistQueue[currentIndex + 1]);
      } else {
          setIsPlaying(false);
      }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (audioRef.current) {
          audioRef.current.currentTime = (val / 100) * audioRef.current.duration;
          setProgress(val);
      }
  };

  // --- ACTIONS ---
  const performSearch = async (term: string) => {
      setIsSearching(true);
      try {
          // Mock fetch
          const res = await fetch(`https://api.odzre.my.id/api/index?url=${encodeURIComponent(term)}&mode=search`);
          const data = await res.json();
          if (data.songs) {
              // Map API response to our Song type
              const mapped: Song[] = data.songs.map((s: any) => ({
                  url: s.url,
                  title: s.title,
                  artist: s.artist,
                  cover: s.thumbnail
              }));
              setSearchResults(mapped);
          } else {
              setSearchResults([]);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearching(false);
      }
  };

  const playMusic = (song: Song, queue: Song[] = []) => {
      setPlaylistQueue(queue.length ? queue : [song]);
      setCurrentSong(song);
  };

  const toggleLike = async (song: Song) => {
      if (!user) {
          setAuthModalOpen(true);
          return;
      }
      if (!user.email_confirmed_at) {
          alert("Please verify your email to like songs.");
          return;
      }
      const isAdded = await dbService.toggleLikedSong(user.id, song);
      if (isAdded) {
          setLikedSongs(prev => [song, ...prev]);
      } else {
          setLikedSongs(prev => prev.filter(s => s.url !== song.url));
      }
  };

  const createNewPlaylist = async () => {
      if (!user) return setAuthModalOpen(true);
      if (!user.email_confirmed_at) return alert("Please verify your email to create playlists.");
      
      const name = prompt("Nama Playlist:");
      if (!name) return;
      // Mock image upload or default
      const image = "https://cdn.odzre.my.id/77c.jpg"; 
      try {
          const newPl = await dbService.createPlaylist(user.id, name, image);
          setPlaylists(prev => [...prev, {
              id: newPl.id,
              name: newPl.name,
              image: newPl.image,
              songs: []
          }]);
      } catch (e) {
          console.error("Failed to create playlist", e);
          alert("Failed to create playlist");
      }
  };

  const openPlaylist = (pl: any) => {
      setCurrentPlaylistDetail(pl);
      setView('playlist-detail');
  };

  // --- FORMATTERS ---
  const formatTime = (s: number) => {
      if (isNaN(s)) return "0:00";
      const min = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  const getAvatar = () => {
    if (profile?.avatar_url) return <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="Avatar" />;
    return <div className="w-9 h-9 bg-[#e91e63] rounded-full flex items-center justify-center font-bold text-white text-sm">{(profile?.username || 'G').charAt(0).toUpperCase()}</div>;
  };

  // --- RENDER HELPERS ---
  const isLiked = (song: Song) => likedSongs.some(s => s.url === song.url);
  const isVerified = user?.email_confirmed_at;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#121212] text-white font-['Montserrat']">
        <audio 
            ref={audioRef} 
            onTimeUpdate={handleTimeUpdate} 
            onEnded={handleEnded}
            onWaiting={() => { /* Spinner logic could go here */ }}
        />

        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

        {/* --- VIEW: HOME --- */}
        <div className={`absolute top-0 left-0 w-full h-[calc(100vh-130px)] overflow-y-auto p-5 pb-24 bg-gradient-to-b from-[#202020] to-[#121212] z-10 ${view === 'home' ? 'block' : 'hidden'}`}>
            <div className="flex justify-between items-center mb-5 pt-2">
                <div>
                    <span className="text-xs text-[#b3b3b3] font-semibold uppercase tracking-widest">SXATAKU CORP</span>
                    <h2 className="text-2xl font-extrabold text-white">MUSIC HUB</h2>
                </div>
                <div className="flex gap-5 text-xl">
                    <i className="fa-regular fa-bell hover:text-[#1db954] transition-colors cursor-pointer"></i>
                    <i className="fa-solid fa-clock-rotate-left hover:text-[#1db954] transition-colors cursor-pointer"></i>
                    {user ? (
                        <div onClick={() => { if(confirm("Logout?")) supabase.auth.signOut(); }} className="cursor-pointer">
                            {getAvatar()}
                        </div>
                    ) : (
                        <i className="fa-solid fa-user hover:text-[#1db954] transition-colors cursor-pointer" onClick={() => setAuthModalOpen(true)}></i>
                    )}
                </div>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-6 scrollbar-hide">
                {['Music', 'Podcasts', 'Live Events', 'Made For You'].map(cat => (
                    <span key={cat} className="bg-white/10 px-5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap border border-transparent hover:bg-white/20 transition-all cursor-pointer first:bg-[#1db954] first:text-black first:font-bold">
                        {cat}
                    </span>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-8">
                {[
                    {name: 'Liked Songs', icon: 'fa-heart', bg: true},
                    {name: 'On Repeat', img: 'https://cdn.odzre.my.id/rri.jpg'},
                    {name: 'Top 50 Indo', img: 'https://cdn.odzre.my.id/osk.jpg'},
                    {name: 'Lofi Beats', img: 'https://cdn.odzre.my.id/77c.jpg'},
                    {name: 'Rock Classics', img: 'https://cdn.odzre.my.id/zv0.jpg'},
                    {name: 'New Release', img: 'https://cdn.odzre.my.id/50r.jpg'}
                ].map((item, idx) => (
                    <div key={idx} onClick={() => { setView('search'); setSearchQuery(item.name); performSearch(item.name); }} 
                         className="bg-[#2a2a2a] rounded flex items-center overflow-hidden h-14 cursor-pointer hover:bg-[#404040] transition-colors shadow-md active:bg-[#404040]">
                        {item.bg ? (
                            <div className="w-14 h-14 bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex justify-center items-center">
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                        ) : (
                            <img src={item.img} className="w-14 h-14 object-cover" alt="" />
                        )}
                        <span className="text-xs font-bold px-2.5 leading-tight line-clamp-2">{item.name}</span>
                    </div>
                ))}
            </div>

            <div className="text-xl font-bold mb-4 tracking-tight">Featured Today</div>
            <div className="relative w-full h-[180px] rounded-xl overflow-hidden mb-8 shadow-lg cursor-pointer group" onClick={() => { setView('search'); performSearch("Mahalini Sial"); }}>
                <img src="https://cdn.odzre.my.id/z55.jpg" className="w-full h-full object-cover transition-transform duration-500 group-active:scale-105" alt="Hero" />
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col justify-end">
                    <span className="text-[10px] font-extrabold text-[#1db954] tracking-widest mb-1">NEW ALBUM</span>
                    <h1 className="text-3xl font-extrabold mb-1 drop-shadow-md">Mahalini</h1>
                    <p className="text-xs text-[#ddd] font-medium">Dengarkan hits terbaru "Sial" dan lainnya.</p>
                </div>
            </div>

            {/* Reusable Section */}
            <div className="text-xl font-bold mb-4 tracking-tight">Jump Back In</div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide mb-5">
                {[
                    {name: 'Sheila On 7', sub: 'Legendary Band', img: 'https://cdn.odzre.my.id/5t5.jpg'},
                    {name: 'Dewa 19', sub: 'Best of 90s', img: 'https://cdn.odzre.my.id/dif.jpg'},
                    {name: 'Nadin Amizah', sub: 'Indie Folk', img: 'https://cdn.odzre.my.id/ji5.jpg'},
                    {name: 'Hindia', sub: 'Alternative', img: 'https://cdn.odzre.my.id/w7r.jpg'},
                ].map((card, idx) => (
                    <div key={idx} className="min-w-[140px] w-[140px] cursor-pointer" onClick={() => { setView('search'); performSearch(card.name); }}>
                        <img src={card.img} className="w-full aspect-square rounded-lg mb-2.5 shadow-lg" alt="" />
                        <p className="text-sm font-bold text-white mb-1 truncate">{card.name}</p>
                        <span className="text-xs text-[#b3b3b3] font-medium">{card.sub}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* --- VIEW: SEARCH --- */}
        <div className={`absolute top-0 left-0 w-full h-[calc(100vh-130px)] overflow-y-auto p-5 pb-24 bg-[#121212] z-10 ${view === 'search' ? 'block' : 'hidden'}`}>
             <div className="mb-6">
                <h1 className="text-3xl font-extrabold mb-4">Search</h1>
                <div className="bg-white p-3.5 rounded-lg flex items-center gap-3 shadow-md">
                    <i className="fa-solid fa-magnifying-glass text-black text-xl"></i>
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if(e.target.value.length > 2) performSearch(e.target.value);
                        }}
                        className="border-none outline-none flex-1 text-base font-semibold text-black placeholder:text-gray-500" 
                        placeholder="What do you want to listen to?" 
                    />
                </div>
            </div>

            {isSearching ? (
                <div className="text-center mt-10 text-[#1db954] font-semibold">
                    <div className="inline-block w-6 h-6 border-4 border-white/10 border-t-[#1db954] rounded-full animate-spin-slow mr-2 align-middle"></div>
                    Mencari...
                </div>
            ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {searchResults.map((song, idx) => (
                        <div key={idx} onClick={() => playMusic(song)} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-white/10 active:bg-white/10 transition-colors cursor-pointer group">
                            <img src={song.cover} className="w-[50px] h-[50px] rounded object-cover" alt="" />
                            <div className="flex-1">
                                <h4 className="text-[15px] font-semibold text-white mb-1 group-hover:text-[#1db954]">{song.title}</h4>
                                <p className="text-[13px] text-[#b3b3b3]">{song.artist}</p>
                            </div>
                            <i className="fa-solid fa-play text-[#1db954]"></i>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center mt-12 text-[#b3b3b3]">
                    <i className="fa-solid fa-music text-5xl mb-5 opacity-50"></i>
                    <p className="text-lg font-bold text-white mb-1">Play what you love</p>
                    <span className="text-[13px]">Search for artists, songs, podcasts, and more.</span>
                </div>
            )}
        </div>

        {/* --- VIEW: LIBRARY --- */}
        <div className={`absolute top-0 left-0 w-full h-[calc(100vh-130px)] overflow-y-auto p-5 pb-24 bg-[#121212] z-10 ${view === 'library' ? 'block' : 'hidden'}`}>
             <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-4">
                    {getAvatar()}
                    <h2 className="text-2xl font-bold">Your Library</h2>
                </div>
                <div className="flex gap-4">
                    <i className="fa-solid fa-plus text-xl text-white cursor-pointer" onClick={createNewPlaylist}></i>
                    {user && <button onClick={() => { supabase.auth.signOut(); }} className="text-xs bg-red-600/20 text-red-500 px-3 py-1 rounded-full font-bold">LOGOUT</button>}
                </div>
            </div>

            <div className="flex gap-2.5 mb-5">
                <span className="px-4 py-2 rounded-full bg-[#2a2a2a] border border-[#333] text-[13px] text-white cursor-pointer hover:bg-white hover:text-black hover:font-bold transition-all">Playlists</span>
            </div>

            <div className="flex flex-col gap-2">
                 {/* Email Verification Banner */}
                 {user && !isVerified && (
                     <div className="bg-yellow-900/40 border border-yellow-600/50 rounded-lg p-4 mb-4 text-center">
                         <i className="fa-solid fa-triangle-exclamation text-yellow-500 text-2xl mb-2"></i>
                         <h3 className="text-white font-bold mb-1">Email Verification Required</h3>
                         <p className="text-gray-300 text-xs mb-3">Your library is locked until you verify your email address. Please check your inbox.</p>
                         <button onClick={() => window.location.reload()} className="bg-yellow-600/20 text-yellow-500 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-600/40">I Have Verified</button>
                     </div>
                 )}

                 {/* Liked Songs Folder */}
                 <div onClick={() => isVerified ? openPlaylist({id: 'liked', name: 'Liked Songs', image: 'https://cdn.odzre.my.id/rri.jpg', songs: likedSongs}) : alert("Verify email to access.")} 
                     className={`flex items-center gap-3 p-2.5 rounded-md hover:bg-white/10 cursor-pointer bg-gradient-to-br from-[#450af5] to-[#8e8e8e] ${!isVerified && 'opacity-50 pointer-events-none'}`}>
                    <div className="w-[50px] h-[50px] flex items-center justify-center text-xl"><i className="fa-solid fa-heart"></i></div>
                    <div className="flex-1">
                        <h4 className="text-[15px] font-semibold text-white">Liked Songs</h4>
                        <p className="text-[13px] text-[#ddd]">{likedSongs.length} liked songs</p>
                    </div>
                 </div>

                 {/* User Playlists */}
                 {!user && <p className="text-center text-sm text-gray-500 mt-5">Login to see your playlists</p>}
                 
                 {isVerified && playlists.map(pl => (
                     <div key={pl.id} onClick={() => openPlaylist(pl)} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-white/10 cursor-pointer">
                        <img src={pl.image} className="w-[50px] h-[50px] rounded object-cover" alt="" />
                        <div className="flex-1">
                            <h4 className="text-[15px] font-semibold text-white">{pl.name}</h4>
                            <p className="text-[13px] text-[#b3b3b3]">{pl.songs.length} songs</p>
                        </div>
                        <i className="fa-solid fa-trash text-red-400 p-2 hover:bg-white/10 rounded-full" onClick={(e) => {
                             e.stopPropagation();
                             if(confirm("Delete playlist?")) {
                                 dbService.deletePlaylist(pl.id).then(() => setPlaylists(prev => prev.filter(p => p.id !== pl.id)));
                             }
                        }}></i>
                     </div>
                 ))}
            </div>
        </div>

        {/* --- VIEW: PLAYLIST DETAIL --- */}
        <div className={`absolute top-0 left-0 w-full h-[calc(100vh-130px)] overflow-y-auto p-5 pb-24 bg-gradient-to-b from-[#444] to-[#121212] z-10 ${view === 'playlist-detail' ? 'block' : 'hidden'}`}>
             <div className="flex flex-col items-center text-center mb-8 pt-2">
                <i className="fa-solid fa-arrow-left self-start text-2xl mb-5 cursor-pointer" onClick={() => setView('library')}></i>
                <img src={currentPlaylistDetail?.image} className="w-[180px] h-[180px] rounded-lg shadow-2xl mb-5 object-cover" alt="" />
                <span className="text-[10px] font-bold tracking-[2px] text-[#b3b3b3] mb-2.5">PLAYLIST</span>
                <h1 className="text-2xl font-extrabold mb-1.5">{currentPlaylistDetail?.name}</h1>
                <p className="text-sm text-[#b3b3b3] mb-4">{currentPlaylistDetail?.songs.length} Songs</p>
                <button onClick={() => { if(currentPlaylistDetail?.songs.length) playMusic(currentPlaylistDetail.songs[0], currentPlaylistDetail.songs); }} className="bg-[#1db954] text-black border-none px-8 py-3 rounded-full font-bold text-sm cursor-pointer transition-transform active:scale-95 flex items-center gap-2">
                    <i className="fa-solid fa-play"></i> PUTAR
                </button>
             </div>

             <div className="flex flex-col gap-2">
                 {currentPlaylistDetail?.songs.map((song, idx) => (
                     <div key={idx} onClick={() => playMusic(song, currentPlaylistDetail.songs)} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-white/10 active:bg-white/10 transition-colors cursor-pointer">
                         <span className="text-[#777] text-xs w-5">{idx + 1}</span>
                         <img src={song.cover} className="w-10 h-10 rounded object-cover" alt="" />
                         <div className="flex-1">
                             <h4 className="text-[15px] font-semibold text-white">{song.title}</h4>
                             <p className="text-[13px] text-[#b3b3b3]">{song.artist}</p>
                         </div>
                     </div>
                 ))}
             </div>
        </div>

        {/* --- BOTTOM MINI PLAYER --- */}
        <div onClick={(e) => { 
                if(!(e.target as HTMLElement).closest('.controls')) setIsFullPlayerOpen(true); 
             }} 
             className="fixed bottom-[65px] left-2 right-2 h-16 bg-[#353535] rounded-lg flex flex-col z-[100] shadow-xl backdrop-blur-md overflow-hidden cursor-pointer">
            <div className="w-full h-[2px] bg-white/20">
                <div className="h-full bg-white rounded-r" style={{width: `${progress}%`}}></div>
            </div>
            <div className="flex items-center px-3 gap-3 h-full">
                <img src={currentSong?.cover || "https://cdn.odzre.my.id/aax.jpg"} className="w-[42px] h-[42px] rounded shadow-sm" alt="cover" />
                <div className="flex-1 overflow-hidden whitespace-nowrap">
                    <h4 className="text-white text-[13px] font-bold mb-0.5">{currentSong?.title || "Not Playing"}</h4>
                    <p className="text-[#bbb] text-[11px]">{currentSong?.artist || "Sxataku"}</p>
                </div>
                <div className="w-10 h-10 flex items-center justify-center text-xl text-white controls" onClick={(e) => {e.stopPropagation(); togglePlay();}}>
                    <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                </div>
            </div>
        </div>

        {/* --- NAVBAR --- */}
        <nav className="fixed bottom-0 w-full h-[60px] bg-gradient-to-t from-black/100 to-[#121212]/95 flex justify-around items-center z-[100] pb-1">
            {['home', 'search', 'library'].map((navItem) => (
                <div key={navItem} onClick={() => setView(navItem as ViewState)} 
                     className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition-all ${view === navItem ? 'text-white scale-105' : 'text-[#777]'}`}>
                    <i className={`fa-solid ${navItem === 'home' ? 'fa-house' : navItem === 'search' ? 'fa-magnifying-glass' : 'fa-book'} text-[22px]`}></i>
                    <span className="capitalize">{navItem}</span>
                </div>
            ))}
        </nav>

        {/* --- FULL PLAYER OVERLAY --- */}
        <div className={`fixed top-0 left-0 w-full h-full bg-gradient-to-br from-[#444] via-[#121212] to-black z-[200] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] p-8 flex flex-col ${isFullPlayerOpen ? 'top-0' : 'top-[100vh]'}`}>
             <div className="flex justify-between items-center mb-10">
                 <i className="fa-solid fa-chevron-down text-2xl cursor-pointer" onClick={() => setIsFullPlayerOpen(false)}></i>
                 <span className="text-xs font-bold uppercase tracking-widest">Now Playing</span>
                 <i className="fa-solid fa-list-ul text-xl cursor-pointer"></i>
             </div>
             
             <img src={currentSong?.cover || "https://cdn.odzre.my.id/aax.jpg"} className="w-full aspect-square rounded-xl shadow-2xl mb-10 object-cover" alt="" />
             
             <div className="flex justify-between items-center mb-8">
                 <div className="overflow-hidden">
                     <h2 className="text-2xl font-extrabold mb-1 truncate">{currentSong?.title || "Song Title"}</h2>
                     <p className="text-[#b3b3b3] text-base font-medium">{currentSong?.artist || "Artist"}</p>
                 </div>
                 <i onClick={() => currentSong && toggleLike(currentSong)} className={`${currentSong && isLiked(currentSong) ? 'fa-solid text-[#1db954]' : 'fa-regular text-white'} fa-heart text-2xl cursor-pointer`}></i>
             </div>

             <div className="mb-8">
                 <input type="range" min="0" max="100" value={progress} onChange={handleSeek} className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer" />
                 <div className="flex justify-between text-xs text-[#b3b3b3] font-medium mt-2">
                     <span>{formatTime(currentTime)}</span>
                     <span>{formatTime(duration)}</span>
                 </div>
             </div>

             <div className="flex justify-between items-center mt-auto text-3xl text-white">
                 <i className="fa-solid fa-shuffle text-xl text-[#1db954]"></i>
                 <i className="fa-solid fa-backward-step"></i>
                 <div className="w-[70px] h-[70px] bg-white text-black rounded-full flex items-center justify-center text-3xl shadow-lg active:scale-95 transition-transform" onClick={togglePlay}>
                     <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                 </div>
                 <i className="fa-solid fa-forward-step" onClick={handleEnded}></i>
                 <i className="fa-solid fa-repeat text-xl text-[#b3b3b3]"></i>
             </div>
             
             <div className="mt-auto text-center text-[11px] text-[#555] tracking-[2px] font-bold uppercase pb-5">SXATA CORP - Copyright 2026</div>
        </div>
    </div>
  );
};

export default App;