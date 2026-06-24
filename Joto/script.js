let session = null;
let currentTargetDid = null;
const JOTO_COLLECTION = 'com.alba.joto';

// Elementos DOM
const friendsContainer = document.getElementById('friendsContainer');
const chatArea = document.getElementById('chatArea');
const emptyState = document.getElementById('emptyState');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const charCount = document.getElementById('charCount');
const navMenuModal = document.getElementById('navMenuModal');
const deleteModal = document.getElementById('deleteModal');
const deleteChatBtn = document.getElementById('deleteChatBtn');

// Modales
function openNavMenu() { navMenuModal.style.display = "flex"; }
function closeNavMenu() { navMenuModal.style.display = "none"; }
function openDeleteModal() { deleteModal.style.display = "flex"; }
function closeDeleteModal() { deleteModal.style.display = "none"; }

window.onclick = function(event) {
    if (event.target == navMenuModal) closeNavMenu();
    if (event.target == deleteModal) closeDeleteModal();
}

// Inicialización: Redirigir a Alba si no hay sesión
window.onload = () => {
    const savedSession = localStorage.getItem('atprotoSession');
    if (!savedSession) {
        window.location.href = '../';
        return;
    }

    try {
        session = JSON.parse(savedSession);
        loadFriends();
    } catch (e) {
        window.location.href = '../';
    }
};

// Navegación del Carrusel con flechas
function scrollFriends(direction) {
    const scrollAmount = 200; // Pixeles a desplazar
    friendsContainer.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Cargar Lista de Amigos (A quienes sigo)
async function loadFriends() {
    try {
        const res = await fetch(`https://bsky.social/xrpc/app.bsky.graph.getFollows?actor=${session.did}&limit=30`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await res.json();

        friendsContainer.innerHTML = '';
        if(data.follows.length === 0) {
            friendsContainer.innerHTML = '<span style="color:var(--dim); font-size:0.9rem;">No sigues a nadie aún.</span>';
            return;
        }

        data.follows.forEach(f => {
            const div = document.createElement('div');
            div.className = 'friend-btn';
            div.id = `friend-${f.did}`;

            const avatarUrl = f.avatar || 'https://via.placeholder.com/55x55/111/444?text=U';
            const displayName = f.displayName || f.handle;

            div.onclick = () => openChat(f.did, f.handle, avatarUrl, displayName);

            div.innerHTML = `
            <div id="indicator-${f.did}" class="msg-indicator"></div>
            <img src="${avatarUrl}" alt="${f.handle}">
            <span>${f.handle}</span>
            `;
            friendsContainer.appendChild(div);
        });

        checkIncomingMessages(data.follows);

    } catch (e) {
        friendsContainer.innerHTML = '<span style="color:var(--dim); font-size:0.9rem;">Error al cargar conexiones.</span>';
    }
}

// Buscar mensajes dirigidos a mí en el PDS de cada amigo
async function checkIncomingMessages(friends) {
    for (const f of friends) {
        try {
            const res = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${f.did}&collection=${JOTO_COLLECTION}`);
            if (res.ok) {
                const data = await res.json();
                const hasMessageForMe = (data.records || []).some(r => r.value.recipient === session.did);
                if (hasMessageForMe) {
                    const indicator = document.getElementById(`indicator-${f.did}`);
                    if (indicator) indicator.style.display = 'block';
                }
            }
        } catch(e) {}
    }
}

// Abrir Conversación
function openChat(did, handle, avatarUrl, displayName) {
    currentTargetDid = did;

    // UI Updates
    document.querySelectorAll('.friend-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`friend-${did}`);
    if(activeBtn) activeBtn.classList.add('active');

    // Apagar el indicador visual
    const indicator = document.getElementById(`indicator-${did}`);
    if(indicator) indicator.style.display = 'none';

    // Actualizar Header
    const avatarImg = document.getElementById('chatAvatar');
    avatarImg.src = avatarUrl;
    avatarImg.style.display = 'block';

    document.getElementById('chatUserName').textContent = displayName;
    document.getElementById('chatUserHandle').textContent = `@${handle}`;

    emptyState.style.display = 'none';
    chatArea.style.display = 'flex';
    deleteChatBtn.style.display = 'block';

    refreshMessages();
}

// Renderizar Mensajes
async function refreshMessages() {
    messagesContainer.innerHTML = '<p style="text-align:center; color:var(--dim);">Cargando...</p>';

    let sent = [], received = [];
    try {
        const myRes = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=${JOTO_COLLECTION}`);
        const myData = await myRes.json();
        sent = (myData.records || []).filter(r => r.value.recipient === currentTargetDid).map(r => ({ ...r.value, type: 'self' }));
    } catch(e) {}

    try {
        const theirRes = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${currentTargetDid}&collection=${JOTO_COLLECTION}`);
        const theirData = await theirRes.json();
        received = (theirData.records || []).filter(r => r.value.recipient === session.did).map(r => ({ ...r.value, type: 'other' }));
    } catch(e) {}

    const allMessages = [...sent, ...received].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

    messagesContainer.innerHTML = '';

    // Burbuja de advertencia
    const warningDiv = document.createElement('div');
    warningDiv.className = 'msg-bubble msg-warning';
    warningDiv.innerHTML = '<b>Aviso de Privacidad</b><br>Joto no utiliza cifrado y opera sobre un PDS público. Evita enviar información sensible o personal.';
    messagesContainer.appendChild(warningDiv);

    // Renderizar mensajes con hora
    allMessages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `msg-bubble ${msg.type === 'self' ? 'msg-self' : 'msg-other'}`;

        // Texto del mensaje seguro
        const textDiv = document.createElement('div');
        textDiv.textContent = msg.text;

        // Hora de formato (ej: 14:30)
        const timeSpan = document.createElement('span');
        timeSpan.className = 'msg-time';
        timeSpan.textContent = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.appendChild(textDiv);
        div.appendChild(timeSpan);
        messagesContainer.appendChild(div);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Lógica de Input y Contador
messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCount.textContent = `${len}/512`;
    if(len >= 512) charCount.style.color = '#ff4444';
    else charCount.style.color = 'var(--dim)';
});

// Enviar Mensaje
document.getElementById('sendBtn').onclick = async () => {
    const text = messageInput.value.trim();
    if (!text || !currentTargetDid) return;

    try {
        await fetch(`https://bsky.social/xrpc/com.atproto.repo.createRecord`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.jwt}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                repo: session.did,
                collection: JOTO_COLLECTION,
                record: {
                    $type: JOTO_COLLECTION,
                    recipient: currentTargetDid,
                    text: text,
                    createdAt: new Date().toISOString()
                }
            })
        });
        messageInput.value = '';
        charCount.textContent = '0/512';
        refreshMessages();
    } catch (e) { alert("Error al enviar mensaje."); }
};

// Borrar Chat Propio
async function confirmDeleteChat() {
    try {
        const res = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=${JOTO_COLLECTION}`);
        const data = await res.json();
        const myMessages = data.records.filter(r => r.value.recipient === currentTargetDid);

        for (const msg of myMessages) {
            await fetch(`https://bsky.social/xrpc/com.atproto.repo.deleteRecord`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.jwt}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo: session.did, collection: JOTO_COLLECTION, rkey: msg.uri.split('/').pop() })
            });
        }
        closeDeleteModal();
        refreshMessages();
    } catch (e) { alert("Error al borrar el chat."); }
}
