let session = null;
let currentRkey = null;

const identifierInput = document.getElementById('identifier');
const passwordInput = document.getElementById('password');
const titleInput = document.getElementById('title');
const contentInput = document.getElementById('content');
const previewDiv = document.getElementById('preview');
const recordsList = document.getElementById('recordsList');

// Live Markdown Preview
contentInput.addEventListener('input', () => {
    const markdown = contentInput.value;
    previewDiv.innerHTML = marked ? marked.parse(markdown) : markdown.replace(/\n/g, '<br>');
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
    document.getElementById('currentUser').textContent = session.handle;
}

function logout() {
    localStorage.removeItem('atprotoSession');
    location.reload();
}

async function saveText() {
    if (!session) return;

    const title = titleInput.value.trim() || "Sin título";
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
                    text: text,
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (resp.ok) {
            alert("✅ Escrito guardado correctamente");
            currentRkey = null;
            clearForm();
            listTexts();
        }
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }
}

async function listTexts() {
    if (!session) return;
    recordsList.innerHTML = "<p>Cargando...</p>";

    try {
        const resp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=com.antuansv.longtext&limit=50`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });

        const data = await resp.json();
        recordsList.innerHTML = '';

        if (data.records.length === 0) {
            recordsList.innerHTML = "<p>Aún no tienes escritos.</p>";
            return;
        }

        data.records.forEach(rec => {
            const rkey = rec.uri.split('/').pop();
            const div = document.createElement('div');
            div.className = 'record';
            div.innerHTML = `
            <strong>${rec.value.title}</strong><br>
            <small>${new Date(rec.value.createdAt).toLocaleString()}</small><br><br>
            <button onclick="showFull('${rkey}', '${rec.value.title.replace(/'/g,"\\'")}', \`${rec.value.text.replace(/`/g,'\\`')}\`)">Leer</button>
            <button onclick="editText('${rkey}', '${rec.value.title.replace(/'/g,"\\'")}', \`${rec.value.text.replace(/`/g,'\\`')}\`)">Editar</button>
            <button class="btn-red" onclick="deleteText('${rkey}')">Eliminar</button>
            `;
            recordsList.appendChild(div);
        });
    } catch (e) {
        recordsList.innerHTML = "<p>Error al cargar los textos.</p>";
    }
}

window.showFull = function(rkey, title, text) {
    const div = document.createElement('div');
    div.className = 'record';
    div.innerHTML = `
    <h3>${title}</h3>
    <div class="full-text">${text}</div>
    <button onclick="this.parentElement.remove()">Cerrar</button>
    `;
    recordsList.prepend(div);
};

window.editText = function(rkey, title, text) {
    currentRkey = rkey;
    titleInput.value = title;
    contentInput.value = text;
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
    contentInput.value = '';
}
