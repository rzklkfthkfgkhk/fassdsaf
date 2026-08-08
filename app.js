// ============================================================
//  STATE
// ============================================================
const state = {
    currentUser: null,
    users: [],
    animeList: [],
    currentView: 'home',
    selectedAnime: null,
    currentEpisode: 1,
    episodes: [],
    theme: 'dark',
    authMode: 'login',
    authError: '',
    loading: true,
};

// ============================================================
//  STORAGE
// ============================================================
function saveUsers() {
    localStorage.setItem('anime_users', JSON.stringify(state.users));
}

function loadUsers() {
    const data = localStorage.getItem('anime_users');
    if (data) {
        state.users = JSON.parse(data);
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

// ============================================================
//  AUTH
// ============================================================
function register(username, password) {
    if (state.users.find(u => u.username === username)) return false;
    state.users.push({
        username,
        password,
        favorites: [],
        watched: [],
        dropped: [],
        createdAt: new Date().toISOString(),
    });
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
    state.currentView = 'home';
    render();
}

// ============================================================
//  ANILIST API
// ============================================================
async function fetchAnime() {
    state.loading = true;
    const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji }
          coverImage { large }
          episodes
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
    } catch (e) {
        console.error('AniList error:', e);
        state.animeList = [];
    }
    state.loading = false;
    render();
}

// ============================================================
//  PLAYER HELPERS
// ============================================================
function getEpisodes(animeId) {
    const anime = state.animeList.find(a => a.id === animeId);
    const total = anime?.episodes || 12;
    return Array.from({ length: Math.min(total, 30) }, (_, i) => i + 1);
}

function getPlayerUrl(animeId, episode) {
    return `https://animeembed.cc/embed/?id=${animeId}&ep=${episode}`;
}

// ============================================================
//  RENDER
// ============================================================
const app = document.getElementById('app');

function render() {
    if (!app) return;

    if (state.currentView === 'profile' && !state.currentUser) {
        state.currentView = 'auth';
    }

    let html = renderHeader();

    if (state.currentView === 'home') html += renderHome();
    else if (state.currentView === 'auth') html += renderAuth();
    else if (state.currentView === 'profile') html += renderProfile();
    else if (state.currentView === 'player') html += renderPlayer();

    app.innerHTML = html;
    attachEvents();
}

// ---------- HEADER ----------
function renderHeader() {
    const user = state.currentUser;
    const themeIcon = state.theme === 'dark' ? '🌙' : '☀️';

    let nav = `
        <button class="nav-btn ${state.currentView === 'home' ? 'active' : ''}" data-action="home">🏠 Главная</button>
    `;

    if (user) {
        nav += `
            <button class="nav-btn ${state.currentView === 'profile' ? 'active' : ''}" data-action="profile">👤 Профиль</button>
            <div class="user-badge">
                <img class="user-avatar-small" src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=ff6b6b&color=fff&size=34" alt="avatar" data-action="profile">
                <span class="user-name">${user.username}</span>
            </div>
            <button class="nav-btn" data-action="logout">🚪 Выйти</button>
        `;
    } else {
        nav += `
            <button class="nav-btn ${state.currentView === 'auth' ? 'active' : ''}" data-action="auth">🔑 Войти</button>
        `;
    }

    nav += `<button class="theme-btn" data-action="theme">${themeIcon}</button>`;

    return `
    <header class="header">
        <div class="logo" data-action="home">🎬 Anime<span>List</span></div>
        <nav class="nav">${nav}</nav>
    </header>
    `;
}

// ---------- HOME ----------
function renderHome() {
    if (state.loading) {
        return '<div class="loader">Загрузка аниме</div>';
    }

    if (state.animeList.length === 0) {
        return '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">Не удалось загрузить аниме. Проверьте подключение к интернету.</div>';
    }

    const cards = state.animeList.map(anime => {
        const isFav = state.currentUser?.favorites?.includes(anime.id) || false;
        const isWatched = state.currentUser?.watched?.includes(anime.id) || false;
        const isDropped = state.currentUser?.dropped?.includes(anime.id) || false;

        return `
        <div class="anime-card" data-id="${anime.id}">
            <div class="image-wrap">
                <img src="${anime.coverImage.large}" alt="${anime.title.romaji}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a2e/8888b0?text=No+Image'">
                <span class="ep-badge">${anime.episodes || '?'} серий</span>
            </div>
            <div class="card-body">
                <h3 title="${anime.title.romaji}">${anime.title.romaji}</h3>
                <div class="ep-info">${anime.episodes || 'Неизвестно'} эп.</div>
                <div class="card-actions">
                    <button class="${isFav ? 'active' : ''}" data-action="fav" data-id="${anime.id}" title="Избранное">❤️</button>
                    <button class="${isWatched ? 'active' : ''}" data-action="watch" data-id="${anime.id}" title="Просмотрено">✅</button>
                    <button class="${isDropped ? 'active' : ''}" data-action="drop" data-id="${anime.id}" title="Брошено">⛔</button>
                    <button class="play-btn" data-action="play" data-id="${anime.id}" title="Смотреть">▶️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    return `
    <div class="page-header">
        <h1>🔥 Популярное аниме</h1>
        <p>Отмечай просмотренное, добавляй в избранное и смотри онлайн</p>
    </div>
    <div class="anime-grid">${cards}</div>
    `;
}

// ---------- AUTH ----------
function renderAuth() {
    const isLogin = state.authMode === 'login';
    const title = isLogin ? 'Добро пожаловать!' : 'Создай аккаунт';
    const subtitle = isLogin ? 'Войдите, чтобы сохранять прогресс' : 'Присоединяйся к сообществу аниме';
    const btnText = isLogin ? 'Войти' : 'Зарегистрироваться';
    const switchText = isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти';

    const extraField = !isLogin ? `
        <div class="form-group">
            <label>Подтвердите пароль</label>
            <input type="password" id="auth-password2" placeholder="Повторите пароль" autocomplete="new-password">
        </div>
    ` : '';

    return `
    <div class="auth-page">
        <div class="auth-card">
            <h2>${title}</h2>
            <p class="subtitle">${subtitle}</p>

            <div class="form-group">
                <label>👤 Имя пользователя</label>
                <input type="text" id="auth-username" placeholder="Введите имя" autocomplete="username" value="">
            </div>

            <div class="form-group">
                <label>🔒 Пароль</label>
                <input type="password" id="auth-password" placeholder="Введите пароль" autocomplete="current-password">
            </div>

            ${extraField}

            <button class="auth-btn" id="auth-submit">${btnText}</button>
            <div class="auth-error" id="auth-error">${state.authError}</div>

            <div class="auth-divider">или</div>

            <button class="auth-switch" id="auth-switch">${switchText}</button>
        </div>
    </div>
    `;
}

// ---------- PROFILE ----------
function renderProfile() {
    const user = state.currentUser;
    if (!user) return '<div style="padding:60px;text-align:center;color:var(--text-secondary);">Ошибка доступа</div>';

    const favList = state.animeList.filter(a => user.favorites.includes(a.id));
    const watchList = state.animeList.filter(a => user.watched.includes(a.id));
    const dropList = state.animeList.filter(a => user.dropped.includes(a.id));

    const renderTags = (list, emptyText = 'Список пуст') => {
        if (list.length === 0) return `<span class="empty-list">${emptyText}</span>`;
        return list.map(a => `<span class="list-tag">${a.title.romaji}</span>`).join('');
    };

    return `
    <div class="profile-section">
        <div class="profile-avatar-wrap">
            <img class="profile-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=ff6b6b&color=fff&size=130" alt="avatar">
        </div>
        <div class="profile-info">
            <h2>${user.username}</h2>
            <div class="handle">@${user.username}</div>
            <div class="profile-stats">
                <div class="stat">
                    <span class="num">${user.favorites.length}</span>
                    <span class="label">❤️ Избранное</span>
                </div>
                <div class="stat">
                    <span class="num">${user.watched.length}</span>
                    <span class="label">✅ Просмотрено</span>
                </div>
                <div class="stat">
                    <span class="num">${user.dropped.length}</span>
                    <span class="label">⛔ Брошено</span>
                </div>
            </div>
            <div class="profile-actions-row">
                <button data-action="change-avatar">🖼️ Сменить аватар</button>
                <button data-action="home">🏠 На главную</button>
            </div>
        </div>
    </div>

    <div class="list-section">
        <h3>❤️ Избранное</h3>
        <div class="list-tags">${renderTags(favList)}</div>
    </div>

    <div class="list-section">
        <h3>✅ Просмотренное</h3>
        <div class="list-tags">${renderTags(watchList)}</div>
    </div>

    <div class="list-section">
        <h3>⛔ Брошено</h3>
        <div class="list-tags">${renderTags(dropList)}</div>
    </div>
    `;
}

// ---------- PLAYER ----------
function renderPlayer() {
    const anime = state.selectedAnime;
    if (!anime) return '<div style="padding:60px;text-align:center;color:var(--text-secondary);">Аниме не выбрано</div>';

    const episodes = state.episodes.length ? state.episodes : getEpisodes(anime.id);
    state.episodes = episodes;

    const epButtons = episodes.map(ep =>
        `<button class="episode-btn ${ep === state.currentEpisode ? 'active' : ''}" data-ep="${ep}">${ep}</button>`
    ).join('');

    const playerSrc = getPlayerUrl(anime.id, state.currentEpisode || 1);

    return `
    <div class="player-section">
        <div class="anime-title">${anime.title.romaji}</div>
        <div class="ep-info-text">Серия ${state.currentEpisode} из ${episodes.length}</div>

        <div class="player-wrap">
            <iframe src="${playerSrc}" allowfullscreen></iframe>
        </div>

        <div class="episode-list">${epButtons}</div>

        <div class="player-controls">
            <select id="quality-select">
                <option value="auto">📺 Авто</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="480">480p</option>
            </select>
            <button class="back-btn" data-action="back-home">← На главную</button>
        </div>
    </div>
    `;
}

// ============================================================
//  EVENTS
// ============================================================
function attachEvents() {
    // ----- Navigation -----
    document.querySelectorAll('[data-action="home"]').forEach(el => {
        el.addEventListener('click', () => {
            state.currentView = 'home';
            render();
        });
    });

    document.querySelectorAll('[data-action="auth"]').forEach(el => {
        el.addEventListener('click', () => {
            state.currentView = 'auth';
            state.authMode = 'login';
            state.authError = '';
            render();
        });
    });

    document.querySelectorAll('[data-action="profile"]').forEach(el => {
        el.addEventListener('click', () => {
            if (state.currentUser) {
                state.currentView = 'profile';
                render();
            }
        });
    });

    document.querySelectorAll('[data-action="logout"]').forEach(el => {
        el.addEventListener('click', logout);
    });

    document.querySelectorAll('[data-action="back-home"]').forEach(el => {
        el.addEventListener('click', () => {
            state.currentView = 'home';
            render();
        });
    });

    // ----- Theme -----
    document.querySelectorAll('[data-action="theme"]').forEach(el => {
        el.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            document.body.className = state.theme === 'dark' ? '' : 'light';
            render();
        });
    });

    // ----- Card actions -----
    document.querySelectorAll('.card-actions button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);

            if (!state.currentUser) {
                state.authError = 'Войдите в аккаунт, чтобы сохранять прогресс';
                state.currentView = 'auth';
                state.authMode = 'login';
                render();
                return;
            }

            const user = state.currentUser;

            if (action === 'fav') {
                const idx = user.favorites.indexOf(id);
                idx > -1 ? user.favorites.splice(idx, 1) : user.favorites.push(id);
            } else if (action === 'watch') {
                const idx = user.watched.indexOf(id);
                idx > -1 ? user.watched.splice(idx, 1) : user.watched.push(id);
            } else if (action === 'drop') {
                const idx = user.dropped.indexOf(id);
                idx > -1 ? user.dropped.splice(idx, 1) : user.dropped.push(id);
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

    // ----- Click on card (open player) -----
    document.querySelectorAll('.anime-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-actions')) return;
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

    // ----- Episodes -----
    document.querySelectorAll('.episode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ep = parseInt(btn.dataset.ep);
            state.currentEpisode = ep;
            render();
        });
    });

    // ----- Quality (demo) -----
    const qualitySelect = document.getElementById('quality-select');
    if (qualitySelect) {
        qualitySelect.addEventListener('change', (e) => {
            // В реальном проекте меняем src плеера
            console.log('Качество изменено на:', e.target.value);
            // Для демо просто показываем уведомление
            const msg = document.createElement('div');
            msg.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: var(--bg-card); padding: 12px 24px; border-radius: 30px;
                border: 1px solid var(--accent); color: var(--text-primary);
                font-weight: 600; z-index: 1000; animation: fadeIn 0.3s ease;
            `;
            msg.textContent = `📺 Качество изменено на ${e.target.value}`;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);
        });
    }

    // ----- Auth -----
    const authSubmit = document.getElementById('auth-submit');
    const authSwitch = document.getElementById('auth-switch');

    if (authSubmit) {
        authSubmit.addEventListener('click', handleAuth);
    }

    if (authSwitch) {
        authSwitch.addEventListener('click', () => {
            state.authMode = state.authMode === 'login' ? 'register' : 'login';
            state.authError = '';
            render();
        });
    }

    // Enter key for auth
    document.querySelectorAll('#auth-username, #auth-password, #auth-password2').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const submit = document.getElementById('auth-submit');
                if (submit) submit.click();
            }
        });
    });

    // ----- Change avatar -----
    document.querySelectorAll('[data-action="change-avatar"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.currentUser) {
                const newName = prompt('Введите новое имя (отобразится на аватарке):', state.currentUser.username);
                if (newName && newName.trim()) {
                    const oldName = state.currentUser.username;
                    const user = state.users.find(u => u.username === oldName);
                    if (user) {
                        user.username = newName.trim();
                        state.currentUser = user;
                        saveUsers();
                        saveSession();
                        render();
                    }
                }
            }
        });
    });
}

// ----- Auth handler -----
function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const isLogin = state.authMode === 'login';

    if (!username || !password) {
        state.authError = 'Заполните все поля';
        render();
        return;
    }

    if (username.length < 3) {
        state.authError = 'Имя должно содержать минимум 3 символа';
        render();
        return;
    }

    if (isLogin) {
        if (login(username, password)) {
            state.authError = '';
            state.currentView = 'home';
            render();
        } else {
            state.authError = '❌ Неверное имя или пароль';
            render();
        }
    } else {
        const password2 = document.getElementById('auth-password2').value.trim();
        if (password !== password2) {
            state.authError = '❌ Пароли не совпадают';
            render();
            return;
        }
        if (password.length < 4) {
            state.authError = '❌ Пароль должен быть минимум 4 символа';
            render();
            return;
        }
        if (register(username, password)) {
            state.authError = '✅ Регистрация успешна! Теперь войдите.';
            state.authMode = 'login';
            render();
        } else {
            state.authError = '❌ Пользователь с таким именем уже существует';
            render();
        }
    }
}

// ============================================================
//  INIT
// ============================================================
function init() {
    loadUsers();
    document.body.className = state.theme === 'dark' ? '' : 'light';
    fetchAnime();
}

// Start the app
init();
