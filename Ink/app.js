let session = null;
let currentRkey = null;

const identifierInput = document.getElementById('identifier');
const passwordInput = document.getElementById('password');
const titleInput = document.getElementById('title');
const categoryInput = document.getElementById('category');
const synopsisInput = document.getElementById('synopsis');
const synopsisCounter = document.getElementById('synopsisCounter');
const contentInput = document.getElementById('content');
const previewDiv = document.getElementById('preview');
const recordsList = document.getElementById('recordsList');
const userStatus = document.getElementById('userStatus');

// Live Markdown Preview
contentInput.addEventListener('input', () => {
    const markdown = contentInput.value;
    previewDiv.innerHTML = typeof marked !== 'undefined' ? marked.parse(markdown) : markdown.replace(/\n/g, '<br>');
});

// Contador de Sinopsis ajustado a 120
synopsisInput.addEventListener('input', () => {
    const len = synopsisInput.value.length;
    synopsisCounter.textContent = `${len} / 120`;
});

// Cargar sesión guardada
window.onload = () => {
    const saved = localStorage.getItem('atprotoSession');
    if (saved) {
        session = JSON.parse(saved);
        showMain();
        listTexts();
    }
};

async function login() {
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value.trim();

    if (!identifier || !password) return alert("Completa los datos");

    try {
        const resp = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ identifier, password })
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Datos incorrectos");

        session = {
            did: data.did,
            jwt: data.accessJwt,
            handle: data.handle
        };

        localStorage.setItem('atprotoSession', JSON.stringify(session));
        showMain();
        listTexts();

    } catch (e) {
        alert("Error: " + e.message);
    }
}

function showMain() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainSection').style.display = 'block';
    userStatus.textContent = `Conectado como: ${session.handle}`;
}

function logout() {
    localStorage.removeItem('atprotoSession');
    location.reload();
}

async function saveText() {
    if (!session) return;

    const title = titleInput.value.trim() || "Sin título";
    const category = categoryInput.value.trim();
    const synopsis = synopsisInput.value.trim();
    const text = contentInput.value.trim();

    if (!text) return alert("Escribe algo en el contenido");

    const rkey = currentRkey || Date.now().toString(36) + Math.random().toString(36).substr(2);

    try {
        const resp = await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.jwt}`
            },
            body: JSON.stringify({
                repo: session.did,
                collection: "com.antuansv.longtext",
                rkey: rkey,
                record: {
                    $type: "com.antuansv.longtext",
                    title: title,
                    category: category,
                    synopsis: synopsis,
                    text: text,
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (resp.ok) {
            alert("Escrito guardado correctamente");
            currentRkey = null;
            clearForm();
            listTexts();
        } else {
            const errData = await resp.json();
            alert("Error del servidor: " + (errData.message || "Desconocido"));
        }
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }
}

async function listTexts() {
    if (!session) return;
    recordsList.innerHTML = "<p>Cargando archivo...</p>";

    try {
        const resp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=com.antuansv.longtext&limit=50`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });

        const data = await resp.json();
        recordsList.innerHTML = '';

        if (!data.records || data.records.length === 0) {
            recordsList.innerHTML = "<p>Aún no tienes escritos.</p>";
            return;
        }

        data.records.forEach(rec => {
            const rkey = rec.uri.split('/').pop();
            const val = rec.value;

            const safeTitle = (val.title || '').replace(/'/g,"\\'");
            const safeCat = (val.category || '').replace(/'/g,"\\'");
            const safeSyn = (val.synopsis || '').replace(/'/g,"\\'");
            const safeText = (val.text || '').replace(/`/g,'\\`');

            const div = document.createElement('div');
            div.className = 'record';
            div.innerHTML = `
            <strong>${val.title}</strong>
            <div class="record-tags">${val.category || 'Sin categoría'} | ${new Date(val.createdAt).toLocaleDateString()}</div>
            <p style="font-size: 0.9rem; color: #aaa;">${val.synopsis || 'Sin sinopsis'}</p>
            <div class="actions">
            <button onclick="editText('${rkey}', '${safeTitle}', '${safeCat}', '${safeSyn}', \`${safeText}\`)">Editar</button>
            <button onclick="deleteText('${rkey}')">Eliminar</button>
            </div>
            `;
            recordsList.appendChild(div);
        });
    } catch (e) {
        recordsList.innerHTML = "<p>Error al cargar los textos.</p>";
    }
}

window.editText = function(rkey, title, category, synopsis, text) {
    currentRkey = rkey;
    titleInput.value = title;
    categoryInput.value = category;
    synopsisInput.value = synopsis;
    contentInput.value = text;

    // Actualizar el contador de la sinopsis reflejando el límite de 120
    synopsisCounter.textContent = `${synopsis.length} / 120`;

    // Actualizar preview
    const markdown = text;
    previewDiv.innerHTML = typeof marked !== 'undefined' ? marked.parse(markdown) : markdown.replace(/\n/g, '<br>');

    window.scrollTo(0,0);
};

window.deleteText = async function(rkey) {
    if (!confirm("¿Eliminar este escrito permanentemente?")) return;

    try {
        await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.jwt}`
            },
            body: JSON.stringify({
                repo: session.did,
                collection: "com.antuansv.longtext",
                rkey: rkey
            })
        });
        listTexts();
    } catch (e) {
        alert("Error al eliminar");
    }
};

function clearForm() {
    currentRkey = null;
    titleInput.value = '';
    categoryInput.value = '';
    synopsisInput.value = '';
    contentInput.value = '';
    synopsisCounter.textContent = '0 / 120';
    previewDiv.innerHTML = '';
}
