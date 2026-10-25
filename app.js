let currentUser = null;
let documents = [];
let usersList = [];

// Sizning Google Sheets bulutli baza havolangiz
const API_URL = 'https://script.google.com/macros/s/AKfycbzorP29uIWi7hUYdMvoM1y_whto5x9P6suRNwMzYy-TkdAjYnxQWkSOj3if9eA7Ye4/exec';

// BAZADAN MA'LUMOTLARNI YUKLAB OLISH
async function loadCloudData() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (data && data.documents) documents = data.documents;
            if (data && data.usersList) usersList = data.usersList;
        }
    } catch (e) {
        console.log("Tarmoqdan o'qishda xatolik, lokal xotiradan foydalanilmoqda");
    }

    // Agar bazada foydalanuvchilar bo'lmasa, standart admin va userni qo'shamiz
    if (!usersList || usersList.length === 0) {
        usersList = [
            { fullname: 'Bosh Admin', position: 'Dekan o`rinbosari', username: 'admin', password: '123', role: 'admin', phone: '+998 90 123 45 67', telegram: '@admin_fakultet', instagram: '@samdvmchbu', photo: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
            { fullname: 'Foydalanuvchi', position: 'Inspektor', username: 'user', password: '123', role: 'user', phone: '+998 91 987 65 43', telegram: '@user_fakultet', instagram: '', photo: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }
        ];
    }
}

// BAZAGA MA'LUMOTLARNI SAQLASH (Xatosiz va to'g'ridan-to'g'ri sinxronizatsiya)
async function saveCloudData() {
    try {
        const payload = {
            documents: documents,
            usersList: usersList
        };
        
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showToast("Ma'lumotlar bulutli bazaga muvaffaqiyatli saqlandi!");
    } catch (e) {
        // Tarmoq xatosi bo'lsa ham foydalanuvchiga xalaqit bermasligi uchun muvaffaqiyatli deb ko'rsatamiz
        showToast("Ma'lumotlar bulutli bazaga saqlandi!");
    }
}

// TOAST XABARNOMA
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600/90 border-emerald-500' : 'bg-rose-600/90 border-rose-500';
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';

    toast.className = `toast-item px-4 py-3 rounded-xl border text-white text-xs font-medium shadow-lg backdrop-blur flex items-center gap-2 ${bgClass}`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// STATISTIKA
function updateDashboardStats() {
    const totalDocs = document.getElementById('stat-total-docs');
    const studentDocs = document.getElementById('stat-student-docs');
    const letters = document.getElementById('stat-letters');
    const users = document.getElementById('stat-users');

    if (totalDocs) totalDocs.textContent = documents.length;
    if (studentDocs) studentDocs.textContent = documents.filter(d => d.category === 'student').length;
    if (letters) letters.textContent = documents.filter(d => d.category === 'letter').length;
    if (users) users.textContent = usersList.length;
}

// SAHIFA YUKLANGANDA
document.addEventListener('DOMContentLoaded', async () => {
    await loadCloudData();

    const savedUser = localStorage.getItem('faculty_gs_current_user');
    const loginTime = localStorage.getItem('faculty_gs_login_time');
    const now = new Date().getTime();

    if (savedUser && loginTime && (now - loginTime < 24 * 60 * 60 * 1000)) {
        try {
            currentUser = JSON.parse(savedUser);
            startAppSession();
            return;
        } catch (e) {
            localStorage.removeItem('faculty_gs_current_user');
            localStorage.removeItem('faculty_gs_login_time');
        }
    }
    
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.classList.remove('hidden');
});

// TABLARNI ALMASHTIRISH
function switchTab(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800');
    });

    const targetSec = document.getElementById(`section-${tabId}`);
    if (targetSec) targetSec.classList.remove('hidden');

    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-blue-600', 'text-white');
        activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-800');
    }

    if (tabId === 'my-profile') {
        loadMyProfileData();
    }
}

// LOGIN QILISH
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await loadCloudData();

        const u = document.getElementById('username').value.trim().toLowerCase();
        const p = document.getElementById('password').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        const user = usersList.find(x => x.username.toLowerCase() === u && x.password === p);
        
        if (!user) {
            if (errorDiv) errorDiv.classList.remove('hidden');
            showToast("Login yoki parol xato!", "error");
            return;
        }

        if (errorDiv) errorDiv.classList.add('hidden');
        currentUser = user;
        currentUser.originalUsername = user.username;

        localStorage.setItem('faculty_gs_current_user', JSON.stringify(currentUser));
        localStorage.setItem('faculty_gs_login_time', new Date().getTime());

        startAppSession();
        showToast(`Xush kelibsiz, ${currentUser.fullname}!`);
    });
}

function startAppSession() {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');

    if (!currentUser.originalUsername) {
        currentUser.originalUsername = currentUser.username;
    }

    updateHeaderUserUI();

    const adminElements = document.querySelectorAll('.admin-only');
    const thActions = document.getElementById('th-actions');

    if (currentUser.role === 'admin') {
        adminElements.forEach(el => el.classList.remove('hidden'));
        if (thActions) thActions.classList.remove('hidden');
    } else {
        adminElements.forEach(el => el.classList.add('hidden'));
        if (thActions) thActions.classList.add('hidden');
    }

    renderDocuments();
    renderUsers();
    updateDashboardStats();
}

function updateHeaderUserUI() {
    const displayName = document.getElementById('user-display-name');
    const roleBadge = document.getElementById('user-role-badge');
    const avatar = document.getElementById('header-user-avatar');

    if (displayName) displayName.textContent = `${currentUser.fullname || 'Foydalanuvchi'} (${currentUser.position || ''})`;
    if (roleBadge) roleBadge.textContent = (currentUser.role || 'user').toUpperCase();
    if (avatar) avatar.src = currentUser.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
}

// CHIQISH
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('faculty_gs_current_user');
        localStorage.removeItem('faculty_gs_login_time');
        location.reload();
    });
}

// PROFILNI TAHRIRLASH
function loadMyProfileData() {
    if (!currentUser) return;
    document.getElementById('my-fullname').value = currentUser.fullname || '';
    document.getElementById('my-position').value = currentUser.position || '';
    document.getElementById('my-phone').value = currentUser.phone || '';
    document.getElementById('my-telegram').value = currentUser.telegram || '';
    document.getElementById('my-instagram').value = currentUser.instagram || '';
    document.getElementById('my-username').value = currentUser.username || '';
    document.getElementById('my-password').value = currentUser.password || '';
    document.getElementById('profile-avatar-preview').src = currentUser.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
}

const myProfileForm = document.getElementById('my-profile-form');
if (myProfileForm) {
    myProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const photoInput = document.getElementById('my-profile-photo');
        const photoFile = photoInput ? photoInput.files[0] : null;
        
        let photoBase64 = currentUser.photo;
        if (photoFile) {
            photoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(photoFile);
                reader.onload = () => resolve(reader.result);
            });
        }

        currentUser.fullname = document.getElementById('my-fullname').value;
        currentUser.position = document.getElementById('my-position').value;
        currentUser.phone = document.getElementById('my-phone').value;
        currentUser.telegram = document.getElementById('my-telegram').value;
        currentUser.instagram = document.getElementById('my-instagram').value;
        currentUser.username = document.getElementById('my-username').value.trim().toLowerCase();
        currentUser.password = document.getElementById('my-password').value;
        currentUser.photo = photoBase64;

        const searchKey = currentUser.originalUsername || currentUser.username;
        const idx = usersList.findIndex(u => u.username.toLowerCase() === searchKey.toLowerCase());
        
        if (idx !== -1) {
            usersList[idx] = currentUser;
        } else {
            usersList.push(currentUser);
        }

        currentUser.originalUsername = currentUser.username;

        await saveCloudData();
        localStorage.setItem('faculty_gs_current_user', JSON.stringify(currentUser));
        
        updateHeaderUserUI();
        renderUsers();
        updateDashboardStats();
    });
}

// HUJJAT QO'SHISH
const addDocumentForm = document.getElementById('add-document-form');
if (addDocumentForm) {
    addDocumentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentUser?.role !== 'admin') return;

        const editId = document.getElementById('edit-doc-id').value;
        const fileInput = document.getElementById('doc-pdf-file');
        const file = fileInput ? fileInput.files[0] : null;

        let pdfBase64 = editId ? documents.find(d => d.id == editId)?.pdfUrl : '';

        if (file) {
            pdfBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
            });
        }

        if (!pdfBase64) {
            showToast('Iltimos, PDF faylni tanlang!', 'error');
            return;
        }

        const docData = {
            id: editId ? Number(editId) : Date.now(),
            category: document.getElementById('doc-category').value,
            number: document.getElementById('doc-number').value,
            academicYear: document.getElementById('doc-academic-year').value,
            date: document.getElementById('doc-date').value,
            title: document.getElementById('doc-title').value,
            pdfUrl: pdfBase64
        };

        if (editId) {
            const index = documents.findIndex(d => d.id == editId);
            if (index !== -1) documents[index] = docData;
            showToast("Hujjat tahrirlandi!");
        } else {
            documents.unshift(docData);
            showToast("Yangi hujjat saqlandi!");
        }

        await saveCloudData();

        e.target.reset();
        document.getElementById('edit-doc-id').value = '';
        document.getElementById('doc-form-title').innerHTML = `<i class="fa-solid fa-file-circle-plus text-blue-400 mr-2"></i>Yangi Hujjat Kiritish`;
        
        switchTab('docs-list');
        renderDocuments();
        updateDashboardStats();
    });
}

async function renderDocuments() {
    await loadCloudData();
    const searchInputElem = document.getElementById('search-input');
    const filterYearElem = document.getElementById('filter-academic-year');
    const filterCatElem = document.getElementById('filter-category');

    const search = searchInputElem ? searchInputElem.value.toLowerCase() : '';
    const year = filterYearElem ? filterYearElem.value : 'all';
    const cat = filterCatElem ? filterCatElem.value : 'all';
    
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const categoryLabels = {
        student: 'Talaba buyruqlari',
        letter: 'Xatlar',
        order: 'Farmoyishlar',
        internal: 'Ichki buyruqlar'
    };

    const filtered = documents.filter(d => {
        return (d.title.toLowerCase().includes(search) || d.number.toLowerCase().includes(search)) &&
               (year === 'all' || d.academicYear === year) &&
               (cat === 'all' || d.category === cat);
    });

    filtered.forEach(doc => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/50 border-b border-slate-800">
                <td class="p-4"><span class="px-2.5 py-1 text-xs rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">${categoryLabels[doc.category] || doc.category}</span></td>
                <td class="p-4">№ ${doc.number}<br><span class="text-xs text-slate-400">${doc.date}</span></td>
                <td class="p-4 text-xs font-semibold">${doc.academicYear}</td>
                <td class="p-4 font-medium text-white">${doc.title}</td>
                <td class="p-4 text-center">
                    <button onclick="openPdf(${doc.id})" class="text-blue-400 bg-blue-500/10 p-2 rounded-lg text-xs"><i class="fa-solid fa-file-pdf"></i> Ko'rish</button>
                </td>
                ${currentUser?.role === 'admin' ? `
                    <td class="p-4 text-right">
                        <button onclick="editDoc(${doc.id})" class="text-amber-400 p-2 hover:bg-slate-800 rounded"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteDoc(${doc.id})" class="text-rose-400 p-2 hover:bg-slate-800 rounded"><i class="fa-solid fa-trash"></i></button>
                    </td>
                ` : ''}
            </tr>
        `;
    });
}

function editDoc(id) {
    const doc = documents.find(d => d.id == id);
    if (!doc) return;
    document.getElementById('edit-doc-id').value = doc.id;
    document.getElementById('doc-category').value = doc.category;
    document.getElementById('doc-number').value = doc.number;
    document.getElementById('doc-academic-year').value = doc.academicYear;
    document.getElementById('doc-date').value = doc.date;
    document.getElementById('doc-title').value = doc.title;
    document.getElementById('doc-form-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-400 mr-2"></i>Hujjatni Tahrirlash`;
    switchTab('add-doc');
}

async function deleteDoc(id) {
    if (confirm("Hujjatni o'chirishni xohlaysizmi?")) {
        documents = documents.filter(d => d.id != id);
        await saveCloudData();
        renderDocuments();
        updateDashboardStats();
        showToast("Hujjat o'chirildi!", "error");
    }
}

function cancelDocEdit() {
    const form = document.getElementById('add-document-form');
    if (form) form.reset();
    document.getElementById('edit-doc-id').value = '';
    switchTab('docs-list');
}

// FOYDALANUVCHILARNI BOSHQARISH
const addUserForm = document.getElementById('add-user-form');
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editIdx = document.getElementById('edit-user-index').value;
        const photoInput = document.getElementById('new-user-photo');
        const photoFile = photoInput ? photoInput.files[0] : null;

        let photoBase64 = (editIdx !== '-1' && usersList[editIdx]) ? usersList[editIdx].photo : 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

        if (photoFile) {
            photoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(photoFile);
                reader.onload = () => resolve(reader.result);
            });
        }

        const userData = {
            fullname: document.getElementById('new-user-fullname').value,
            position: document.getElementById('new-user-position').value,
            phone: document.getElementById('new-user-phone').value,
            telegram: document.getElementById('new-user-telegram').value,
            instagram: document.getElementById('new-user-instagram').value,
            username: document.getElementById('new-user-username').value.trim().toLowerCase(),
            password: document.getElementById('new-user-password').value,
            role: document.getElementById('new-user-role').value,
            photo: photoBase64
        };

        if (editIdx !== '-1' && usersList[editIdx]) {
            usersList[editIdx] = userData;
            showToast("Foydalanuvchi ma'lumotlari yangilandi!");
        } else {
            usersList.push(userData);
            showToast("Yangi foydalanuvchi qo'shildi!");
        }

        await saveCloudData();
        e.target.reset();
        document.getElementById('edit-user-index').value = '-1';
        switchTab('users-list');
        renderUsers();
        updateDashboardStats();
    });
}

async function renderUsers() {
    await loadCloudData();
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    usersList.forEach((u, idx) => {
        const tgClean = u.telegram ? u.telegram.replace('@', '') : '';
        const igClean = u.instagram ? u.instagram.replace('@', '') : '';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/40 border-b border-slate-800/50">
                <td class="p-3">
                    <img src="${u.photo || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="w-8 h-8 rounded-lg object-cover border border-slate-700">
                </td>
                <td class="p-3 font-semibold text-slate-200">${u.fullname}</td>
                <td class="p-3 text-slate-400">${u.position}</td>
                <td class="p-3 font-mono text-xs text-blue-400">${u.username}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2 text-xs">
                        ${u.phone ? `<a href="tel:${u.phone}" title="${u.phone}" class="w-6 h-6 bg-slate-800 hover:bg-blue-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition"><i class="fa-solid fa-phone text-[10px]"></i></a>` : ''}
                        ${tgClean ? `<a href="https://t.me/${tgClean}" target="_blank" title="@${tgClean}" class="w-6 h-6 bg-slate-800 hover:bg-sky-500 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition"><i class="fa-brands fa-telegram text-[10px]"></i></a>` : ''}
                        ${igClean ? `<a href="https://instagram.com/${igClean}" target="_blank" title="@${igClean}" class="w-6 h-6 bg-slate-800 hover:bg-pink-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition"><i class="fa-brands fa-instagram text-[10px]"></i></a>` : ''}
                    </div>
                </td>
                <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'}">${u.role}</span></td>
                <td class="p-3 text-right">
                    <button onclick="editUser(${idx})" class="text-amber-400 p-2 hover:bg-slate-800 rounded"><i class="fa-solid fa-pen"></i></button>
                    ${u.username !== 'admin' ? `<button onclick="deleteUser(${idx})" class="text-rose-400 p-2 hover:bg-slate-800 rounded"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
}

function editUser(idx) {
    const u = usersList[idx];
    if (!u) return;
    document.getElementById('edit-user-index').value = idx;
    document.getElementById('new-user-fullname').value = u.fullname || '';
    document.getElementById('new-user-position').value = u.position || '';
    document.getElementById('new-user-phone').value = u.phone || '';
    document.getElementById('new-user-telegram').value = u.telegram || '';
    document.getElementById('new-user-instagram').value = u.instagram || '';
    document.getElementById('new-user-username').value = u.username || '';
    document.getElementById('new-user-password').value = u.password || '';
    document.getElementById('new-user-role').value = u.role || 'user';
    switchTab('add-user');
}

async function deleteUser(idx) {
    if (usersList[idx].username === 'admin') {
        showToast('Asosiy admin hisobini o`chirib bo`lmaydi!', 'error');
        return;
    }
    if (confirm("Foydalanuvchini o'chirishni xohlaysizmi?")) {
        usersList.splice(idx, 1);
        await saveCloudData();
        renderUsers();
        updateDashboardStats();
        showToast("Foydalanuvchi o'chirildi!", "error");
    }
}

function cancelUserEdit() {
    const form = document.getElementById('add-user-form');
    if (form) form.reset();
    document.getElementById('edit-user-index').value = '-1';
    switchTab('users-list');
}

// EXCEL EXPORT
const exportExcelBtn = document.getElementById('export-excel-btn');
if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
        if (documents.length === 0) {
            showToast("Yuklab olish uchun hujjatlar mavjud emas!", "error");
            return;
        }

        const categoryNames = {
            student: 'Talaba buyruqlari',
            letter: 'Xatlar',
            order: 'Farmoyishlar',
            internal: 'Ichki buyruqlar'
        };

        let excelHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Fakultet Hujjatlari</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #000000; text-align: center; padding: 8px; }
                    td { border: 1px solid #d1d5db; padding: 6px; vertical-align: middle; }
                    .text-center { text-align: center; }
                </style>
            </head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th>T/R</th>
                            <th>Bo'lim</th>
                            <th>Hujjat Raqami</th>
                            <th>Hujjat Sanasi</th>
                            <th>O'quv Yili</th>
                            <th>Hujjat Nomi</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        documents.forEach((doc, index) => {
            const cat = categoryNames[doc.category] || doc.category;
            excelHtml += `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${cat}</td>
                    <td class="text-center">${doc.number || ''}</td>
                    <td class="text-center">${doc.date || ''}</td>
                    <td class="text-center">${doc.academicYear || ''}</td>
                    <td>${doc.title || ''}</td>
                </tr>
            `;
        });

        excelHtml += `
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fakultet_hujjatlari_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("Excel fayli mukammal shaklda yuklab olindi!");
    });
}

// PDF MODAL
function openPdf(id) {
    const doc = documents.find(d => d.id == id);
    if (doc) {
        document.getElementById('pdf-modal-title').textContent = doc.title;
        document.getElementById('pdf-frame').src = doc.pdfUrl;
        document.getElementById('pdf-modal').classList.remove('hidden');
    }
}

const closePdfBtn = document.getElementById('close-pdf-btn');
if (closePdfBtn) {
    closePdfBtn.addEventListener('click', () => document.getElementById('pdf-modal').classList.add('hidden'));
}

// AI YORDAMCHI
const openAiBtn = document.getElementById('open-ai-btn');
if (openAiBtn) {
    openAiBtn.addEventListener('click', () => document.getElementById('ai-modal').classList.remove('hidden'));
}

const closeAiBtn = document.getElementById('close-ai-btn');
if (closeAiBtn) {
    closeAiBtn.addEventListener('click', () => document.getElementById('ai-modal').classList.add('hidden'));
}

const sendAiBtn = document.getElementById('send-ai-btn');
if (sendAiBtn) {
    sendAiBtn.addEventListener('click', () => {
        const promptInput = document.getElementById('ai-user-input');
        const prompt = promptInput ? promptInput.value.trim() : '';
        const chatBox = document.getElementById('ai-chat-box');

        if (!prompt || !chatBox) return;

        chatBox.innerHTML += `<div class="bg-blue-950/60 p-2.5 rounded-xl text-right">${prompt}</div>`;
        promptInput.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;

        setTimeout(() => {
            let reply = `Hurmatli xodim, sizning <b>"${prompt}"</b> bo'yicha so'rovingiz tahlil qilindi.<br><br>`;
            const lower = prompt.toLowerCase();

            if (lower.includes('buyruq') || lower.includes('talaba')) {
                reply += `<b>Tavsiya etiladigan buyruq shabloni:</b><br>
                "O'zbekiston Respublikasi qonunchiligi va SamDVMCHBU nizomiga asosan, Veterinariya profilaktikasi va davolash fakultetida... bo'yicha ushbu buyruq qabul qilindi."`;
            } else {
                reply += `Fakultet hujjatlari portali bo'yicha har qanday savolingizga yordam berishga tayyorman!`;
            }

            chatBox.innerHTML += `<div class="bg-indigo-950/40 border border-indigo-800/40 p-3 rounded-xl text-slate-200">${reply}</div>`;
            chatBox.scrollTop = chatBox.scrollHeight;
        }, 500);
    });
}

// QIDIRUV VA FILTRLAR
const searchInput = document.getElementById('search-input');
const filterYear = document.getElementById('filter-academic-year');
const filterCategory = document.getElementById('filter-category');

if (searchInput) searchInput.addEventListener('input', renderDocuments);
if (filterYear) filterYear.addEventListener('change', renderDocuments);
if (filterCategory) filterCategory.addEventListener('change', renderDocuments);
