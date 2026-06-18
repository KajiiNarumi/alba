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
    return { handle: handle || "", rkey };
}

window.onpopstate = () => {
    const { handle } = getUrlParams();
    if (handle) {
        userInput.value = handle;
        loadUser(handle);
    }
};

goBtn.onclick = () => loadUser(userInput.value.trim());
userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') loadUser(userInput.value.trim());
});

window.onload = () => {
    const { handle } = getUrlParams();
    if (handle) {
        userInput.value = handle;
        loadUser(handle);
    } else {
        postsContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#666;">Busca con el URL o el handle a un usuario</p>`;
    }
};

async function loadUser(handle) {
    if (!handle) return;
    currentHandle = handle;
    window.carouselStates = {};

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
            if (!res.ok) throw new Error("Handle no encontrado");
            const data = await res.json();
            did = data.did;
        } catch (e) {
            profileDiv.innerHTML = "<h2 style='text-align:center;padding:20px;color:#fff;'>USUARIO NO ENCONTRADO</h2>";
            albumsDiv.innerHTML = "";
            postsContainer.innerHTML = "";
            return;
        }
    }
    currentDid = did;

    try {
        const [profRes, recordsRes] = await Promise.all([
            fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`),
                                                        fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=com.alba.kron&limit=100`).catch(() => ({ json: () => ({ records: [] }) }))
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

function renderProfile(profile, handle, count) {
    profileDiv.innerHTML = `
    <div class="profile">
    <div class="profile-avatar-container">
    <img src="${profile.avatar || 'https://via.placeholder.com/80x80/111/444?text=User'}" alt="">
    <span class="motivos-count">${count} motivos</span>
    </div>
    <div class="profile-info">
    <h2>${profile.displayName || handle}</h2>
    <p>${profile.description || ''}</p>
    </div>
    <div class="profile-actions">
    <a class="btn" href="https://bsky.app/profile/${handle}" target="_blank" style="text-decoration:none;">Perfil</a>
    <button class="btn" onclick="shareProfile()">Compartir</button>
    <button class="btn" onclick="loadFollowers('${currentDid}')">Seguidores</button>
    <button class="btn" onclick="loadFollowing('${currentDid}')">Siguiendo</button>
    </div>
    </div>`;
}

function renderAlbums(records) {
    albumsDiv.innerHTML = '';

    // Botón "Todo"
    const allBtn = document.createElement('div');
    allBtn.className = 'album-btn active';
    allBtn.textContent = 'Todo';
    allBtn.onclick = () => {
        document.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        renderPosts(records);
    };
    albumsDiv.appendChild(allBtn);

    // Obtener categorías únicas
    const cats = [...new Set(records.map(r => r.value.categoria).filter(c => c))];
    cats.forEach(cat => {
        const btn = document.createElement('div');
        btn.className = 'album-btn';
        btn.textContent = cat;
        btn.onclick = () => {
            document.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPosts(records.filter(r => r.value.categoria === cat));
        };
        albumsDiv.appendChild(btn);
    });
}

function renderPosts(records) {
    if (records.length === 0) {
        postsContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#666;">No hay motivos en esta sección.</p>`;
        return;
    }

    const sorted = records.sort((a,b) => new Date(b.value.createdAt || b.value.fechaInicio) - new Date(a.value.createdAt || a.value.fechaInicio));

    let html = '';
    sorted.forEach(rec => {
        const val = rec.value;
        const rkey = rec.uri.split('/').pop();
        const shareUrl = `${window.location.origin}${window.location.pathname}?${currentHandle}&rkey=${rkey}`;
        const motivoTitle = val.motivo || val.title || 'Sin título';

        // Cálculo de días restantes (Regresivo)
        let fFin = '';
        if (val.fechaFin) {
            const endTimestamp = new Date(val.fechaFin).getTime();
            const now = new Date().getTime();
            const diffDays = Math.ceil((endTimestamp - now) / (1000 * 60 * 60 * 24));
            fFin = diffDays > 0 ? `${diffDays} días` : 'Finalizado';
        }

        let timePercent = 0;
        if (val.fechaInicio && val.fechaFin) {
            const startTimestamp = new Date(val.fechaInicio).getTime();
            const endTimestamp = new Date(val.fechaFin).getTime();
            const now = new Date().getTime();
            if (now >= endTimestamp) { timePercent = 100; }
            else if (now > startTimestamp && endTimestamp > startTimestamp) {
                timePercent = Math.round(((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100);
            }
        }

        const tareas = val.tareas || [];
        if (window.carouselStates[rkey] === undefined) window.carouselStates[rkey] = 0;

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
        <div class="kron-time-col">
        <div class="circle-progress" style="background: conic-gradient(#ffffff ${timePercent}%, #222222 0);" data-percent="${timePercent}%"></div>
        <div class="kron-end-date">${fFin}</div>
        </div>

        <div class="kron-details">
        <div class="kron-header">
        <h3>${motivoTitle}</h3>
        <button class="share-kron-btn" onclick="shareKron('${motivoTitle}', '', '${shareUrl}')">Compartir</button>
        </div>

        <div class="task-bar-container">
        ${taskSegments}
        </div>

        <div class="task-carousel" id="carousel-${rkey}" data-rkey="${rkey}">
        </div>
        </div>
        </div>`;
    });

    postsContainer.innerHTML = html;

    sorted.forEach(rec => {
        const rkey = rec.uri.split('/').pop();
        renderCarousel(rkey, rec.value.tareas || []);
    });
}

function renderCarousel(rkey, tareas) {
    const container = document.getElementById(`carousel-${rkey}`);
    if (!container) return;

    if (tareas.length === 0) {
        container.innerHTML = `<div style="color:#666; font-size:0.9rem; text-align:center; width:100%;">Sin tareas</div>`;
        return;
    }

    const currentIndex = window.carouselStates[rkey];
    const total = tareas.length;
    const btnPrevState = currentIndex === 0 ? "disabled" : "";
    const btnNextState = currentIndex === total - 1 ? "disabled" : "";

    let prevText = "";
    if (currentIndex > 0) prevText = `· ${tareas[currentIndex - 1].nombre}`;
    let currentText = `· ${tareas[currentIndex].nombre} ${currentIndex + 1}/${total}`;
    let nextText = "";
    if (currentIndex < total - 1) nextText = `· ${tareas[currentIndex + 1].nombre}`;

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

function shareProfile() {
    navigator.clipboard.writeText(window.location.href);
    alert("✅ Enlace del perfil copiado");
}

function shareKron(motivo, categoria, url) {
    const textToShare = `🕰️ ${motivo}\n${url}`;
    navigator.clipboard.writeText(textToShare);
    alert("✅ Enlace del motivo copiado");
}

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
        div.onclick = () => { closeModal(); loadUser(user.handle); };
        userList.appendChild(div);
    });
}

function closeModal() { userModal.style.display = "none"; }

window.onclick = function(event) {
    if (event.target == userModal) closeModal();
    if (event.target == navMenuModal) closeNavMenu();
}
