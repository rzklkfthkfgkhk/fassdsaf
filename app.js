// app.js
// -------------------- STATE --------------------
const state = {
    currentUser: null, // { username, password, favorites: [], watched: [], dropped: [], avatar: 'default.jpg' }
    users: [], // для простоты храним в localStorage
    animeList: [],
    currentView: 'home', // home | profile | player | auth
    selectedAnime: null,
    currentEpisode: 0,
    episodes: [],
    theme: 'dark',
};

// -------------------- DOM REFS --------------------
let app = document.getElementById('app');

// -------------------- UTILITY --------------------
function saveUsers() {
    localStorage.setItem('anime_users', JSON.stringify(state.users));
}

function loadUsers() {
    const data = localStorage.getItem('anime_users');
    if (data) {
        state.users = JSON.parse(data);
        // если есть активный пользователь в сессии
        const session = localStorage.getItem('anime_session');
        if (session) {
            const found = state.users.find(u => u.username === session);
            if (found) state.currentUser = found;
        }
    }
}

function saveSession() {
    if (state.currentUser) {
        localStorage.setItem('anime_session', state.currentUser.username);
    } else {
        localStorage.removeItem('anime_session');
    }
}

// -------------------- AUTH --------------------
function register(username, password) {
    if (state.users.find(u => u.username === username)) return false;
    const newUser = {
        username,
        password,
        favorites: [],
        watched: [],
        dropped: [],
        avatar: 'default.jpg'
    };
    state.users.push(newUser);
    saveUsers();
    return true;
}

function login(username, password) {
    const user = state.users.find(u => u.username === username && u.password === password);
    if (user) {
        state.currentUser = user;
        saveSession();
        return true;
    }
    return false;
}

function logout() {
    state.currentUser = null;
    localStorage.removeItem('anime_session');
    render();
}

// -------------------- AniList GraphQL --------------------
async function fetchAnimeList() {
    const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji }
          coverImage { large }
          episodes
          description
        }
      }
    }
    `;
    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        state.animeList = data.data.Page.media;
        render();
    } catch (e) {
        console.error('AniList error', e);
        // fallback
        state.animeList = [];
        render();
    }
}

// -------------------- PLAYER / EPISODES --------------------
function getEpisodes(animeId) {
    // Имитация поиска серий (по id аниме)
    const total = state.animeList.find(a => a.id == animeId)?.episodes || 12;
    return Array.from({ length: Math.min(total, 24) }, (_, i) => i + 1);
}

function getPlayerUrl(animeId, episode) {
    // Используем embed-плеер (пример: для теста используем аниме с id)
    // В реальном проекте нужен парсинг или API
    return `https://animeembed.cc/embed/?id=${animeId}&ep=${episode}`;
}

// -------------------- RENDER --------------------
function render() {
    if (!app) return;
    const view = state.currentView;

    // Проверка авторизации для profile
    if (view === 'profile' && !state.currentUser) {
        state.currentView = 'auth';
        return render();
    }

    let html = '';
    // Header
    html += renderHeader();

    // Body
    if (view === 'home') {
        html += renderHome();
    } else if (view === 'auth') {
        html += renderAuth();
    } else if (view === 'profile') {
        html += renderProfile();
    } else if (view === 'player') {
        html += renderPlayer();
    }

    app.innerHTML = html;
    attachEvents();
}

// -------------------- HEADER --------------------
function renderHeader() {
    const user = state.currentUser;
    const themeIcon = state.theme === 'dark' ? '🌙' : '☀️';
    return `
    <div class="header">
      <div class="logo" data-action="home">🎬 AnimeList</div>
      <div class="nav">
        <button data-action="home" class="${state.currentView === 'home' ? 'active-btn' : ''}">Главная</button>
        ${user ? `<button data-action="profile" class="${state.currentView === 'profile' ? 'active-btn' : ''}">Профиль</button>` : ''}
        ${user ? `<img src="https://ui-avatars.com/api/?name=${user.username}&background=ff6b6b&color=fff&size=36" class="avatar-small" data-action="profile" alt="avatar">` : ''}
        <button class="theme-toggle" data-action="theme">${themeIcon}</button>
        ${user ? `<button data-action="logout">Выйти</button>` : `<button data-action="auth">Вход</button>`}
      </div>
    </div>
    `;
}

// -------------------- HOME --------------------
function renderHome() {
    if (state.animeList.length === 0) {
        return `<div style="text-align:center;padding:40px;">Загрузка аниме...</div>`;
    }
    let cards = state.animeList.map(anime => {
        const isFav = state.currentUser?.favorites?.includes(anime.id) || false;
        const isWatched = state.currentUser?.watched?.includes(anime.id) || false;
        const isDropped = state.currentUser?.dropped?.includes(anime.id) || false;
        return `
        <div class="anime-card" data-id="${anime.id}">
          <img src="${anime.coverImage.large}" alt="${anime.title.romaji}" loading="lazy">
          <div class="info">
            <h3>${anime.title.romaji}</h3>
            <div class="actions">
              <button class="${isFav ? 'active-action' : ''}" data-action="fav" data-id="${anime.id}">❤️</button>
              <button class="${isWatched ? 'active-action' : ''}" data-action="watch" data-id="${anime.id}">✅</button>
              <button class="${isDropped ? 'active-action' : ''}" data-action="drop" data-id="${anime.id}">⛔</button>
              <button data-action="play" data-id="${anime.id}">▶️</button>
            </div>
          </div>
        </div>
        `;
    }).join('');
    return `<div class="anime-grid">${cards}</div>`;
}

// -------------------- AUTH --------------------
function renderAuth() {
    return `
    <div class="auth-container">
      <div class="auth-box" id="auth-box">
        <h2 id="auth-title">Вход</h2>
        <input type="text" id="auth-username" placeholder="Имя пользователя">
        <input type="password" id="auth-password" placeholder="Пароль">
        <button id="auth-submit">Войти</button>
        <div class="switch" id="auth-switch">Нет аккаунта? Зарегистрироваться</div>
      </div>
    </div>
    `;
}

// -------------------- PROFILE --------------------
function renderProfile() {
    const user = state.currentUser;
    if (!user) return '<div>Ошибка</div>';

    const favList = state.animeList.filter(a => user.favorites.includes(a.id));
    const watchList = state.animeList.filter(a => user.watched.includes(a.id));
    const dropList = state.animeList.filter(a => user.dropped.includes(a.id));

    const renderAnimeList = (list, title) => {
        if (list.length === 0) return `<p>Нет аниме</p>`;
        return list.map(a => `<div style="display:inline-block;margin:6px;background:var(--bg-card);padding:6px 14px;border-radius:30px;border:1px solid var(--border);">${a.title.romaji}</div>`).join('');
    };

    return `
    <div class="profile-header">
      <img src="https://ui-avatars.com/api/?name=${user.username}&background=ff6b6b&color=fff&size=120" class="profile-avatar" alt="avatar">
      <div class="profile-info">
        <h2>${user.username}</h2>
        <div class="profile-stats">
          <span>❤️ ${user.favorites.length}</span>
          <span>✅ ${user.watched.length}</span>
          <span>⛔ ${user.dropped.length}</span>
        </div>
        <div style="margin-top:8px;">
          <button data-action="change-avatar" style="background:transparent;border:1px solid var(--border);padding:4px 16px;border-radius:30px;color:var(--text);cursor:pointer;">Сменить аватар</button>
        </div>
      </div>
    </div>
    <div class="section-title">❤️ Избранное</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${renderAnimeList(favList)}</div>
    <div class="section-title">✅ Просмотренное</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${renderAnimeList(watchList)}</div>
    <div class="section-title">⛔ Брошено</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">${renderAnimeList(dropList)}</div>
    `;
}

// -------------------- PLAYER --------------------
function renderPlayer() {
    const anime = state.selectedAnime;
    if (!anime) return '<div>Аниме не выбрано</div>';
    const episodes = state.episodes.length ? state.episodes : getEpisodes(anime.id);
    state.episodes = episodes;

    const epButtons = episodes.map(ep => `
        <button class="episode-btn ${ep === state.currentEpisode ? 'active-ep' : ''}" data-ep="${ep}">${ep}</button>
    `).join('');

    const playerSrc = getPlayerUrl(anime.id, state.currentEpisode || 1);

    return `
    <div>
      <h2 style="margin-bottom:10px;">${anime.title.romaji}</h2>
      <div class="player-container">
        <div class="player-wrapper">
          <iframe src="${playerSrc}" allowfullscreen></iframe>
        </div>
        <div class="player-controls">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">${epButtons}</div>
          <select id="quality-select">
            <option value="auto">Авто</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="480">480p</option>
          </select>
          <button data-action="back-home" style="background:var(--accent);border:none;color:#fff;padding:6px 18px;border-radius:30px;cursor:pointer;">Назад</button>
        </div>
      </div>
    </div>
    `;
}

// -------------------- EVENTS --------------------
function attachEvents() {
    // Навигация
    document.querySelectorAll('[data-action="home"]').forEach(el => {
        el.addEventListener('click', () => { state.currentView = 'home'; render(); });
    });
    document.querySelectorAll('[data-action="auth"]').forEach(el => {
        el.addEventListener('click', () => { state.currentView = 'auth'; render(); });
    });
    document.querySelectorAll('[data-action="profile"]').forEach(el => {
        if (state.currentUser) { state.currentView = 'profile'; render(); }
    });
    document.querySelectorAll('[data-action="logout"]').forEach(el => {
        el.addEventListener('click', () => { logout(); });
    });
    document.querySelectorAll('[data-action="theme"]').forEach(el => {
        el.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            document.body.className = state.theme === 'dark' ? '' : 'light';
            render();
        });
    });
    document.querySelectorAll('[data-action="back-home"]').forEach(el => {
        el.addEventListener('click', () => { state.currentView = 'home'; render(); });
    });

    // Аниме карточки: действия
    document.querySelectorAll('.anime-card .actions button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);
            if (!state.currentUser) {
                alert('Войдите в аккаунт');
                return;
            }
            const user = state.currentUser;
            if (action === 'fav') {
                const idx = user.favorites.indexOf(id);
                if (idx > -1) user.favorites.splice(idx, 1);
                else user.favorites.push(id);
            } else if (action === 'watch') {
                const idx = user.watched.indexOf(id);
                if (idx > -1) user.watched.splice(idx, 1);
                else user.watched.push(id);
            } else if (action === 'drop') {
                const idx = user.dropped.indexOf(id);
                if (idx > -1) user.dropped.splice(idx, 1);
                else user.dropped.push(id);
            } else if (action === 'play') {
                const anime = state.animeList.find(a => a.id === id);
                if (anime) {
                    state.selectedAnime = anime;
                    state.currentEpisode = 1;
                    state.episodes = getEpisodes(id);
                    state.currentView = 'player';
                    render();
                }
                return;
            }
            saveUsers();
            render();
        });
    });

    // Нажатие на карточку (открыть плеер)
    document.querySelectorAll('.anime-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.actions')) return;
            const id = parseInt(card.dataset.id);
            const anime = state.animeList.find(a => a.id === id);
            if (anime) {
                state.selectedAnime = anime;
                state.currentEpisode = 1;
                state.episodes = getEpisodes(id);
                state.currentView = 'player';
                render();
            }
        });
    });

    // Эпизоды
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ep = parseInt(btn.dataset.ep);
            state.currentEpisode = ep;
            render();
        });
    });

    // Качество
    const qualitySelect = document.getElementById('quality-select');
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            // для демонстрации просто перезагружаем плеер с качеством (в реальном проекте меняем src)
            render();
        });
    }

    // Auth
    const authSubmit = document.getElementById('auth-submit');
    const authSwitch = document.getElementById('auth-switch');
    if (authSubmit) {
        let isLogin = true;
        authSubmit.textContent = 'Войти';
        if (authSwitch) {
            authSwitch.textContent = 'Нет аккаунта? Зарегистрироваться';
        }
        authSubmit.addEventListener('click', () => {
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            if (!username || !password) return alert('Заполните поля');
            if (isLogin) {
                if (login(username, password)) {
                    state.currentView = 'home';
                    render();
                } else {
                    alert('Неверные данные');
                }
            } else {
                if (register(username, password)) {
                    alert('Регистрация успешна! Войдите.');
                    isLogin = true;
                    authSubmit.textContent = 'Войти';
                    authSwitch.textContent = 'Нет аккаунта? Зарегистрироваться';
                } else {
                    alert('Пользователь уже существует');
                }
            }
        });
        if (authSwitch) {
            authSwitch.addEventListener('click', () => {
                isLogin = !isLogin;
                authSubmit.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
                authSwitch.textContent = isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
                document.getElementById('auth-title').textContent = isLogin ? 'Вход' : 'Регистрация';
            });
        }
    }

    // Смена аватара (демо)
    document.querySelectorAll('[data-action="change-avatar"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.currentUser) {
                const newName = prompt('Введите новое имя для аватара (будет отображаться на аватарке):', state.currentUser.username);
                if (newName) {
                    state.currentUser.username = newName;
                    saveUsers();
                    render();
                }
            }
        });
    });
}

// -------------------- INIT --------------------
function init() {
    loadUsers();
    // установка темы
    document.body.className = state.theme === 'dark' ? '' : 'light';
    fetchAnimeList();
}

init();
