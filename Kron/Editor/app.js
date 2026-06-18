let session = null;
let currentRkey = null;
let currentTasks = [];
let sessionCheckInterval = null;

const userStatus = document.getElementById('userStatus');
const navMenuModal = document.getElementById('navMenuModal');

// ==================== MENÚ ====================
function openNavMenu() { navMenuModal.style.display = "flex"; }
function closeNavMenu() { navMenuModal.style.display = "none"; }
window.onclick = function(event) {
    if (event.target == navMenuModal) closeNavMenu();
};

// ==================== VERIFICACIÓN DE SESIÓN ====================
async function checkSession(silent = false) {
    if (!session || !session.jwt) {
        handleSessionExpired();
        return false;
    }
    try {
        const resp = await fetch(`https://bsky.social/xrpc/com.atproto.server.getSession`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        if (!resp.ok) throw new Error();
        return true;
    } catch (e) {
        if (!silent) handleSessionExpired();
        return false;
    }
}

function handleSessionExpired() {
    userStatus.innerHTML = `<span style="color:#ff6666;">Sesión expirada</span> 
        <button onclick="renewSession()" style="margin-left:10px; padding:5px 10px; font-size:0.9rem;">Renovar Sesión</button>`;
}

window.renewSession = function() {
    const tempData = {
        projectTitle: document.getElementById('projectTitle').value,
        description: document.getElementById('description').value,
        category: document.getElementById('category').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        tasks: currentTasks
    };
    localStorage.setItem('kronTempForm', JSON.stringify(tempData));
    
    localStorage.removeItem('atprotoSession');
    window.location.href = '../../';
};

function loadTempFormData() {
    const saved = localStorage.getItem('kronTempForm');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('projectTitle').value = data.projectTitle || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('category').value = data.category || '';
        document.getElementById('startDate').value = data.startDate || '';
        document.getElementById('endDate').value = data.endDate || '';
        currentTasks = data.tasks || [];
        renderCurrentTasks();
        localStorage.removeItem('kronTempForm');
    }
}

// ==================== INICIALIZACIÓN ====================
window.onload = () => {
    const saved = localStorage.getItem('atprotoSession');
    if (saved) {
        session = JSON.parse(saved);
        userStatus.textContent = `Conectado como: ${session.handle}`;
        loadTempFormData();
        loadActiveProjects();
        loadArchive();

        // Verificación automática cada 5 minutos
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
        sessionCheckInterval = setInterval(() => checkSession(true), 300000);
    } else {
        alert("No hay sesión activa. Redirigiendo...");
        window.location.href = '../../';
    }
};

// ==================== LIMPIAR ====================
function clearEditor() {
    currentRkey = null;
    currentTasks = [];
    document.getElementById('projectTitle').value = '';
    document.getElementById('description').value = '';
    document.getElementById('category').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('currentTasksList').innerHTML = '';
}

// ==================== TAREAS ====================
function addTaskToList() {
    const name = document.getElementById('taskName').value.trim();
    const date = document.getElementById('taskDate').value;
    if (!name) return alert("Escribe el nombre de la tarea");
    currentTasks.push({ nombre: name, fecha: date, completada: false });
    renderCurrentTasks();
    document.getElementById('taskName').value = '';
    document.getElementById('taskDate').value = '';
}

function renderCurrentTasks() {
    const container = document.getElementById('currentTasksList');
    container.innerHTML = '';
    currentTasks.forEach((task, i) => {
        const div = document.createElement('div');
        div.style.margin = '8px 0';
        div.innerHTML = `
            <span style="flex:1">${task.nombre} ${task.fecha ? `— ${task.fecha}` : ''}</span>
            <button onclick="moveTask(${i}, -1)">↑</button>
            <button onclick="moveTask(${i}, 1)">↓</button>
            <button onclick="removeTask(${i})">Eliminar</button>
        `;
        container.appendChild(div);
    });
}

window.moveTask = function(i, dir) {
    const newI = i + dir;
    if (newI < 0 || newI >= currentTasks.length) return;
    [currentTasks[i], currentTasks[newI]] = [currentTasks[newI], currentTasks[i]];
    renderCurrentTasks();
};

window.removeTask = function(i) {
    currentTasks.splice(i, 1);
    renderCurrentTasks();
};

function calculateProgress(tasks) {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter(t => t.completada).length;
    return Math.round((done / tasks.length) * 100);
}

// ==================== GUARDAR ====================
async function saveProject() {
    if (!(await checkSession())) return;
    const motivo = document.getElementById('projectTitle').value.trim() || "Sin título";
    const descripcion = document.getElementById('description').value.trim();
    const categoria = document.getElementById('category').value.trim();
    const fechaInicio = document.getElementById('startDate').value;
    const fechaFin = document.getElementById('endDate').value;

    const rkey = currentRkey || Date.now().toString(36) + Math.random().toString(36).substr(2);

    try {
        await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.jwt}` },
            body: JSON.stringify({
                repo: session.did,
                collection: "com.alba.kron",
                rkey: rkey,
                record: {
                    $type: "com.alba.kron",
                    activo: true,
                    estado: "activo",
                    motivo: motivo,
                    descripcion: descripcion,
                    categoria: categoria,
                    fechaInicio: fechaInicio,
                    fechaFin: fechaFin,
                    tareas: currentTasks,
                    porcentaje: calculateProgress(currentTasks),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            })
        });
        alert("Proyecto guardado correctamente");
        clearEditor();
        loadActiveProjects();
        loadArchive();
    } catch (e) { alert("Error al guardar: " + e.message); }
}

// ==================== DÍAS RESTANTES ====================
function daysRemaining(endDate) {
    if (!endDate) return "—";
    const diff = new Date(endDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} día${days > 1 ? 's' : ''}` : "Vencido";
}

// ==================== CARGAR ACTIVOS ====================
async function loadActiveProjects() {
    const container = document.getElementById('activeProjects');
    container.innerHTML = "<p>Cargando...</p>";
    try {
        const resp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=com.alba.kron&limit=50`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await resp.json();
        container.innerHTML = '';
        const active = data.records.filter(r => r.value.activo === true);

        if (active.length === 0) {
            container.innerHTML = "<p>No tienes proyectos activos.</p>";
            return;
        }

        active.forEach(rec => {
            const rkey = rec.uri.split('/').pop();
            const p = rec.value;
            const total = p.tareas ? p.tareas.length : 0;
            const pending = total - (p.tareas ? p.tareas.filter(t => t.completada).length : 0);
            const progress = p.porcentaje || calculateProgress(p.tareas);

            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div class="project-header" onclick="toggleExpand(this)">
                    <div class="project-info">
                        <strong>${p.motivo}</strong>
                        <span>${p.categoria || ''}</span>
                        <span>${progress}% • ${pending} pendientes</span>
                        <span>Vence en ${daysRemaining(p.fechaFin)}</span>
                    </div>
                    <span class="toggle-btn">+</span>
                </div>
                <div class="project-details">
                    <p><strong>Descripción:</strong> ${p.descripcion || 'Sin descripción'}</p>
                    <div class="checklist">
                        ${p.tareas ? p.tareas.map((t, i) => `
                            <label>
                                <input type="checkbox" ${t.completada ? 'checked' : ''} onchange="toggleTaskDone('${rkey}', ${i}, this.checked)">
                                ${t.nombre} ${t.fecha ? `— ${t.fecha}` : ''}
                            </label>`).join('') : ''}
                    </div>
                    <div class="actions">
                        <button onclick="editProject('${rkey}')">Editar</button>
                        <button onclick="finishProject('${rkey}')">Terminar</button>
                        <button onclick="deleteProject('${rkey}')">Eliminar</button>
                        <button onclick="publishProject('${rkey}', '${p.motivo}')">Publicar</button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { container.innerHTML = "<p>Error al cargar.</p>"; }
}

window.toggleExpand = function(header) {
    const card = header.parentElement;
    card.classList.toggle('expanded');
    header.querySelector('.toggle-btn').textContent = card.classList.contains('expanded') ? '−' : '+';
};

window.toggleTaskDone = async function(rkey, taskIndex, isDone) {
    if (!(await checkSession())) return;
    try {
        const getResp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${session.did}&collection=com.alba.kron&rkey=${rkey}`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await getResp.json();
        const record = data.value;
        record.tareas[taskIndex].completada = isDone;
        record.porcentaje = calculateProgress(record.tareas);
        record.updatedAt = new Date().toISOString();

        await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.jwt}` },
            body: JSON.stringify({ repo: session.did, collection: "com.alba.kron", rkey, record })
        });
        loadActiveProjects();
    } catch (e) { alert("Error al actualizar tarea"); }
};

// ==================== TERMINAR ====================
window.finishProject = async function(rkey) {
    if (!(await checkSession())) return;
    if (!confirm("¿Archivar este proyecto?")) return;
    try {
        const getResp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${session.did}&collection=com.alba.kron&rkey=${rkey}`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await getResp.json();
        const record = data.value;

        const terminarTask = record.tareas.find(t => t.nombre === "Terminar proyecto");
        if (terminarTask) terminarTask.completada = true;

        record.activo = false;
        record.estado = "terminado";
        record.porcentaje = calculateProgress(record.tareas);
        record.updatedAt = new Date().toISOString();

        await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.jwt}` },
            body: JSON.stringify({ repo: session.did, collection: "com.alba.kron", rkey, record })
        });
        loadActiveProjects();
        loadArchive();
    } catch (e) { alert("Error al terminar"); }
};

// ==================== ARCHIVO ====================
async function loadArchive() {
    const container = document.getElementById('archiveList');
    container.innerHTML = "<p>Cargando archivo...</p>";
    try {
        const resp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${session.did}&collection=com.alba.kron&limit=50`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await resp.json();
        container.innerHTML = '';
        const archived = data.records.filter(r => r.value.activo === false);

        if (archived.length === 0) {
            container.innerHTML = "<p>El archivo está vacío.</p>";
            return;
        }

        archived.forEach(rec => {
            const rkey = rec.uri.split('/').pop();
            const p = rec.value;
            const status = p.estado === "terminado" ? "✅ Terminado" : "⛔ Vencido";
            const progress = p.porcentaje || 0;

            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div class="project-header" onclick="toggleExpand(this)">
                    <div class="project-info">
                        <strong>${p.motivo}</strong>
                        <span>${p.categoria || ''}</span>
                        <span>${p.fechaInicio} → ${p.fechaFin}</span>
                        <span>${progress}%</span>
                        <span>${status}</span>
                    </div>
                    <span class="toggle-btn">+</span>
                </div>
                <div class="project-details">
                    <p><strong>Descripción:</strong> ${p.descripcion || 'Sin descripción'}</p>
                    <div class="actions">
                        <button onclick="cloneToEditor('${rkey}')">Clonar</button>
                        <button onclick="deleteProject('${rkey}')">Eliminar</button>
                        <button onclick="publishProject('${rkey}', '${p.motivo}')">Publicar</button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { container.innerHTML = "<p>Error al cargar archivo.</p>"; }
};

// ==================== EDITAR Y CLONAR ====================
window.editProject = async function(rkey) {
    if (!(await checkSession())) return;
    try {
        const getResp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${session.did}&collection=com.alba.kron&rkey=${rkey}`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await getResp.json();
        const p = data.value;
        currentRkey = rkey;
        loadDataToEditor(p);
    } catch (e) { alert("Error al editar"); }
};

window.cloneToEditor = async function(rkey) {
    if (!(await checkSession())) return;
    try {
        const getResp = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${session.did}&collection=com.alba.kron&rkey=${rkey}`, {
            headers: { 'Authorization': `Bearer ${session.jwt}` }
        });
        const data = await getResp.json();
        const p = data.value;
        currentRkey = null;
        loadDataToEditor(p);
    } catch (e) { alert("Error al clonar"); }
};

function loadDataToEditor(p) {
    document.getElementById('projectTitle').value = p.motivo || '';
    document.getElementById('description').value = p.descripcion || '';
    document.getElementById('category').value = p.categoria || '';
    document.getElementById('startDate').value = p.fechaInicio || '';
    document.getElementById('endDate').value = p.fechaFin || '';
    currentTasks = JSON.parse(JSON.stringify(p.tareas || []));
    renderCurrentTasks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.deleteProject = async function(rkey) {
    if (!(await checkSession())) return;
    if (!confirm("¿Eliminar permanentemente?")) return;
    try {
        await fetch('https://bsky.social/xrpc/com.atproto.repo.deleteRecord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.jwt}` },
            body: JSON.stringify({ repo: session.did, collection: "com.alba.kron", rkey })
        });
        loadActiveProjects();
        loadArchive();
    } catch (e) { alert("Error al eliminar"); }
};

window.publishProject = function(rkey, motivo) {
    const shareUrl = `${window.location.origin}/Kron/?${session.handle}&rkey=${rkey}`;
    const text = `🕰️ ${motivo}\n\n${shareUrl}`;
    window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`, '_blank');
};
