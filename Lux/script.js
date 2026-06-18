/* Configuración de Idioma */
const lang = navigator.language.slice(0, 2);
const i18n = {
    es: {
        search: "Buscar", profile: "Perfil", share: "Compartir",
        followers: "Seguidores", following: "Siguiendo", post: "Ver publicación",
        images: "imágenes", all: "Todo", copyMsg: "Copia el enlace:",
        visit: "Visitar enlace"
    },
    en: {
        search: "Search", profile: "Profile", share: "Share",
        followers: "Followers", following: "Following", post: "View post",
        images: "images", all: "All", copyMsg: "Copy link:", visit: "Visit link"
    }
};

const t = i18n[lang] || i18n.en;

/* Variables Globales */
let images = [], filtered = [], index = 0, currentHandle = "";

/* Escuchar el botón atrás del navegador */
window.onpopstate = () => {
    const handle = window.location.search.replace("?", "");
    if (handle) {
        load(handle);
    } else {
        resetAlba();
    }
};

/* Lógica del Modal Menú de Navegación */
const navMenuModal = document.getElementById('navMenuModal');
function openNavMenu() { navMenuModal.style.display = "flex"; }
function closeNavMenu() { navMenuModal.style.display = "none"; }
window.addEventListener('click', (e) => {
    if (e.target === navMenuModal) closeNavMenu();
});

/* Lógica de Búsqueda */
const handleSearch = () => {
    const u = userInput.value.trim().replace("@", "");
    if (!u) {
        resetAlba();
        return;
    }
    load(u);
};

goBtn.onclick = handleSearch;
userInput.onkeydown = (e) => { if (e.key === "Enter") handleSearch(); };

function resetAlba() {
    userInput.value = "";
    currentHandle = "";
    const cleanURL = window.location.origin + window.location.pathname;
    if (window.location.search) window.history.pushState({}, '', cleanURL);

    // Limpiar contenedores
    profile.innerHTML = "";
    albums.innerHTML = "";
    gallery.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--dim); padding: 50px 20px;">Usa el buscador para explorar una galería.</div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function load(handle) {
    if (!handle) { resetAlba(); return; }
    currentHandle = handle;
    userInput.value = handle;

    if (window.location.search !== "?" + handle) {
        history.pushState({}, "", "?" + handle);
    }

    localStorage.setItem("user", handle);

    gallery.innerHTML = '<div class="card skeleton"></div>'.repeat(9);
    profile.innerHTML = '<div class="profile skeleton" style="height:100px; border:none;"></div>';
    albums.innerHTML = '';

    try {
        const didRes = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`);
        const { did } = await didRes.json();
        const prof = await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`)).json();
        const data = await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=100`)).json();

        images = [];
        const tagMap = {};

        data.feed.forEach(item => {
            const p = item.post;
            if (p.record?.reply || item.reason?.$type === "app.bsky.feed.defs#reasonRepost" || p.embed?.record) return;
            const text = p.record?.text || "";
            const tags = (text.match(/#\w+/g) || []).map(t => t.toLowerCase());
            let imgs = [];
            if (p.embed?.images) imgs.push(...p.embed.images);
            if (p.embed?.media?.images) imgs.push(...p.embed.media.images);
            if (p.record?.embed?.images) imgs.push(...p.record.embed.images);
            if (p.record?.embed?.media?.images) imgs.push(...p.record.embed.media.images);

            imgs.forEach(img => {
                const cid = img.image?.ref?.$link || img.image?.$link;
                if (!cid) return;
                images.push({
                    thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`,
                    full: `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`,
                    text, likes: p.likeCount || 0, uri: p.uri, tags
                });
            });
        });

        profile.innerHTML = `
        <div class="profile">
        <img src="${prof.avatar || ''}">
        <div class="profile-info">
        <h2>${prof.displayName || handle}</h2>
        <p>${prof.description || ""}</p>
        <div class="count">${images.length} ${t.images}</div>
        </div>
        <div class="profile-actions">
        <a class="btn" href="https://bsky.app/profile/${handle}" target="_blank">${t.profile}</a>
        <button class="btn" onclick="share()">${t.share}</button>
        <button class="btn" onclick="followers('${did}')">${t.followers}</button>
        <button class="btn" onclick="follows('${did}')">${t.following}</button>
        </div>
        </div>`;

        images.forEach(img => {
            img.tags.forEach(tag => {
                if (!tagMap[tag]) tagMap[tag] = [];
                tagMap[tag].push(img);
            });
        });

        renderAlbums(tagMap);
        filtered = [...images];
        render();
    } catch (err) { resetAlba(); }
}

function renderAlbums(tagMap) {
    albums.innerHTML = "";
    const allBtn = document.createElement("div");
    allBtn.className = "album-btn active";
    allBtn.innerText = t.all;
    allBtn.onclick = () => { filtered = [...images]; setActive(allBtn); render(); };
    albums.appendChild(allBtn);
    Object.keys(tagMap).forEach(tag => {
        const b = document.createElement("div");
        b.className = "album-btn";
        b.innerText = tag.replace("#", "");
        b.onclick = () => { filtered = tagMap[tag]; setActive(b); render(); };
        albums.appendChild(b);
    });
}

function setActive(el) {
    document.querySelectorAll(".album-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
}

function render() {
    gallery.innerHTML = "";
    if(filtered.length === 0) {
        gallery.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--dim); padding: 40px;">No se encontraron imágenes.</div>`;
        return;
    }
    filtered.forEach((img, i) => {
        const d = document.createElement("div");
        d.className = "card";
        d.innerHTML = `<img src="${img.thumb}" loading="lazy">`;
        d.onclick = () => openImg(i);
        gallery.appendChild(d);
    });
}

/* Función para abrir fotos */
function openImg(i) {
    index = i;
    const d = filtered[i];

    mImg.style.display = "block";
    mImg.src = d.full;
    mText.innerText = d.text;
    mLikes.innerText = "❤️ " + d.likes;

    const id = d.uri.split("/").pop();
    postLink.href = `https://bsky.app/profile/${currentHandle}/post/${id}`;
    postLink.style.display = "inline-block";
    postLink.innerText = t.post;

    prevBtn.style.display = "flex";
    nextBtn.style.display = "flex";
    modal.classList.add("active");
}

prevBtn.onclick = e => { e.stopPropagation(); if (index > 0) openImg(index - 1); };
nextBtn.onclick = e => { e.stopPropagation(); if (index < filtered.length - 1) openImg(index + 1); };
closeBtn.onclick = () => modal.classList.remove("active");
modal.onclick = e => { if (e.target === modal) modal.classList.remove("active"); };

async function followers(did) {
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollowers?actor=${did}`);
    const data = await res.json();
    showUsers(data.followers);
}

async function follows(did) {
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${did}`);
    const data = await res.json();
    showUsers(data.follows);
}

function showUsers(list) {
    userList.innerHTML = "";
    list.forEach(u => {
        const d = document.createElement("div");
        d.className = "user";
        d.innerHTML = `<img src="${u.avatar || ''}"><span>${u.handle}</span>`;
        d.onclick = () => { document.getElementById('userModal').classList.remove("active"); load(u.handle); };
        userList.appendChild(d);
    });
    document.getElementById('userModal').classList.add("active");
}

function share() {
    navigator.clipboard.writeText(window.location.href).then(() => alert("Copiado!"));
}

/* Inicialización */
const params = new URLSearchParams(window.location.search);
const initQuery = params.get("usuario") || window.location.search.replace("?", "");
goBtn.innerText = t.search;

if (initQuery) {
    load(initQuery);
} else {
    const lastUser = localStorage.getItem("user");
    if (lastUser) {
        load(lastUser);
    } else {
        resetAlba();
    }
}
