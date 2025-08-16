function main() {
    // --- ESTADO DA APLICAÇÃO ---
    let currentUser = null;
    let spinsLeft = 3;
    const watchedMovies = new Map();
    let searchTimeout;
    let suggestionPool = [];
    let suggestionPoolIndex = 0;

    // --- ELEMENTOS DA UI ---
    const allElements = {
        googleLoginButton: document.getElementById('google-login-button'), guestLoginButton: document.getElementById('guest-login-button'),
        logoutButton: document.getElementById('logout-button'), userStatusDiv: document.getElementById('user-status'),
        userNameP: document.getElementById('user-name'), galleryButton: document.getElementById('gallery-button'),
        goToRouletteButton: document.getElementById('go-to-roulette-button'), spinButton: document.getElementById('spinButton'),
        resultContainer: document.getElementById('result'), genreSelectionContainer: document.getElementById('genre-selection'),
        movieSearchInput: document.getElementById('movie-search-input'), movieSearchResults: document.getElementById('movie-search-results'),
        selectedMoviesContainer: document.getElementById('selected-movies-container'), spinsLeftText: document.getElementById('spins-left-text'),
        backToPrefsButton: document.getElementById('back-to-prefs-button'), galleryGrid: document.getElementById('gallery-grid'),
        movieGridSuggestions: document.getElementById('movie-grid-suggestions')
    };

    // --- LÓGICA DE NAVEGAÇÃO E ESTADO ---
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) screenToShow.classList.add('active');
    }

    function resetSpins() {
        spinsLeft = 3;
        allElements.spinsLeftText.textContent = spinsLeft;
        document.getElementById('roulette-initial').style.display = 'flex';
        allElements.resultContainer.style.display = 'none';
    }

    // --- LÓGICA DE AUTENTICAÇÃO (SIMULADA) ---
    function updateUIForUser(user) {
        if (user) {
            currentUser = user;
            currentUser.preferences = { genres: [], favoriteMovies: [] };
            allElements.userStatusDiv.classList.remove('hidden');
            const displayName = user.displayName ? user.displayName.split(' ')[0] : 'Visitante';
            allElements.userNameP.textContent = `Olá, ${displayName}!`;
            resetSpins();
            watchedMovies.clear();
            loadMovieSuggestions();
            showScreen('preferencesScreen');
        } else {
            currentUser = null;
            allElements.userStatusDiv.classList.add('hidden');
            showScreen('welcomeScreen');
        }
    }

    // --- LÓGICA DE PREFERÊNCIAS E BUSCA INTERATIVA ---
    function savePreferences() {
        if (!currentUser) return;
        const selectedGenres = Array.from(allElements.genreSelectionContainer.querySelectorAll('.genre-checkbox:checked')).map(cb => cb.value);
        currentUser.preferences.genres = selectedGenres;
    }

    function addFavoriteMovie(movie, elementToReplace = null) {
        if (currentUser.preferences.favoriteMovies.length < 3 && !currentUser.preferences.favoriteMovies.some(m => m.id === movie.id)) {
            currentUser.preferences.favoriteMovies.push(movie);
            if (elementToReplace) {
                replaceSuggestionInGrid(elementToReplace);
            }
        }
    }

    function replaceSuggestionInGrid(elementToReplace) {
        const nextMovie = suggestionPool[suggestionPoolIndex];
        suggestionPoolIndex++;
        if (nextMovie) {
            const newElement = document.createElement('div');
            newElement.innerHTML = createMovieSuggestionHTML(nextMovie);
            elementToReplace.replaceWith(newElement.firstChild);
        } else {
            elementToReplace.style.display = 'none';
        }
    }

    // --- LÓGICA DA ROLETA (TMDb API) ---
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMG_URL = 'https://image.tmdb.org/t/p/w500';
    const LOGO_URL = 'https://image.tmdb.org/t/p/w92';

    async function fetchFromApi(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na comunicação com a API de filmes.');
        return response.json();
    }

    function createMovieSuggestionHTML(movie) {
        return `<div class="movie-suggestion transition-all duration-200 rounded-lg" data-movie-id="${movie.id}">
                    <img src="${IMG_URL}${movie.poster_path}" alt="${movie.title}" title="${movie.title}" data-movie='${JSON.stringify(movie)}' class="rounded-lg shadow-lg aspect-[2/3] object-cover w-full h-full cursor-pointer hover:scale-105">
                </div>`;
    }

    async function loadMovieSuggestions() {
        try {
            const data1 = await fetchFromApi(`${BASE_URL}/movie/top_rated?${API_KEY}&language=pt-BR&page=1`);
            const data2 = await fetchFromApi(`${BASE_URL}/movie/top_rated?${API_KEY}&language=pt-BR&page=2`);
            suggestionPool = [...data1.results, ...data2.results].filter(m => m.poster_path);
            suggestionPoolIndex = 12;
            allElements.movieGridSuggestions.innerHTML = suggestionPool.slice(0, 12).map(createMovieSuggestionHTML).join('');
        } catch (error) {
            console.error("Erro ao carregar sugestões de filmes:", error);
        }
    }

    async function getRecommendations(movieIds) {
        const promises = movieIds.map(id => fetchFromApi(`${BASE_URL}/movie/${id}/recommendations?${API_KEY}&language=pt-BR`));
        const results = await Promise.all(promises);
        return results.flatMap(data => data.results);
    }

    async function getWatchProviders(movieId) {
        const data = await fetchFromApi(`${BASE_URL}/movie/${movieId}/watch/providers?${API_KEY}`);
        return data.results.BR?.flatrate?.map(p => ({ logo_path: p.logo_path, provider_name: p.provider_name })) || [];
    }

    async function spinRoulette() {
        if (spinsLeft <= 0) return;
        spinsLeft--;

        document.getElementById('roulette-initial').style.display = 'none';
        document.getElementById('loading').style.display = 'flex';
        allElements.resultContainer.style.display = 'none';

        try {
            let candidateMovies = [];
            const { genres, favoriteMovies } = currentUser.preferences;

            if (genres.length > 0) {
                const data = await fetchFromApi(`${BASE_URL}/discover/movie?sort_by=popularity.desc&${API_KEY}&language=pt-BR&with_genres=${genres.join(',')}`);
                candidateMovies.push(...data.results);
            }
            if (favoriteMovies.length > 0) {
                const movieIds = favoriteMovies.map(m => m.id);
                const recommendations = await getRecommendations(movieIds);
                candidateMovies.push(...recommendations);
            }
            if (candidateMovies.length === 0) {
                const data = await fetchFromApi(`${BASE_URL}/movie/popular?${API_KEY}&language=pt-BR`);
                candidateMovies.push(...data.results);
            }

            const uniqueMovies = Array.from(new Map(candidateMovies.map(m => [m.id, m])).values());
            const validMovies = uniqueMovies.filter(m => m.overview && m.poster_path && !watchedMovies.has(m.id));

            if (validMovies.length === 0) throw new Error("Não foram encontrados mais filmes novos com esses critérios.");

            const movie = validMovies[Math.floor(Math.random() * validMovies.length)];
            const providers = await getWatchProviders(movie.id);
            renderResultCard(movie, providers);

        } catch (error) {
            allElements.resultContainer.innerHTML = `<div class="text-center"><p class="text-red-500 mb-4">${error.message}</p><button id="back-to-prefs" class="bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Voltar às Preferências</button></div>`;
            document.getElementById('back-to-prefs').addEventListener('click', () => showScreen('preferencesScreen'));
        } finally {
            document.getElementById('loading').style.display = 'none';
            allElements.resultContainer.style.display = 'flex';
        }
    }

    function renderResultCard(movie, providers) {
        let providersHtml = providers.length > 0 ? `<div class="mt-4"><p class="text-sm font-semibold mb-2">Onde Assistir:</p><div class="flex justify-center flex-wrap gap-3">${providers.map(p => `<img src="${LOGO_URL}${p.logo_path}" alt="${p.provider_name}" class="w-10 h-10 rounded-lg" title="${p.provider_name}">`).join('')}</div></div>` : '<p class="text-sm text-gray-400 mt-4">Não disponível em streaming no Brasil.</p>';
        allElements.resultContainer.innerHTML = `<div class="bg-gray-800 rounded-2xl shadow-lg w-full max-w-sm overflow-hidden card-enter"><img src="${IMG_URL}${movie.poster_path}" alt="Póster de ${movie.title}" class="w-full h-auto object-cover"><div class="p-5 text-center"><h3 class="text-2xl font-bold mb-2">${movie.title}</h3><p class="text-gray-300 text-sm mb-4 max-h-32 overflow-y-auto custom-scrollbar">${movie.overview}</p>${providersHtml}</div></div><div class="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-6"><button id="watched-button" data-movie-id="${movie.id}" class="bg-gray-700 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-full transition-colors w-full sm:w-auto">Já Assisti</button>${spinsLeft > 0 ? `<button id="spin-again-button" class="bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold py-3 px-6 rounded-full w-full sm:w-auto">Girar (${spinsLeft})</button>` : ''}</div>${spinsLeft === 0 ? `<p class="mt-6 bg-green-800 text-white font-bold py-3 px-8 rounded-full">Esta é a sua escolha! Bom filme!</p>` : ''}`;
        if (spinsLeft > 0) document.getElementById('spin-again-button').addEventListener('click', spinRoulette);
        document.getElementById('watched-button').addEventListener('click', (e) => {
            const movieId = parseInt(e.currentTarget.dataset.movieId);
            if (!watchedMovies.has(movieId)) watchedMovies.set(movieId, movie);
            spinRoulette();
        });
    }

    // --- ATIVAÇÃO DOS EVENT LISTENERS ---
    allElements.googleLoginButton.addEventListener('click', () => updateUIForUser({ displayName: 'Alex', isAnonymous: false }));
    allElements.guestLoginButton.addEventListener('click', () => updateUIForUser({ displayName: 'Visitante', isAnonymous: true }));
    allElements.logoutButton.addEventListener('click', () => updateUIForUser(null));
    allElements.goToRouletteButton.addEventListener('click', () => { savePreferences(); resetSpins(); showScreen('rouletteScreen'); });
    allElements.spinButton.addEventListener('click', spinRoulette);
    allElements.galleryButton.addEventListener('click', () => {
        allElements.galleryGrid.innerHTML = Array.from(watchedMovies.values()).map(movie => `<img src="${IMG_URL}${movie.poster_path}" alt="${movie.title}" class="rounded-lg shadow-lg aspect-[2/3] object-cover" title="${movie.title}">`).join('') || '<p class="col-span-full text-center text-gray-400">Você ainda não marcou nenhum filme como assistido.</p>';
        showScreen('galleryScreen');
    });
    allElements.backToPrefsButton.addEventListener('click', () => showScreen('preferencesScreen'));
    allElements.movieSearchInput.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;
        if (query.length < 3) { allElements.movieSearchResults.innerHTML = ''; return; }
        searchTimeout = setTimeout(async () => {
            const data = await fetchFromApi(`${BASE_URL}/search/movie?${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`);
            allElements.movieSearchResults.innerHTML = data.results.slice(0, 5).map(movie => `<div class="p-2 flex items-center gap-3 hover:bg-gray-700 cursor-pointer search-result-item" data-movie='${JSON.stringify(movie)}'><img src="${IMG_URL}${movie.poster_path}" class="w-10 h-14 object-cover rounded"><p>${movie.title} (${new Date(movie.release_date).getFullYear()})</p></div>`).join('');
        }, 300);
    });
    allElements.movieSearchResults.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item) { addFavoriteMovie(JSON.parse(item.dataset.movie)); allElements.movieSearchInput.value = ''; allElements.movieSearchResults.innerHTML = ''; }
    });
    allElements.movieGridSuggestions.addEventListener('click', (e) => {
        const suggestionDiv = e.target.closest('.movie-suggestion');
        if (suggestionDiv) {
            addFavoriteMovie(JSON.parse(suggestionDiv.querySelector('img').dataset.movie), suggestionDiv);
        }
    });
}
document.addEventListener('DOMContentLoaded', main);
