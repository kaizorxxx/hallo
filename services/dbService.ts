import { supabase } from '../supabaseClient';
import { Song, Playlist, Profile } from '../types';

export const dbService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    // Allow PGRST116 (No rows found) so we can create one if needed
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertProfile(profile: Profile) {
    const { error } = await supabase.from('profiles').upsert(profile);
    if (error) throw error;
  },

  async getLikedSongs(userId: string): Promise<Song[]> {
    const { data, error } = await supabase
      .from('liked_songs')
      .select('song_data')
      .eq('user_id', userId)
      .order('id', { ascending: false });
    
    if (error) throw error;
    return data.map((item: any) => item.song_data);
  },

  async toggleLikedSong(userId: string, song: Song) {
    // Check if exists
    const { data: existing } = await supabase
      .from('liked_songs')
      .select('id')
      .eq('user_id', userId)
      .contains('song_data', { url: song.url })
      .single();

    if (existing) {
      await supabase.from('liked_songs').delete().eq('id', existing.id);
      return false; // Removed
    } else {
      await supabase.from('liked_songs').insert({ user_id: userId, song_data: song });
      return true; // Added
    }
  },

  async getPlaylists(userId: string): Promise<Playlist[]> {
    const { data: playlists, error } = await supabase
      .from('user_playlists')
      .select(`
        id, name, image,
        playlist_songs ( song_data )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    return playlists.map((pl: any) => ({
      id: pl.id,
      name: pl.name,
      image: pl.image || 'https://cdn.odzre.my.id/77c.jpg',
      songs: pl.playlist_songs.map((ps: any) => ps.song_data)
    }));
  },

  async createPlaylist(userId: string, name: string, image: string) {
    const { data, error } = await supabase
      .from('user_playlists')
      .insert({ user_id: userId, name, image })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePlaylist(playlistId: number | string) {
    const { error } = await supabase.from('user_playlists').delete().eq('id', playlistId);
    if (error) throw error;
  },

  async addSongToPlaylist(playlistId: number | string, song: Song) {
    const { error } = await supabase
      .from('playlist_songs')
      .insert({ playlist_id: playlistId, song_data: song });
    if (error) throw error;
  }
};