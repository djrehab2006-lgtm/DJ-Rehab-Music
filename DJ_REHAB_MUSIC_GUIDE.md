# 🎵 DJ REHAB MUSIC - Admin Guide

## Overview
DJ Rehab Music is a professional Android music streaming app with full admin control for managing albums and tracks via CDN links.

## 📱 Features

### Admin Authentication
- Simple login system
- **Login Credentials:**
  - Username: `djrehab2006`
  - Password: `Helena@1810`

### Album (Folder) Management
- ✅ Create albums/folders to organize your music
- ✅ Rename albums
- ✅ Delete albums (also deletes all tracks within)
- ✅ Beautiful grid view with cover art support

### Track Management
- ✅ Add tracks with CDN streaming URLs
- ✅ Edit track metadata (title, artist, duration, CDN URL)
- ✅ Assign tracks to albums
- ✅ Delete tracks
- ✅ Search tracks by title or artist

### Music Player
- ✅ Full-featured audio player
- ✅ Background playback support
- ✅ Play/Pause/Skip controls
- ✅ Seek bar for navigation
- ✅ Duration display
- ✅ Beautiful now-playing screen

## 🎯 How to Use

### Adding an Album
1. Login with djrehab2006 / Helena@1810
2. Tap the **+ icon** next to "Albums"
3. Enter album name
4. Tap "Save"

### Adding a Track
1. Tap the **+ icon** next to "All Tracks"
2. Fill in the track details:
   - **Track title**: Name of the song
   - **Artist name**: Artist/composer name
   - **CDN URL**: Direct streaming link to the audio file
   - **Duration**: Length in seconds (e.g., 210 for 3:30)
   - **Album**: Select which album (optional)
3. Tap "Save"

### Editing/Deleting
- **Long press** on any album or track to see edit/delete options

### Playing Music
- Tap any track to open the player
- Use the player controls:
  - Play/Pause button (center)
  - Skip forward/backward (10 seconds)
  - Seek bar to jump to any position
  - Back button to return to library

## 🔧 Technical Details

### Backend API
- **Base URL**: `/api`
- **Auth**: JWT Bearer tokens
- **Database**: MongoDB

### Supported Audio Formats
Any format supported by React Native's Audio component:
- MP3
- M4A
- WAV
- AAC
- And more...

### CDN Requirements
- Use **direct links** to audio files
- HTTPS recommended
- CORS-enabled CDN
- Example: `https://cdn.example.com/music/track.mp3`

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/verify` - Verify token

### Albums
- `GET /api/folders` - List all albums
- `POST /api/folders` - Create album
- `PUT /api/folders/:id` - Update album
- `DELETE /api/folders/:id` - Delete album

### Tracks
- `GET /api/tracks` - List all tracks
- `POST /api/tracks` - Create track
- `PUT /api/tracks/:id` - Update track
- `DELETE /api/tracks/:id` - Delete track

## 🎨 Design Features
- **Dark Theme**: Professional dark UI optimized for OLED displays
- **Purple Accent**: Beautiful purple highlights (#A855F7)
- **Gold Branding**: Distinctive gold logo
- **Smooth Animations**: Native-feeling transitions
- **Responsive**: Works on all Android screen sizes

## 🚀 Deployment
The app is ready for:
- **Expo Go**: Scan QR code for testing
- **Android APK**: Build standalone app
- **Google Play**: Production deployment

## 💡 Tips
1. Use high-quality CDN services for best streaming performance
2. Test CDN links before adding (paste in browser to verify)
3. Organize tracks into albums for easier management
4. Duration can be calculated: minutes × 60 + seconds (e.g., 3:30 = 210)
5. Background playback works when app is minimized

## 🔐 Security Note
Change the default admin password in production by creating a new admin user in the MongoDB database.

---

**Enjoy your DJ Rehab Music experience! 🎧**
