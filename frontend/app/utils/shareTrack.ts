import { Share } from 'react-native';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.djrehab2006.djrehabmusic&hl=en_US';

export async function shareTrack(trackTitle: string) {
  try {
    await Share.share({
      message: `🎧 Check out "${trackTitle}" by DJ Rehab on the DJ Rehab Music app! Download it free on Google Play: ${PLAY_STORE_URL}`,
      url: PLAY_STORE_URL,
      title: 'DJ Rehab Music',
    });
  } catch {
    // User dismissed the share sheet or sharing unavailable - ignore
  }
}
