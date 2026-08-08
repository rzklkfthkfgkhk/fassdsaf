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
  vkToken: '',
  theme: 'light',
  anilibriaId: null, // ручной ID тайтла AniLibria
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
      STATE.vkToken = parsed.vkToken || '';
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
      vkToken: STATE.vkToken,
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

// ---------- ANILIST API (с таймаутом и fallback) ----------
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

// ---------- ТРАНСЛИТЕРАЦИЯ И ГЕНЕРАЦИЯ ССЫЛОК ----------
function transliterate(word) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return word.toLowerCase().split('').map(ch => map[ch] || ch).join('').replace(/[^a-z0-9]/g, '');
}

function generateJutSuUrls(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return [
    `https://jut.su/${slug}/season-1/episode-${episode}.html`,
    `https://jut.su/${slug}/episode-${episode}.html`,
  ];
}

function generateYammuanimeUrls(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return [
    `https://yammuanime.tv/anime/${slug}/episode-${episode}`,
    `https://yammuanime.net/anime/${slug}/episode-${episode}`,
  ];
}

function generateYummyAnimeUrls(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return [
    `https://ru.yummyani.me/catalog/item/${slug}/episode-${episode}`,
    `https://yummyani.me/catalog/item/${slug}/episode-${episode}`,
  ];
}

function generateCvhUrls(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return [
    `https://cvh.tv/anime/${slug}/episode-${episode}`,
    `https://cvh.xyz/anime/${slug}/episode-${episode}`,
  ];
}

function generateAniboomUrls(title, episode) {
  const slug = transliterate(title).replace(/\s+/g, '-');
  return [
    `https://aniboom.tv/anime/${slug}/episode-${episode}`,
    `https://aniboom.space/anime/${slug}/episode-${episode}`,
  ];
}

// ---------- ANILIBRIA API (НОВАЯ ВЕРСИЯ С УЛУЧШЕННЫМ ПОИСКОМ) ----------
const ANILIBRIA_API = 'https://api.anilibria.top/v1';

// Генерация вариантов названий для поиска
function generateSearchVariants(titleObj) {
  const variants = [];
  if (titleObj.romaji) variants.push(titleObj.romaji);
  if (titleObj.english) variants.push(titleObj.english);
  if (titleObj.native) variants.push(titleObj.native);
  // Очищенные от спецсимволов
  if (titleObj.romaji) {
    const clean = titleObj.romaji.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    if (clean && !variants.includes(clean)) variants.push(clean);
  }
  // Разбиваем на слова и пробуем отдельные значимые слова
  const words = titleObj.romaji ? titleObj.romaji.split(' ') : [];
  if (words.length > 1) {
    // Пробуем первые два слова, последние два, и все вместе
    const combos = [];
    if (words.length >= 2) {
      combos.push(words.slice(0, 2).join(' '));
      combos.push(words.slice(-2).join(' '));
    }
    combos.forEach(c => {
      if (c && !variants.includes(c)) variants.push(c);
    });
  }
  // Убираем дубли
  return [...new Set(variants)];
}

// Поиск тайтла по названию (несколько попыток)
async function searchAnilibriaTitle(titleObj) {
  const variants = generateSearchVariants(titleObj);
  console.log('Поиск AniLibria по вариантам:', variants);
  for (const query of variants) {
    if (!query) continue;
    try {
      const url = `${ANILIBRIA_API}/searchTitles?search=${encodeURIComponent(query)}&limit=1`;
      console.log(`Запрос к AniLibria: ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`Ответ не OK: ${resp.status} для запроса "${query}"`);
        continue;
      }
      const data = await resp.json();
      console.log(`Результат для "${query}":`, data);
      if (data && data.length > 0) {
        console.log(`Найден тайтл: ${data[0].id} - ${data[0].title}`);
        return data[0];
      }
    } catch (e) {
      console.warn(`Ошибка поиска на AniLibria по запросу "${query}":`, e);
    }
  }
  return null;
}

// Получение полной информации о тайтле по ID
async function getAnilibriaTitleById(id) {
  try {
    const url = `${ANILIBRIA_API}/getTitle?id=${id}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    console.log('Получены данные тайтла:', data);
    return data;
  } catch (e) {
    console.warn('Ошибка получения тайтла AniLibria:', e);
    return null;
  }
}

// Получение данных о конкретной серии
async function getAnilibriaEpisode(animeTitle, episode) {
  // Если есть ручной ID, используем его
  let titleData = null;
  if (STATE.anilibriaId) {
    console.log('Используем ручной ID AniLibria:', STATE.anilibriaId);
    const fullData = await getAnilibriaTitleById(STATE.anilibriaId);
    if (fullData) {
      titleData = fullData;
    } else {
      console.warn('Ручной ID не найден, пробуем поиск');
    }
  }
  if (!titleData) {
    // Ищем по названию
    const found = await searchAnilibriaTitle(animeTitle);
    if (!found) {
      console.warn('Тайтл не найден на AniLibria');
      return null;
    }
    // Получаем детали
    const fullData = await getAnilibriaTitleById(found.id);
    if (!fullData) {
      console.warn('Не удалось получить детали тайтла');
      return null;
    }
    titleData = fullData;
  }
  // Проверяем плейлист
  if (!titleData.player || !titleData.player.playlist) {
    console.warn('Нет плейлиста у тайтла');
    return null;
  }
  const playlist = titleData.player.playlist;
  console.log('Плейлист:', playlist);
  const epData = playlist.find(p => p.episode === episode);
  if (!epData) {
    console.warn(`Серия ${episode} не найдена в плейлисте`);
    return null;
  }
  console.log('Найдена серия:', epData);
  // Возвращаем данные серии
  return {
    videos: epData.videos || {},
    voices: titleData.voices || ['Студийная Банда'],
    title: titleData,
  };
}

// ---------- ПОИСК ВИДЕО (YouTube, VK) ----------
async function searchVideoInvidious(query) {
  const instances = ['https://yewtu.be', 'https://invidious.snopyta.org', 'https://inv.riverside.rocks'];
  for (const base of instances) {
    try {
      const resp = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && data.length > 0) {
        return { videoId: data[0].videoId, source: 'invidious' };
      }
    } catch (e) { continue; }
  }
  return null;
}

async function searchVideoPiped(query) {
  try {
    const resp = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=video`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.items && data.items.length > 0) {
      const url = data.items[0].url;
      const videoId = url.split('watch?v=')[1] || url.split('/')?.pop();
      return { videoId, source: 'piped' };
    }
  } catch (e) { return null; }
}

async function searchVideoVK(query) {
  if (!STATE.vkToken) return { error: 'Токен VK не задан' };
  const url = `https://api.vk.com/method/video.search?q=${encodeURIComponent(query)}&count=1&access_token=${STATE.vkToken}&v=5.131`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) return { error: data.error.error_msg || 'Ошибка VK API' };
    if (data.response && data.response.items && data.response.items.length > 0) {
      const video = data.response.items[0];
      const embed = `https://vk.com/video_ext.php?oid=${video.owner_id}&id=${video.id}&hash=${video.access_key || ''}`;
      return { embedUrl: embed, source: 'vk' };
    }
    return { error: 'Видео не найдено' };
  } catch (e) {
    return { error: 'Ошибка запроса к VK' };
  }
}

function getYouTubeSearchUrl(query) {
  return `https://www.youtube.com/embed/?listType=search&list=${encodeURIComponent(query)}`;
}

// ---------- ОСНОВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ВИДЕО ----------
async function loadVideo(anime, episode, source = 'auto') {
  const iframe = $('#playerIframe');
  if (!iframe) return;
  const titleObj = anime.title;
  const title = titleObj.romaji || titleObj.english || titleObj.native || '';
  const query = `${title} серия ${episode} аниме`;

  if (source === 'manual') {
    const manualArea = $('#manualLinkArea');
    if (manualArea) manualArea.style.display = 'flex';
    iframe.src = '';
    return;
  }

  if (source === 'vk') {
    const result = await searchVideoVK(query);
    if (result.embedUrl) {
      iframe.src = result.embedUrl;
      return;
    } else {
      alert(`VK: ${result.error || 'Видео не найдено'}. Попробуйте YouTube.`);
      const youtubeTab = document.querySelector('.player-tabs button[data-source="auto"]');
      if (youtubeTab) youtubeTab.click();
      return;
    }
  }

  // AniLibria – с улучшенной обработкой ошибок и автоматическим переходом на YouTube
  if (source === 'anilibria') {
    try {
      const epData = await getAnilibriaEpisode(titleObj, episode);
      if (epData && epData.videos) {
        const videos = epData.videos;
        const videoSrc = videos.hls || videos.fhd || videos.hd || videos.sd;
        if (videoSrc) {
          iframe.src = videoSrc;
          // Заполняем меню качества
          const qualityMenu = document.getElementById('qualityMenu');
          if (qualityMenu) {
            qualityMenu.innerHTML = '';
            const qualityMap = { fhd: 'FHD (1080p)', hd: 'HD (720p)', sd: 'SD (480p)', hls: 'Адаптивное (HLS)' };
            const order = ['hls', 'fhd', 'hd', 'sd'];
            order.forEach(key => {
              if (videos[key]) {
                const opt = document.createElement('option');
                opt.value = videos[key];
                opt.textContent = qualityMap[key] || key.toUpperCase();
                qualityMenu.appendChild(opt);
              }
            });
            if (qualityMenu.options.length > 0) {
              qualityMenu.value = videoSrc;
              qualityMenu.onchange = () => { iframe.src = qualityMenu.value; };
              qualityMenu.style.display = 'inline-block';
            }
          }
          const voiceMenu = document.getElementById('voiceMenu');
          if (voiceMenu) {
            voiceMenu.innerHTML = '';
            const voices = epData.voices || ['Студийная Банда'];
            voices.forEach(v => {
              const opt = document.createElement('option');
              opt.value = v;
              opt.textContent = v;
              voiceMenu.appendChild(opt);
            });
            voiceMenu.onchange = () => {
              // Здесь можно было бы перезагрузить с другой озвучкой, но для простоты уведомление
              console.log(`Выбрана озвучка: ${voiceMenu.value}`);
            };
            voiceMenu.style.display = 'inline-block';
          }
          return; // Успешно загрузили
        }
      }
      // Если не удалось найти видео – логируем и переключаемся на YouTube автоматически
      console.warn('AniLibria не нашла видео для этой серии, переключаем на YouTube');
      // Показываем уведомление в консоли, но не алерт
      // Автоматически переключаем вкладку на YouTube
      const youtubeTab = document.querySelector('.player-tabs button[data-source="auto"]');
      if (youtubeTab) {
        // Снимаем активную вкладку
        document.querySelectorAll('.player-tabs button').forEach(b => b.classList.remove('active-tab'));
        youtubeTab.classList.add('active-tab');
        // Прячем меню качества/озвучки
        const qualityMenu = document.getElementById('qualityMenu');
        const voiceMenu = document.getElementById('voiceMenu');
        if (qualityMenu) qualityMenu.style.display = 'none';
        if (voiceMenu) voiceMenu.style.display = 'none';
        // Загружаем видео через YouTube
        await loadVideo(anime, episode, 'auto');
        return;
      }
    } catch (e) {
      console.error('Ошибка при загрузке AniLibria:', e);
      // При ошибке тоже переключаем на YouTube
      const youtubeTab = document.querySelector('.player-tabs button[data-source="auto"]');
      if (youtubeTab) {
        document.querySelectorAll('.player-tabs button').forEach(b => b.classList.remove('active-tab'));
        youtubeTab.classList.add('active-tab');
        const qualityMenu = document.getElementById('qualityMenu');
        const voiceMenu = document.getElementById('voiceMenu');
        if (qualityMenu) qualityMenu.style.display = 'none';
        if (voiceMenu) voiceMenu.style.display = 'none';
        await loadVideo(anime, episode, 'auto');
        return;
      }
    }
    // Если ничего не сработало, показываем сообщение и предлагаем другие источники
    alert('Не удалось загрузить видео с AniLibria. Попробуйте другой источник (YouTube, VK, Jut.su и т.д.)');
    return;
  }

  // Остальные источники (Jut.su, Yammuanime, YummyAnime, CVH, AniBoom)
  if (['jutsu', 'yammuanime', 'yummyanime', 'cvh', 'aniboom'].includes(source)) {
    let urls = [];
    if (source === 'jutsu') {
      urls = generateJutSuUrls(title, episode);
    } else if (source === 'yammuanime') {
      urls = generateYammuanimeUrls(title, episode);
    } else if (source === 'yummyanime') {
      urls = generateYummyAnimeUrls(title, episode);
    } else if (source === 'cvh') {
      urls = generateCvhUrls(title, episode);
    } else if (source === 'aniboom') {
      urls = generateAniboomUrls(title, episode);
    }
    iframe.src = urls[0];
    const manualArea = $('#manualLinkArea');
    manualArea.style.display = 'flex';
    $('#manualLinkInput').value = urls[0];
    let btnContainer = manualArea.querySelector('.url-variants');
    if (!btnContainer) {
      btnContainer = document.createElement('div');
      btnContainer.className = 'url-variants';
      btnContainer.style.cssText = 'display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem; width:100%;';
      manualArea.appendChild(btnContainer);
    }
    btnContainer.innerHTML = '';
    urls.forEach(url => {
      const btn = document.createElement('button');
      btn.textContent = '📎 Вариант ' + (urls.indexOf(url) + 1);
      btn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.6rem; background:var(--bg-button);';
      btn.onclick = () => {
        iframe.src = url;
        $('#manualLinkInput').value = url;
      };
      btnContainer.appendChild(btn);
    });
    let googleBtn = manualArea.querySelector('.google-search-btn');
    if (!googleBtn) {
      googleBtn = document.createElement('button');
      googleBtn.className = 'google-search-btn';
      googleBtn.textContent = '🔍 Поиск в Google';
      googleBtn.style.cssText = 'background:#ea4335; color:white;';
      googleBtn.onclick = () => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(title + ' серия ' + episode + ' смотреть онлайн')}`, '_blank');
      };
      manualArea.appendChild(googleBtn);
    }
    return;
  }

  // source === 'auto' или 'youtube'
  let videoData = await searchVideoInvidious(query);
  if (!videoData) videoData = await searchVideoPiped(query);
  if (videoData) {
    const embedUrl = videoData.source === 'invidious'
      ? `https://yewtu.be/embed/${videoData.videoId}`
      : `https://www.youtube.com/embed/${videoData.videoId}`;
    iframe.src = embedUrl;
    return;
  }
  iframe.src = getYouTubeSearchUrl(query);
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
  const episodes = anime.episodes || 12;

  let html = `
    <div class="anime-detail">
      <div class="anime-detail-header">
        <img src="${img}" alt="${title}" />
        <div class="info">
          <h2>${title}</h2>
          <p>${description}</p>
          <div class="genres">${genres.map(g => `<span>${g}</span>`).join('')}</div>
          <p>⭐ ${anime.averageScore || '?'}% · ${anime.status || 'Неизвестно'} · ${episodes} серий</p>
          <button id="backToHome">← На главную</button>
        </div>
      </div>
      <div class="player-section">
        <h3>Выбор серии</h3>
        <div class="episode-list">
  `;
  for (let i = 1; i <= episodes; i++) {
    html += `<button class="${i === STATE.selectedEpisode ? 'active-ep' : ''}" data-ep="${i}">${i}</button>`;
  }
  html += `
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
        <div class="player-tabs">
          <button class="active-tab" data-source="auto">▶ YouTube</button>
          <button data-source="vk">📺 VK</button>
          <button data-source="anilibria">🎬 AniLibria</button>
          <button data-source="jutsu">🎬 Jut.su</button>
          <button data-source="yammuanime">🎬 Yammuanime</button>
          <button data-source="yummyanime">🎬 YummyAnime</button>
          <button data-source="cvh">🎬 CVH</button>
          <button data-source="aniboom">🎬 AniBoom</button>
          <button data-source="manual">🔗 Ссылка</button>
        </div>
        <div id="playerContent">
          <div class="video-container" id="videoContainer">
            <iframe id="playerIframe" src="" allowfullscreen></iframe>
          </div>
          <div class="manual-link-area" id="manualLinkArea" style="display:none;">
            <input type="text" id="manualLinkInput" placeholder="Вставьте ссылку на видео (iframe-совместимую)" />
            <button id="manualLinkBtn">Загрузить</button>
          </div>
        </div>
        <p style="margin-top:1rem; font-size:0.85rem; opacity:0.7;">
          💡 Для VK нужен сервисный ключ (настройки в профиле). 
          AniLibria автоматически подбирает качество и озвучку.
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

  const epButtons = container.querySelectorAll('.episode-list button');
  epButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = parseInt(btn.dataset.ep);
      STATE.selectedEpisode = ep;
      epButtons.forEach(b => b.classList.remove('active-ep'));
      btn.classList.add('active-ep');
      const activeSource = container.querySelector('.player-tabs .active-tab')?.dataset.source || 'auto';
      loadVideo(anime, ep, activeSource);
    });
  });

  const tabButtons = container.querySelectorAll('.player-tabs button');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active-tab'));
      btn.classList.add('active-tab');
      const source = btn.dataset.source;
      const manualArea = $('#manualLinkArea');
      const qualityMenu = document.getElementById('qualityMenu');
      const voiceMenu = document.getElementById('voiceMenu');
      if (source === 'manual') {
        manualArea.style.display = 'flex';
        const iframe = $('#playerIframe');
        if (iframe) iframe.src = '';
        const variants = manualArea.querySelector('.url-variants');
        if (variants) variants.remove();
        const googleBtn = manualArea.querySelector('.google-search-btn');
        if (googleBtn) googleBtn.remove();
        if (qualityMenu) qualityMenu.style.display = 'none';
        if (voiceMenu) voiceMenu.style.display = 'none';
      } else if (source === 'anilibria') {
        manualArea.style.display = 'none';
        // Показываем меню качества и озвучки (заполняются в loadVideo)
        if (qualityMenu) qualityMenu.style.display = 'inline-block';
        if (voiceMenu) voiceMenu.style.display = 'inline-block';
        loadVideo(anime, STATE.selectedEpisode, source);
      } else {
        manualArea.style.display = 'none';
        if (qualityMenu) qualityMenu.style.display = 'none';
        if (voiceMenu) voiceMenu.style.display = 'none';
        const variants = manualArea.querySelector('.url-variants');
        if (variants) variants.remove();
        const googleBtn = manualArea.querySelector('.google-search-btn');
        if (googleBtn) googleBtn.remove();
        loadVideo(anime, STATE.selectedEpisode, source);
      }
    });
  });

  $('#manualLinkBtn')?.addEventListener('click', () => {
    const link = $('#manualLinkInput').value.trim();
    if (!link) {
      alert('Введите ссылку');
      return;
    }
    const iframe = $('#playerIframe');
    if (iframe) iframe.src = link;
  });

  // Загружаем первую серию (авто – YouTube)
  loadVideo(anime, STATE.selectedEpisode, 'auto');
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
          <button id="vkSettingsBtn">⚙️ Настройки VK</button>
          <button id="anilibriaIdBtn">🎬 Настройки AniLibria</button>
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
  $('#vkSettingsBtn')?.addEventListener('click', () => openVKSettingsModal());
  $('#anilibriaIdBtn')?.addEventListener('click', () => openAnilibriaSettingsModal());

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
// Авторизация
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

// VK настройки
const vkSettingsModal = $('#vkSettingsModal');
const vkTokenInput = $('#vkTokenInput');
const vkTokenSaveBtn = $('#vkTokenSaveBtn');
const vkTokenStatus = $('#vkTokenStatus');

function openVKSettingsModal() {
  vkSettingsModal.style.display = 'flex';
  vkTokenInput.value = STATE.vkToken || '';
  vkTokenStatus.textContent = '';
}
function closeVKSettingsModal() { vkSettingsModal.style.display = 'none'; }

document.querySelector('.close-vk')?.addEventListener('click', closeVKSettingsModal);
window.addEventListener('click', (e) => { if (e.target === vkSettingsModal) closeVKSettingsModal(); });

vkTokenSaveBtn?.addEventListener('click', () => {
  const token = vkTokenInput.value.trim();
  if (!token) {
    vkTokenStatus.textContent = 'Ключ не может быть пустым';
    vkTokenStatus.style.color = '#ef4444';
    return;
  }
  STATE.vkToken = token;
  saveState();
  vkTokenStatus.textContent = '✅ Токен сохранён!';
  vkTokenStatus.style.color = '#10b981';
  setTimeout(() => closeVKSettingsModal(), 1500);
});

// AniLibria настройки (ручной ID)
const anilibriaSettingsModal = document.createElement('div');
anilibriaSettingsModal.id = 'anilibriaSettingsModal';
anilibriaSettingsModal.className = 'modal';
anilibriaSettingsModal.style.display = 'none';
anilibriaSettingsModal.innerHTML = `
  <div class="modal-content">
    <span class="close-anilibria">&times;</span>
    <h2>Настройки AniLibria</h2>
    <p style="font-size:0.9rem; opacity:0.8; margin-bottom:1rem;">
      Введите <strong>ID тайтла</strong> с сайта AniLibria (число).<br>
      <a href="https://anilibria.top/search" target="_blank">Найти ID на AniLibria</a>
    </p>
    <input type="number" id="anilibriaIdInput" placeholder="Например, 12345" style="width:100%; padding:0.8rem; border-radius:40px; border:1px solid #d1d9e6;" />
    <button id="anilibriaIdSaveBtn" style="margin-top:1rem; background:#3b82f6; color:white; width:100%;">Сохранить</button>
    <div id="anilibriaIdStatus" style="margin-top:0.5rem; font-size:0.9rem;"></div>
  </div>
`;
document.body.appendChild(anilibriaSettingsModal);

const anilibriaModal = document.getElementById('anilibriaSettingsModal');
const anilibriaIdInput = document.getElementById('anilibriaIdInput');
const anilibriaIdSaveBtn = document.getElementById('anilibriaIdSaveBtn');
const anilibriaIdStatus = document.getElementById('anilibriaIdStatus');

function openAnilibriaSettingsModal() {
  anilibriaModal.style.display = 'flex';
  anilibriaIdInput.value = STATE.anilibriaId || '';
  anilibriaIdStatus.textContent = '';
}
function closeAnilibriaSettingsModal() { anilibriaModal.style.display = 'none'; }

document.querySelector('.close-anilibria')?.addEventListener('click', closeAnilibriaSettingsModal);
window.addEventListener('click', (e) => { if (e.target === anilibriaModal) closeAnilibriaSettingsModal(); });

anilibriaIdSaveBtn?.addEventListener('click', () => {
  const id = parseInt(anilibriaIdInput.value.trim());
  if (isNaN(id) || id <= 0) {
    anilibriaIdStatus.textContent = 'Введите корректное число';
    anilibriaIdStatus.style.color = '#ef4444';
    return;
  }
  STATE.anilibriaId = id;
  saveState();
  anilibriaIdStatus.textContent = '✅ ID сохранён!';
  anilibriaIdStatus.style.color = '#10b981';
  setTimeout(() => closeAnilibriaSettingsModal(), 1500);
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
console.log('AniList App с актуальным AniLibria API и автоматическим переключением на YouTube');
