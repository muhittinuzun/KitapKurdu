/**
 * Kitap Ligi - Core Application Logic
 */

const API_URL = 'https://n8n.ittyazilim.com/webhook/kitap-ligi-api';

const AppState = {
    user: null, // { id, role, name, level, points, theme_preference ... }
    theme: 'child', // 'child' | 'academic'
    currentView: 'login', // 'login', 'register', 'student_dashboard', 'authority_dashboard'
    data: {
        books: [],
        leaderboard: [],
        groups: [],
        bookProgressMap: {},
        recentReadLogs: [],
        pendingIsbnBook: null,
        lastReadAction: null,
        activeBook: {
            edition_id: null,
            title: '',
            author: '',
            page_count: 0,
            current_page: 0
        }
    }
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log("Kitap Ligi Initialization Started...");

    // Initialize icons
    lucide.createIcons();

    // Load state from localStorage
    loadState();

    // Setup event listeners
    setupEventListeners();

    // Check auth and route
    await checkAuth();

    // Apply theme
    applyTheme(AppState.theme);

    // Hide global loader and show container
    document.getElementById('global-loader').classList.add('hidden');
    document.getElementById('view-container').classList.remove('hidden');
}

// --- State Management ---

function loadState() {
    const savedUser = localStorage.getItem('kl_user');
    if (savedUser) {
        try {
            AppState.user = JSON.parse(savedUser);
            AppState.user.role = normalizeRole(AppState.user.role);
            AppState.theme = AppState.user.role === 'student' ? 'child' : 'academic';
        } catch (e) {
            console.error("Failed to parse user state", e);
            localStorage.removeItem('kl_user');
        }
    }

    const savedTheme = localStorage.getItem('kl_theme');
    if (savedTheme) {
        AppState.theme = savedTheme;
    }
}

function saveState() {
    if (AppState.user) {
        localStorage.setItem('kl_user', JSON.stringify(AppState.user));
    } else {
        localStorage.removeItem('kl_user');
    }
    localStorage.setItem('kl_theme', AppState.theme);
}

// --- API Client ---

/**
 * Generic API Caller ensuring the format matches n8n requirements
 * fetch(url, { method: 'POST', body: JSON.stringify({ action, resource, data, user_id }) })
 */
async function apiCall(request, legacyParams = {}) {
    let action = 'unknown';
    try {
        // Backward compatible parser: apiCall('login', {...}) or apiCall({ action, resource, data })
        let resource = null;
        let data = {};

        if (typeof request === 'string') {
            action = request;
            resource = legacyParams.resource || null;
            data = { ...legacyParams };
            delete data.resource;
        } else {
            action = request.action;
            resource = request.resource || null;
            data = request.data ? { ...request.data } : {};
        }

        const payload = { action, resource, data };
        if (action === 'fetch_book_by_isbn' && data.isbn) {
            payload.isbn = data.isbn;
        }

        // Inject user_id if authenticated, crucial for backend contextualization
        if (AppState.user && AppState.user.id) {
            payload.user_id = AppState.user.id;
        }

        console.log(`[API Request] Action: ${action}`, payload);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const rawBody = await response.text();
        if (!rawBody || !rawBody.trim()) {
            // n8n can respond 200 with empty body when SELECT returns zero rows.
            // For read-like requests this should be treated as an empty dataset, not an error.
            if (action === 'read' || action === 'leaderboard_group' || action === 'authority_students') {
                const emptyResponse = { status: 'success', resource, data: [] };
                console.log(`[API Response] Action: ${action}`, emptyResponse);
                return emptyResponse;
            }
            throw new Error(`Boş yanıt alındı (status: ${response.status}, action: ${action})`);
        }

        let responseData;
        try {
            responseData = JSON.parse(rawBody);
        } catch (parseError) {
            const preview = rawBody.slice(0, 240);
            throw new Error(`Geçersiz JSON yanıtı (action: ${action}): ${preview}`);
        }
        console.log(`[API Response] Action: ${action}`, responseData);

        return responseData;
    } catch (error) {
        console.error(`[API Error] Action: ${action}`, error);
        showToast('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
        throw error;
    }
}

function normalizeRole(role) {
    if (!role) return 'student';
    const normalized = String(role).trim().toLowerCase();

    if (normalized === 'student' || normalized === 'ogrenci') return 'student';
    if (normalized === 'teacher' || normalized === 'ogretmen') return 'teacher';
    if (normalized === 'admin' || normalized === 'administrator' || normalized === 'yonetici') return 'admin';

    return normalized;
}

// --- Routing & Views ---

async function checkAuth() {
    if (AppState.user) {
        // Token validation could happen here via an API call
        if (AppState.user.role === 'student') {
            await navigate('student_dashboard');
        } else {
            await navigate('authority_dashboard');
        }
    } else {
        await navigate('login');
    }
}

async function navigate(viewName, params = {}) {
    AppState.currentView = viewName;
    const viewContainer = document.getElementById('view-container');

    // Add slide out animation to current view
    viewContainer.style.opacity = '0';

    setTimeout(async () => {
        // Render new view
        viewContainer.innerHTML = '';

        switch (viewName) {
            case 'login':
                renderLoginView(viewContainer);
                updateNavigationUI('hidden');
                break;
            case 'register':
                renderRegisterView(viewContainer);
                updateNavigationUI('hidden');
                break;
            case 'student_dashboard':
                await renderStudentDashboard(viewContainer);
                updateNavigationUI('student');
                break;
            case 'leaderboard':
                await renderLeaderboardView(viewContainer);
                updateNavigationUI('student');
                break;
            case 'my_books':
                await renderMyBooksView(viewContainer);
                updateNavigationUI('student');
                break;
            case 'library':
                await renderLibraryView(viewContainer);
                updateNavigationUI('student');
                break;
            case 'badges':
                await renderBadgesView(viewContainer);
                updateNavigationUI('student');
                break;
            case 'authority_dashboard':
                await renderAuthorityDashboard(viewContainer);
                updateNavigationUI('authority');
                break;
            case 'authority_reports':
                await renderAuthorityReportsView(viewContainer);
                updateNavigationUI('authority');
                break;
            case 'authority_students':
                await renderAuthorityStudentsView(viewContainer);
                updateNavigationUI('authority');
                break;
            case 'authority_settings':
                await renderAuthoritySettingsView(viewContainer);
                updateNavigationUI('authority');
                break;
            default:
                renderLoginView(viewContainer);
                updateNavigationUI('hidden');
        }

        // Setup Lucide icons for new content
        lucide.createIcons();

        // Slide in new view
        viewContainer.style.opacity = '1';
        viewContainer.classList.add('animate-fade-in');

    }, 200);
}

// --- View Renderers ---

function renderLoginView(container) {
    document.getElementById('page-title').textContent = "Giriş Yap";

    container.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden glass mt-10">
            <div class="px-8 pt-10 pb-8 bg-gradient-to-b from-child-primary/10 to-transparent">
                <div class="flex justify-center mb-6">
                    <div class="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-child-primary/20">
                        <i data-lucide="book-open" class="h-10 w-10 text-child-primary"></i>
                    </div>
                </div>
                <h2 class="text-3xl font-display font-bold text-center text-gray-800 mb-2">Kitap Ligi</h2>
                <p class="text-center text-gray-500 mb-8 font-medium">Okudukça kazan, kazandıkça oku!</p>
                
                <form id="login-form" class="space-y-5">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i data-lucide="mail" class="h-5 w-5 text-gray-400"></i>
                            </div>
                            <input type="email" id="login-email" required class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-child-primary focus:border-child-primary transition-all shadow-sm bg-gray-50" placeholder="ornek@okul.edu.tr">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i data-lucide="lock" class="h-5 w-5 text-gray-400"></i>
                            </div>
                            <input type="password" id="login-password" required class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-child-primary focus:border-child-primary transition-all shadow-sm bg-gray-50" placeholder="••••••••">
                        </div>
                    </div>
                    
                    <button type="submit" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-child-primary hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-child-primary transition-colors mt-6">
                        Giriş Yap
                    </button>

                    <div class="text-right -mt-2">
                        <a href="#" id="forgot-password-link" class="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Şifremi unuttum</a>
                    </div>
                    
                    <div class="mt-6 text-center text-sm text-gray-600">
                        Hesabın yok mu? <a href="#" onclick="navigate('register')" class="font-bold text-child-secondary hover:text-indigo-600 transition-colors">Hemen Kayıt Ol</a>
                    </div>
                </form>
            </div>
        </div>
    `;

    const rememberedEmail = localStorage.getItem('kl_login_hint_email');
    if (rememberedEmail) {
        const emailInput = document.getElementById('login-email');
        if (emailInput) {
            emailInput.value = rememberedEmail;
        }
    }

    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Şifre sıfırlama için okul yöneticinizden destek alabilirsiniz.', 'info');
        });
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        showToast('Giriş yapılıyor...', 'info');
        try {
            const res = await apiCall({
                action: 'login',
                resource: 'k_t_users',
                data: { email, password }
            });

            const users = normalizeApiDataArray(res);
            if (users.length > 0) {
                const user = users[0];
                if (user.auth_status === 'wrong_password') {
                    showToast('Şifren yanlış görünüyor. Lütfen tekrar dene veya Şifremi Unuttum adımını kullan.', 'error');
                    return;
                }
                if (user.auth_status === 'not_found') {
                    showToast('Bu e-posta ile hesap bulunamadı. İstersen yeni kayıt oluşturabilirsin.', 'error');
                    return;
                }
                localStorage.removeItem('kl_login_hint_email');

                // Assuming database structure from DATABASE_SCHEMA.md
                AppState.user = {
                    id: user.id,
                    role: normalizeRole(user.role),
                    full_name: user.full_name,
                    email: user.email,
                    group_id: user.group_id
                };

                AppState.theme = AppState.user.role === 'student' ? 'child' : 'academic';
                saveState();
                applyTheme(AppState.theme);

                showToast('Başarıyla giriş yapıldı!', 'success');

                if (AppState.user.role === 'student') {
                    await navigate('student_dashboard');
                } else {
                    await navigate('authority_dashboard');
                }
            } else {
                showToast('E-posta veya şifre yanlış.', 'error');
            }

        } catch (err) {
            console.error('Login error:', err);
            // showToast is already called inside apiCall on catch
        }
    });
}

function renderRegisterView(container) {
    document.getElementById('page-title').textContent = "Kayıt Ol";
    container.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden glass mt-10">
            <div class="p-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-display font-bold text-gray-800">Yeni Hesap</h2>
                    <button onclick="navigate('login')" class="text-sm font-medium text-gray-500 hover:text-gray-800 flex items-center">
                        <i data-lucide="arrow-left" class="w-4 h-4 mr-1"></i> Geri
                    </button>
                </div>
                
                <!-- Registration Tabs -->
                <div class="flex bg-gray-100 rounded-lg p-1 mb-6">
                    <button id="tab-joincode" class="flex-1 py-2 px-4 text-sm font-bold text-indigo-700 bg-white shadow rounded-md transition-all">Sınıf Kodu ile</button>
                    <button id="tab-manual" class="flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 transition-all">Manuel Seçim</button>
                </div>

                <!-- Form: Join Code -->
                <form id="form-joincode" class="space-y-4 transition-all">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Öğretmeninin verdiği katılım kodu</label>
                        <input type="text" id="reg-join-code" required class="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-child-primary text-center font-mono text-xl uppercase tracking-wider bg-gray-50" placeholder="ÖRN: ABX89K">
                    </div>
                    <button type="button" onclick="resolveJoinCode()" class="w-full py-3 px-4 border border-transparent rounded-xl shadow-md text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        Kodu Doğrula
                    </button>
                    <div id="join-code-result" class="hidden mt-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">
                    </div>
                </form>

                <!-- Form: Manual Select (Hidden Initially) -->
                <form id="form-manual" class="space-y-4 hidden transition-all">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">İl</label>
                            <select id="reg-city" class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-child-primary bg-gray-50">
                                <option value="">Seçiniz</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">İlçe</label>
                            <select id="reg-district" disabled class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-child-primary bg-gray-50 opacity-50">
                                <option value="">Önce İl Seçin</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Okul</label>
                        <select id="reg-school" disabled class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-child-primary bg-gray-50 opacity-50">
                            <option value="">Önce İlçe Seçin</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Sınıf</label>
                            <select id="reg-grade" disabled class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-child-primary bg-gray-50 opacity-50">
                                <option value="">Seçiniz</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Şube</label>
                            <select id="reg-branch" disabled class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-child-primary bg-gray-50 opacity-50">
                                <option value="">Seçiniz</option>
                            </select>
                        </div>
                    </div>
                </form>

                <hr class="my-6 border-gray-200">

                <!-- Final User Details (Always visible, validates class definition first) -->
                <form id="final-register-form" class="space-y-4 opacity-50 pointer-events-none transition-opacity">
                    <input type="hidden" id="final-group-id" value="">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                        <input type="text" id="reg-name" required class="block w-full px-3 py-3 border border-gray-300 rounded-xl bg-gray-50" placeholder="Ad Soyad">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                        <input type="email" id="reg-email" required class="block w-full px-3 py-3 border border-gray-300 rounded-xl bg-gray-50" placeholder="ornek@mail.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                        <input type="password" id="reg-password" required class="block w-full px-3 py-3 border border-gray-300 rounded-xl bg-gray-50" placeholder="••••••••">
                    </div>
                    <button type="submit" class="w-full py-3 px-4 rounded-xl shadow-md text-base font-bold text-white bg-child-primary hover:bg-amber-600 transition-colors">
                        Kaydı Tamamla
                    </button>
                </form>

            </div>
        </div>
    `;

    // Tab Logic
    const tabJoin = document.getElementById('tab-joincode');
    const tabManual = document.getElementById('tab-manual');
    const formJoin = document.getElementById('form-joincode');
    const formManual = document.getElementById('form-manual');

    tabJoin.addEventListener('click', () => {
        tabJoin.className = 'flex-1 py-2 px-4 text-sm font-bold text-indigo-700 bg-white shadow rounded-md transition-all';
        tabManual.className = 'flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 transition-all';
        formJoin.classList.remove('hidden');
        formManual.classList.add('hidden');
    });

    tabManual.addEventListener('click', () => {
        tabManual.className = 'flex-1 py-2 px-4 text-sm font-bold text-indigo-700 bg-white shadow rounded-md transition-all';
        tabJoin.className = 'flex-1 py-2 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 transition-all';
        formManual.classList.remove('hidden');
        formJoin.classList.add('hidden');
        loadGroups('city', null); // Initial load of cities
    });

    // Final Register Submit
    document.getElementById('final-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const groupId = document.getElementById('final-group-id').value;
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        showToast('Kayıt oluşturuluyor...', 'info');
        try {
            const res = await apiCall({
                action: 'register',
                resource: 'k_t_users',
                data: {
                    group_id: groupId,
                    full_name: name,
                    email,
                    password,
                    role: 'student'
                }
            });

            const users = normalizeApiDataArray(res);
            if (users.length > 0) {
                const user = users[0];

                if (user.already_exists === true) {
                    localStorage.setItem('kl_login_hint_email', email);
                    showToast('Bu e-posta zaten kayıtlı. Mevcut hesap için giriş yapın. Not: Her öğrenci benzersiz e-posta ile kayıt olmalıdır.', 'info');
                    await navigate('login');
                    return;
                }

                AppState.user = {
                    id: user.id,
                    role: normalizeRole(user.role),
                    full_name: user.full_name,
                    email: user.email,
                    group_id: user.group_id
                };

                AppState.theme = AppState.user.role === 'student' ? 'child' : 'academic';
                saveState();
                applyTheme(AppState.theme);

                showToast('Aramıza hoş geldin!', 'success');

                if (AppState.user.role === 'student') {
                    await navigate('student_dashboard');
                } else {
                    await navigate('authority_dashboard');
                }
            } else {
                showToast('Kayıt oluşturulurken bir hata oluştu.', 'error');
            }

        } catch (err) {
            console.error('Register error:', err);
            // showToast is handled in apiCall
        }
    });

    // Group Selection Logic
    document.getElementById('reg-city').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) { loadGroups('district', val); }
        else { resetSelect('reg-district', 'Önce İl Seçin'); resetSelect('reg-school', 'Önce İlçe Seçin'); disableFinalForm(); }
    });

    document.getElementById('reg-district').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) { loadGroups('school', val); }
        else { resetSelect('reg-school', 'Önce İlçe Seçin'); disableFinalForm(); }
    });

    document.getElementById('reg-school').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            resetSelect('reg-grade', 'Sınıf seviyesi otomatik');
            loadGroups('class', val);
        }
        else {
            resetSelect('reg-grade', 'Önce Okul Seçin');
            resetSelect('reg-branch', 'Önce Okul Seçin');
            disableFinalForm();
        }
    });

    document.getElementById('reg-grade').addEventListener('change', (e) => {
        if (!e.target.value) {
            disableFinalForm();
        }
    });

    document.getElementById('reg-branch').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) { enableFinalForm(val); }
        else { disableFinalForm(); }
    });

}

async function resolveJoinCode() {
    const codeInput = document.getElementById('reg-join-code');
    const resultDiv = document.getElementById('join-code-result');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) return;

    showToast('Kod kontrol ediliyor...', 'info');
    try {
        const res = await apiCall({
            action: 'resolve_code',
            resource: 'k_t_groups',
            data: { code: code }
        });

        const rows = normalizeApiDataArray(res);
        const mapping = rows.length > 0 ? rows[0] : null;

        if (mapping && mapping.class_id) {
            const [className, schoolName, districtName, cityName] = await Promise.all([
                getGroupNameById(mapping.class_id),
                getGroupNameById(mapping.school_id),
                getGroupNameById(mapping.district_id),
                getGroupNameById(mapping.city_id)
            ]);
            resultDiv.classList.remove('hidden');
            resultDiv.innerHTML = `
                ✅ <b>Sınıf bulundu.</b><br>
                <span class="text-xs">${cityName || '-'} / ${districtName || '-'} / ${schoolName || '-'} / <b>${className || '-'}</b></span><br>
                <span class="text-xs">Lütfen ad, e-posta ve şifre alanlarını doldurarak kaydı tamamlayın.</span>
            `;
            enableFinalForm(mapping.class_id);
        } else {
            showToast('Geçersiz katılım kodu', 'error');
            disableFinalForm();
            resultDiv.classList.add('hidden');
        }
    } catch (err) {
        console.error('Resolve code error:', err);
    }
}

async function loadGroups(type, parentId) {
    const selectMap = {
        'city': 'reg-city',
        'district': 'reg-district',
        'school': 'reg-school',
        'class': 'reg-branch'
    };

    const selectId = selectMap[type];
    const selectEl = document.getElementById(selectId);

    selectEl.innerHTML = '<option value="">Yükleniyor...</option>';
    selectEl.disabled = true;

    try {
        const res = await apiCall({
            action: 'get_groups',
            resource: 'k_t_groups',
            data: { type: type, parent_id: parentId || null }
        });
        const groups = normalizeApiDataArray(res);

        selectEl.innerHTML = '<option value="">Seçiniz</option>';
        groups.forEach(item => {
            selectEl.innerHTML += `<option value="${item.id}">${item.name}</option>`;
        });

        selectEl.disabled = false;
        selectEl.classList.remove('opacity-50');

    } catch (err) {
        console.error('Group load error:', err);
        resetSelect(selectId, 'Yüklenemedi');
    }

    // Reset downstream selects
    resetDownstreamSelects(type);
}

function resetDownstreamSelects(fromType) {
    const order = ['city', 'district', 'school', 'class'];
    const labelMap = {
        city: 'İl',
        district: 'İlçe',
        school: 'Okul',
        class: 'Sınıf'
    };
    const idx = order.indexOf(fromType);

    if (idx > -1) {
        for (let i = idx + 1; i < order.length; i++) {
            const elId = order[i] === 'class' ? 'reg-branch' : `reg-${order[i]}`;
            resetSelect(elId, `Önce ${labelMap[order[i - 1]]} seçin`);
        }
    }
    disableFinalForm();
}

function resetSelect(id, placeholder) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = `<option value="">${placeholder}</option>`;
        el.disabled = true;
        el.classList.add('opacity-50');
    }
}

function enableFinalForm(groupId) {
    document.getElementById('final-group-id').value = groupId;
    const finalForm = document.getElementById('final-register-form');
    finalForm.classList.remove('opacity-50', 'pointer-events-none');
}

function disableFinalForm() {
    document.getElementById('final-group-id').value = '';
    const finalForm = document.getElementById('final-register-form');
    finalForm.classList.add('opacity-50', 'pointer-events-none');
}

function getTodayISODate() {
    return new Date().toISOString().split('T')[0];
}

function parseReadLogEvent(note) {
    if (!note || typeof note !== 'string') return null;
    if (note.includes('[KT_EVENT]START')) return 'start';
    if (note.includes('[KT_EVENT]DROP')) return 'drop';
    if (note.includes('[KT_EVENT]FINISH')) return 'finish';
    return null;
}

function normalizeApiDataArray(res) {
    if (res && Array.isArray(res.data)) return res.data;
    if (res && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return [res.data];
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object' && !('status' in res)) return [res];
    return [];
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildBookCoverHtml(thumbnailUrl, altText, classes = 'w-full h-full object-cover') {
    const safeUrl = String(thumbnailUrl || '').trim();
    const safeAlt = escapeHtml(altText || 'Kitap kapağı');
    if (!safeUrl) {
        return `
            <div class="w-full h-full bg-slate-100 flex items-center justify-center">
                <i data-lucide="book" class="w-10 h-10 text-slate-400"></i>
            </div>
        `;
    }
    return `
        <img src="${escapeHtml(safeUrl)}" alt="${safeAlt}" class="${classes}" loading="lazy"
             onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');">
        <div class="hidden w-full h-full bg-slate-100 flex items-center justify-center">
            <i data-lucide="book" class="w-10 h-10 text-slate-400"></i>
        </div>
    `;
}

async function getGroupNameById(groupId) {
    if (!groupId) return null;
    try {
        const res = await apiCall({
            action: 'read',
            resource: 'k_t_groups',
            data: {
                fields: ['id', 'name'],
                filters: { id: groupId },
                limit: 1
            }
        });
        const rows = normalizeApiDataArray(res);
        return rows.length > 0 ? rows[0].name : null;
    } catch (err) {
        console.error('Group name load error:', err);
        return null;
    }
}

async function loadStudentActiveBook() {
    if (!AppState.user || !AppState.user.id) return;

    try {
        const logsRes = await apiCall({
            action: 'read',
            resource: 'k_t_read_logs',
            data: {
                fields: ['book_isbn', 'pages_read', 'read_date', 'note'],
                filters: { user_id: AppState.user.id },
                order: 'read_date DESC',
                limit: 300
            }
        });

        const logs = logsRes.data || [];
        if (logs.length === 0) return;

        const latestEventByIsbn = {};
        const totalPagesByIsbn = {};

        logs.forEach((log) => {
            const isbn = log.book_isbn;
            if (!isbn) return;

            if (!latestEventByIsbn[isbn]) {
                latestEventByIsbn[isbn] = parseReadLogEvent(log.note) || 'read';
            }
            totalPagesByIsbn[isbn] = (totalPagesByIsbn[isbn] || 0) + Math.max(0, Number(log.pages_read) || 0);
        });

        let latestIsbn = null;
        for (const log of logs) {
            const isbn = log.book_isbn;
            if (!isbn) continue;
            const latestEvent = latestEventByIsbn[isbn];
            if (latestEvent !== 'drop' && latestEvent !== 'finish') {
                latestIsbn = isbn;
                break;
            }
        }

        if (!latestIsbn) {
            const fallback = logs.find((log) => log.book_isbn && latestEventByIsbn[log.book_isbn] !== 'drop');
            latestIsbn = fallback ? fallback.book_isbn : null;
        }

        if (!latestIsbn) return;

        const currentPage = totalPagesByIsbn[latestIsbn] || 0;

        const editionRes = await apiCall({
            action: 'read',
            resource: 'k_t_book_editions',
            data: {
                fields: ['isbn', 'book_id', 'page_count'],
                filters: { isbn: latestIsbn },
                limit: 1
            }
        });
        const edition = editionRes.data && editionRes.data.length > 0 ? editionRes.data[0] : null;
        if (!edition) return;

        const bookRes = await apiCall({
            action: 'read',
            resource: 'k_t_books',
            data: {
                fields: ['id', 'title', 'author'],
                filters: { id: edition.book_id },
                limit: 1
            }
        });
        const book = bookRes.data && bookRes.data.length > 0 ? bookRes.data[0] : {};

        const pageCount = Number(edition.page_count) || Math.max(currentPage, 1);
        AppState.data.activeBook = {
            edition_id: edition.isbn || latestIsbn,
            title: book.title || 'İsimsiz Kitap',
            author: book.author || 'Bilinmeyen Yazar',
            page_count: pageCount,
            current_page: Math.min(Math.max(currentPage, 0), pageCount)
        };
    } catch (err) {
        console.error('Active book load error:', err);
    }
}

async function renderStudentDashboard(container) {
    await loadStudentActiveBook();
    let dashboardStats = { read_books_count: 0, total_pages: 0, streak_days: 0 };
    let ongoingBooks = [];
    try {
        dashboardStats = await loadDashboardStats();
        const allBooks = await loadMyBooksData();
        ongoingBooks = allBooks.filter((book) => !book.finished && !book.dropped).slice(0, 12);
    } catch (err) {
        console.error('Dashboard metrics load error:', err);
    }

    const activeBook = AppState.data.activeBook;
    const hasActiveBook = Boolean(activeBook && activeBook.edition_id);
    const safePageCount = Math.max(1, Number(activeBook.page_count) || 1);
    const safeCurrentPage = Math.min(Math.max(Number(activeBook.current_page) || 0, 0), safePageCount);
    const progressPercent = Math.round((safeCurrentPage / safePageCount) * 100);
    const readBooksCount = Number(dashboardStats.read_books_count) || 0;
    const streakDays = Number(dashboardStats.streak_days) || 0;
    const totalPages = Number(dashboardStats.total_pages) || 0;

    document.getElementById('page-title').textContent = "Öğrenci Paneli";
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
            <!-- Left Col: Profile & Stats -->
            <div class="space-y-6">
                <!-- Profile Card -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center space-x-4 relative overflow-hidden">
                    <div class="absolute -right-10 -top-10 w-32 h-32 bg-child-primary/10 rounded-full blur-2xl"></div>
                    <img src="https://ui-avatars.com/api/?name=${AppState.user.full_name}&background=f59e0b&color=fff&size=128" class="w-20 h-20 rounded-2xl shadow-md border-4 border-white" alt="Profile">
                    <div>
                        <h2 class="text-2xl font-display font-bold text-gray-900">${AppState.user.full_name}</h2>
                        <p class="text-sm text-gray-500 font-medium flex items-center mt-1">
                            <i data-lucide="award" class="w-4 h-4 text-child-primary mr-1"></i> Öğrenci Profili
                        </p>
                    </div>
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                        <i data-lucide="book-open" class="absolute -right-2 -bottom-2 w-16 h-16 text-white/20"></i>
                        <p class="text-indigo-100 text-sm font-medium mb-1">Okunan</p>
                        <p class="text-3xl font-display font-bold">${readBooksCount} <span class="text-lg font-normal opacity-80">Kitap</span></p>
                    </div>
                    <div class="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                        <i data-lucide="flame" class="absolute -right-2 -bottom-2 w-16 h-16 text-white/20"></i>
                        <p class="text-amber-100 text-sm font-medium mb-1">Seri</p>
                        <p class="text-3xl font-display font-bold">${streakDays} <span class="text-lg font-normal opacity-80">Gün</span></p>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                        <i data-lucide="file-text" class="absolute -right-2 -bottom-2 w-16 h-16 text-white/20"></i>
                        <p class="text-emerald-100 text-sm font-medium mb-1">Toplam</p>
                        <p class="text-3xl font-display font-bold">${totalPages} <span class="text-lg font-normal opacity-80">Sayfa</span></p>
                    </div>
                </div>
            </div>

            <!-- Main Col: Active Book & Actions -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-display font-bold text-gray-800 flex items-center">
                            <i data-lucide="bookmark" class="w-5 h-5 text-child-secondary mr-2"></i> Şu An Okuduğun
                        </h3>
                        <button onclick="navigate('library')" class="text-sm font-medium text-child-secondary bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-100 transition">Değiştir</button>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-6">
                        <div class="w-32 h-44 bg-gray-200 rounded-xl shadow-inner flex-shrink-0 flex items-center justify-center relative overflow-hidden group">
                           <i data-lucide="image" class="text-gray-400"></i>
                           <!-- Book Cover Image would go here -->
                        </div>
                        <div class="flex-1 flex flex-col justify-center">
                            <h4 class="text-2xl font-bold text-gray-900 mb-1">${hasActiveBook ? activeBook.title : 'Henüz aktif kitap yok'}</h4>
                            <p class="text-gray-500 mb-4">${hasActiveBook ? activeBook.author : 'Kütüphane bölümünden bir kitap seçerek başlayabilirsin.'}</p>
                            
                            <!-- Progress Bar -->
                            <div class="mb-2 flex justify-between text-sm font-medium">
                                <span class="text-child-secondary">Sayfa ${hasActiveBook ? safeCurrentPage : 0} / ${hasActiveBook ? safePageCount : 0}</span>
                                <span class="text-gray-500">${hasActiveBook ? progressPercent : 0}%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-3 mb-6 overflow-hidden">
                                <div class="bg-child-secondary h-3 rounded-full transition-all duration-1000" style="width: ${hasActiveBook ? progressPercent : 0}%"></div>
                            </div>
                            
                            <button onclick="${hasActiveBook ? 'openReadingLogModal()' : "navigate('library')"}" class="w-full sm:w-auto px-6 py-3 bg-child-primary text-white font-bold rounded-xl shadow-md hover:bg-amber-600 transition-colors flex items-center justify-center group">
                                <i data-lucide="plus-circle" class="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform"></i> Okuma Ekle
                            </button>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h3 class="text-xl font-display font-bold text-gray-800 flex items-center mb-4">
                        <i data-lucide="library" class="w-5 h-5 text-child-secondary mr-2"></i> Şu An Okuduklarım
                    </h3>
                    ${ongoingBooks.length === 0 ? `
                        <div class="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl p-4">
                            Aktif okuma listen henüz boş. Kütüphaneden bir kitap seçip başlayabilirsin.
                        </div>
                    ` : `
                        <div class="overflow-x-auto no-scrollbar">
                            <div class="flex gap-4 snap-x snap-mandatory pb-1">
                                ${ongoingBooks.map((book) => `
                                    <button onclick="startReadingForIsbn('${book.edition_id}')" class="snap-start shrink-0 w-56 text-left rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-indigo-50 p-4 shadow-sm hover:shadow-md transition">
                                        <div class="flex items-center justify-between mb-3">
                                            <div class="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                <i data-lucide="book-marked" class="w-5 h-5"></i>
                                            </div>
                                            <span class="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">${Math.max(0, Number(book.progress_percent) || 0)}%</span>
                                        </div>
                                        <h4 class="font-bold text-sm text-gray-900 line-clamp-2">${book.title || 'İsimsiz Kitap'}</h4>
                                        <p class="text-xs text-gray-500 mt-1 line-clamp-1">${book.author || 'Bilinmeyen Yazar'}</p>
                                        <div class="w-full bg-white rounded-full h-2 mt-3 overflow-hidden border border-indigo-100">
                                            <div class="bg-indigo-500 h-2 rounded-full transition-all duration-700" style="width: ${Math.max(0, Number(book.progress_percent) || 0)}%"></div>
                                        </div>
                                        <p class="text-[11px] text-gray-500 mt-2">Sayfa ${Number(book.current_page) || 0} / ${Number(book.page_count) || 0}</p>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `}
                </div>
            </div>
        </div>

        <!-- Read Log Modal -->
        <div id="read-log-modal" class="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                    <h3 class="font-bold text-lg text-indigo-900 flex items-center">
                        <i data-lucide="book-open" class="w-5 h-5 mr-2 text-indigo-500"></i> Şu An Kaçıncı Sayfadasın?
                    </h3>
                    <button onclick="closeReadingLogModal()" class="text-gray-400 hover:text-gray-600 p-1">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="p-6">
                    <div class="mb-5 bg-amber-50 p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                        <span class="text-amber-800 text-sm font-medium">En son kaldığın sayfa:</span>
                        <span class="font-bold font-display text-xl text-amber-600">${hasActiveBook ? AppState.data.activeBook.current_page : 0}</span>
                    </div>
                
                    <form id="read-log-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-800 mb-2">Şu an kaçıncı sayfadasın?</label>
                            <input type="number" id="log-new-page" min="${hasActiveBook ? AppState.data.activeBook.current_page + 1 : 1}" max="${hasActiveBook ? AppState.data.activeBook.page_count : 1}" ${hasActiveBook ? 'required' : 'disabled'} class="w-full px-4 py-3 text-xl font-display text-center border-2 border-indigo-100 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all ${hasActiveBook ? '' : 'opacity-50'}" placeholder="${hasActiveBook ? 'Örn: 55' : 'Önce aktif kitap seç'}">
                        </div>
                        
                        <div class="pt-2">
                            <label class="block text-sm font-bold text-gray-800 mb-2 flex justify-between items-center">
                                Okuma Notu (İsteğe bağlı)
                                <button type="button" onclick="startSpeechToText('log-note')" class="text-indigo-600 hover:text-indigo-800 flex items-center text-xs bg-indigo-50 px-2 py-1 rounded-full transition-colors" title="Sesle yazdır">
                                    <i data-lucide="mic" class="w-3 h-3 mr-1"></i> Sesli Yazdır
                                </button>
                            </label>
                            <textarea id="log-note" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-200 outline-none text-sm transition-all shadow-inner" placeholder="Bugün okuduğun kısım hakkında neler hissettin?"></textarea>
                        </div>

                        <button type="submit" ${hasActiveBook ? '' : 'disabled'} class="w-full mt-2 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex justify-center items-center text-lg ${hasActiveBook ? '' : 'opacity-50 cursor-not-allowed'}">
                            <i data-lucide="check" class="w-5 h-5 mr-2"></i> İlerlemeyi Kaydet
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Process read log form logic
    const logForm = document.getElementById('read-log-form');
    if (logForm) {
        logForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPage = parseInt(document.getElementById('log-new-page').value, 10);
            const noteText = document.getElementById('log-note').value;
            await logReading(newPage, noteText);
        });
    }
}

function openReadingLogModal() {
    const modal = document.getElementById('read-log-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeReadingLogModal() {
    const modal = document.getElementById('read-log-modal');
    if (modal) modal.classList.add('hidden');
}

function startSpeechToText(targetId) {
    const targetElement = document.getElementById(targetId);
    if (!('webkitSpeechRecognition' in window)) {
        showToast('Tarayıcınız sesle yazmayı desteklemiyor.', 'error');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    showToast('Sizi dinliyorum, konuşun...', 'info');

    recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        const currentText = targetElement.value;
        targetElement.value = currentText ? currentText + ' ' + result : result;
        showToast('Ses algılandı ve eklendi.', 'success');
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        showToast('Ses anlaşılamadı, tekrar deneyin.', 'error');
    };

    recognition.start();
}

async function renderLeaderboardView(container) {
    document.getElementById('page-title').textContent = "Sıralama Panosu";
    let ranking = [];
    try {
        const res = await apiCall({
            action: 'leaderboard_group',
            resource: 'k_t_read_logs',
            data: { group_id: AppState.user.group_id, limit: 50 }
        });
        ranking = normalizeApiDataArray(res);
    } catch (err) {
        console.error('Leaderboard load error:', err);
    }

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up">
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 class="font-bold text-gray-800 flex items-center">
                    <i data-lucide="trophy" class="w-5 h-5 mr-2 text-amber-500"></i> Sınıf Sıralaması
                </h3>
            </div>
            <div class="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
                ${ranking.length === 0 ? `
                    <div class="px-4 py-8 text-sm text-gray-500 text-center">Sıralama verisi henüz oluşmadı.</div>
                ` : ranking.map((row, idx) => `
                    <div class="flex items-center px-4 py-3 ${idx > 0 ? 'border-t border-gray-50' : ''} ${row.user_id === AppState.user.id ? 'bg-amber-50/60 rounded-2xl' : 'hover:bg-gray-50 rounded-2xl'} transition">
                        <span class="w-8 font-bold ${idx < 3 ? 'text-amber-600' : 'text-gray-400'} text-center">${idx + 1}</span>
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(row.full_name || 'Öğrenci')}&background=f59e0b&color=fff&size=40" class="w-10 h-10 rounded-full mx-4">
                        <div class="flex-1 font-bold text-gray-700">${row.full_name || 'İsimsiz Öğrenci'}</div>
                        <div class="font-medium text-child-primary">${Number(row.total_pages) || 0} sf</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function loadMyBooksData() {
    if (!AppState.user || !AppState.user.id) return [];

    const logsRes = await apiCall({
        action: 'read',
        resource: 'k_t_read_logs',
        data: {
            fields: ['book_isbn', 'pages_read', 'read_date', 'note'],
            filters: { user_id: AppState.user.id },
            order: 'read_date DESC',
            limit: 1000
        }
    });

    const logs = normalizeApiDataArray(logsRes);
    AppState.data.recentReadLogs = logs;
    const grouped = {};

    logs.forEach((log) => {
        const isbn = log.book_isbn;
        if (!isbn) return;

        if (!grouped[isbn]) {
            grouped[isbn] = {
                edition_id: isbn,
                title: 'İsimsiz Kitap',
                author: 'Bilinmeyen Yazar',
                page_count: 0,
                current_page: 0,
                last_read_date: log.read_date || null,
                latest_event: null,
                finished_date: null
            };
        }

        if (!grouped[isbn].latest_event) {
            const evt = parseReadLogEvent(log.note);
            grouped[isbn].latest_event = evt || 'read';
            if (evt === 'finish') {
                grouped[isbn].finished_date = log.read_date || null;
            }
        }

        grouped[isbn].current_page += Math.max(0, Number(log.pages_read) || 0);
        if (log.read_date && (!grouped[isbn].last_read_date || log.read_date > grouped[isbn].last_read_date)) {
            grouped[isbn].last_read_date = log.read_date;
        }
    });

    const books = await Promise.all(Object.keys(grouped).map(async (isbn) => {
        const editionRes = await apiCall({
            action: 'read',
            resource: 'k_t_book_editions',
            data: {
                fields: ['isbn', 'book_id', 'page_count'],
                filters: { isbn: isbn },
                limit: 1
            }
        });
        const editionRows = normalizeApiDataArray(editionRes);
        const edition = editionRows.length > 0 ? editionRows[0] : null;

        let title = grouped[isbn].title;
        let author = grouped[isbn].author;
        let pageCount = Number(edition?.page_count) || Math.max(grouped[isbn].current_page, 1);

        if (edition && edition.book_id) {
            const bookRes = await apiCall({
                action: 'read',
                resource: 'k_t_books',
                data: {
                    fields: ['id', 'title', 'author'],
                    filters: { id: edition.book_id },
                    limit: 1
                }
            });

            const bookRows = normalizeApiDataArray(bookRes);
            if (bookRows.length > 0) {
                title = bookRows[0].title || title;
                author = bookRows[0].author || author;
            }
        }

        const currentPage = Math.min(Math.max(grouped[isbn].current_page, 0), pageCount);
        const progress = Math.round((currentPage / pageCount) * 100);

        const isFinishedByPage = currentPage >= pageCount;
        const isFinishedByEvent = grouped[isbn].latest_event === 'finish';
        const isDropped = grouped[isbn].latest_event === 'drop';
        const finished = isFinishedByEvent || isFinishedByPage;
        const finishedDate = grouped[isbn].finished_date || (finished ? grouped[isbn].last_read_date : null);

        return {
            edition_id: edition?.isbn || isbn,
            title,
            author,
            page_count: pageCount,
            current_page: currentPage,
            progress_percent: progress,
            last_read_date: grouped[isbn].last_read_date,
            finished: finished,
            dropped: isDropped,
            finished_date: finishedDate
        };
    }));

    books.sort((a, b) => (b.last_read_date || '').localeCompare(a.last_read_date || ''));
    AppState.data.bookProgressMap = books.reduce((acc, item) => {
        acc[item.edition_id] = item;
        return acc;
    }, {});

    return books;
}

async function loadDashboardStats() {
    if (!AppState.user || !AppState.user.id) {
        return { read_books_count: 0, total_pages: 0, streak_days: 0 };
    }

    const res = await apiCall({
        action: 'dashboard_stats',
        resource: 'k_t_read_logs',
        data: {}
    });

    const rows = normalizeApiDataArray(res);
    const row = rows.length > 0 ? rows[0] : {};
    return {
        read_books_count: Number(row.read_books_count) || 0,
        total_pages: Number(row.total_pages) || 0,
        streak_days: Number(row.streak_days) || 0
    };
}

function calculateReadingStreak(logs) {
    if (!Array.isArray(logs) || logs.length === 0) return 0;

    const uniqueDates = [...new Set(
        logs
            .map((log) => log.read_date)
            .filter(Boolean)
    )].sort().reverse();

    if (uniqueDates.length === 0) return 0;

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const yesterdayUTC = new Date(todayUTC);
    yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

    const latestDateUTC = new Date(`${uniqueDates[0]}T00:00:00Z`);
    const latestMs = latestDateUTC.getTime();
    const todayMs = todayUTC.getTime();
    const yesterdayMs = yesterdayUTC.getTime();

    // Current streak only: last reading must be today or yesterday.
    if (latestMs !== todayMs && latestMs !== yesterdayMs) {
        return 0;
    }

    let streak = 1;
    let prevDateUTC = latestDateUTC;

    for (let i = 1; i < uniqueDates.length; i++) {
        const currentDateUTC = new Date(`${uniqueDates[i]}T00:00:00Z`);
        const expectedPrev = new Date(prevDateUTC);
        expectedPrev.setUTCDate(expectedPrev.getUTCDate() - 1);

        if (currentDateUTC.getTime() === expectedPrev.getTime()) {
            streak += 1;
            prevDateUTC = currentDateUTC;
        } else {
            break;
        }
    }

    return streak;
}

function startReadingForIsbn(isbn) {
    const book = AppState.data.bookProgressMap[isbn];
    if (!book) {
        showToast('Kitap bilgisi bulunamadı.', 'error');
        return;
    }
    AppState.data.activeBook = {
        edition_id: book.edition_id,
        title: book.title,
        author: book.author,
        page_count: book.page_count,
        current_page: book.current_page
    };
    navigate('student_dashboard');
}

async function startReadingFromLibrary(isbn, title, author, pageCount) {
    if (!isbn) {
        showToast('Bu kitap için ISBN bulunamadı. Lütfen farklı bir baskı seçin.', 'error');
        return;
    }

    try {
        await apiCall({
            action: 'log_read',
            resource: 'k_t_read_logs',
            data: {
                book_isbn: isbn,
                pages_read: 0,
                note: '[KT_EVENT]START',
                read_date: getTodayISODate()
            }
        });
    } catch (err) {
        console.error('Start reading log error:', err);
    }

    AppState.data.activeBook = {
        edition_id: isbn,
        title: title || 'İsimsiz Kitap',
        author: author || 'Bilinmeyen Yazar',
        page_count: Number(pageCount) || 1,
        current_page: 0
    };
    showToast('Kitap aktif okumana eklendi. Şimdi ilerleme girebilirsin.', 'success');
    navigate('student_dashboard');
}

async function removeFromActiveList(isbn) {
    if (!isbn) return;
    try {
        await apiCall({
            action: 'log_read',
            resource: 'k_t_read_logs',
            data: {
                book_isbn: isbn,
                pages_read: 0,
                note: '[KT_EVENT]DROP',
                read_date: getTodayISODate()
            }
        });
        showToast('Kitap aktif listenden çıkarıldı.', 'info');
        await renderMyBooksView(document.getElementById('view-container'));
    } catch (err) {
        console.error('Drop active book error:', err);
    }
}

function markBookAsFinished(isbn) {
    openFinishDateModal(isbn);
}

function openFinishDateModal(isbn) {
    if (!isbn) return;
    const modal = document.getElementById('finish-date-modal');
    const isbnInput = document.getElementById('finish-book-isbn');
    const dateInput = document.getElementById('finish-date-input');
    if (!modal || !isbnInput || !dateInput) return;

    isbnInput.value = isbn;
    dateInput.value = getTodayISODate();
    modal.classList.remove('hidden');
}

function closeFinishDateModal() {
    const modal = document.getElementById('finish-date-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitFinishDateModal() {
    const isbnInput = document.getElementById('finish-book-isbn');
    const dateInputEl = document.getElementById('finish-date-input');
    const isbn = isbnInput ? isbnInput.value : '';
    const dateInput = dateInputEl ? dateInputEl.value : '';

    if (!isbn) {
        showToast('Kitap bilgisi bulunamadı.', 'error');
        return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        showToast('Tarih formatı geçersiz. Örnek: 2026-03-01', 'error');
        return;
    }

    const book = AppState.data.bookProgressMap[isbn];
    if (!book) {
        showToast('Kitap bilgisi bulunamadı.', 'error');
        return;
    }

    const remaining = Math.max(0, (Number(book.page_count) || 0) - (Number(book.current_page) || 0));

    try {
        await apiCall({
            action: 'log_read',
            resource: 'k_t_read_logs',
            data: {
                book_isbn: isbn,
                pages_read: remaining,
                note: '[KT_EVENT]FINISH',
                read_date: dateInput
            }
        });
        closeFinishDateModal();
        showToast('Kitap bitirildi olarak kaydedildi.', 'success');
        await renderMyBooksView(document.getElementById('view-container'));
        await syncBadgeAchievements(true);
    } catch (err) {
        console.error('Finish book error:', err);
    }
}

async function renderMyBooksView(container) {
    document.getElementById('page-title').textContent = "Kitaplarım";
    let books = [];
    try {
        books = await loadMyBooksData();
    } catch (err) {
        console.error('My books load error:', err);
    }

    const ongoing = books.filter((book) => !book.finished && !book.dropped);
    const finished = books.filter((book) => book.finished);
    const totalPages = books.reduce((sum, book) => sum + (Number(book.current_page) || 0), 0);

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up">
            <!-- Stats overview -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <i data-lucide="book-open" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Okunan</p>
                        <p class="text-2xl font-display font-bold text-gray-900">${books.length}</p>
                    </div>
                </div>
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                        <i data-lucide="file-text" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Sayfa</p>
                        <p class="text-2xl font-display font-bold text-gray-900">${totalPages}</p>
                    </div>
                </div>
            </div>

            <!-- Current Books -->
            <div>
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <i data-lucide="bookmark" class="w-5 h-5 mr-2 text-child-secondary"></i> Şu an Okuduklarım
                </h3>
                <div class="space-y-3">
                    ${ongoing.length === 0 ? `
                        <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-sm text-gray-500">
                            Devam eden kitabın görünmüyor. Kütüphane’den bir kitap seçip okumaya başlayabilirsin.
                        </div>
                    ` : ongoing.map((book) => `
                        <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                            <div class="flex gap-5">
                                <div class="w-24 h-36 bg-gray-200 rounded-lg shadow-inner shrink-0 flex items-center justify-center">
                                    <i data-lucide="image" class="text-gray-400"></i>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-bold text-gray-900 text-lg leading-tight">${book.title}</h4>
                                    <p class="text-sm text-gray-500 mb-3">${book.author}</p>
                                    
                                    <div class="flex justify-between text-xs font-medium mb-1">
                                        <span class="text-child-secondary">Sayfa ${book.current_page} / ${book.page_count}</span>
                                        <span class="text-gray-500">${book.progress_percent}%</span>
                                    </div>
                                    <div class="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                                        <div class="bg-child-secondary h-2 rounded-full" style="width: ${book.progress_percent}%"></div>
                                    </div>
                                    
                                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button onclick="startReadingForIsbn('${book.edition_id}')" class="w-full py-2 bg-child-primary text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors">
                                        <i data-lucide="plus" class="w-4 h-4 inline-block -mt-0.5"></i> Okuma Ekle
                                    </button>
                                    <button onclick="markBookAsFinished('${book.edition_id}')" class="w-full py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors">
                                        <i data-lucide="check" class="w-4 h-4 inline-block -mt-0.5"></i> Bitir
                                    </button>
                                    <button onclick="removeFromActiveList('${book.edition_id}')" class="w-full py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-300 transition-colors">
                                        <i data-lucide="x" class="w-4 h-4 inline-block -mt-0.5"></i> Aktiften Çıkar
                                    </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Finished Books List -->
            <div>
                <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <i data-lucide="check-circle-2" class="w-5 h-5 mr-2 text-green-500"></i> Bitirdiklerim
                </h3>
                <div class="space-y-3">
                    ${finished.length === 0 ? `
                        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-sm text-gray-500">
                            Henüz bitirdiğin kitap görünmüyor.
                        </div>
                    ` : finished.map((book) => `
                        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center">
                            <div class="w-12 h-16 bg-gray-100 rounded mr-4 flex-shrink-0 flex items-center justify-center border border-gray-200">
                                <i data-lucide="book" class="w-5 h-5 text-gray-400"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-bold text-sm text-gray-900">${book.title}</h4>
                                <p class="text-xs text-gray-500">${book.author}</p>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-bold text-gray-700">${book.page_count} sf</div>
                                <div class="text-xs text-gray-400">${book.finished_date || '-'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Finish Date Modal -->
            <div id="finish-date-modal" class="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up">
                    <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-green-50/50">
                        <h3 class="font-bold text-lg text-green-900 flex items-center">
                            <i data-lucide="calendar-check-2" class="w-5 h-5 mr-2 text-green-600"></i> Bitirme Tarihi
                        </h3>
                        <button onclick="closeFinishDateModal()" class="text-gray-400 hover:text-gray-600 p-1">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <div class="p-6 space-y-4">
                        <input type="hidden" id="finish-book-isbn" value="">
                        <div>
                            <label class="block text-sm font-bold text-gray-800 mb-2">Kitabı hangi tarihte bitirdin?</label>
                            <input id="finish-date-input" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-200 outline-none">
                        </div>
                        <div class="grid grid-cols-2 gap-3 pt-2">
                            <button type="button" onclick="closeFinishDateModal()" class="w-full py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                Vazgeç
                            </button>
                            <button type="button" onclick="submitFinishDateModal()" class="w-full py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors">
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadBadgeProgressData() {
    const badgesRes = await apiCall({
        action: 'read',
        resource: 'k_t_badges',
        data: {
            fields: ['id', 'name', 'description', 'icon_key', 'requirement_type', 'requirement_value'],
            order: 'requirement_type ASC, requirement_value ASC'
        }
    });
    const badges = normalizeApiDataArray(badgesRes);

    const books = await loadMyBooksData();
    const finishedBooksCount = books.filter((b) => b.finished).length;

    const logs = Array.isArray(AppState.data.recentReadLogs) ? AppState.data.recentReadLogs : [];
    const readingLogs = logs.filter((log) => (Number(log.pages_read) || 0) > 0);
    const totalPages = readingLogs.reduce((sum, log) => sum + (Number(log.pages_read) || 0), 0);
    const streakDays = calculateReadingStreak(readingLogs);

    const metrics = {
        total_pages: totalPages,
        read_streak: streakDays,
        total_books: finishedBooksCount
    };

    const enriched = badges.map((badge) => {
        const type = badge.requirement_type;
        const target = Number(badge.requirement_value) || 0;
        const current = Number(metrics[type]) || 0;
        const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const earned = current >= target;

        return {
            ...badge,
            target_value: target,
            current_value: current,
            progress_percent: progress,
            earned
        };
    });

    return { badges: enriched, metrics };
}

async function syncBadgeAchievements(notifyNew = false) {
    try {
        const res = await apiCall({
            action: 'sync_user_badges',
            resource: 'k_t_user_badges',
            data: {}
        });
        const rows = normalizeApiDataArray(res);
        const newlyEarnedBadges = rows.filter((r) => r.newly_earned).map((r) => r.name);

        if (notifyNew && newlyEarnedBadges.length > 0) {
            showToast(`Yeni rozet kazandın: ${newlyEarnedBadges.join(', ')}`, 'success');
        }
    } catch (err) {
        console.error('Badge sync error:', err);
    }
}

async function renderBadgesView(container) {
    document.getElementById('page-title').textContent = "Rozetler";

    let data = { badges: [], metrics: { total_pages: 0, read_streak: 0, total_books: 0 } };
    try {
        data = await loadBadgeProgressData();
        await syncBadgeAchievements(false);
    } catch (err) {
        console.error('Badge load error:', err);
    }

    const earned = data.badges.filter((b) => b.earned);
    const locked = data.badges.filter((b) => !b.earned);
    const nextTargets = [...locked]
        .sort((a, b) => {
            const progressDiff = (Number(b.progress_percent) || 0) - (Number(a.progress_percent) || 0);
            if (progressDiff !== 0) return progressDiff;
            const remainingA = (Number(a.target_value) || 0) - (Number(a.current_value) || 0);
            const remainingB = (Number(b.target_value) || 0) - (Number(b.current_value) || 0);
            return remainingA - remainingB;
        })
        .slice(0, 3);
    const badgeThemesByType = {
        total_pages: {
            card: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 border-blue-300',
            iconWrap: 'bg-white/25 text-white',
            lockedIconWrap: 'bg-blue-50 text-blue-600',
            lockedProgress: 'bg-blue-500'
        },
        read_streak: {
            card: 'bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 border-fuchsia-300',
            iconWrap: 'bg-white/25 text-white',
            lockedIconWrap: 'bg-purple-50 text-purple-600',
            lockedProgress: 'bg-purple-500'
        },
        total_books: {
            card: 'bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 border-emerald-300',
            iconWrap: 'bg-white/30 text-white',
            lockedIconWrap: 'bg-emerald-50 text-emerald-600',
            lockedProgress: 'bg-emerald-500'
        },
        default: {
            card: 'bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 border-orange-300',
            iconWrap: 'bg-white/30 text-white',
            lockedIconWrap: 'bg-gray-100 text-gray-500',
            lockedProgress: 'bg-indigo-500'
        }
    };

    function getBadgeTheme(badge) {
        return badgeThemesByType[badge.requirement_type] || badgeThemesByType.default;
    }

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Kazanılan Rozet</p>
                    <p class="text-2xl font-display font-bold text-gray-900 mt-1">${earned.length}</p>
                </div>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Toplam Sayfa</p>
                    <p class="text-2xl font-display font-bold text-gray-900 mt-1">${data.metrics.total_pages}</p>
                </div>
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <p class="text-xs text-gray-500 uppercase tracking-wider">Mevcut Seri</p>
                    <p class="text-2xl font-display font-bold text-gray-900 mt-1">${data.metrics.read_streak} gün</p>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <i data-lucide="target" class="w-5 h-5 mr-2 text-indigo-500"></i> Sıradaki Hedeflerin
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${nextTargets.length === 0 ? `
                        <div class="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-sm text-gray-500">
                            Kilitli rozet kalmadı. Hepsini tamamladın, harikasın!
                        </div>
                    ` : nextTargets.map((badge) => {
        const theme = getBadgeTheme(badge);
        return `
                        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 min-h-[220px] flex flex-col">
                            <div class="flex items-start justify-between">
                                <div class="w-16 h-16 rounded-2xl ${theme.lockedIconWrap} flex items-center justify-center">
                                    <i data-lucide="${badge.icon_key || 'medal'}" class="w-8 h-8"></i>
                                </div>
                                <span class="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">${badge.current_value} / ${badge.target_value}</span>
                            </div>
                            <h4 class="font-bold text-gray-900 text-lg mt-4 leading-tight">${badge.name}</h4>
                            <p class="text-sm text-gray-500 mt-2">${badge.description || ''}</p>
                            <div class="w-full bg-gray-100 rounded-full h-2 mt-auto overflow-hidden">
                                <div class="${theme.lockedProgress} h-2 rounded-full transition-all duration-700" style="width: ${badge.progress_percent}%"></div>
                            </div>
                        </div>
                    `;
    }).join('')}
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <i data-lucide="gift" class="w-5 h-5 mr-2 text-amber-500"></i> Hazine Sandığım
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    ${earned.length === 0 ? `
                        <div class="sm:col-span-2 lg:col-span-3 xl:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-sm text-gray-500">
                            Henüz rozet kazanmadın. Okudukça hazine sandığın dolacak.
                        </div>
                    ` : earned.map((badge) => {
        const theme = getBadgeTheme(badge);
        return `
                        <div class="rounded-2xl p-5 shadow-md border text-white min-h-[220px] flex flex-col ${theme.card}">
                            <div class="flex items-start justify-between">
                                <div class="w-16 h-16 rounded-2xl ${theme.iconWrap} flex items-center justify-center shadow-inner">
                                    <i data-lucide="${badge.icon_key || 'medal'}" class="w-8 h-8"></i>
                                </div>
                                <span class="text-[11px] px-2 py-1 rounded-full bg-white/25 text-white font-semibold">Kazanıldı</span>
                            </div>
                            <h4 class="font-bold text-lg mt-4 leading-tight">${badge.name}</h4>
                            <p class="text-sm text-white/90 mt-2">${badge.description || ''}</p>
                            <div class="mt-auto pt-4">
                                <div class="h-1.5 w-full bg-white/30 rounded-full overflow-hidden">
                                    <div class="h-full w-full bg-white rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    `;
    }).join('')}
                </div>
            </div>
        </div>
    `;
}

async function renderLibraryView(container) {
    document.getElementById('page-title').textContent = "Kütüphane";
    AppState.data.pendingIsbnBook = null;

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up max-w-2xl mx-auto">
            <!-- Search & Actions -->
            <div class="flex gap-2">
                <div class="relative flex-1">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"></i>
                    <input type="text" placeholder="Kitap veya yazar ara..." class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-child-primary focus:border-child-primary shadow-sm outline-none transition-all">
                </div>
                <button onclick="openAddBookModal()" class="bg-child-primary text-white p-3 rounded-xl shadow-sm hover:bg-amber-600 transition-colors flex items-center justify-center shrink-0">
                    <i data-lucide="plus" class="w-6 h-6"></i>
                </button>
            </div>

            <!-- Recently Added by Others -->
            <div>
                <h3 class="text-lg font-bold text-gray-800 mb-4">Sisteme Yeni Eklenenler</h3>
                <div id="library-books-grid" class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <!-- Loading Skeleton -->
                    <div class="bg-gray-100 rounded-2xl h-48 animate-pulse"></div>
                    <div class="bg-gray-100 rounded-2xl h-48 animate-pulse"></div>
                </div>
            </div>
            
            <div class="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex items-start mt-6">
                <i data-lucide="lightbulb" class="w-6 h-6 text-indigo-500 mr-3 shrink-0 mt-0.5"></i>
                <div>
                    <h4 class="font-bold text-indigo-800 text-sm">Aradığın kitabı bulamadın mı?</h4>
                    <p class="text-xs text-indigo-600 mt-1">Sistemdeki tüm kitaplar senin gibi öğrenciler tarafından ekleniyor. Yukarıdaki "+" butonuna basarak kütüphaneye yeni bir kitap kazandırabilirsin!</p>
                </div>
            </div>
        </div>

        <!-- Add Book Modal -->
        <div id="add-book-modal" class="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-y-auto animate-slide-up max-h-[90vh]">
                <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 class="font-bold text-lg text-gray-800">Sisteme Kitap Ekle</h3>
                    <button onclick="closeAddBookModal()" class="text-gray-400 hover:text-gray-600 p-1">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="p-6 space-y-6">
                    <form id="add-book-form" class="space-y-6">
                        <div class="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm">
                            <label class="block text-sm font-bold text-indigo-900 mb-2">
                                ISBN Barkod Okut
                            </label>
                            <button type="button" id="start-isbn-scan-btn" class="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center shadow-sm">
                                <i data-lucide="scan-line" class="w-4 h-4 mr-2"></i> Kamerayı Aç
                            </button>
                            <div id="barcode-scanner-container" class="hidden mt-3 w-full rounded-xl border border-indigo-200 overflow-hidden bg-white">
                                <div id="barcode-scanner-reader" class="w-full min-h-[240px]"></div>
                                <button type="button" onclick="stopBarcodeScanner()" class="w-full py-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">Taramayı Durdur</button>
                            </div>
                        </div>

                        <div class="rounded-3xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
                            <label class="block text-sm font-bold text-gray-800 mb-2">Manuel ISBN Gir</label>
                            <input type="text" id="new-book-isbn" required class="w-full px-4 py-3.5 text-lg font-semibold tracking-wide border border-amber-200 rounded-2xl focus:ring-4 focus:ring-amber-100 focus:border-amber-400 bg-white shadow-inner" placeholder="Örn: 9781234567890">
                            <button type="submit" class="w-full mt-3 py-3.5 rounded-2xl bg-child-primary text-white font-bold hover:bg-amber-600 transition-colors flex items-center justify-center shadow-sm">
                                <i data-lucide="search" class="w-5 h-5 mr-2"></i> ISBN ile Getir
                            </button>
                            <p class="text-xs text-gray-500 mt-2">Kitap bilgisi önce doğrulanır, sonra onayınla kitaplığa eklenir.</p>
                        </div>
                    </form>

                    <div id="isbn-fetch-loader" class="hidden rounded-3xl border border-indigo-100 bg-indigo-50/80 p-5 flex items-center shadow-sm">
                        <div class="animate-spin rounded-full h-6 w-6 border-2 border-indigo-200 border-t-indigo-600 mr-3"></div>
                        <p class="text-sm font-bold text-indigo-900">Aranıyor...</p>
                    </div>

                    <div id="book-confirm-card" class="hidden rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-md"></div>
                </div>
            </div>
        </div>
    `;

    // Fetch live books
    fetchLibraryBooks();

    // Process Add Book form
    const form = document.getElementById('add-book-form');
    const scanBtn = document.getElementById('start-isbn-scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            await startBarcodeScanner();
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const isbn = document.getElementById('new-book-isbn').value.replace(/-/g, '').trim();
            await fetchBookByIsbnForConfirm(isbn);
        });
    }
}

// Global Barcode Scanner State
let html5QrScanner = null;

async function startBarcodeScanner() {
    const container = document.getElementById('barcode-scanner-container');
    if (!container) return;

    if (!window.Html5Qrcode) {
        showToast('Barkod tarayıcı yüklenemedi. ISBN numarasını elle girebilirsin.', 'error');
        return;
    }

    container.classList.remove('hidden');

    try {
        if (html5QrScanner) {
            await stopBarcodeScanner();
        }

        html5QrScanner = new Html5Qrcode('barcode-scanner-reader');
        await html5QrScanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 250, height: 120 },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                ]
            },
            async (decodedText) => {
                const isbn = String(decodedText || '').replace(/\D/g, '').trim();
                if (!isbn) return;
                document.getElementById('new-book-isbn').value = isbn;
                await stopBarcodeScanner();
                await fetchBookByIsbnForConfirm(isbn);
            }
        );
    } catch (err) {
        console.error('Barcode scanner start error:', err);
        showToast('Kamera açılamadı. ISBN numarasını elle girebilirsin.', 'error');
        container.classList.add('hidden');
    }
}

async function stopBarcodeScanner() {
    const container = document.getElementById('barcode-scanner-container');
    if (container) container.classList.add('hidden');

    if (html5QrScanner) {
        try {
            await html5QrScanner.stop();
        } catch (_) {
            // noop
        }
        await html5QrScanner.clear();
        html5QrScanner = null;
    }
}

async function fetchBookByIsbnForConfirm(rawIsbn) {
    const isbn = String(rawIsbn || '').replace(/-/g, '').trim();
    if (!isbn) {
        setIsbnFetchLoading(false);
        showToast('Lütfen geçerli bir ISBN gir.', 'error');
        return;
    }

    setIsbnFetchLoading(true);
    showToast('Kitap bilgisi getiriliyor...', 'info');
    try {
        const res = await apiCall('fetch_book_by_isbn', { isbn });

        let payload = res;
        if (Array.isArray(res) && res.length > 0) payload = res[0];
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (_) {
                payload = null;
            }
        }

        if (!payload || payload.status === 'error') {
            showToast(payload?.message || 'Bu ISBN ile kitap bulunamadı.', 'error');
            setIsbnFetchLoading(false);
            return;
        }

        const data = payload.data || {};
        AppState.data.pendingIsbnBook = {
            isbn,
            title: data.title || 'İsimsiz Kitap',
            author: data.author || 'Bilinmeyen Yazar',
            page_count: Number(data.page_count) || 0,
            category: data.category || 'Diğer',
            thumbnail_url: data.thumbnail_url || ''
        };
        renderBookConfirmationCard();
        setIsbnFetchLoading(false);
    } catch (err) {
        console.error('fetch_book_by_isbn error:', err);
        setIsbnFetchLoading(false);
    }
}

function renderBookConfirmationCard() {
    const card = document.getElementById('book-confirm-card');
    const pending = AppState.data.pendingIsbnBook;
    if (!card || !pending) return;

    card.classList.remove('hidden');
    card.innerHTML = `
        <h4 class="font-bold text-emerald-900 flex items-center text-base">
            <i data-lucide="sparkles" class="w-4 h-4 mr-2"></i> Kitap Bilgisi Onayı
        </h4>
        <div class="mt-4 flex gap-4">
            <div class="w-24 h-32 rounded-2xl overflow-hidden border border-emerald-100 bg-white shrink-0 shadow-sm">
                ${buildBookCoverHtml(pending.thumbnail_url, pending.title)}
            </div>
            <div class="flex-1">
                <p class="font-bold text-gray-900 leading-tight text-lg">${escapeHtml(pending.title)}</p>
                <p class="text-sm text-gray-600 mt-1">${escapeHtml(pending.author)}</p>
                <p class="text-xs text-gray-500 mt-2 inline-flex items-center bg-white/80 border border-emerald-100 px-2 py-1 rounded-full">${pending.page_count || 0} sayfa</p>
            </div>
        </div>
        <div class="mt-4">
            <label class="block text-xs font-bold text-gray-700 mb-1">Kategori</label>
            <div class="relative">
                <select id="confirm-book-category" class="appearance-none w-full px-4 py-3 border border-emerald-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 bg-white text-sm font-medium shadow-sm">
                    <option value="Roman" ${pending.category === 'Roman' ? 'selected' : ''}>Roman</option>
                    <option value="Tarih" ${pending.category === 'Tarih' ? 'selected' : ''}>Tarih</option>
                    <option value="Bilim" ${pending.category === 'Bilim' ? 'selected' : ''}>Bilim</option>
                    <option value="Hikaye" ${pending.category === 'Hikaye' ? 'selected' : ''}>Hikaye</option>
                    <option value="Diğer" ${pending.category === 'Diğer' ? 'selected' : ''}>Diğer</option>
                </select>
                <i data-lucide="chevrons-up-down" class="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            </div>
        </div>
        <div class="mt-5">
            <button id="confirm-add-book-btn" class="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-md flex items-center justify-center">
                <i data-lucide="check-circle" class="w-5 h-5 mr-2"></i>
                Evet, Kitaplığıma Ekle
            </button>
            <div class="flex items-center justify-center gap-4 mt-3">
                <button id="retry-scan-btn" class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">Tekrar Tara</button>
                <button id="cancel-confirm-book-btn" class="text-sm font-semibold text-gray-500 hover:text-gray-700">İptal</button>
            </div>
        </div>
    `;
    lucide.createIcons({ root: card });

    const confirmBtn = document.getElementById('confirm-add-book-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            await confirmAddBookFromPending();
        });
    }
    const retryBtn = document.getElementById('retry-scan-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
            await stopBarcodeScanner();
            card.classList.add('hidden');
            AppState.data.pendingIsbnBook = null;
            await startBarcodeScanner();
        });
    }
    const cancelBtn = document.getElementById('cancel-confirm-book-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            card.classList.add('hidden');
            AppState.data.pendingIsbnBook = null;
        });
    }
}

async function confirmAddBookFromPending() {
    const pending = AppState.data.pendingIsbnBook;
    if (!pending) {
        showToast('Önce ISBN ile kitap bilgisi getir.', 'error');
        return;
    }

    showToast('Kitap sisteme ekleniyor...', 'info');
    try {
        const categorySelect = document.getElementById('confirm-book-category');
        const selectedCategory = categorySelect ? categorySelect.value : (pending.category || 'Diğer');
        const addRes = await apiCall('add_book_edition', {
            isbn: pending.isbn,
            title: pending.title,
            author: pending.author,
            page_count: pending.page_count,
            thumbnail_url: pending.thumbnail_url || '',
            category: selectedCategory
        });
        const createdRows = normalizeApiDataArray(addRes);
        if (createdRows.length === 0) {
            throw new Error('Book edition insert failed');
        }

        document.getElementById('add-book-modal').classList.add('hidden');
        document.getElementById('add-book-form').reset();
        const card = document.getElementById('book-confirm-card');
        if (card) {
            card.classList.add('hidden');
            card.innerHTML = '';
        }
        AppState.data.pendingIsbnBook = null;
        showToast('Kitap başarıyla sisteme eklendi!', 'success');
        await renderLibraryView(document.getElementById('view-container'));
    } catch (err) {
        console.error('Add book confirm error:', err);
    }
}

function setIsbnFetchLoading(isLoading) {
    const loader = document.getElementById('isbn-fetch-loader');
    const form = document.getElementById('add-book-form');
    if (loader) {
        loader.classList.toggle('hidden', !isLoading);
    }
    if (form) {
        if (isLoading) {
            form.classList.add('opacity-60', 'pointer-events-none');
        } else {
            form.classList.remove('opacity-60', 'pointer-events-none');
        }
    }
}

async function closeAddBookModal() {
    const modal = document.getElementById('add-book-modal');
    if (modal) modal.classList.add('hidden');
    await stopBarcodeScanner();
    setIsbnFetchLoading(false);
    AppState.data.pendingIsbnBook = null;
    const card = document.getElementById('book-confirm-card');
    if (card) {
        card.classList.add('hidden');
        card.innerHTML = '';
    }
}

function openAddBookModal() {
    const modal = document.getElementById('add-book-modal');
    if (modal) modal.classList.remove('hidden');
    const form = document.getElementById('add-book-form');
    if (form) form.reset();
    setIsbnFetchLoading(false);
    AppState.data.pendingIsbnBook = null;
    const card = document.getElementById('book-confirm-card');
    if (card) {
        card.classList.add('hidden');
        card.innerHTML = '';
    }
}

async function fetchLibraryBooks() {
    try {
        const editionsRes = await apiCall({
            action: 'read',
            resource: 'k_t_book_editions',
            data: {
                fields: ['isbn', 'book_id', 'page_count', 'thumbnail_url'],
                order: 'isbn DESC',
                limit: 24
            }
        });
        const grid = document.getElementById('library-books-grid');
        if (!grid) return;

        grid.innerHTML = ''; // clear skeleton
        const editions = normalizeApiDataArray(editionsRes);

        if (editions.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-6">Henüz kitap eklenmemiş.</div>';
            return;
        }

        const books = await Promise.all(editions.map(async (edition) => {
            let title = 'İsimsiz Kitap';
            let author = 'Bilinmeyen Yazar';
            let category = 'Diğer';

            if (edition.book_id) {
                try {
                    const bookRes = await apiCall({
                        action: 'read',
                        resource: 'k_t_books',
                        data: {
                            fields: ['id', 'title', 'author', 'category'],
                            filters: { id: edition.book_id },
                            limit: 1
                        }
                    });
                    const rows = normalizeApiDataArray(bookRes);
                    if (rows.length > 0) {
                        title = rows[0].title || title;
                        author = rows[0].author || author;
                        category = rows[0].category || category;
                    }
                } catch (err) {
                    console.error('Library book detail load error:', err);
                }
            }

            return {
                isbn: edition.isbn || '',
                page_count: Number(edition.page_count) || 0,
                thumbnail_url: edition.thumbnail_url || '',
                title,
                author,
                category
            };
        }));

        books.forEach((b) => {
            const safeTitle = String(b.title || '').replace(/'/g, "\\'");
            const safeAuthor = String(b.author || '').replace(/'/g, "\\'");
            grid.innerHTML += `
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div class="w-20 h-28 rounded-lg shadow-inner mb-3 overflow-hidden border border-slate-100">
                    ${buildBookCoverHtml(b.thumbnail_url, b.title, 'w-full h-full object-cover')}
                </div>
                <h4 class="font-bold text-sm text-gray-900 line-clamp-2">${b.title}</h4>
                <p class="text-xs text-gray-500 mt-1 line-clamp-1">${b.author || 'Bilinmeyen Yazar'}</p>
                <div class="flex items-center text-xs text-gray-400 mt-2 bg-gray-50 px-2 py-1 rounded">
                    <i data-lucide="tag" class="w-3 h-3 mr-1"></i> ${b.category || 'Diğer'}
                </div>
                <button onclick="startReadingFromLibrary('${b.isbn || ''}', '${safeTitle}', '${safeAuthor}', ${Number(b.page_count) || 0})" class="w-full mt-3 py-1.5 border border-child-secondary text-child-secondary text-xs rounded-lg font-bold hover:bg-child-secondary hover:text-white transition-colors">Okumaya Başla</button>
            </div>
            `;
        });
        lucide.createIcons();
    } catch (err) {
        console.error('Failed to load library:', err);
    }
}

async function renderAuthorityDashboard(container) {
    let stats = {
        total_pages: 0,
        total_students: 0,
        active_students_30d: 0,
        distinct_books_started: 0,
        monthly: []
    };
    try {
        const res = await apiCall({
            action: 'authority_stats',
            resource: 'k_t_read_logs',
            data: {}
        });
        const rows = normalizeApiDataArray(res);
        if (rows.length > 0) {
            const row = rows[0];
            let monthlySeries = [];
            if (Array.isArray(row.monthly)) {
                monthlySeries = row.monthly;
            } else if (typeof row.monthly === 'string') {
                try {
                    monthlySeries = JSON.parse(row.monthly);
                } catch (e) {
                    monthlySeries = [];
                }
            }
            stats = {
                total_pages: Number(row.total_pages) || 0,
                total_students: Number(row.total_students) || 0,
                active_students_30d: Number(row.active_students_30d) || 0,
                distinct_books_started: Number(row.distinct_books_started) || 0,
                monthly: monthlySeries
            };
        }
    } catch (err) {
        console.error('Authority stats load error:', err);
    }

    document.getElementById('page-title').textContent = "Yönetici Paneli";
    container.innerHTML = `
        <div class="space-y-6 animate-slide-up">
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div>
                   <h2 class="text-2xl font-display font-bold text-academic-primary">${AppState.user.full_name}</h2>
                   <p class="text-gray-500 flex items-center mt-1"><i data-lucide="shield" class="w-4 h-4 mr-1"></i> Gerçek verilerle canlı yönetim paneli</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <p class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Toplam Okunan Sayfa</p>
                    <p class="text-3xl font-display font-bold text-gray-900">${stats.total_pages}</p>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <p class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Aktif Öğrenci (30 Gün)</p>
                    <p class="text-3xl font-display font-bold text-gray-900">${stats.active_students_30d} / ${stats.total_students}</p>
                    <div class="w-full bg-gray-100 rounded-full h-2 mt-4">
                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${stats.total_students > 0 ? Math.round((stats.active_students_30d / stats.total_students) * 100) : 0}%"></div>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <p class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Başlanan Farklı Kitap</p>
                    <p class="text-3xl font-display font-bold text-gray-900">${stats.distinct_books_started}</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Aylık Okuma Trendi</h3>
                <div class="chart-container h-64">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const ctx = document.getElementById('trendChart');
        if (ctx) {
            const monthly = stats.monthly || [];
            const labels = monthly.map((m) => m.month || '');
            const values = monthly.map((m) => Number(m.pages) || 0);
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Okunan Sayfa',
                        data: values,
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }, 300);
}

async function renderAuthorityReportsView(container) {
    await renderAuthorityDashboard(container);
    document.getElementById('page-title').textContent = "Raporlar";
}

async function renderAuthorityStudentsView(container) {
    document.getElementById('page-title').textContent = "Öğrenciler";
    let rows = [];
    try {
        const res = await apiCall({
            action: 'authority_students',
            resource: 'k_t_read_logs',
            data: { limit: 200 }
        });
        rows = normalizeApiDataArray(res);
    } catch (err) {
        console.error('Authority students load error:', err);
    }

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <h3 class="text-lg font-bold text-gray-800">Öğrenci Listesi</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                                <th class="py-3 px-6 font-medium">Ad Soyad</th>
                                <th class="py-3 px-6 font-medium">E-posta</th>
                                <th class="py-3 px-6 font-medium text-center">Toplam Sayfa</th>
                                <th class="py-3 px-6 font-medium text-center">Kitap</th>
                            </tr>
                        </thead>
                        <tbody class="text-gray-700 divide-y divide-gray-100">
                            ${rows.length === 0 ? `
                                <tr><td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">Öğrenci verisi bulunamadı.</td></tr>
                            ` : rows.map((r) => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="py-4 px-6 font-semibold">${r.full_name || '-'}</td>
                                    <td class="py-4 px-6 text-sm">${r.email || '-'}</td>
                                    <td class="py-4 px-6 text-center font-bold text-academic-primary">${Number(r.total_pages) || 0}</td>
                                    <td class="py-4 px-6 text-center">${Number(r.books_started) || 0}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

async function renderAuthoritySettingsView(container) {
    document.getElementById('page-title').textContent = "Ayarlar";
    let profile = null;
    try {
        const res = await apiCall({
            action: 'read',
            resource: 'k_t_users',
            data: {
                fields: ['id', 'full_name', 'email', 'role', 'group_id'],
                filters: { id: AppState.user.id },
                limit: 1
            }
        });
        const rows = normalizeApiDataArray(res);
        profile = rows.length > 0 ? rows[0] : null;
    } catch (err) {
        console.error('Authority profile load error:', err);
    }

    container.innerHTML = `
        <div class="space-y-6 animate-slide-up max-w-2xl">
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Hesap Bilgileri</h3>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between border-b border-gray-100 pb-2"><span class="text-gray-500">Ad Soyad</span><span class="font-semibold">${profile?.full_name || '-'}</span></div>
                    <div class="flex justify-between border-b border-gray-100 pb-2"><span class="text-gray-500">E-posta</span><span class="font-semibold">${profile?.email || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Rol</span><span class="font-semibold">${normalizeRole(profile?.role || '') || '-'}</span></div>
                </div>
            </div>
        </div>
    `;
}


// --- UI Utilities ---

function updateNavigationUI(role) {
    const desktopNavLinks = document.getElementById('desktop-nav-links');
    const mobileNavLinks = document.getElementById('mobile-nav-links');
    const desktopSidebar = document.getElementById('desktop-sidebar');
    const mobileBottomNav = document.getElementById('mobile-bottom-nav');

    if (role === 'hidden') {
        desktopSidebar.classList.add('hidden');
        desktopSidebar.classList.remove('md:flex');
        mobileBottomNav.classList.add('hidden');
        return;
    }

    // Mobilde sidebar her zaman gizli kalsın, sadece md+ ekranda görünsün.
    desktopSidebar.classList.add('hidden');
    desktopSidebar.classList.add('md:flex');
    mobileBottomNav.classList.remove('hidden');

    let navItems = [];

    if (role === 'student') {
        navItems = [
            { icon: 'home', label: 'Ana Sayfa', action: "navigate('student_dashboard')" },
            { icon: 'book', label: 'Kitaplarım', action: "navigate('my_books')" },
            { icon: 'library', label: 'Keşfet', action: "navigate('library')" },
            { icon: 'medal', label: 'Rozetler', action: "navigate('badges')" },
            { icon: 'trending-up', label: 'Sıralama', action: "navigate('leaderboard')" },
        ];
    } else {
        navItems = [
            { icon: 'layout-dashboard', label: 'Panel', action: "navigate('authority_dashboard')" },
            { icon: 'bar-chart-2', label: 'Raporlar', action: "navigate('authority_reports')" },
            { icon: 'users', label: 'Öğrenciler', action: "navigate('authority_students')" },
            { icon: 'settings', label: 'Ayarlar', action: "navigate('authority_settings')" },
        ];
    }

    // Build Desktop Nav
    desktopNavLinks.innerHTML = navItems.map(item => `
        <a href="#" onclick="${item.action}" class="flex items-center px-4 py-3 mt-1 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 rounded-xl transition-colors font-medium">
            <i data-lucide="${item.icon}" class="h-5 w-5 mr-3"></i>
            ${item.label}
        </a>
    `).join('');

    // Append Mobile Logout
    desktopNavLinks.innerHTML += `
        <div class="h-px bg-gray-200 my-4"></div>
        <a href="#" onclick="logout()" class="flex items-center px-4 py-3 mt-1 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium">
            <i data-lucide="log-out" class="h-5 w-5 mr-3"></i>
            Çıkış Yap
        </a>
    `;

    // Build Mobile Nav
    mobileNavLinks.innerHTML = navItems.map(item => `
        <a href="#" onclick="${item.action}" class="flex flex-col items-center justify-center w-full h-full text-gray-500 hover:text-indigo-600 transition-colors">
            <i data-lucide="${item.icon}" class="h-6 w-6 mb-1"></i>
            <span class="text-[10px] font-medium">${item.label}</span>
        </a>
    `).join('');
}

function applyTheme(theme) {
    document.body.classList.remove('theme-child', 'theme-academic');
    document.body.classList.add(`theme-${theme}`);

    // Update theme toggle icon based on current state
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');
    const iconAcademic = document.getElementById('icon-academic');

    iconMoon.classList.add('hidden');
    iconSun.classList.add('hidden');
    iconAcademic.classList.add('hidden');

    if (theme === 'child') {
        iconAcademic.classList.remove('hidden');
        document.body.classList.remove('dark');
        document.documentElement.classList.remove('dark');
    } else {
        iconSun.classList.remove('hidden');
        // Let's keep it simple for now, 'academic' is light but different colors
        document.body.classList.remove('dark');
        document.documentElement.classList.remove('dark');
    }
}

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', () => {
        AppState.theme = AppState.theme === 'child' ? 'academic' : 'child';
        saveState();
        applyTheme(AppState.theme);
        // Force re-render to apply color changes accurately if needed
        navigate(AppState.currentView);
    });
}

function showToast(message, type = 'info', options = {}) {
    const container = document.getElementById('inline-alert-container');
    if (!container) return;

    let colorClass = 'bg-slate-50 border-slate-200 text-slate-800';
    let icon = 'info';

    if (type === 'success') {
        colorClass = 'bg-green-50 border-green-200 text-green-900';
        icon = 'check-circle';
    } else if (type === 'error') {
        colorClass = 'bg-red-50 border-red-200 text-red-900';
        icon = 'alert-triangle';
    } else if (type === 'info') {
        colorClass = 'bg-indigo-50 border-indigo-200 text-indigo-900';
        icon = 'info';
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="flex items-start justify-between gap-3 px-4 py-3 rounded-xl border shadow-sm ${colorClass}">
            <div class="flex items-start">
                <i data-lucide="${icon}" class="w-5 h-5 mr-3 mt-0.5 shrink-0"></i>
                <p class="text-sm font-medium">${message}</p>
            </div>
            <div class="flex items-center gap-2">
                ${options.actionLabel ? `
                    <button id="inline-alert-action" class="text-xs font-bold px-2 py-1 rounded-md bg-white/70 hover:bg-white transition-colors">
                        ${escapeHtml(options.actionLabel)}
                    </button>
                ` : ''}
                <button id="inline-alert-close" class="p-1 rounded-md hover:bg-black/5 transition-colors" aria-label="Mesajı kapat">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
    lucide.createIcons({ root: container });

    const closeBtn = document.getElementById('inline-alert-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            container.classList.add('hidden');
            container.innerHTML = '';
        });
    }

    const actionBtn = document.getElementById('inline-alert-action');
    if (actionBtn && typeof options.onAction === 'function') {
        actionBtn.addEventListener('click', async () => {
            try {
                await options.onAction();
            } catch (err) {
                console.error('Alert action error:', err);
            }
        });
    }
}

async function logReading(newPage, noteText) {
    if (!AppState.data.activeBook || !AppState.data.activeBook.edition_id) {
        showToast('Önce bir kitabı aktif okumana eklemelisin.', 'error');
        return;
    }
    const deltaStr = newPage - AppState.data.activeBook.current_page;
    if (deltaStr <= 0) {
        showToast('Yeni sayfa mevcut sayfadan büyük olmalıdır.', 'error');
        return;
    }

    showToast('Okuma kaydediliyor...', 'info');

    try {
        const prevPage = Number(AppState.data.activeBook.current_page) || 0;
        const logRes = await apiCall({
            action: 'log_read',
            resource: 'k_t_read_logs',
            data: {
                book_isbn: AppState.data.activeBook.edition_id,
                pages_read: deltaStr,
                note: noteText,
                read_date: new Date().toISOString().split('T')[0]
            }
        });
        const logRows = normalizeApiDataArray(logRes);
        const insertedLogId = logRows[0]?.id || null;

        // Update local state and dynamically refresh dashboard
        AppState.data.activeBook.current_page = newPage;
        AppState.data.lastReadAction = {
            log_id: insertedLogId,
            isbn: AppState.data.activeBook.edition_id,
            prev_page: prevPage,
            new_page: newPage,
            pages_read: deltaStr
        };

        closeReadingLogModal();
        renderStudentDashboard(document.getElementById('view-container'));

        // Demonstration of canvas-confetti
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#6366f1', '#10b981', '#ef4444']
        });

        showToast(`Harika! ${deltaStr} sayfa daha okudun.`, 'success', {
            actionLabel: 'Geri Al',
            onAction: async () => {
                await undoLastReadAction();
            }
        });
        await syncBadgeAchievements(true);

    } catch (err) {
        console.error('Log reading error:', err);
    }
}

async function undoLastReadAction() {
    const last = AppState.data.lastReadAction;
    if (!last) {
        showToast('Geri alınacak bir okuma kaydı bulunamadı.', 'info');
        return;
    }

    // MVP simülasyonu: backend aksiyonu çağrılır; destek yoksa yerelde geri alınır.
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                action: 'undo_read_log',
                resource: 'k_t_read_logs',
                data: { log_id: last.log_id, isbn: last.isbn, pages_read: last.pages_read },
                user_id: AppState.user?.id || null
            })
        });
    } catch (err) {
        console.warn('undo_read_log simülasyonu backend tarafında başarısız:', err);
    }

    if (AppState.data.activeBook && AppState.data.activeBook.edition_id === last.isbn) {
        AppState.data.activeBook.current_page = Math.max(0, Number(last.prev_page) || 0);
    }
    AppState.data.lastReadAction = null;

    await renderStudentDashboard(document.getElementById('view-container'));
    showToast('Son okuma girişi geri alındı.', 'info');
}

function logout() {
    AppState.user = null;
    saveState();
    navigate('login');
    showToast('Başarıyla çıkış yapıldı.', 'success');
}
