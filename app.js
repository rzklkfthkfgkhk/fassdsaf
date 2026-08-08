// =============================== app.js ===============================
// Глобальное состояние
const STATE = {
  currentUser: null,
  currentPage: 'home',
  animeList: [],
  selectedAnime: null,
  selectedEpisode: 1,
  searchQuery: '',
  userLists: {},
  avatars: {},
  theme: 'light',
  manualVideoUrl: null,
  manualAnimeId: null, // для ручного ввода ID Gogoanime
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

// ---------- ANILIST API ----------
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

// ---------- ПОЛУЧЕНИЕ ID АНИМЕ ----------
const CONSUMET_API = 'https://api.consumet.org/anime/gogoanime';
const CORS_PROXY = 'https://corsproxy.io/';
const ID_CACHE = {};

// Метод 1: через consumet API
async function getAnimeIdConsumet(animeTitle) {
  const key = animeTitle.toLowerCase();
  if (ID_CACHE[key]) return ID_CACHE[key];

  const slug = animeTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  try {
    const url = `${CONSUMET_API}/${slug}`;
    console.log('consumet запрос:', url);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('consumet ответ:', resp.status);
      return null;
    }
    const data = await resp.json();
    console.log('consumet ответ:', data);
    if (data && data.results && data.results.length > 0) {
      const id = data.results[0].id;
      ID_CACHE[key] = id;
      console.log('Найден ID (consumet):', id);
      return id;
    }
    return null;
  } catch (e) {
    console.error('consumet ошибка:', e);
    return null;
  }
}

// Метод 2: парсинг страницы Gogoanime (запасной)
async function getAnimeIdGogo(animeTitle) {
  const key = animeTitle.toLowerCase();
  if (ID_CACHE[key]) return ID_CACHE[key];

  const slug = animeTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  try {
    const url = `${CORS_PROXY}https://gogoanime.gg/category/${slug}`;
    console.log('Gogoanime запрос (через прокси):', url);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('Gogoanime ответ:', resp.status);
      return null;
    }
    const html = await resp.text();
    // Ищем ID в атрибуте data-id (обычно на странице есть элемент с data-id)
    const match = html.match(/<input[^>]*id="movie_id"[^>]*value="([^"]+)"/);
    if (match) {
      const id = match[1];
      ID_CACHE[key] = id;
      console.log('Найден ID (Gogoanime):', id);
      return id;
    }
    // Другой вариант: ищем в data-video
    const match2 = html.match(/data-video="([^"]+)"/);
    if (match2) {
      const videoUrl = match2[1];
      // Извлекаем ID из URL (например, https://gogoanime.gg/embed/attack-on-titan-episode-1 -> attack-on-titan)
      const idMatch = videoUrl.match(/\/embed\/([^\/]+)/);
      if (idMatch) {
        const id = idMatch[1];
        ID_CACHE[key] = id;
        console.log('Найден ID (из data-video):', id);
        return id;
      }
    }
    return null;
  } catch (e) {
    console.error('Gogoanime парсинг ошибка:', e);
    return null;
  }
}

// Основная функция получения ID (сначала consumet, потом парсинг)
async function getAnimeId(animeTitle) {
  let id = await getAnimeIdConsumet(animeTitle);
  if (id) return id;
  id = await getAnimeIdGogo(animeTitle);
  return id;
}

async function getVideoUrl(animeTitle, episode, manualId = null) {
  let id = manualId || await getAnimeId(animeTitle);
  if (!id) return null;
  // Если id содержит не только цифры (например, "attack-on-titan"), оставляем как есть
  return `https://vidsrc.to/embed/anime/${id}/${episode}`;
}

// ---------- ЗАГРУЗКА ВИДЕО ----------
async function loadVideo(anime, episode) {
  const iframe = $('#playerIframe');
  if (!iframe) return;

  // Ручная ссылка
  if (STATE.manualVideoUrl) {
    iframe.src = STATE.manualVideoUrl;
    return;
  }

  const title = anime.title.romaji || anime.title.english || anime.title.native || '';
  const loadingMsg = document.getElementById('loadingMessage');
  if (loadingMsg) loadingMsg.style.display = 'block';
  iframe.src = '';

  let videoUrl = null;
  // Если есть ручной ID, используем его
  if (STATE.manualAnimeId) {
    videoUrl = await getVideoUrl(title, episode, STATE.manualAnimeId);
  } else {
    videoUrl = await getVideoUrl(title, episode);
  }

  if (loadingMsg) loadingMsg.style.display = 'none';

  if (videoUrl) {
    iframe.src = videoUrl;
    console.log('Видео загружено:', videoUrl);
  } else {
    alert('Не удалось найти ID аниме. Попробуйте ввести ID вручную (см. поле "ID аниме" ниже) или вставьте ссылку.');
    // Показываем поле для ручного ID
    const manualIdContainer = document.getElementById('manualIdContainer');
    if (manualIdContainer) manualIdContainer.style.display = 'block';
  }
}

// ---------- РЕНДЕРИНГ (полный) ----------
const container = $('#pageContainer');

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
    STATE.manualVideoUrl = null;
    STATE.manualAnimeId = null;
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

        <div id="sourceTabs" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin:1rem 0;">
          <button class="source-tab active-tab" data-source="auto">▶ Автопоиск</button>
          <button class="source-tab" data-source="manual">🔗 Ссылка</button>
        </div>

        <div id="manualIdContainer" style="display:none; margin:1rem 0; padding:0.5rem; border:1px solid var(--border-color); border-radius:10px;">
          <div style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center;">
            <input type="text" id="manualIdInput" placeholder="Введите ID аниме (например, attack-on-titan)" style="flex:2; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);" />
            <button id="manualIdApplyBtn" style="background:#3b82f6; color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Применить ID</button>
            <button id="manualIdClearBtn" style="background:#ef4444; color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Сбросить ID</button>
          </div>
          <p style="font-size:0.8rem; opacity:0.7; margin-top:0.3rem;">Пример ID: attack-on-titan (можно посмотреть в URL на gogoanime)</p>
        </div>

        <div id="manualControls" style="margin-bottom:1rem; display:none;">
          <div style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center;">
            <input type="text" id="manualUrlInput" placeholder="Вставьте ссылку на видео (iframe)" style="flex:1; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);" />
            <button id="manualUrlApplyBtn" style="background:#10b981; color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Применить</button>
            <button id="manualUrlClearBtn" style="background:#ef4444; color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Очистить</button>
          </div>
        </div>

        <div id="playerContent">
          <div class="video-container" id="videoContainer">
            <div id="loadingMessage" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:1.2rem; z-index:10;">Поиск видео...</div>
            <iframe id="playerIframe" src="" allowfullscreen></iframe>
          </div>
        </div>
        <p style="margin-top:1rem; font-size:0.85rem; opacity:0.7;">
          🎬 Автопоиск через Gogoanime + vidsrc.to. Если не работает – введите ID вручную или вставьте ссылку.
        </p>
      </div>
    </div>
  `;
  container.innerHTML = html;

  $('#backToHome')?.addEventListener('click', () => {
    STATE.selectedAnime = null;
    STATE.searchQuery = '';
    renderHome();
  });

  // Генерируем кнопки серий
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
      const activeTab = document.querySelector('.source-tab.active-tab');
      const source = activeTab ? activeTab.dataset.source : 'auto';
      if (source === 'auto') {
        loadVideo(anime, ep);
      } else {
        if (!STATE.manualVideoUrl) {
          alert('Вставьте ссылку вручную или переключитесь на автопоиск');
        }
      }
    });
  });

  // Вкладки
  const sourceTabs = document.querySelectorAll('.source-tab');
  const manualControls = document.getElementById('manualControls');
  const manualIdContainer = document.getElementById('manualIdContainer');
  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => t.classList.remove('active-tab'));
      tab.classList.add('active-tab');
      const source = tab.dataset.source;
      if (source === 'manual') {
        manualControls.style.display = 'block';
        manualIdContainer.style.display = 'none';
        const iframe = $('#playerIframe');
        if (iframe && !STATE.manualVideoUrl) {
          iframe.src = '';
        }
      } else {
        manualControls.style.display = 'none';
        if (!STATE.manualVideoUrl) {
          const anime = STATE.selectedAnime;
          if (anime) loadVideo(anime, STATE.selectedEpisode);
        }
      }
    });
  });

  // Ручной ID
  const manualIdInput = document.getElementById('manualIdInput');
  const manualIdApplyBtn = document.getElementById('manualIdApplyBtn');
  const manualIdClearBtn = document.getElementById('manualIdClearBtn');

  manualIdApplyBtn?.addEventListener('click', () => {
    const id = manualIdInput.value.trim();
    if (!id) {
      alert('Введите ID');
      return;
    }
    STATE.manualAnimeId = id;
    // Перезагружаем видео
    const anime = STATE.selectedAnime;
    if (anime) loadVideo(anime, STATE.selectedEpisode);
    manualIdContainer.style.display = 'none';
  });

  manualIdClearBtn?.addEventListener('click', () => {
    STATE.manualAnimeId = null;
    manualIdInput.value = '';
    const anime = STATE.selectedAnime;
    if (anime) loadVideo(anime, STATE.selectedEpisode);
    manualIdContainer.style.display = 'none';
  });

  // Ручная ссылка
  const manualUrlInput = document.getElementById('manualUrlInput');
  const manualUrlApplyBtn = document.getElementById('manualUrlApplyBtn');
  const manualUrlClearBtn = document.getElementById('manualUrlClearBtn');

  manualUrlApplyBtn?.addEventListener('click', () => {
    const url = manualUrlInput.value.trim();
    if (!url) {
      alert('Введите ссылку');
      return;
    }
    STATE.manualVideoUrl = url;
    const iframe = $('#playerIframe');
    if (iframe) iframe.src = url;
    const manualTab = document.querySelector('.source-tab[data-source="manual"]');
    if (manualTab && !manualTab.classList.contains('active-tab')) {
      manualTab.click();
    }
  });

  manualUrlClearBtn?.addEventListener('click', () => {
    STATE.manualVideoUrl = null;
    const iframe = $('#playerIframe');
    if (iframe) iframe.src = '';
    manualUrlInput.value = '';
    const autoTab = document.querySelector('.source-tab[data-source="auto"]');
    if (autoTab) autoTab.click();
  });

  // Если автопоиск – загружаем первую серию
  if (document.querySelector('.source-tab.active-tab')?.dataset.source === 'auto') {
    loadVideo(anime, STATE.selectedEpisode);
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

authForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = $('#authUsername').value.trim();
  const password = $('#authPassword').value.trim();
  if (!username || !password) { alert('Заполните все поля'); return; }

  if (isLoginMode) {
    const stored = localStorage.getItem(`user_${username}`);
    if (!stored) { alert('Пользователь не найден'); return; }
    const user = JSON.parse(stored);
    if (user.password !== password) { alert('Неверный пароль'); return; }
    STATE.currentUser = { username, password };
    saveState();
    closeAuthModal();
    updateUI();
    renderCurrentPage();
  } else {
    if (localStorage.getItem(`user_${username}`)) { alert('Пользователь уже существует'); return; }
    localStorage.setItem(`user_${username}`, JSON.stringify({ username, password }));
    STATE.currentUser = { username, password };
    getUserLists(username);
    saveState();
    closeAuthModal();
    updateUI();
    renderCurrentPage();
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
$('#logoutBtn')?.addEventListener('click', () => {
  STATE.currentUser = null;
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
console.log('AniList App с автопоиском (consumet + Gogoanime) и ручным ID');
