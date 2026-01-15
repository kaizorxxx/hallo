export interface Song {
  url: string;
  title: string;
  artist: string;
  thumbnail?: string; // API response key
  cover?: string; // Internal key
}

export interface Playlist {
  id: number | string;
  name: string;
  image: string;
  songs: Song[];
  user_id?: string;
}

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

export type ViewState = 'home' | 'search' | 'library' | 'playlist-detail';

export interface UserContextType {
  user: any | null; // Supabase user
  profile: Profile | null;
  loading: boolean;
  signInWithProvider: (provider: 'google' | 'github' | 'facebook') => Promise<void>;
  signOut: () => Promise<void>;
}
