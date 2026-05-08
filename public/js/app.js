// Main app component
const App = (() => {
  const API_BASE = 'http://localhost:5000/api';
  const socket = io();
  let currentView = 'home';

  // Initialize app
  async function init() {
    console.log('🚀 YouTube Offline App initializing...');
    
    await IDBHandler.initDB();
    setupEventListeners();
    renderHome();
    setupLiveStreaming();
  }

  function setupEventListeners() {
    const searchBtn = document.querySelector('.search-bar button');
    const searchInput = document.querySelector('.search-bar input');
    const sidebarItems = document.querySelectorAll('.sidebar-item');

    // Search functionality
    searchBtn?.addEventListener('click', () => performSearch());
    searchInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });

    // Sidebar navigation
    sidebarItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        sidebarItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const text = item.textContent.trim();
        if (text.includes('Home')) {
          renderHome();
        } else if (text.includes('Live')) {
          renderLive();
        } else if (text.includes('Favorites')) {
          renderFavorites();
        } else if (text.includes('History')) {
          renderHistory();
        }
      });
    });
  }

  async function performSearch() {
    const query = document.querySelector('.search-bar input')?.value;
    if (!query) return;

    showLoading();

    if (OfflineManager.isOnline()) {
      try {
        const response = await fetch(`${API_BASE}/youtube/search?q=${encodeURIComponent(query)}&maxResults=20`);
        const data = await response.json();
        
        if (data.success) {
          await IDBHandler.addSearchQuery(query);
          displayVideos(data.videos);
        } else {
          showError('Search failed: ' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Search error:', error);
        showError('Failed to search videos. Check console.');
      }
    } else {
      // Show cached videos matching query
      const cached = await OfflineManager.getCachedVideos();
      const filtered = cached.filter(v =>
        v.title.toLowerCase().includes(query.toLowerCase())
      );
      displayVideos(filtered);
    }
  }

  function displayVideos(videos) {
    const mainContent = document.querySelector('.main-content');
    
    if (!videos || videos.length === 0) {
      mainContent.innerHTML = '<p style="padding: 20px;">No videos found</p>';
      return;
    }

    mainContent.innerHTML = '<div class="video-grid">' +
      videos.map(video => `
        <div class="video-card" onclick="App.playVideo('${video.id}')">
          <div class="video-thumbnail">
            ${video.thumbnail ? `<img src="${video.thumbnail}" alt="${video.title}">` : '▶'}
            <div class="play-button">▶</div>
          </div>
          <div class="video-info">
            <div class="video-title">${video.title || 'Unknown Title'}</div>
            <div class="video-channel">${video.channelTitle || 'Unknown Channel'}</div>
            <div class="video-stats">
              ${video.viewCount ? `<span>${formatNumber(video.viewCount)} views</span>` : ''}
            </div>
          </div>
        </div>
      `).join('') +
      '</div>';
  }

  function playVideo(videoId) {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
      <div class="player-container">
        <iframe 
          width="100%" 
          height="100%" 
          src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1"
          frameborder="0" 
          allowfullscreen>
        </iframe>
      </div>
    `;

    // Cache the video
    OfflineManager.cacheVideo(videoId, {
      id: videoId,
      title: 'Cached Video',
      playedAt: new Date().toISOString()
    });

    IDBHandler.addToWatchHistory({ id: videoId });
  }

  async function renderHome() {
    const mainContent = document.querySelector('.main-content');
    
    if (OfflineManager.isOnline()) {
      showLoading();
      try {
        const response = await fetch(`${API_BASE}/youtube/trending`);
        const data = await response.json();
        if (data.success) {
          displayVideos(data.videos);
        } else {
          showError('Failed to load trending videos');
          showCached();
        }
      } catch (error) {
        console.error('Failed to fetch trending:', error);
        showCached();
      }
    } else {
      showCached();
    }
  }

  async function renderLive() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
      <div style="padding: 20px;">
        <h2>🔴 Live Streams</h2>
        <button onclick="App.startStream()" style="padding: 12px 24px; background-color: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-bottom: 20px;">Start Live Stream</button>
        <div id="streams-list">Loading streams...</div>
      </div>
    `;
    
    loadActiveStreams();
  }

  async function loadActiveStreams() {
    try {
      const response = await fetch(`${API_BASE}/stream/active`);
      const data = await response.json();
      const streamsList = document.getElementById('streams-list');
      
      if (data.streams && data.streams.length > 0) {
        streamsList.innerHTML = data.streams.map(stream => `
          <div style="background-color: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h3>${stream.title}</h3>
            <p>${stream.channelName}</p>
            <p style="color: #aaa;">Viewers: ${stream.viewers || 0}</p>
          </div>
        `).join('');
      } else {
        streamsList.innerHTML = '<p>No active streams</p>';
      }
    } catch (error) {
      console.error('Error loading streams:', error);
    }
  }

  function startStream() {
    const title = prompt('Stream Title:');
    const channel = prompt('Channel Name:');
    
    if (title && channel) {
      fetch(`${API_BASE}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, channelName: channel, description: '' })
      })
      .then(r => r.json())
      .then(data => {
        alert('✅ Stream started! Stream ID: ' + data.streamId);
        loadActiveStreams();
      })
      .catch(err => alert('❌ Error: ' + err.message));
    }
  }

  async function renderFavorites() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = '<h2>⭐ Favorites</h2><p>Loading...</p>';
    
    const favorites = await IDBHandler.getFavorites();
    if (favorites.length > 0) {
      displayVideos(favorites);
    } else {
      mainContent.innerHTML = '<h2>⭐ Favorites</h2><p>No favorites yet. Click the star on any video to add!</p>';
    }
  }

  async function renderHistory() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = '<h2>📜 Watch History</h2><p>Loading...</p>';
    
    const history = await IDBHandler.getAllVideos();
    if (history.length > 0) {
      displayVideos(history);
    } else {
      mainContent.innerHTML = '<h2>📜 Watch History</h2><p>No videos watched yet</p>';
    }
  }

  async function showCached() {
    const cached = await OfflineManager.getCachedVideos();
    const mainContent = document.querySelector('.main-content');
    
    if (cached.length > 0) {
      mainContent.innerHTML = '<h2>📦 Cached Videos (Offline Mode)</h2>';
      displayVideos(cached);
    } else {
      mainContent.innerHTML = '<h2>📦 Offline Mode</h2><p>No cached videos. Watch videos online to cache them!</p>';
    }
  }

  function setupLiveStreaming() {
    socket.on('new-stream', (data) => {
      console.log('🔴 New live stream:', data);
      loadActiveStreams();
    });

    socket.on('stream-chunk', (data) => {
      console.log('Stream data received');
    });

    socket.on('stream-ended', (data) => {
      console.log('Stream ended:', data.streamerId);
      loadActiveStreams();
    });
  }

  function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function showLoading() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  }

  function showError(message) {
    console.error(message);
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `<div style="padding: 20px; color: #ff0000;"><strong>Error:</strong> ${message}</div>`;
  }

  return {
    init,
    playVideo,
    performSearch,
    startStream
  };
})();

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}