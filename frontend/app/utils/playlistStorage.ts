import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

const PLAYLISTS_KEY = 'user_playlists';

function generateId(): string {
  return 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

export async function getPlaylists(): Promise<Playlist[]> {
  try {
    const data = await AsyncStorage.getItem(PLAYLISTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading playlists:', error);
    return [];
  }
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  } catch (error) {
    console.error('Error saving playlists:', error);
  }
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const playlists = await getPlaylists();
  const newPlaylist: Playlist = {
    id: generateId(),
    name: name.trim(),
    trackIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  playlists.unshift(newPlaylist);
  await savePlaylists(playlists);
  return newPlaylist;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const playlists = await getPlaylists();
  const filtered = playlists.filter((p) => p.id !== playlistId);
  await savePlaylists(filtered);
}

export async function renamePlaylist(playlistId: string, newName: string): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (playlist) {
    playlist.name = newName.trim();
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
  }
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (playlist) {
    if (playlist.trackIds.includes(trackId)) {
      return false; // Already in playlist
    }
    playlist.trackIds.push(trackId);
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
    return true;
  }
  return false;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const playlists = await getPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (playlist) {
    playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    playlist.updatedAt = Date.now();
    await savePlaylists(playlists);
  }
}

export async function getPlaylistById(playlistId: string): Promise<Playlist | null> {
  const playlists = await getPlaylists();
  return playlists.find((p) => p.id === playlistId) || null;
}
