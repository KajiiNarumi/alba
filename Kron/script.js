let currentHandle = "";
let currentDid = "";
let allPosts = [];

const userInput = document.getElementById('userInput');
const goBtn = document.getElementById('goBtn');
const profileDiv = document.getElementById('profile');
const albumsDiv = document.getElementById('albums');
const postsContainer = document.getElementById('postsContainer');
const userModal = document.getElementById('userModal');
const modalTitle = document.getElementById('modalTitle');
const userList = document.getElementById('userList');
const navMenuModal = document.getElementById('navMenuModal');

// Objeto para mantener el estado de los carruseles (índice actual por motivo)
window.carouselStates = {};

// ==================== MENÚ DE NAVEGACIÓN MODAL ====================
function openNavMenu() { navMenuModal.style.display = "flex"; }
function closeNavMenu() { navMenuModal.style.display = "none"; }

// ==================== LÓGICA DE URL CORTA ====================
function getUrlParams() {
    const search = window.location.search.substring(1);
    const params = new URLSearchParams(search);

    let handle = params.get('handle') || params.get('usuario');
    let rkey = params.get('rkey');

    if (!handle && search) {
        const firstPart = search.split('&')[0];
        if (firstPart && !firstPart.includes('=')) {
            handle = decodeURIComponent(firstPart);
        }
    }

    return { handle: handle || "iasuarezv.com", rkey };
}

// ==================== NAVEGACIÓN DEL SISTEMA ====================
window.onpopstate = () => {
    const { handle } = getUrlParams();
    userInput.value = handle;
    loadUser(handle);
};

goBtn.onclick = () => loadUser(userInput.value.trim());
userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') loadUser(userInput.value.trim());
});

window.onload = () => {
    const { handle } = getUrlParams();
    userInput.value = handle;
    loadUser(handle);
};

// ==================== CARGAR DATOS DE ACTOR AT PROTOCOL ====================
async function loadUser(handle) {
    if (!handle) return;
    currentHandle = handle;
    window.carouselStates = {}; // Reset estados al cambiar usuario

    const { rkey } = getUrlParams();
    let newUrl = `?${handle}`;
    if(rkey) newUrl += `&rkey=${rkey}`;
    history.pushState({}, "", newUrl);

    profileDiv.innerHTML = "<p style='text-align:center;color:#666'>Cargando perfil...</p>";
    albumsDiv.innerHTML = "";
    postsContainer.innerHTML = "<p style='text-align:center;color:#666'>Cargando motivos...</p>";

    let did = handle.startsWith('did:') ? handle : null;
    if (!did) {
        try {
            const res = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
            const data = await res.json();
            did = data.did;
        } catch (e) {
            profileDiv.innerHTML = "<h2 style='text-align:center;padding:20px;color:#fff;'>USER NOT FOUND</h2>";
            albumsDiv.innerHTML = "";
            postsContainer.innerHTML = "";
            return;
        }
    }
    currentDid = did;

    try {
        const [profRes, recordsRes] = await Promise.all([
            fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`),
                                                        // Nota: usando tu custom lexicon supuesto com.antuansv.kron
                                                        fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=com.antuansv.kron&limit=100`).catch(() => ({ json: () => ({ records: [] }) }))
        ]);

        const profile = await profRes.json();
        let recordsData = { records: [] };

        try { recordsData = await recordsRes.json(); } catch(e) {}

        allPosts = recordsData.records || [];

        renderProfile(profile, handle, allPosts.length);
        renderAlbums(allPosts);
        renderPosts(allPosts);

        if (rkey) {
            setTimeout(() => {
                const targetPost = document.getElementById(`post-${rkey}`);
                if (targetPost) {
                    targetPost.classList.add('highlight');
                    targetPost.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 300);
        }

    } catch (e) {
        postsContainer.innerHTML = "<p style='text-align:center;padding:20px;'>Error al conectar con el PDS.</p>";
    }
}

// ==================== RENDERIZADO DE COMPONENTES DOM ====================
function renderProfile(profile, handle, count) {
    profileDiv.innerHTML = `
    <div class="profile">
    <img src="${profile.avatar || 'https://via.placeholder.com/80x80/111/444?text=User'}" alt="">
    <div class="profile-info">
    <h2>${profile.displayName || handle}</h2>
    <p>${profile.description || ''}</p>
    </div>
    <div class="profile-actions">
    <a class="btn" href="https://bsky.app/profile/${handle}" target="_blank">Perfil</a>
    <button class="btn" onclick="shareProfile()">Compartir</button>
    <button class="btn" onclick="loadFollowers('${currentDid}')">Seguidores</button>
    <button class="btn" onclick="loadFollowing('${currentDid}')">Siguiendo</button>
    <span class="btn" style="border:none; cursor:default;">${count} motivos</span>
    </div>
    </div>`;
}

function renderAlbums(records) {
    albumsDiv.innerHTML = '';
    const allBtn = document.createElement('div');
    allBtn.className = 'album-btn active';
    allBtn.textContent = 'Todo';
    allBtn.onclick = () => {
        document.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        renderPosts(records);
    };
    albumsDiv.appendChild(allBtn);

    const tagMap = {};

    records.forEach(rec => {
        const catString = rec.value.categoria || rec.value.category || '';
        const tags = catString.split(/\s+/).filter(t => t);
        tags.forEach(tag => {
            const clean = tag.replace('#', '').toLowerCase();
            if (!clean) return;
            if (!tagMap[clean]) tagMap[clean] = [];
            tagMap[clean].push(rec);
        });
    });

    Object.keys(tagMap).sort().forEach(tag => {
        const btn = document.createElement('div');
        btn.className = 'album-btn';
        btn.textContent = tag; // Sin la almohadilla
        btn.onclick = () => {
            document.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPosts(tagMap[tag]);
        };
        albumsDiv.appendChild(btn);
    });
}

function renderPosts(records) {
    if (records.length === 0) {
        postsContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#666;">El usuario no tiene motivos</p>`;
        return;
    }

    const sorted = records.sort((a,b) => new Date(b.value.createdAt || b.value.fechaInicio) - new Date(a.value.createdAt || a.value.fechaInicio));

    let html = '';
    sorted.forEach(rec => {
        const val = rec.value;
        const rkey = rec.uri.split('/').pop();
        const shareUrl = `${window.location.origin}${window.location.pathname}?${currentHandle}&rkey=${rkey}`;

        const motivoTitle = val.motivo || val.title || 'Sin título';
        const displayCat = (val.categoria || val.category || '').split(/\s+/).map(t => t.replace('#', '')).join(' ');

        const fInicio = new Date(val.fechaInicio || val.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year:'numeric' });
        const fFin = val.fechaFin ? new Date(val.fechaFin).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year:'numeric' }) : 'Indefinido';

        // Cálculo porcentaje de tiempo
        const startTimestamp = new Date(val.fechaInicio).getTime();
        const endTimestamp = new Date(val.fechaFin).getTime();
        const now = new Date().getTime();
        let timePercent = 0;

        if (now >= endTimestamp) timePercent = 100;
        else if (now > startTimestamp && endTimestamp > startTimestamp) {
            timePercent = Math.round(((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100);
        }

        // Tareas (Asumiendo formato: val.tareas = [{nombre, completada}, ...])
        const tareas = val.tareas || [];

        // Estado inicial del carrusel para este rkey
        if (window.carouselStates[rkey] === undefined) {
            window.carouselStates[rkey] = 0; // Inicia en la tarea 0
        }

        // Construir Segmentos de Progreso
        let taskSegments = '';
        if (tareas.length > 0) {
            tareas.forEach(t => {
                taskSegments += `<div class="task-segment ${t.completada ? 'done' : 'pending'}"></div>`;
            });
        } else {
            taskSegments = `<div class="task-segment pending" style="background:#111; border:none;"></div>`;
        }

        html += `
        <div class="post" id="post-${rkey}">
        <div class="kron-time">
        <div class="circle-progress" style="background: conic-gradient(#ffffff ${timePercent}%, #222222 0);" data-percent="${timePercent}%"></div>
        </div>

        <div class="kron-details">
        <div class="kron-header">
        <div class="kron-title-group">
        <h3>${motivoTitle}</h3>
        <div class="kron-meta">${fInicio} - ${fFin}</div>
        ${displayCat ? `<div class="kron-category">${displayCat}</div>` : ''}
        </div>
        <button class="share-kron-btn" onclick="shareKron('${motivoTitle}', '${displayCat}', '${shareUrl}')">Compartir</button>
        </div>

        <div class="task-bar-container">
        ${taskSegments}
        </div>

        <div class="task-carousel" id="carousel-${rkey}" data-rkey="${rkey}">
        <!-- El contenido del carrusel se inyecta mediante JS -->
        </div>
        </div>
        </div>`;
    });

    postsContainer.innerHTML = html;

    // Renderizar carruseles para todos los motivos
    sorted.forEach(rec => {
        const rkey = rec.uri.split('/').pop();
        renderCarousel(rkey, rec.value.tareas || []);
    });
}

// ==================== LÓGICA DE CARRUSEL DE TAREAS ====================
function renderCarousel(rkey, tareas) {
    const container = document.getElementById(`carousel-${rkey}`);
    if (!container) return;

    if (tareas.length === 0) {
        container.innerHTML = `<div style="color:#666; font-size:0.9rem; text-align:center; width:100%;">Sin tareas intermedias</div>`;
        return;
    }

    const currentIndex = window.carouselStates[rkey];
    const total = tareas.length;

    const btnPrevState = currentIndex === 0 ? "disabled" : "";
    const btnNextState = currentIndex === total - 1 ? "disabled" : "";

    // Prev
    let prevText = "";
    if (currentIndex > 0) prevText = `· ${tareas[currentIndex - 1].nombre} ${currentIndex}/${total}`;

    // Current
    let currentText = `· ${tareas[currentIndex].nombre} ${currentIndex + 1}/${total}`;

    // Next
    let nextText = "";
    if (currentIndex < total - 1) nextText = `· ${tareas[currentIndex + 1].nombre} ${currentIndex + 2}/${total}`;

    // Convertimos a JSON seguro para inyectar en el onclick
    const safeTareasStr = encodeURIComponent(JSON.stringify(tareas));

    container.innerHTML = `
    <button class="carousel-btn" ${btnPrevState} onclick="moveCarousel('${rkey}', -1, '${safeTareasStr}')">❮</button>
    <div class="carousel-content">
    <div class="task-item" style="text-align: left;">${prevText}</div>
    <div class="task-item current">${currentText}</div>
    <div class="task-item" style="text-align: right;">${nextText}</div>
    </div>
    <button class="carousel-btn" ${btnNextState} onclick="moveCarousel('${rkey}', 1, '${safeTareasStr}')">❯</button>
    `;
}

function moveCarousel(rkey, direction, tareasStrEnc) {
    const tareas = JSON.parse(decodeURIComponent(tareasStrEnc));
    const currentIndex = window.carouselStates[rkey];
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < tareas.length) {
        window.carouselStates[rkey] = nextIndex;
        renderCarousel(rkey, tareas);
    }
}

// ==================== INTERACCIONES INTERNAS ====================
function shareProfile() {
    navigator.clipboard.writeText(window.location.href);
    alert("✅ Enlace del perfil copiado");
}

function shareKron(motivo, categoria, url) {
    const textToShare = `🕰️ ${motivo} ${categoria}\n${url}`;
    navigator.clipboard.writeText(textToShare);
    alert("✅ Enlace del motivo copiado");
}

// ==================== GRAPH EN AT PROTOCOL (SOCIAL MODALS) ====================
async function loadFollowers(did) {
    modalTitle.textContent = "Seguidores";
    userList.innerHTML = "<p style='text-align:center;color:#666'>Cargando...</p>";
    userModal.style.display = "flex";

    try {
        const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollowers?actor=${did}&limit=50`);
        const data = await res.json();
        renderUserList(data.followers);
    } catch (e) {
        userList.innerHTML = "<p style='text-align:center;'>Error al cargar seguidores.</p>";
    }
}

async function loadFollowing(did) {
    modalTitle.textContent = "Siguiendo";
    userList.innerHTML = "<p style='text-align:center;color:#666'>Cargando...</p>";
    userModal.style.display = "flex";

    try {
        const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${did}&limit=50`);
        const data = await res.json();
        renderUserList(data.follows);
    } catch (e) {
        userList.innerHTML = "<p style='text-align:center;'>Error al cargar seguidos.</p>";
    }
}

function renderUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
        <img src="${user.avatar || 'https://via.placeholder.com/48'}">
        <div>
        <strong>${user.displayName || user.handle}</strong><br>
        <small style="color:#888">@${user.handle}</small>
        </div>
        `;
        div.onclick = () => {
            closeModal();
            loadUser(user.handle);
        };
        userList.appendChild(div);
    });
}

function closeModal() {
    userModal.style.display = "none";
}

// Cerrar modales clickeando afuera de la tarjeta interna
window.onclick = function(event) {
    if (event.target == userModal) {
        closeModal();
    }
    if (event.target == navMenuModal) {
        closeNavMenu();
    }
}
