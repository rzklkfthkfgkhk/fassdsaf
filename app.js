// =============================== app.js ===============================
// Глобальное состояние
const STATE = {
  currentUser: null,
  authToken: null, // Добавлено для хранения токена
  currentPage: 'home',
  animeList: [],
  selectedAnime: null,
  selectedEpisode: 1,
  searchQuery: '',
  userLists: {},
  avatars: {},
  theme: 'light',
  videoSource: 'direct', // 'direct', 'youtube', 'vk'
  videoUrl: '',
  vkVideoId: '',
  youtubeQuery: '',
};

// ---------- FALLBACK СПИСОК АНИМЕ ----------
const FALLBACK_ANIME = [
  { id: 1, title: { romaji: 'Re:Zero', english: 'Re:ZERO -Starting Life in Another World-' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21327-CA5bBcIuBSXZ.jpg' }, genres: ['Fantasy', 'Drama'], episodes: 25, status: 'Finished', averageScore: 82 },
  { id: 2, title: { romaji: 'Attack on Titan', english: 'Attack on Titan' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-PhIKwjqPSOX9.jpg' }, genres: ['Action', 'Fantasy'], episodes: 87, status: 'Finished', averageScore: 86 },
  { id: 3, title: { romaji: 'Jujutsu Kaisen', english: 'Jujutsu Kaisen' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120907-iwafhRnzCOA8.jpg' }, genres: ['Action', 'Supernatural'], episodes: 24, status: 'Finished', averageScore: 84 },
  { id: 4, title: { romaji: 'Demon Slayer', english: 'Demon Slayer: Kimetsu no Yaiba' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-Z9wDqUULh5hQ.jpg' }, genres: ['Action', 'Fantasy'], episodes: 26, status: 'Finished', averageScore: 83 },
  { id: 5, title: { romaji: 'One Piece', english: 'One Piece' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-HB0tLGLQuG6v.jpg' }, genres: ['Action', 'Adventure'], episodes: 1000, status: 'Ongoing', averageScore: 87 },
  { id: 6, title: { romaji: 'Naruto', english: 'Naruto' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20-NE1ffJtSYYdq.jpg' }, genres: ['Action', 'Adventure'], episodes: 220, status: 'Finished', averageScore: 80 },
  { id: 7, title: { romaji: 'Death Note', english: 'Death Note' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-rvXXRc2TvGpN.jpg' }, genres: ['Mystery', 'Psychological'], episodes: 37, status: 'Finished', averageScore: 85 },
  { id: 8, title: { romaji: 'Fullmetal Alchemist: Brotherhood', english: 'Fullmetal Alchemist: Brotherhood' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-SJGVbh0kA7VK.jpg' }, genres: ['Action', 'Adventure'], episodes: 64, status: 'Finished', averageScore: 90 },
  { id: 9, title: { romaji: 'My Hero Academia', english: 'My Hero Academia' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx100317-5NyA2Q3BxpBw.jpg' }, genres: ['Action', 'Superhero'], episodes: 113, status: 'Ongoing', averageScore: 81 },
  { id: 10, title: { romaji: 'Tokyo Ghoul', english: 'Tokyo Ghoul' }, coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20665-K2sXzBc6HjQH.jpg' }, genres: ['Action', 'Horror'], episodes: 12, status: 'Finished', averageScore: 75 },
];

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function loadState() {
  try {
    const raw = localStorage.getItem('animeapp_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      STATE.userLists = parsed.userLists || {};
      STATE.avatars = parsed.avatars || {};
      STATE.theme = parsed.theme || 'light';
      if (parsed.currentUser) STATE.currentUser = parsed.currentUser;
      if (parsed.authToken) STATE.authToken = parsed.authToken; // Восстанавливаем токен
    }
  } catch (e) { console.warn('Ошибка загрузки состояния', e); }
}
function saveState() {
  try {
    localStorage.setItem('animeapp_state', JSON.stringify({
      userLists: STATE.userLists,
      avatars: STATE.avatars,
      theme: STATE.theme,
      currentUser: STATE.currentUser,
      authToken: STATE.authToken, // Сохраняем токен
    }));
  } catch (e) { console.warn('Ошибка сохранения состояния', e); }
}

function getUserLists(username) {
  if (!STATE.userLists[username]) {
    STATE.userLists[username] = { favorites: [], watched: [], dropped: [] };
    saveState();
  }
  return STATE.userLists[username];
}

function toggleList(username, animeId, listName) {
  const lists = getUserLists(username);
  const arr = lists[listName];
  if (!arr) return;
  const idx = arr.indexOf(animeId);
  if (idx > -1) arr.splice(idx, 1);
  else arr.push(animeId);
  saveState();
  renderCurrentPage();
}

// ============================================
// ⭐ НОВЫЙ БЛОК: АВТОРИЗАЦИЯ НА AniLiberty TOP
// ============================================

const ANILIBERTY_API = 'https://aniliberty.top/api/v1';

// Функция логина (получение зашифрованного токена)
async function loginToAniLiberty(login, password) {
  const url = `${ANILIBERTY_API}/accounts/users/auth/login`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ login, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    // API возвращает токен в поле "token"
    if (data.token) {
      return data.token; 
    } else {
      throw new Error('Токен не получен');
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    throw error;
  }
}

// ---------- ANILIST API (FALLBACK) ----------
const ANILIST_API = 'https://graphql.anilist.co';

async function fetchAnimeList(page = 1, perPage = 50, search = '') {
  const query = `
    query ($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, search: $search) {
          id
          title { romaji english native }
          coverImage { large medium }
          genres
          description
          episodes
          status
          averageScore
        }
        pageInfo { hasNextPage }
      }
    }
  `;
  const variables = { page, perPage, search: search || undefined };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error('HTTP error ' + resp.status);
    const json = await resp.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data.Page;
  } catch (e) {
    console.warn('AniList API не отвечает, используем fallback', e);
    let list = FALLBACK_ANIME;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        a.title.romaji.toLowerCase().includes(q) ||
        (a.title.english && a.title.english.toLowerCase().includes(q))
      );
    }
    return { media: list, pageInfo: { hasNextPage: false } };
  }
}

async function fetchAnimeById(id) {
  const fallback = FALLBACK_ANIME.find(a => a.id === id);
  if (fallback) return fallback;

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        coverImage { large medium }
        genres
        description
        episodes
        status
        averageScore
        bannerImage
      }
    }
  `;
  try {
    const resp = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { id } })
    });
    const json = await resp.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data.Media;
  } catch (e) {
    console.warn('Не удалось загрузить аниме по ID', e);
    return fallback || null;
  }
}

// ============================================
// ⭐ УНИВЕРСАЛЬНЫЙ ПЛЕЕР С ПОДДЕРЖКОЙ ВСЕХ ИСТОЧНИКОВ
// ============================================
class UniversalPlayer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Контейнер плеера не найден');
      return;
    }
    this.currentSource = null;
    this.videoElement = null;
    this.iframeElement = null;
  }

  clear() {
    this.container.innerHTML = '';
    this.videoElement = null;
    this.iframeElement = null;
  }

  playDirect(url) {
    this.clear();
    this.currentSource = 'direct';
    
    const video = document.createElement('video');
    video.id = 'animePlayer';
    video.controls = true;
    video.muted = false;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.maxWidth = '100%';
    video.style.height = 'auto';
    video.style.maxHeight = '500px';
    video.style.borderRadius = '12px';
    video.style.background = '#000';
    video.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    
    video.poster = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%231a1a1a"/%3E%3Ctext x="50" y="150" fill="%23666" font-size="20"%3EЗагрузка видео...%3C/text%3E%3C/svg%3E';
    
    this.container.appendChild(video);
    this.videoElement = video;
    
    if (url) {
      video.src = url;
      video.load();
      video.play().catch(e => console.warn('Автовоспроизведение заблокировано', e));
    }
    
    return video;
  }

  playYouTube(query) {
    this.clear();
    this.currentSource = 'youtube';
    
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '500';
    iframe.src = `https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(query)}`;
    iframe.title = 'YouTube video player';
    iframe.frameBorder = '0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.style.borderRadius = '12px';
    iframe.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    
    this.container.appendChild(iframe);
    this.iframeElement = iframe;
    
    return iframe;
  }

  playVK(videoId) {
    this.clear();
    this.currentSource = 'vk';
    
    if (!videoId) {
      this.container.innerHTML = `
        <div style="padding:2rem; text-align:center; color:var(--text-secondary); background:var(--bg-input); border-radius:12px;">
          <p>Введите ID видео VK (например, video-12345_67890)</p>
        </div>
      `;
      return null;
    }
    
    const vkContainer = document.createElement('div');
    vkContainer.id = 'vk_player_widget';
    vkContainer.style.width = '100%';
    vkContainer.style.minHeight = '400px';
    vkContainer.style.borderRadius = '12px';
    vkContainer.style.overflow = 'hidden';
    this.container.appendChild(vkContainer);
    
    const loadVKWidget = () => {
      if (window.VK && VK.Widgets) {
        try {
          VK.Widgets.Player('vk_player_widget', { 
            video: videoId,
            width: '100%',
            height: 480,
            autoplay: 0
          });
        } catch (e) {
          console.error('Ошибка загрузки VK плеера:', e);
          this.container.innerHTML = `
            <div style="padding:2rem; text-align:center; color:#e74c3c; background:var(--bg-input); border-radius:12px;">
              <p>❌ Ошибка загрузки VK плеера. Проверьте ID видео.</p>
              <p style="font-size:0.85rem; margin-top:0.5rem;">${e.message}</p>
            </div>
          `;
        }
      } else {
        const script = document.createElement('script');
        script.src = 'https://vk.com/js/api/vk_api.js?169';
        script.onload = () => {
          if (window.VK && VK.Widgets) {
            try {
              VK.Widgets.Player('vk_player_widget', { 
                video: videoId,
                width: '100%',
                height: 480,
                autoplay: 0
              });
            } catch (e) {
              console.error('Ошибка загрузки VK плеера:', e);
              this.container.innerHTML = `
                <div style="padding:2rem; text-align:center; color:#e74c3c; background:var(--bg-input); border-radius:12px;">
                  <p>❌ Ошибка загрузки VK плеера. Проверьте ID видео.</p>
                  <p style="font-size:0.85rem; margin-top:0.5rem;">${e.message}</p>
                </div>
              `;
            }
          }
        };
        script.onerror = () => {
          this.container.innerHTML = `
            <div style="padding:2rem; text-align:center; color:#e74c3c; background:var(--bg-input); border-radius:12px;">
              <p>❌ Не удалось загрузить VK API</p>
            </div>
          `;
        };
        document.head.appendChild(script);
      }
    };
    
    setTimeout(loadVKWidget, 100);
    
    return vkContainer;
  }

  playHTML5(url, type = 'video/mp4') {
    this.clear();
    this.currentSource = 'html5';
    
    const video = document.createElement('video');
    video.id = 'animePlayer';
    video.controls = true;
    video.muted = false;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.maxWidth = '100%';
    video.style.height = 'auto';
    video.style.maxHeight = '500px';
    video.style.borderRadius = '12px';
    video.style.background = '#000';
    video.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    
    const source = document.createElement('source');
    source.src = url;
    source.type = type;
    video.appendChild(source);
    
    this.container.appendChild(video);
    this.videoElement = video;
    
    video.load();
    video.play().catch(e => console.warn('Автовоспроизведение заблокировано', e));
    
    return video;
  }

  playWithProgress(url) {
    this.clear();
    this.currentSource = 'direct';
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    
    const video = document.createElement('video');
    video.id = 'animePlayer';
    video.controls = true;
    video.muted = false;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.maxWidth = '100%';
    video.style.height = 'auto';
    video.style.maxHeight = '500px';
    video.style.borderRadius = '12px';
    video.style.background = '#000';
    video.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    video.preload = 'metadata';
    
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: absolute;
      bottom: 50px;
      left: 20px;
      right: 20px;
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      overflow: hidden;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: #3b82f6;
      border-radius: 2px;
      transition: width 0.1s;
    `;
    progressBar.appendChild(progressFill);
    wrapper.appendChild(video);
    wrapper.appendChild(progressBar);
    this.container.appendChild(wrapper);
    this.videoElement = video;
    
    video.addEventListener('progress', () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        if (duration > 0) {
          progressBar.style.opacity = '1';
          progressFill.style.width = `${(buffered / duration) * 100}%`;
          if (buffered >= duration) {
            setTimeout(() => { progressBar.style.opacity = '0'; }, 1000);
          }
        }
      }
    });
    
    video.addEventListener('playing', () => {
      progressBar.style.opacity = '0';
    });
    
    if (url) {
      video.src = url;
      video.load();
      video.play().catch(e => console.warn('Автовоспроизведение заблокировано', e));
    }
    
    return video;
  }
}

// ---------- РЕНДЕРИНГ ----------
const container = $('#pageContainer');
let player = null;

function clearContainer() { container.innerHTML = ''; }

async function renderHome() {
  clearContainer();
  container.innerHTML = '<div class="loading">Загрузка аниме...</div>';
  try {
    const data = await fetchAnimeList(1, 50, STATE.searchQuery);
    STATE.animeList = data.media || [];
    renderAnimeGrid(STATE.animeList);
    const clearBtn = $('#clearSearchBtn');
    if (STATE.searchQuery) clearBtn.style.display = 'inline-block';
    else clearBtn.style.display = 'none';
    const searchInput = $('#searchInput');
    if (searchInput) searchInput.value = STATE.searchQuery;
  } catch (e) {
    container.innerHTML = `<div class="loading">Ошибка загрузки: ${e.message}</div>`;
    const fallbackData = await fetchAnimeList(1, 50, STATE.searchQuery);
    STATE.animeList = fallbackData.media || [];
    renderAnimeGrid(STATE.animeList);
  }
}

function renderAnimeGrid(animes, targetContainer = null) {
  const target = targetContainer || container;
  if (!animes || animes.length === 0) {
    target.innerHTML = '<div class="loading">Ничего не найдено</div>';
    return;
  }
  let html = '<div class="grid">';
  for (const anime of animes) {
    const title = anime.title.romaji || anime.title.english || anime.title.native || 'Без названия';
    const img = anime.coverImage?.large || anime.coverImage?.medium || '';
    const id = anime.id;
    let fav = false, watched = false, dropped = false;
    if (STATE.currentUser) {
      const lists = getUserLists(STATE.currentUser.username);
      fav = lists.favorites.includes(id);
      watched = lists.watched.includes(id);
      dropped = lists.dropped.includes(id);
    }
    html += `
      <div class="card card-enter" data-id="${id}">
        <img src="${img}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22300%22/%3E'" />
        <div class="card-content">
          <div class="card-title">${title}</div>
          <div class="card-actions">
            <button class="fav ${fav ? 'active-status' : ''}" data-id="${id}" data-list="favorites">❤️</button>
            <button class="watched ${watched ? 'active-status' : ''}" data-id="${id}" data-list="watched">👁️</button>
            <button class="dropped ${dropped ? 'active-status' : ''}" data-id="${id}" data-list="dropped">🚫</button>
          </div>
        </div>
      </div>
    `;
  }
  html += '</div>';
  target.innerHTML = html;

  target.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = parseInt(card.dataset.id);
      openAnimeDetail(id);
    });
  });
  target.querySelectorAll('.card-actions button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!STATE.currentUser) {
        alert('Войдите, чтобы добавлять в списки');
        return;
      }
      const id = parseInt(btn.dataset.id);
      const list = btn.dataset.list;
      toggleList(STATE.currentUser.username, id, list);
    });
  });
}

async function openAnimeDetail(id) {
  clearContainer();
  container.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    let anime = await fetchAnimeById(id);
    if (!anime) {
      anime = FALLBACK_ANIME.find(a => a.id === id);
    }
    if (!anime) {
      container.innerHTML = '<div class="loading">Аниме не найдено</div>';
      return;
    }
    STATE.selectedAnime = anime;
    STATE.selectedEpisode = 1;
    renderAnimeDetail(anime);
  } catch (e) {
    container.innerHTML = `<div class="loading">Ошибка: ${e.message}</div>`;
  }
}

function renderAnimeDetail(anime) {
  const title = anime.title.romaji || anime.title.english || anime.title.native || 'Без названия';
  const img = anime.coverImage?.large || anime.coverImage?.medium || '';
  const genres = anime.genres || [];
  const description = anime.description ? anime.description.replace(/<[^>]*>/g, '').slice(0, 300) + '...' : 'Описание отсутствует';
  const totalEpisodes = anime.episodes || 12;

  let html = `
    <div class="anime-detail">
      <div class="anime-detail-header">
        <img src="${img}" alt="${title}" />
        <div class="info">
          <h2>${title}</h2>
          <p>${description}</p>
          <div class="genres">${genres.map(g => `<span>${g}</span>`).join('')}</div>
          <p>⭐ ${anime.averageScore || '?'}% · ${anime.status || 'Неизвестно'} · ${totalEpisodes} серий</p>
          <button id="backToHome">← На главную</button>
        </div>
      </div>
      <div class="player-section">
        <h3>Выбор серии</h3>
        <div id="episodeListContainer" class="episode-list"></div>

        <div style="margin:1rem 0; padding:0.5rem; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-input);">
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem;">
            <button class="source-btn" data-source="direct">📁 Прямая ссылка</button>
            <button class="source-btn" data-source="youtube">▶ YouTube</button>
            <button class="source-btn" data-source="vk">📺 VK</button>
            <button class="source-btn" data-source="html5">🎬 HTML5</button>
          </div>
          <div id="sourceControls">
            <div id="directControl" style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center;">
              <input type="text" id="directUrlInput" placeholder="Введите ссылку на MP4-видео" style="flex:2; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);" />
              <button id="directPlayBtn" style="background:#3b82f6; color:white; border:none; padding:0.3rem 1.2rem; border-radius:20px; cursor:pointer;">Загрузить</button>
            </div>
            <div id="youtubeControl" style="display:none; flex-wrap:wrap; gap:0.8rem; align-items:center;">
              <input type="text" id="youtubeQueryInput" placeholder="Введите поисковый запрос (например, Attack on Titan 1 серия)" style="flex:2; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);" />
              <button id="youtubePlayBtn" style="background:#ff0000; color:white; border:none; padding:0.3rem 1.2rem; border-radius:20px; cursor:pointer;">Поиск на YouTube</button>
            </div>
            <div id="vkControl" style="display:none; flex-wrap:wrap; gap:0.8rem; align-items:center;">
              <input type="text" id="vkVideoIdInput" placeholder="Введите ID видео (например, video-12345_67890)" style="flex:2; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);" />
              <button id="vkPlayBtn" style="background:#4c75a3; color:white; border:none; padding:0.3rem 1.2rem; border-radius:20px; cursor:pointer;">Загрузить VK</button>
            </div>
            <div id="html5Control" style="display:none; flex-wrap:wrap; gap:0.8rem; align-items:center;">
              <input type="text" id="html5UrlInput" placeholder="Введите ссылку на видео (MP4, WebM)" style="flex:2; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);" />
              <select id="html5TypeSelect" style="padding:0.3rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);">
                <option value="video/mp4">MP4</option>
                <option value="video/webm">WebM</option>
                <option value="video/ogg">OGG</option>
              </select>
              <button id="html5PlayBtn" style="background:#10b981; color:white; border:none; padding:0.3rem 1.2rem; border-radius:20px; cursor:pointer;">Загрузить</button>
            </div>
          </div>
        </div>

        <div id="playerContainer">
          <div style="padding:2rem; text-align:center; color:var(--text-secondary); background:var(--bg-input); border-radius:12px;">
            <p>🎬 Выберите источник и загрузите видео</p>
          </div>
        </div>

        <p style="margin-top:1rem; font-size:0.85rem; opacity:0.7;">
          🎬 Вставьте ссылку на видео вручную или используйте поиск YouTube / VK.
        </p>
      </div>
    </div>
  `;
  container.innerHTML = html;

  player = new UniversalPlayer('playerContainer');

  $('#backToHome')?.addEventListener('click', () => {
    STATE.selectedAnime = null;
    STATE.searchQuery = '';
    renderHome();
  });

  const epContainer = document.getElementById('episodeListContainer');
  let epHtml = '';
  for (let i = 1; i <= totalEpisodes; i++) {
    epHtml += `<button class="${i === STATE.selectedEpisode ? 'active-ep' : ''}" data-ep="${i}">${i}</button>`;
  }
  epContainer.innerHTML = epHtml;

  epContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = parseInt(btn.dataset.ep);
      STATE.selectedEpisode = ep;
      epContainer.querySelectorAll('button').forEach(b => b.classList.remove('active-ep'));
      btn.classList.add('active-ep');
      
      const directInput = document.getElementById('directUrlInput');
      if (directInput && directInput.value) {
        const url = directInput.value;
        if (url) {
          const epUrl = url.replace(/\d+\.mp4$/, `${ep}.mp4`);
          if (epUrl !== url) {
            directInput.value = epUrl;
            player.playDirect(epUrl);
          }
        }
      }
    });
  });

  const sourceBtns = document.querySelectorAll('.source-btn');
  const directControl = document.getElementById('directControl');
  const youtubeControl = document.getElementById('youtubeControl');
  const vkControl = document.getElementById('vkControl');
  const html5Control = document.getElementById('html5Control');

  sourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sourceBtns.forEach(b => {
        b.style.background = '';
        b.style.color = '';
      });
      btn.style.background = 'var(--accent, #3b82f6)';
      btn.style.color = 'white';
      const source = btn.dataset.source;
      directControl.style.display = source === 'direct' ? 'flex' : 'none';
      youtubeControl.style.display = source === 'youtube' ? 'flex' : 'none';
      vkControl.style.display = source === 'vk' ? 'flex' : 'none';
      html5Control.style.display = source === 'html5' ? 'flex' : 'none';
      STATE.videoSource = source;
    });
  });
  
  const defaultBtn = document.querySelector('.source-btn[data-source="direct"]');
  if (defaultBtn) defaultBtn.click();

  document.getElementById('directPlayBtn')?.addEventListener('click', () => {
    const url = document.getElementById('directUrlInput').value.trim();
    if (!url) {
      alert('Введите ссылку на видео');
      return;
    }
    player.playWithProgress(url);
    localStorage.setItem('lastVideoUrl', url);
  });

  document.getElementById('youtubePlayBtn')?.addEventListener('click', () => {
    const query = document.getElementById('youtubeQueryInput').value.trim();
    if (!query) {
      alert('Введите поисковый запрос');
      return;
    }
    player.playYouTube(query);
  });

  document.getElementById('vkPlayBtn')?.addEventListener('click', () => {
    const videoId = document.getElementById('vkVideoIdInput').value.trim();
    if (!videoId) {
      alert('Введите ID видео VK (например, video-12345_67890)');
      return;
    }
    player.playVK(videoId);
  });

  document.getElementById('html5PlayBtn')?.addEventListener('click', () => {
    const url = document.getElementById('html5UrlInput').value.trim();
    const type = document.getElementById('html5TypeSelect').value;
    if (!url) {
      alert('Введите ссылку на видео');
      return;
    }
    player.playHTML5(url, type);
  });

  const savedUrl = localStorage.getItem('lastVideoUrl');
  if (savedUrl) {
    const input = document.getElementById('directUrlInput');
    if (input) input.value = savedUrl;
  }
}

// ---------- ПРОФИЛЬ ----------
function renderProfile() {
  if (!STATE.currentUser) { renderHome(); return; }
  clearContainer();
  const username = STATE.currentUser.username;
  const lists = getUserLists(username);
  const avatar = STATE.avatars[username] || '';

  let html = `
    <div class="profile-header">
      <img class="profile-avatar" id="profileAvatar" src="${avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22/%3E'}" alt="avatar" />
      <div class="profile-info">
        <h2>${username}</h2>
        <div class="profile-stats">
          <span>⭐ Избранное: ${lists.favorites.length}</span>
          <span>👁️ Просмотрено: ${lists.watched.length}</span>
          <span>🚫 Брошено: ${lists.dropped.length}</span>
        </div>
        <div style="display:flex; gap:0.8rem; flex-wrap:wrap; margin-top:0.5rem;">
          <button id="changeAvatarBtn">📷 Сменить аватар</button>
        </div>
      </div>
    </div>
    <div class="profile-tabs">
      <button class="active-tab" data-tab="favorites">Избранное</button>
      <button data-tab="watched">Просмотренное</button>
      <button data-tab="dropped">Брошенное</button>
    </div>
    <div id="profileListContainer"></div>
  `;
  container.innerHTML = html;

  $('#profileAvatar')?.addEventListener('click', () => openAvatarModal());
  $('#changeAvatarBtn')?.addEventListener('click', () => openAvatarModal());

  container.querySelectorAll('.profile-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.profile-tabs button').forEach(b => b.classList.remove('active-tab'));
      btn.classList.add('active-tab');
      renderProfileList(btn.dataset.tab);
    });
  });
  renderProfileList('favorites');
}

async function renderProfileList(type) {
  const containerList = $('#profileListContainer');
  if (!containerList) return;
  const username = STATE.currentUser.username;
  const lists = getUserLists(username);
  const ids = lists[type] || [];
  if (ids.length === 0) {
    containerList.innerHTML = '<div class="loading">Список пуст</div>';
    return;
  }
  containerList.innerHTML = '<div class="loading">Загрузка...</div>';
  try {
    const animes = [];
    for (const id of ids) {
      let found = STATE.animeList.find(a => a.id === id);
      if (!found) {
        try { found = await fetchAnimeById(id); } catch (e) { continue; }
      }
      if (found) animes.push(found);
    }
    renderAnimeGrid(animes, containerList);
  } catch (e) {
    containerList.innerHTML = `<div class="loading">Ошибка: ${e.message}</div>`;
  }
}

// ---------- МОДАЛКИ ----------
const authModal = $('#authModal');
const authForm = $('#authForm');
let isLoginMode = true;

function openAuthModal() {
  authModal.style.display = 'flex';
  isLoginMode = true;
  updateAuthForm();
}
function closeAuthModal() { authModal.style.display = 'none'; }

function updateAuthForm() {
  const title = $('#authTitle');
  const btn = $('#authSubmitBtn');
  const toggleText = $('#authToggleText');
  if (isLoginMode) {
    title.textContent = 'Вход';
    btn.textContent = 'Войти';
    toggleText.innerHTML = 'Нет аккаунта? <a href="#" id="authToggleLink">Зарегистрироваться</a>';
  } else {
    title.textContent = 'Регистрация';
    btn.textContent = 'Создать аккаунт';
    toggleText.innerHTML = 'Уже есть аккаунт? <a href="#" id="authToggleLink">Войти</a>';
  }
  const link = document.getElementById('authToggleLink');
  if (link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      isLoginMode = !isLoginMode;
      updateAuthForm();
    });
  }
}

// ============================================
// ⭐ ОБНОВЛЕННЫЙ ОБРАБОТЧИК АВТОРИЗАЦИИ
// ============================================
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#authUsername').value.trim();
  const password = $('#authPassword').value.trim();
  
  if (!username || !password) { 
    alert('Заполните все поля'); 
    return; 
  }

  const submitBtn = $('#authSubmitBtn');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Загрузка...';
  submitBtn.disabled = true;

  try {
    // Вход в реальное API AniLiberty
    const token = await loginToAniLiberty(username, password);
    
    STATE.currentUser = { username: username, token: token };
    STATE.authToken = token;

    getUserLists(username);
    saveState();

    closeAuthModal();
    updateUI();
    renderCurrentPage();
    
  } catch (error) {
    alert(`Ошибка авторизации: ${error.message}`);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

document.querySelector('.close')?.addEventListener('click', closeAuthModal);
window.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

// Аватарка
const avatarModal = $('#avatarModal');
const avatarInput = $('#avatarInput');
const avatarSaveBtn = $('#avatarSaveBtn');

function openAvatarModal() {
  if (!STATE.currentUser) return;
  avatarModal.style.display = 'flex';
  avatarInput.value = '';
}
function closeAvatarModal() { avatarModal.style.display = 'none'; }

document.querySelector('.close-avatar')?.addEventListener('click', closeAvatarModal);
window.addEventListener('click', (e) => { if (e.target === avatarModal) closeAvatarModal(); });

avatarSaveBtn?.addEventListener('click', () => {
  const file = avatarInput.files[0];
  if (!file) { alert('Выберите файл'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    STATE.avatars[STATE.currentUser.username] = e.target.result;
    saveState();
    closeAvatarModal();
    renderCurrentPage();
  };
  reader.readAsDataURL(file);
});

// Тема
const themeModal = $('#themeModal');
const themeOptions = document.querySelectorAll('.theme-option');

function openThemeModal() {
  themeModal.style.display = 'flex';
}
function closeThemeModal() { themeModal.style.display = 'none'; }

document.querySelector('.close-theme')?.addEventListener('click', closeThemeModal);
window.addEventListener('click', (e) => { if (e.target === themeModal) closeThemeModal(); });

themeOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    STATE.theme = theme;
    saveState();
    closeThemeModal();
  });
});

// ---------- НАВИГАЦИЯ ----------
function renderCurrentPage() {
  if (STATE.currentPage === 'home') renderHome();
  else if (STATE.currentPage === 'profile') renderProfile();
  else renderHome();
  updateUI();
}

function updateUI() {
  const isAuth = !!STATE.currentUser;
  $('#loginBtn').style.display = isAuth ? 'none' : 'inline-block';
  $('#logoutBtn').style.display = isAuth ? 'inline-block' : 'none';
  $('#profileLink').style.display = isAuth ? 'inline-block' : 'none';
}

$('#homeLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  STATE.currentPage = 'home';
  STATE.selectedAnime = null;
  STATE.searchQuery = '';
  renderCurrentPage();
});

$('#profileLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!STATE.currentUser) { alert('Войдите в аккаунт'); return; }
  STATE.currentPage = 'profile';
  STATE.selectedAnime = null;
  renderCurrentPage();
});

$('#loginBtn')?.addEventListener('click', openAuthModal);

// ============================================
// ⭐ ОБНОВЛЕННЫЙ ВЫХОД
// ============================================
$('#logoutBtn')?.addEventListener('click', () => {
  STATE.currentUser = null;
  STATE.authToken = null;
  saveState();
  STATE.currentPage = 'home';
  STATE.selectedAnime = null;
  STATE.searchQuery = '';
  renderCurrentPage();
  updateUI();
});

$('#themeToggle')?.addEventListener('click', openThemeModal);

// Поиск
const searchInput = $('#searchInput');
const searchBtn = $('#searchBtn');
const clearSearchBtn = $('#clearSearchBtn');

searchBtn?.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    STATE.searchQuery = query;
    STATE.currentPage = 'home';
    STATE.selectedAnime = null;
    renderCurrentPage();
  } else {
    alert('Введите название для поиска');
  }
});

searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchBtn?.click();
});

clearSearchBtn?.addEventListener('click', () => {
  STATE.searchQuery = '';
  searchInput.value = '';
  STATE.currentPage = 'home';
  STATE.selectedAnime = null;
  renderCurrentPage();
});

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
loadState();
document.documentElement.setAttribute('data-theme', STATE.theme);
if (STATE.currentUser) updateUI();
renderCurrentPage();
console.log('AniList App с авторизацией через AniLiberty API');
