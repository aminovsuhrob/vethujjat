// Firebase konfiguratsiyasi
const firebaseConfig = {
    apiKey: "AIzaSyBvjW1sZlK_La1iga0opVAoVF9bnWwBtLI",
    authDomain: "fakultet-hujjatlari.firebaseapp.com",
    projectId: "fakultet-hujjatlari",
    storageBucket: "fakultet-hujjatlari.firebasestorage.app",
    messagingSenderId: "459968500801",
    appId: "1:459968500801:web:23d71ca4864cc139f4a2c0",
    measurementId: "G-X9JFVWKDYC"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const facultyRef = db.ref("faculty_data");

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

// Tezkorlik uchun darhol keshdan o'qiymiz
let currentUser = null;
let documents = JSON.parse(localStorage.getItem('faculty_cache_docs')) || [];
let usersList = JSON.parse(localStorage.getItem('faculty_cache_users')) || [];
let cloudReady = false;
let cloudError = false;
let isSaving = false;
let saveQueue = Promise.resolve();
let currentUserOriginalUsername = null;

const DEFAULT_USERS = [
    {
        fullname: "Bosh Admin",
        position: "Dekan o'rinbosari",
        username: "admin",
        password: "123",
        role: "admin",
        phone: "+998 90 123 45 67",
        telegram: "@admin_fakultet",
        instagram: "@samdvmchbu",
        photo: DEFAULT_AVATAR
    },
    {
        fullname: "Foydalanuvchi",
        position: "Inspektor",
        username: "user",
        password: "123",
        role: "user",
        phone: "+998 91 987 65 43",
        telegram: "@user_fakultet",
        instagram: "",
        photo: DEFAULT_AVATAR
    }
];

if (usersList.length === 0) {
    usersList = DEFAULT_USERS.map(normalizeUser);
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) {
        console.log(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = "toast-item px-4 py-3 rounded-xl border text-white text-xs font-medium shadow-lg backdrop-blur flex items-center gap-2 " +
        (type === "success" ? "bg-emerald-600/90 border-emerald-500" : "bg-rose-600/90 border-rose-500");

    const icon = document.createElement("i");
    icon.className = "fa-solid " + (type === "success" ? "fa-circle-check" : "fa-circle-exclamation");

    const span = document.createElement("span");
    span.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };
        return entities[char];
    });
}

function normalizeUser(user) {
    return {
        fullname: user.fullname || "Foydalanuvchi",
        position: user.position || "",
        username: String(user.username || "").trim().toLowerCase(),
        password: user.password || "",
        role: user.role === "admin" ? "admin" : "user",
        phone: user.phone || "",
        telegram: user.telegram || "",
        instagram: user.instagram || "",
        photo: user.photo || DEFAULT_AVATAR
    };
}

function updateDashboardStats() {
    const totalDocs = document.getElementById("stat-total-docs");
    const studentDocs = document.getElementById("stat-student-docs");
    const letters = document.getElementById("stat-letters");
    const users = document.getElementById("stat-users");

    if (totalDocs) totalDocs.textContent = documents.length;
    if (studentDocs) studentDocs.textContent = documents.filter(d => d.category === "student").length;
    if (letters) letters.textContent = documents.filter(d => d.category === "letter").length;
    if (users) users.textContent = usersList.length;
}

function initCloudSync() {
    return facultyRef.once("value")
        .then(async function(snapshot) {
            const data = snapshot.val();
            if (data) {
                documents = Array.isArray(data.documents) ? data.documents : [];
                usersList = Array.isArray(data.usersList) ? data.usersList.map(normalizeUser) : DEFAULT_USERS.map(normalizeUser);
            } else {
                documents = [];
                usersList = DEFAULT_USERS.map(normalizeUser);
                await facultyRef.set({
                    documents: documents,
                    usersList: usersList
                });
            }

            localStorage.setItem('faculty_cache_docs', JSON.stringify(documents));
            localStorage.setItem('faculty_cache_users', JSON.stringify(usersList));

            cloudReady = true;
            cloudError = false;

            renderDocuments();
            renderUsers();
            updateDashboardStats();

            return true;
        })
        .catch(function(error) {
            cloudReady = false;
            cloudError = true;
            console.error("Firebase yuklash xatosi:", error);
            showToast("Firebase bilan bog'lanishda xatolik yuz berdi!", "error");
            return false;
        });
}

async function saveCloudData() {
    const payload = {
        documents: documents,
        usersList: usersList
    };

    localStorage.setItem('faculty_cache_docs', JSON.stringify(documents));
    localStorage.setItem('faculty_cache_users', JSON.stringify(usersList));

    saveQueue = saveQueue.then(async function() {
        isSaving = true;
        try {
            await facultyRef.set(payload);
            return true;
        } catch (error) {
            console.error("Firebase saqlash xatosi:", error);
            showToast("Ma'lumotlarni saqlashda xatolik!", "error");
            return false;
        } finally {
            isSaving = false;
        }
    });

    return saveQueue;
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-section").forEach(function(section) {
        section.classList.add("hidden");
    });

    document.querySelectorAll(".tab-btn").forEach(function(button) {
        button.classList.remove("bg-blue-600", "text-white");
        button.classList.add("text-slate-400", "hover:bg-slate-800");
    });

    const targetSection = document.getElementById("section-" + tabId);
    if (targetSection) targetSection.classList.remove("hidden");

    const activeButton = document.getElementById("tab-btn-" + tabId);
    if (activeButton) {
        activeButton.classList.add("bg-blue-600", "text-white");
        activeButton.classList.remove("text-slate-400", "hover:bg-slate-800");
    }

    if (tabId === "my-profile") loadMyProfileData();
    if (tabId === "docs-list") renderDocuments();
    if (tabId === "users-list") renderUsers();
}

function startAppSession() {
    if (!currentUser) return;

    const loginScreen = document.getElementById("login-screen");
    const appContent = document.getElementById("app-content");

    if (loginScreen) loginScreen.classList.add("hidden");
    if (appContent) appContent.classList.remove("hidden");

    updateHeaderUserUI();

    const isAdmin = currentUser.role === "admin";
    document.querySelectorAll(".admin-only").forEach(function(element) {
        element.classList.toggle("hidden", !isAdmin);
    });

    const actionsHeader = document.getElementById("th-actions");
    if (actionsHeader) actionsHeader.classList.toggle("hidden", !isAdmin);

    renderDocuments();
    renderUsers();
    updateDashboardStats();
}

function updateHeaderUserUI() {
    if (!currentUser) return;

    const displayName = document.getElementById("user-display-name");
    const roleBadge = document.getElementById("user-role-badge");
    const avatar = document.getElementById("header-user-avatar");

    if (displayName) displayName.textContent = (currentUser.fullname || "Foydalanuvchi") + " (" + (currentUser.position || "") + ")";
    if (roleBadge) roleBadge.textContent = (currentUser.role || "user").toUpperCase();
    if (avatar) avatar.src = currentUser.photo || DEFAULT_AVATAR;
}

function loadMyProfileData() {
    if (!currentUser) return;

    const fields = {
        "my-fullname": currentUser.fullname,
        "my-position": currentUser.position,
        "my-phone": currentUser.phone,
        "my-telegram": currentUser.telegram,
        "my-instagram": currentUser.instagram,
        "my-username": currentUser.username,
        "my-password": currentUser.password
    };

    Object.entries(fields).forEach(function(entry) {
        const element = document.getElementById(entry[0]);
        if (element) element.value = entry[1] || "";
    });

    const preview = document.getElementById("profile-avatar-preview");
    if (preview) preview.src = currentUser.photo || DEFAULT_AVATAR;
}

function renderDocuments() {
    const tbody = document.getElementById("documents-table-body");
    if (!tbody) return;

    const searchElement = document.getElementById("search-input");
    const yearElement = document.getElementById("filter-academic-year");
    const categoryElement = document.getElementById("filter-category");

    const search = searchElement ? searchElement.value.trim().toLowerCase() : "";
    const year = yearElement ? yearElement.value : "all";
    const category = categoryElement ? categoryElement.value : "all";

    const categoryLabels = {
        student: "Talaba buyruqlari",
        letter: "Xatlar",
        order: "Farmoyishlar",
        internal: "Ichki buyruqlar"
    };

    const filtered = documents.filter(function(doc) {
        const title = String(doc.title || "").toLowerCase();
        const number = String(doc.number || "").toLowerCase();
        return (
            (title.includes(search) || number.includes(search)) &&
            (year === "all" || doc.academicYear === year) &&
            (category === "all" || doc.category === category)
        );
    });

    // Ko'p hujjatlarda interfeys qotib qolmasligi uchun dastlabki 100 tasi tezkor render qilinadi
    const paginated = filtered.slice(0, 100);
    const isAdmin = currentUser && currentUser.role === "admin";

    tbody.innerHTML = paginated.map(function(doc) {
        return `
            <tr class="hover:bg-slate-800/50 border-b border-slate-800">
                <td class="p-4">
                    <span class="px-2.5 py-1 text-xs rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        ${escapeHTML(categoryLabels[doc.category] || doc.category)}
                    </span>
                </td>
                <td class="p-4">
                    № ${escapeHTML(doc.number)}
                    <br>
                    <span class="text-xs text-slate-400">${escapeHTML(doc.date)}</span>
                </td>
                <td class="p-4 text-xs font-semibold">${escapeHTML(doc.academicYear)}</td>
                <td class="p-4 font-medium text-white">${escapeHTML(doc.title)}</td>
                <td class="p-4 text-center">
                    <button type="button" data-action="open-pdf" data-id="${Number(doc.id)}" class="text-blue-400 bg-blue-500/10 p-2 rounded-lg text-xs">
                        <i class="fa-solid fa-file-pdf"></i> Ko'rish
                    </button>
                </td>
                ${isAdmin ? `
                    <td class="p-4 text-right">
                        <button type="button" data-action="edit-doc" data-id="${Number(doc.id)}" class="text-amber-400 p-2 hover:bg-slate-800 rounded">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" data-action="delete-doc" data-id="${Number(doc.id)}" class="text-rose-400 p-2 hover:bg-slate-800 rounded">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                ` : ""}
            </tr>
        `;
    }).join("");

    updateDashboardStats();
}

function editDoc(id) {
    if (!currentUser || currentUser.role !== "admin") return;
    const doc = documents.find(item => item.id == id);
    if (!doc) return;

    const fields = {
        "edit-doc-id": doc.id,
        "doc-category": doc.category,
        "doc-number": doc.number,
        "doc-academic-year": doc.academicYear,
        "doc-date": doc.date,
        "doc-title": doc.title
    };

    Object.entries(fields).forEach(function(entry) {
        const element = document.getElementById(entry[0]);
        if (element) element.value = entry[1] || "";
    });

    const title = document.getElementById("doc-form-title");
    if (title) {
        title.innerHTML = '<i class="fa-solid fa-pen-to-square text-amber-400 mr-2"></i>Hujjatni tahrirlash';
    }

    switchTab("add-doc");
}

async function deleteDoc(id) {
    if (!currentUser || currentUser.role !== "admin") {
        showToast("Bu amal faqat administrator uchun!", "error");
        return;
    }

    if (!confirm("Hujjatni o'chirishni xohlaysizmi?")) return;

    const oldDocuments = documents.slice();
    documents = documents.filter(doc => doc.id != id);
    renderDocuments();

    const saved = await saveCloudData();
    if (saved) {
        showToast("Hujjat o'chirildi!");
    } else {
        documents = oldDocuments;
        renderDocuments();
    }
}

function cancelDocEdit() {
    const form = document.getElementById("add-document-form");
    if (form) form.reset();
    const editId = document.getElementById("edit-doc-id");
    if (editId) editId.value = "";
    switchTab("docs-list");
}

function renderUsers() {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;

    const isAdmin = currentUser && currentUser.role === "admin";

    tbody.innerHTML = usersList.map(function(user, index) {
        const tg = String(user.telegram || "").replace(/^@/, "");
        const ig = String(user.instagram || "").replace(/^@/, "");
        const phone = String(user.phone || "");

        return `
            <tr class="hover:bg-slate-800/40 border-b border-slate-800/50">
                <td class="p-3">
                    <img src="${escapeHTML(user.photo || DEFAULT_AVATAR)}" class="w-8 h-8 rounded-lg object-cover border border-slate-700" alt="Profil">
                </td>
                <td class="p-3 font-semibold text-slate-200">${escapeHTML(user.fullname)}</td>
                <td class="p-3 text-slate-400">${escapeHTML(user.position)}</td>
                <td class="p-3 font-mono text-xs text-blue-400">${escapeHTML(user.username)}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2 text-xs">
                        ${phone ? `<a href="tel:${escapeHTML(phone)}" class="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center"><i class="fa-solid fa-phone"></i></a>` : ""}
                        ${tg ? `<a href="https://t.me/${encodeURIComponent(tg)}" target="_blank" class="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center"><i class="fa-brands fa-telegram"></i></a>` : ""}
                        ${ig ? `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" class="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center"><i class="fa-brands fa-instagram"></i></a>` : ""}
                    </div>
                </td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold ${user.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-slate-800 text-slate-400"}">
                        ${escapeHTML(user.role)}
                    </span>
                </td>
                ${isAdmin ? `
                    <td class="p-3 text-right">
                        <button type="button" data-action="edit-user" data-index="${index}" class="text-amber-400 p-2 hover:bg-slate-800 rounded">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        ${user.username !== "admin" ? `
                            <button type="button" data-action="delete-user" data-index="${index}" class="text-rose-400 p-2 hover:bg-slate-800 rounded">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ""}
                    </td>
                ` : ""}
            </tr>
        `;
    }).join("");

    updateDashboardStats();
}

function editUser(index) {
    if (!currentUser || currentUser.role !== "admin") return;
    const user = usersList[index];
    if (!user) return;

    const fields = {
        "edit-user-index": index,
        "new-user-fullname": user.fullname,
        "new-user-position": user.position,
        "new-user-phone": user.phone,
        "new-user-telegram": user.telegram,
        "new-user-instagram": user.instagram,
        "new-user-username": user.username,
        "new-user-password": user.password,
        "new-user-role": user.role
    };

    Object.entries(fields).forEach(function(entry) {
        const element = document.getElementById(entry[0]);
        if (element) element.value = entry[1] ?? "";
    });

    switchTab("add-user");
}

async function deleteUser(index) {
    if (!currentUser || currentUser.role !== "admin") return;
    const user = usersList[index];

    if (!user || user.username === "admin") {
        showToast("Asosiy administratorni o'chirib bo'lmaydi!", "error");
        return;
    }

    if (!confirm("Foydalanuvchini o'chirishni xohlaysizmi?")) return;

    const oldUsers = usersList.slice();
    usersList.splice(index, 1);
    renderUsers();

    const saved = await saveCloudData();
    if (saved) {
        showToast("Foydalanuvchi o'chirildi!");
    } else {
        usersList = oldUsers;
        renderUsers();
    }
}

function cancelUserEdit() {
    const form = document.getElementById("add-user-form");
    if (form) form.reset();
    const index = document.getElementById("edit-user-index");
    if (index) index.value = "-1";
    switchTab("users-list");
}

function openPdf(id) {
    const doc = documents.find(item => item.id == id);
    if (!doc || !doc.pdfUrl) {
        showToast("PDF fayli topilmadi!", "error");
        return;
    }

    const title = document.getElementById("pdf-modal-title");
    const frame = document.getElementById("pdf-frame");
    const modal = document.getElementById("pdf-modal");

    if (title) title.textContent = doc.title || "Hujjat";
    if (frame) frame.src = doc.pdfUrl;
    if (modal) modal.classList.remove("hidden");
}

function closePdfModal() {
    const modal = document.getElementById("pdf-modal");
    const frame = document.getElementById("pdf-frame");
    if (modal) modal.classList.add("hidden");
    if (frame) frame.src = "about:blank";
}

function readFileAsDataURL(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function() { reject(new Error("Faylni o'qib bo'lmadi.")); };
        reader.readAsDataURL(file);
    });
}

function bindFormEvents() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", function(event) {
            event.preventDefault();

            if (!cloudReady) {
                showToast("Ma'lumotlar yuklanishini kuting!", "error");
                return;
            }

            const username = document.getElementById("username")?.value.trim().toLowerCase();
            const password = document.getElementById("password")?.value;
            const errorDiv = document.getElementById("login-error");

            const user = usersList.find(item => item.username === username && item.password === password);

            if (!user) {
                if (errorDiv) errorDiv.classList.remove("hidden");
                showToast("Login yoki parol noto'g'ri!", "error");
                return;
            }

            if (errorDiv) errorDiv.classList.add("hidden");

            currentUser = user;
            currentUserOriginalUsername = user.username;

            localStorage.setItem("faculty_gs_current_user", JSON.stringify({ username: user.username }));
            startAppSession();
            showToast("Xush kelibsiz, " + user.fullname + "!");
        });
    }

    const logoutButton = document.getElementById("logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", function() {
            localStorage.removeItem("faculty_gs_current_user");
            currentUser = null;
            currentUserOriginalUsername = null;

            const app = document.getElementById("app-content");
            const login = document.getElementById("login-screen");

            if (app) app.classList.add("hidden");
            if (login) login.classList.remove("hidden");

            const form = document.getElementById("login-form");
            if (form) form.reset();

            showToast("Tizimdan chiqdingiz!");
        });
    }

    const profileForm = document.getElementById("my-profile-form");
    if (profileForm) {
        profileForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            if (!currentUser || !cloudReady) return;

            try {
                const photoInput = document.getElementById("my-profile-photo");
                const photoFile = photoInput?.files?.[0];
                let photo = currentUser.photo || DEFAULT_AVATAR;

                if (photoFile) {
                    if (!photoFile.type.startsWith("image/")) {
                        showToast("Rasm faylini tanlang!", "error");
                        return;
                    }
                    if (photoFile.size > 1024 * 1024) {
                        showToast("Profil rasmi 1 MB dan kichik bo'lishi kerak!", "error");
                        return;
                    }
                    photo = await readFileAsDataURL(photoFile);
                }

                const oldUsername = currentUserOriginalUsername || currentUser.username;
                const updatedUser = {
                    ...currentUser,
                    fullname: document.getElementById("my-fullname").value.trim(),
                    position: document.getElementById("my-position").value.trim(),
                    phone: document.getElementById("my-phone").value.trim(),
                    telegram: document.getElementById("my-telegram").value.trim(),
                    instagram: document.getElementById("my-instagram").value.trim(),
                    username: document.getElementById("my-username").value.trim().toLowerCase(),
                    password: document.getElementById("my-password").value,
                    photo: photo
                };

                if (!updatedUser.username || !updatedUser.password) {
                    showToast("Login va parol bo'sh bo'lmasligi kerak!", "error");
                    return;
                }

                const duplicate = usersList.some(user => user.username === updatedUser.username && user.username !== oldUsername);
                if (duplicate) {
                    showToast("Bu login boshqa foydalanuvchiga tegishli!", "error");
                    return;
                }

                const index = usersList.findIndex(user => user.username === oldUsername);
                if (index === -1) {
                    showToast("Foydalanuvchi topilmadi!", "error");
                    return;
                }

                usersList[index] = updatedUser;
                currentUser = updatedUser;
                currentUserOriginalUsername = updatedUser.username;

                const saved = await saveCloudData();
                if (!saved) return;

                localStorage.setItem("faculty_gs_current_user", JSON.stringify({ username: updatedUser.username }));

                updateHeaderUserUI();
                renderUsers();
                updateDashboardStats();
                showToast("Profil muvaffaqiyatli yangilandi!");
            } catch (error) {
                console.error(error);
                showToast("Profilni saqlashda xatolik!", "error");
            }
        });
    }

    const documentForm = document.getElementById("add-document-form");
    if (documentForm) {
        documentForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            if (!currentUser || currentUser.role !== "admin") {
                showToast("Bu amal faqat administrator uchun!", "error");
                return;
            }

            if (!cloudReady) {
                showToast("Ma'lumotlar yuklanishini kuting!", "error");
                return;
            }

            try {
                const editId = document.getElementById("edit-doc-id").value;
                const fileInput = document.getElementById("doc-pdf-file");
                const file = fileInput?.files?.[0];

                const existing = editId ? documents.find(doc => doc.id == editId) : null;
                let pdfUrl = existing?.pdfUrl || "";

                if (file) {
                    if (file.type !== "application/pdf") {
                        showToast("Faqat PDF fayl tanlang!", "error");
                        return;
                    }
                    if (file.size > 300 * 1024) {
                        showToast("Tez ishlashi uchun PDF fayl hajmi 300 KB dan kichik bo'lishi kerak!", "error");
                        return;
                    }
                    pdfUrl = await readFileAsDataURL(file);
                }

                if (!pdfUrl) {
                    showToast("Iltimos, PDF faylni tanlang!", "error");
                    return;
                }

                const docData = {
                    id: editId ? Number(editId) : Date.now(),
                    category: document.getElementById("doc-category").value,
                    number: document.getElementById("doc-number").value.trim(),
                    academicYear: document.getElementById("doc-academic-year").value,
                    date: document.getElementById("doc-date").value,
                    title: document.getElementById("doc-title").value.trim(),
                    pdfUrl: pdfUrl
                };

                if (editId) {
                    const index = documents.findIndex(doc => doc.id == editId);
                    if (index !== -1) documents[index] = docData;
                } else {
                    documents.unshift(docData);
                }

                const saved = await saveCloudData();
                if (!saved) return;

                documentForm.reset();
                const editField = document.getElementById("edit-doc-id");
                if (editField) editField.value = "";

                const formTitle = document.getElementById("doc-form-title");
                if (formTitle) {
                    formTitle.innerHTML = '<i class="fa-solid fa-file-circle-plus text-blue-400 mr-2"></i>Yangi hujjat kiritish';
                }

                renderDocuments();
                switchTab("docs-list");
                showToast(editId ? "Hujjat tahrirlandi!" : "Yangi hujjat saqlandi!");
            } catch (error) {
                console.error(error);
                showToast("Hujjatni saqlashda xatolik!", "error");
            }
        });
    }

    const userForm = document.getElementById("add-user-form");
    if (userForm) {
        userForm.addEventListener("submit", async function(event) {
            event.preventDefault();
            if (!currentUser || currentUser.role !== "admin") {
                showToast("Bu amal faqat administrator uchun!", "error");
                return;
            }

            try {
                const editIndex = Number(document.getElementById("edit-user-index").value);
                const photoInput = document.getElementById("new-user-photo");
                const photoFile = photoInput?.files?.[0];

                let photo = (editIndex >= 0 && usersList[editIndex]) ? usersList[editIndex].photo : DEFAULT_AVATAR;

                if (photoFile) {
                    if (!photoFile.type.startsWith("image/")) {
                        showToast("Rasm faylini tanlang!", "error");
                        return;
                    }
                    if (photoFile.size > 1024 * 1024) {
                        showToast("Rasm hajmi 1 MB dan kichik bo'lishi kerak!", "error");
                        return;
                    }
                    photo = await readFileAsDataURL(photoFile);
                }

                const userData = normalizeUser({
                    fullname: document.getElementById("new-user-fullname").value.trim(),
                    position: document.getElementById("new-user-position").value.trim(),
                    phone: document.getElementById("new-user-phone").value.trim(),
                    telegram: document.getElementById("new-user-telegram").value.trim(),
                    instagram: document.getElementById("new-user-instagram").value.trim(),
                    username: document.getElementById("new-user-username").value,
                    password: document.getElementById("new-user-password").value,
                    role: document.getElementById("new-user-role").value,
                    photo: photo
                });

                if (!userData.username || !userData.password) {
                    showToast("Login va parolni kiriting!", "error");
                    return;
                }

                if (editIndex >= 0 && usersList[editIndex] && usersList[editIndex].username === "admin" && userData.username !== "admin") {
                    showToast("Asosiy administrator loginini o'zgartirmang!", "error");
                    return;
                }

                const duplicate = usersList.some((user, index) => user.username === userData.username && index !== editIndex);
                if (duplicate) {
                    showToast("Bu login allaqachon mavjud!", "error");
                    return;
                }

                if (editIndex >= 0 && usersList[editIndex]) {
                    usersList[editIndex] = userData;
                } else {
                    usersList.push(userData);
                }

                const saved = await saveCloudData();
                if (!saved) return;

                userForm.reset();
                const editField = document.getElementById("edit-user-index");
                if (editField) editField.value = "-1";

                renderUsers();
                updateDashboardStats();
                switchTab("users-list");
                showToast(editIndex >= 0 ? "Foydalanuvchi yangilandi!" : "Yangi foydalanuvchi qo'shildi!");
            } catch (error) {
                console.error(error);
                showToast("Foydalanuvchini saqlashda xatolik!", "error");
            }
        });
    }
}

function bindInterfaceEvents() {
    const searchInput = document.getElementById("search-input");
    const yearFilter = document.getElementById("filter-academic-year");
    const categoryFilter = document.getElementById("filter-category");

    if (searchInput) searchInput.addEventListener("input", renderDocuments);
    if (yearFilter) yearFilter.addEventListener("change", renderDocuments);
    if (categoryFilter) categoryFilter.addEventListener("change", renderDocuments);

    const tbody = document.getElementById("documents-table-body");
    if (tbody) {
        tbody.addEventListener("click", function(event) {
            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const id = button.dataset.id;
            const action = button.dataset.action;

            if (action === "open-pdf") openPdf(id);
            if (action === "edit-doc") editDoc(id);
            if (action === "delete-doc") deleteDoc(id);
        });
    }

    const usersTable = document.getElementById("users-table-body");
    if (usersTable) {
        usersTable.addEventListener("click", function(event) {
            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const index = Number(button.dataset.index);
            if (button.dataset.action === "edit-user") editUser(index);
            if (button.dataset.action === "delete-user") deleteUser(index);
        });
    }

    const closePdfButton = document.getElementById("close-pdf-btn");
    if (closePdfButton) closePdfButton.addEventListener("click", closePdfModal);

    const exportButton = document.getElementById("export-excel-btn");
    if (exportButton) exportButton.addEventListener("click", exportExcel);
}

function exportExcel() {
    if (!currentUser || currentUser.role !== "admin") {
        showToast("Excel eksporti faqat administrator uchun!", "error");
        return;
    }

    if (!documents.length) {
        showToast("Yuklab olish uchun hujjatlar mavjud emas!", "error");
        return;
    }

    const categoryNames = {
        student: "Talaba buyruqlari",
        letter: "Xatlar",
        order: "Farmoyishlar",
        internal: "Ichki buyruqlar"
    };

    const rows = documents.map(function(doc, index) {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHTML(categoryNames[doc.category] || doc.category)}</td>
                <td>${escapeHTML(doc.number)}</td>
                <td>${escapeHTML(doc.date)}</td>
                <td>${escapeHTML(doc.academicYear)}</td>
                <td>${escapeHTML(doc.title)}</td>
            </tr>
        `;
    }).join("");

    const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; width: 100%; }
                th { background: #1e3a8a; color: white; border: 1px solid black; padding: 8px; }
                td { border: 1px solid #d1d5db; padding: 6px; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>T/R</th>
                        <th>Bo'lim</th>
                        <th>Hujjat raqami</th>
                        <th>Hujjat sanasi</th>
                        <th>O'quv yili</th>
                        <th>Hujjat nomi</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(
        ["\ufeff", html],
        { type: "application/vnd.ms-excel;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "fakultet_hujjatlari_" + new Date().toISOString().slice(0, 10) + ".xls";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Excel fayli yuklab olindi!");
}

document.addEventListener("DOMContentLoaded", async function() {
    const loginScreen = document.getElementById("login-screen");
    const appContent = document.getElementById("app-content");

    if (loginScreen) loginScreen.classList.add("hidden");
    if (appContent) appContent.classList.add("hidden");

    // Interfeys darhol keshdagi ma'lumotlar bilan ochiladi
    renderDocuments();
    renderUsers();
    updateDashboardStats();

    bindFormEvents();
    bindInterfaceEvents();

    const loaded = await initCloudSync();
    if (!loaded) {
        if (loginScreen) loginScreen.classList.remove("hidden");
        return;
    }

    const savedSession = localStorage.getItem("faculty_gs_current_user");
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            const matchedUser = usersList.find(function(user) {
                return user.username === String(session.username || "").toLowerCase();
            });

            if (matchedUser) {
                currentUser = matchedUser;
                currentUserOriginalUsername = matchedUser.username;
                startAppSession();
                return;
            }

            localStorage.removeItem("faculty_gs_current_user");
        } catch (error) {
            console.error("Sessiyani o'qish xatosi:", error);
            localStorage.removeItem("faculty_gs_current_user");
        }
    }

    if (loginScreen) loginScreen.classList.remove("hidden");
});
