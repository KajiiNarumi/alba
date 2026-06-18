let session = null;
let currentRkey = null;
let currentTasks = [];

const userStatus = document.getElementById('userStatus');
const navMenuModal = document.getElementById('navMenuModal');

// ==================== MENÚ ====================
function openNavMenu() { navMenuModal.style.display = "flex"; }
function closeNavMenu() { navMenuModal.style.display = "none"; }
window.onclick = function(event) {
    if (event.target == navMenuModal) closeNavMenu();
};

// ==================== INICIALIZACIÓN ====================
window.onload = () => {
    const saved = localStorage.getItem('atprotoSession');
    if (saved) {
        session = JSON.parse(saved);
        userStatus.textContent = `Conectado como: ${session.handle}`;
        loadActiveProjects();
        loadArchive();
    } else {
        alert("No hay sesión activa. Redirigiendo a Alba...");
        window.location.href = '../../';
    }
};

// ==================== LIMPIAR EDITOR ====================
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
    if (!name) {
        alert("Escribe el nombre de la tarea");
        return;
    }
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
    if (!session) return;
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

// ==================== FUNCIONES AUXILIARES ====================
function daysRemaining(endDate) {
    if (!endDate) return "—";
    const diff = new Date(endDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} día${days > 1 ? 's' : ''}` : "Vencido";
}

// (El resto de funciones: loadActiveProjects, loadArchive, toggleExpand, toggleTaskDone, finishProject, editProject, cloneToEditor, deleteProject, publishProject se mantienen igual que en la versión anterior)

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
            const progress = p.porcentaje || calculateProgress(p.tareas);

            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div class="project-header" onclick="toggleExpand(this)">
                    <div class="project-info">
                        <strong>${p.motivo}</strong>
                        <span>${p.categoria || ''}</span>
                        <span>${progress}%</span>
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

window.finishProject = async function(rkey) { /* misma función anterior */ };
window.editProject = async function(rkey) { /* misma */ };
window.cloneToEditor = async function(rkey) { /* misma */ };
window.deleteProject = async function(rkey) { /* misma */ };
window.publishProject = function(rkey, motivo) { /* misma */ };

async function loadArchive() { /* misma función anterior */ }
