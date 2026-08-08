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
  anilibriaId: null,
  manualVideoUrl: null,
  currentSource: 'anilibria', // текущий выбранный источник
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
      STATE.anilibriaId = parsed.anilibriaId || null;
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
      anilibriaId: STATE.anilibriaId,
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

// ---------- ТРАНСЛИТЕРАЦИЯ (для ссылок) ----------
function transliterate(word) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return word.toLowerCase().split('').map(ch => map[ch] || ch).join('').replace(/[^a-z0-9]/g, '');
}

// ---------- ANILIBRIA API (v1) ----------
const ANILIBRIA_API = 'https://api.anilibria.top/v1';

function generateSearchVariants(titleObj) {
  const variants = [];
  if (titleObj.romaji) variants.push(titleObj.romaji);
  if (titleObj.english) variants.push(titleObj.english);
  if (titleObj.native) variants.push(titleObj.native);
  if (titleObj.romaji) {
    const clean = titleObj.romaji.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    if (clean && !variants.includes(clean)) variants.push(clean);
  }
  const words = titleObj.romaji ? titleObj.romaji.split(' ') : [];
  if (words.length > 1) {
    if (words.length >= 2) {
      variants.push(words.slice(0, 2).join(' '));
      variants.push(words.slice(-2).join(' '));
    }
    variants.push(words.join(' '));
  }
  return [...new Set(variants)];
}

async function searchAnilibriaTitle(titleObj) {
  const variants = generateSearchVariants(titleObj);
  for (const query of variants) {
    if (!query) continue;
    try {
      const url = `${ANILIBRIA_API}/searchTitles?search=${encodeURIComponent(query)}&limit=1`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && data.length > 0) return data[0];
    } catch (e) { continue; }
  }
  return null;
}

async function getAnilibriaTitleById(id) {
  try {
    const url = `${ANILIBRIA_API}/getTitle?id=${id}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.warn('Ошибка получения тайтла:', e);
    return null;
  }
}

async function getAnilibriaEpisodes(animeTitle, manualId = null) {
  let titleData = null;
  if (manualId) {
    const fullData = await getAnilibriaTitleById(manualId);
    if (fullData) titleData = fullData;
  }
  if (!titleData) {
    const found = await searchAnilibriaTitle(animeTitle);
    if (!found) return null;
    const fullData = await getAnilibriaTitleById(found.id);
    if (!fullData) return null;
    titleData = fullData;
  }
  if (!titleData.player || !titleData.player.list) return null;
  const list = titleData.player.list;
  const episodes = Object.keys(list).map(key => {
    const ep = list[key];
    return { episode: ep.episode, name: ep.name || null, hls: ep.hls || null };
  }).sort((a, b) => a.episode - b.episode);
  return {
    episodes: episodes,
    host: titleData.player.host || null,
    title: titleData,
    voices: titleData.team?.voice || ['Студийная Банда'],
  };
}

// ---------- ФУНКЦИИ ДЛЯ ДРУГИХ ИСТОЧНИКОВ ----------
function generateKinoboxUrl(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return `https://kinobox.tv/embed/${slug}-episode-${episode}`;
}

function generateVidsrcMeUrl(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return `https://vidsrc.me/embed/${slug}-episode-${episode}`;
}

function generateVidsrcToUrl(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return `https://vidsrc.to/embed/${slug}-episode-${episode}`;
}

// ---------- ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ВИДЕО ----------
function loadVideo(anime, episode, source) {
  const iframe = $('#playerIframe');
  if (!iframe) return;
  const title = anime.title.romaji || anime.title.english || anime.title.native || '';

  // Если есть ручная ссылка – используем её
  if (STATE.manualVideoUrl) {
    iframe.src = STATE.manualVideoUrl;
    return;
  }

  if (source === 'kinobox') {
    iframe.src = generateKinoboxUrl(title, episode);
    console.log('Kinobox URL:', iframe.src);
    return;
  }
  if (source === 'vidsrcme') {
    iframe.src = generateVidsrcMeUrl(title, episode);
    console.log('Vidsrc.me URL:', iframe.src);
    return;
  }
  if (source === 'vidsrcto') {
    iframe.src = generateVidsrcToUrl(title, episode);
    console.log('Vidsrc.to URL:', iframe.src);
    return;
  }

  // AniLibria (по умолчанию)
  const data = STATE._anilibriaData;
  if (!data) {
    iframe.src = '';
    return;
  }
  const epData = data.episodes.find(e => e.episode === episode);
  if (!epData || !epData.hls) {
    iframe.src = '';
    alert(`Серия ${episode} не найдена на AniLibria`);
    return;
  }
  const qualityMenu = document.getElementById('qualityMenu');
  let qualityKey = qualityMenu && qualityMenu.value ? qualityMenu.value : 'fhd';
  const hls = epData.hls;
  let url = hls[qualityKey];
  if (!url) {
    const keys = ['fhd', 'hd', 'sd'];
    for (const k of keys) {
      if (hls[k]) { url = hls[k]; break; }
    }
  }
  if (!url) {
    iframe.src = '';
    alert(`Нет доступного видео для серии ${episode}`);
    return;
  }
  const host = data.host || 'cache.libria.fun';
  const fullUrl = `https://${host}${url}`;
  iframe.src = fullUrl;
  console.log('AniLibria URL:', fullUrl);
}

// ---------- РЕНДЕРИНГ ----------
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
    STATE._anilibriaData = null;
    STATE.manualVideoUrl = null;
    STATE.currentSource = 'anilibria'; // по умолчанию
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
          <p>⭐ ${anime.averageScore || '?'}% · ${anime.status || 'Неизвестно'} · <span id="episodesCount">${totalEpisodes}</span> серий</p>
          <button id="backToHome">← На главную</button>
        </div>
      </div>
      <div class="player-section">
        <h3>Выбор серии</h3>
        <div id="episodeListContainer" class="episode-list">
          <!-- Сюда будут добавлены кнопки серий -->
        </div>
        <div class="player-controls" style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center;">
          <div class="quality-selector">
            <label for="qualityMenu">Качество:</label>
            <select id="qualityMenu" style="padding:0.3rem 0.8rem; border-radius:20px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); display:none;">
              <option value="">Авто</option>
            </select>
          </div>
          <div class="voice-selector">
            <label for="voiceMenu">Озвучка:</label>
            <select id="voiceMenu" style="padding:0.3rem 0.8rem; border-radius:20px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); display:none;">
              <option value="">Студийная Банда</option>
            </select>
          </div>
        </div>
        <div id="sourceTabs" style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">
          <button class="source-tab active-tab" data-source="anilibria">AniLibria</button>
          <button class="source-tab" data-source="kinobox">Kinobox</button>
          <button class="source-tab" data-source="vidsrcme">Vidsrc.me</button>
          <button class="source-tab" data-source="vidsrcto">Vidsrc.to</button>
          <button class="source-tab" data-source="manual">Ручная ссылка</button>
        </div>
        <div id="manualControls" style="margin-bottom:1rem; display:none;">
          <div style="display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center;">
            <input type="number" id="manualIdInput" placeholder="Введите ID тайтла AniLibria" style="flex:1; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);" />
            <button id="manualIdLoadBtn" style="background:var(--accent); color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Загрузить по ID</button>
            <button id="manualUrlBtn" style="background:#10b981; color:white; border:none; padding:0.5rem 1rem; border-radius:20px;">Вставить ссылку</button>
          </div>
          <div id="manualUrlInput" style="display:none; margin-top:0.5rem;">
            <input type="text" id="manualUrlField" placeholder="Введите прямую ссылку на видео (iframe)" style="flex:1; padding:0.5rem 1rem; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); width:100%;" />
            <button id="manualUrlApplyBtn" style="margin-top:0.5rem; background:#10b981; color:white; border:none; padding:0.3rem 1rem; border-radius:20px;">Применить</button>
          </div>
        </div>
        <div id="playerContent">
          <div class="video-container" id="videoContainer">
            <iframe id="playerIframe" src="" allowfullscreen></iframe>
          </div>
        </div>
        <p style="margin-top:1rem; font-size:0.85rem; opacity:0.7;">
          🎬 Выберите источник. Если видео не загружается, попробуйте другой или вставьте ссылку вручную.
        </p>
      </div>
    </div>
  `;
  container.innerHTML = html;

  // Обработчик "На главную"
  $('#backToHome')?.addEventListener('click', () => {
    STATE.selectedAnime = null;
    STATE.searchQuery = '';
    STATE._anilibriaData = null;
    renderHome();
  });

  // Обработчики вкладок источников
  const sourceTabs = document.querySelectorAll('.source-tab');
  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => t.classList.remove('active-tab'));
      tab.classList.add('active-tab');
      const source = tab.dataset.source;
      STATE.currentSource = source;
      const manualControls = document.getElementById('manualControls');
      const qualityMenu = document.getElementById('qualityMenu');
      const voiceMenu = document.getElementById('voiceMenu');
      if (source === 'manual') {
        manualControls.style.display = 'block';
        qualityMenu.style.display = 'none';
        voiceMenu.style.display = 'none';
        // Очищаем iframe
        const iframe = $('#playerIframe');
        if (iframe) iframe.src = '';
        STATE.manualVideoUrl = null;
        return;
      } else {
        manualControls.style.display = 'none';
        if (source === 'anilibria') {
          qualityMenu.style.display = 'inline-block';
          voiceMenu.style.display = 'inline-block';
        } else {
          qualityMenu.style.display = 'none';
          voiceMenu.style.display = 'none';
        }
        // Загружаем видео с текущим источником
        const anime = STATE.selectedAnime;
        if (anime) {
          loadVideo(anime, STATE.selectedEpisode, source);
        }
      }
    });
  });

  // Обработчики ручного ввода
  const manualIdInput = document.getElementById('manualIdInput');
  const manualIdLoadBtn = document.getElementById('manualIdLoadBtn');
  const manualUrlBtn = document.getElementById('manualUrlBtn');
  const manualUrlInput = document.getElementById('manualUrlInput');
  const manualUrlField = document.getElementById('manualUrlField');
  const manualUrlApplyBtn = document.getElementById('manualUrlApplyBtn');

  manualIdLoadBtn?.addEventListener('click', () => {
    const id = parseInt(manualIdInput.value.trim());
    if (!id || isNaN(id)) {
      alert('Введите корректный ID (число)');
      return;
    }
    STATE.anilibriaId = id;
    saveState();
    loadAnilibriaData(anime, id);
  });

  manualUrlBtn?.addEventListener('click', () => {
    manualUrlInput.style.display = manualUrlInput.style.display === 'none' ? 'block' : 'none';
  });

  manualUrlApplyBtn?.addEventListener('click', () => {
    const url = manualUrlField.value.trim();
    if (!url) {
      alert('Введите ссылку');
      return;
    }
    STATE.manualVideoUrl = url;
    const iframe = $('#playerIframe');
    if (iframe) iframe.src = url;
    manualUrlInput.style.display = 'none';
  });

  // Генерируем кнопки серий на основе totalEpisodes (для всех источников, кроме AniLibria)
  generateEpisodeButtons(totalEpisodes, anime);

  // Загружаем данные AniLibria (по умолчанию)
  loadAnilibriaData(anime, STATE.anilibriaId);
}

// Генерация кнопок серий (используется для всех источников)
function generateEpisodeButtons(totalEpisodes, anime) {
  const container = document.getElementById('episodeListContainer');
  if (!container) return;
  let epHtml = '';
  for (let i = 1; i <= totalEpisodes; i++) {
    epHtml += `<button class="${i === STATE.selectedEpisode ? 'active-ep' : ''}" data-ep="${i}">${i}</button>`;
  }
  container.innerHTML = epHtml;

  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = parseInt(btn.dataset.ep);
      STATE.selectedEpisode = ep;
      container.querySelectorAll('button').forEach(b => b.classList.remove('active-ep'));
      btn.classList.add('active-ep');
      // Загружаем с текущим активным источником
      const activeTab = document.querySelector('.source-tab.active-tab');
      const source = activeTab ? activeTab.dataset.source : 'anilibria';
      loadVideo(anime, ep, source);
    });
  });
}

// Загрузка данных AniLibria (обновляет кнопки серий и меню качества/озвучки)
async function loadAnilibriaData(anime, manualId = null) {
  const episodeListContainer = document.getElementById('episodeListContainer');
  const manualControls = document.getElementById('manualControls');
  if (!episodeListContainer) return;

  // Показываем индикатор загрузки
  episodeListContainer.innerHTML = '<div class="loading" style="padding:0.5rem;">Загрузка серий с AniLibria...</div>';
  manualControls.style.display = 'none';

  let data = await getAnilibriaEpisodes(anime.title, manualId);
  if (!data && STATE.anilibriaId && !manualId) {
    data = await getAnilibriaEpisodes(anime.title, STATE.anilibriaId);
  }

  if (!data || !data.episodes || data.episodes.length === 0) {
    // Не удалось загрузить AniLibria – показываем сообщение, но кнопки серий уже есть (из AniList)
    episodeListContainer.innerHTML = `
      <div style="color:var(--text-secondary); padding:0.5rem; width:100%;">
        ⚠️ Не удалось загрузить серии с AniLibria. Используйте другие источники или введите ID вручную.
      </div>
    `;
    // Показываем ручные контролы
    manualControls.style.display = 'block';
    // Обновляем кнопки серий (уже есть из generateEpisodeButtons)
    // Но их нужно перегенерировать, так как они могли быть затерты
    const totalEpisodes = anime.episodes || 12;
    generateEpisodeButtons(totalEpisodes, anime);
    return;
  }

  // Сохраняем данные AniLibria
  STATE._anilibriaData = data;

  // Обновляем количество серий
  const episodesCountSpan = document.getElementById('episodesCount');
  if (episodesCountSpan) {
    episodesCountSpan.textContent = data.episodes.length;
  }

  // Генерируем кнопки серий из данных AniLibria
  let epHtml = '';
  const maxEp = data.episodes.length;
  for (let i = 1; i <= maxEp; i++) {
    const ep = data.episodes.find(e => e.episode === i);
    if (ep) {
      epHtml += `<button class="${i === STATE.selectedEpisode ? 'active-ep' : ''}" data-ep="${i}">${i}</button>`;
    }
  }
  episodeListContainer.innerHTML = epHtml;

  episodeListContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = parseInt(btn.dataset.ep);
      STATE.selectedEpisode = ep;
      episodeListContainer.querySelectorAll('button').forEach(b => b.classList.remove('active-ep'));
      btn.classList.add('active-ep');
      const activeTab = document.querySelector('.source-tab.active-tab');
      const source = activeTab ? activeTab.dataset.source : 'anilibria';
      loadVideo(anime, ep, source);
    });
  });

  // Если текущая выбранная серия есть в данных, активируем её
  if (data.episodes.some(e => e.episode === STATE.selectedEpisode)) {
    const activeBtn = episodeListContainer.querySelector(`button[data-ep="${STATE.selectedEpisode}"]`);
    if (activeBtn) {
      episodeListContainer.querySelectorAll('button').forEach(b => b.classList.remove('active-ep'));
      activeBtn.classList.add('active-ep');
    }
  } else if (data.episodes.length > 0) {
    // Иначе выбираем первую
    STATE.selectedEpisode = data.episodes[0].episode;
    const firstBtn = episodeListContainer.querySelector(`button[data-ep="${STATE.selectedEpisode}"]`);
    if (firstBtn) {
      episodeListContainer.querySelectorAll('button').forEach(b => b.classList.remove('active-ep'));
      firstBtn.classList.add('active-ep');
    }
  }

  // Загружаем видео с текущим источником (если активен AniLibria)
  const activeTab = document.querySelector('.source-tab.active-tab');
  const currentSource = activeTab ? activeTab.dataset.source : 'anilibria';
  if (currentSource === 'anilibria') {
    loadVideo(anime, STATE.selectedEpisode, 'anilibria');
  }

  // Заполняем меню качества
  const qualityMenu = document.getElementById('qualityMenu');
  if (qualityMenu && qualityMenu.options.length === 0) {
    const firstEp = data.episodes[0];
    if (firstEp && firstEp.hls) {
      const hls = firstEp.hls;
      const qualityMap = { fhd: 'FHD (1080p)', hd: 'HD (720p)', sd: 'SD (480p)' };
      const order = ['fhd', 'hd', 'sd'];
      order.forEach(key => {
        if (hls[key]) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = qualityMap[key] || key.toUpperCase();
          qualityMenu.appendChild(opt);
        }
      });
      if (qualityMenu.options.length > 0) {
        qualityMenu.value = 'fhd';
        qualityMenu.style.display = 'inline-block';
        qualityMenu.onchange = () => {
          const activeTab2 = document.querySelector('.source-tab.active-tab');
          const src = activeTab2 ? activeTab2.dataset.source : 'anilibria';
          loadVideo(anime, STATE.selectedEpisode, src);
        };
      }
    }
  }
  const voiceMenu = document.getElementById('voiceMenu');
  if (voiceMenu && voiceMenu.options.length === 0 && data.voices) {
    data.voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      voiceMenu.appendChild(opt);
    });
    voiceMenu.style.display = 'inline-block';
  }

  // Скрываем ручные контролы, если данные загружены
  manualControls.style.display = 'none';
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
          <button id="clearAnilibriaIdBtn">🗑️ Сбросить ID AniLibria</button>
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
  $('#clearAnilibriaIdBtn')?.addEventListener('click', () => {
    STATE.anilibriaId = null;
    saveState();
    alert('ID AniLibria сброшен');
    renderCurrentPage();
  });

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

// ---------- МОДАЛКИ (авторизация, аватарка, тема) ----------
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
  STATE._anilibriaData = null;
  renderCurrentPage();
});

$('#profileLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!STATE.currentUser) { alert('Войдите в аккаунт'); return; }
  STATE.currentPage = 'profile';
  STATE.selectedAnime = null;
  STATE._anilibriaData = null;
  renderCurrentPage();
});

$('#loginBtn')?.addEventListener('click', openAuthModal);
$('#logoutBtn')?.addEventListener('click', () => {
  STATE.currentUser = null;
  saveState();
  STATE.currentPage = 'home';
  STATE.selectedAnime = null;
  STATE.searchQuery = '';
  STATE._anilibriaData = null;
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
    STATE._anilibriaData = null;
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
  STATE._anilibriaData = null;
  renderCurrentPage();
});

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
loadState();
document.documentElement.setAttribute('data-theme', STATE.theme);
if (STATE.currentUser) updateUI();
renderCurrentPage();
console.log('AniList App с AniLibria, Kinobox, Vidsrc.me, Vidsrc.to и ручным вводом');
