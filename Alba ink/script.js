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

// ==================== NAVEGACIÓN DEL NAVEGADOR ====================
window.onpopstate = () => {
    const params = new URLSearchParams(window.location.search);
    const handle = params.get('handle') || params.get('usuario') || "iasuarezv.com";
    userInput.value = handle;
    loadUser(handle);
};

// ==================== BUSCADOR ====================
goBtn.onclick = () => loadUser(userInput.value.trim());
userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') loadUser(userInput.value.trim());
});

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const handle = params.get('handle') || params.get('usuario') || "iasuarezv.com";
    userInput.value = handle;
    loadUser(handle);
};

function goToEditor() {
    window.open('editor.html', '_blank'); // Cambia el nombre si tu editor se llama diferente
}

function resetPage() {
    window.history.pushState({}, '', window.location.pathname);
    loadUser("iasuarezv.com");
}

// ==================== CARGAR USUARIO ====================
async function loadUser(handle) {
    if (!handle) return;
    currentHandle = handle;
    history.pushState({}, "", `?handle=${handle}`);

    profileDiv.innerHTML = "<p style='text-align:center;color:#666'>Cargando perfil...</p>";
    albumsDiv.innerHTML = "";
    postsContainer.innerHTML = "<p style='text-align:center;color:#666'>Cargando escritos...</p>";

    let did = handle.startsWith('did:') ? handle : null;
    if (!did) {
        try {
            const res = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
            const data = await res.json();
            did = data.did;
        } catch (e) {
            profileDiv.innerHTML = "<p>Usuario no encontrado.</p>";
            return;
        }
    }
    currentDid = did;

    try {
        const [profRes, recordsRes] = await Promise.all([
            fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`),
                                                        fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=com.antuansv.longtext&limit=100`)
        ]);

        const profile = await profRes.json();
        const recordsData = await recordsRes.json();

        allPosts = recordsData.records;

        renderProfile(profile, handle, allPosts.length);
        renderAlbums(allPosts);
        renderPosts(allPosts);

    } catch (e) {
        postsContainer.innerHTML = "<p>Error al cargar datos.</p>";
    }
}

function renderProfile(profile, handle, count) {
    profileDiv.innerHTML = `
    <div class="profile">
    <img src="${profile.avatar || ''}" alt="">
    <div class="profile-info">
    <h2>${profile.displayName || handle}</h2>
    <p>${profile.description || ''}</p>
    <p style="color:#888">${count} escritos</p>
    </div>
    <div class="profile-actions">
    <a class="btn" href="https://bsky.app/profile/${handle}" target="_blank">Ver Perfil</a>
    <button class="btn" onclick="shareProfile()">Compartir Autor</button>
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

    const tagMap = {};

    records.forEach(rec => {
        const text = rec.value.text || '';
        const tags = text.match(/#\w+/g) || [];
        tags.forEach(tag => {
            const clean = tag.toLowerCase();
            if (!tagMap[clean]) tagMap[clean] = [];
            tagMap[clean].push(rec);
        });
    });

    Object.keys(tagMap).sort().forEach(tag => {
        const btn = document.createElement('div');
        btn.className = 'album-btn';
        btn.textContent = tag;
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
        postsContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#666;">Todavía no hay escritos publicados.</p>`;
        return;
    }

    const sorted = records.sort((a,b) => new Date(b.value.createdAt) - new Date(a.value.createdAt));

    let html = '';
    sorted.forEach(rec => {
        const date = new Date(rec.value.createdAt);
        const rkey = rec.uri.split('/').pop();
        const shareUrl = `${window.location.origin}${window.location.pathname}?handle=${currentHandle}&rkey=${rkey}`;

        html += `
        <div class="post">
        <div class="post-header">
        <div class="post-title" onclick="togglePost(this)">
        <span class="toggle-btn">+</span> ${rec.value.title}
        </div>
        <button class="btn" onclick="sharePost('${shareUrl}')">Compartir</button>
        </div>
        <div class="post-date">${date.toLocaleDateString('es-ES', {year:'numeric', month:'long', day:'numeric'})}</div>
        <div class="post-content">${marked.parse(rec.value.text)}</div>
        </div>`;
    });

    postsContainer.innerHTML = html;
}

function togglePost(el) {
    const content = el.parentElement.parentElement.querySelector('.post-content');
    const toggle = el.querySelector('.toggle-btn');

    if (content.style.display === 'block') {
        content.style.display = 'none';
        toggle.textContent = '+';
    } else {
        content.style.display = 'block';
        toggle.textContent = '−';
    }
}

function shareProfile() {
    navigator.clipboard.writeText(window.location.href);
    alert("✅ Enlace del autor copiado");
}

function sharePost(url) {
    navigator.clipboard.writeText(url);
    alert("✅ Enlace de publicación copiado");
}

// ==================== SEGUIDORES Y SIGUIENDO ====================
async function loadFollowers(did) {
    modalTitle.textContent = "Seguidores";
    userList.innerHTML = "<p>Cargando...</p>";
    userModal.style.display = "flex";

    try {
        const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollowers?actor=${did}&limit=50`);
        const data = await res.json();
        renderUserList(data.followers);
    } catch (e) {
        userList.innerHTML = "<p>Error al cargar seguidores.</p>";
    }
}

async function loadFollowing(did) {
    modalTitle.textContent = "Siguiendo";
    userList.innerHTML = "<p>Cargando...</p>";
    userModal.style.display = "flex";

    try {
        const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${did}&limit=50`);
        const data = await res.json();
        renderUserList(data.follows);
    } catch (e) {
        userList.innerHTML = "<p>Error al cargar seguidos.</p>";
    }
}

function renderUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
        <img src="${user.avatar || ''}">
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
