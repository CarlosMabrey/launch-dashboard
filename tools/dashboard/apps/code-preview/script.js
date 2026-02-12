// App State
let snippets = [];
let currentSnippetId = null;

// DOM Elements
const htmlEditor = document.getElementById('html-editor');
const cssEditor = document.getElementById('css-editor');
const jsEditor = document.getElementById('js-editor');
const previewIframe = document.getElementById('preview-iframe');
const snippetList = document.getElementById('snippet-list');
const repoCount = document.getElementById('repo-count');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const fileInput = document.getElementById('file-input');
const newBtn = document.getElementById('new-snippet-btn');
const modal = document.getElementById('modal');
const snippetNameInput = document.getElementById('snippet-name');
const modalSave = document.getElementById('modal-save');
const modalCancel = document.getElementById('modal-cancel');
const resizer = document.getElementById('resizer');
const toggleSidebar = document.getElementById('toggle-sidebar');
const mainContainer = document.querySelector('main');

// File-based Storage
async function saveSnippetsToFile() {
    try {
        const response = await fetch('/api/snippets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snippets)
        });

        if (response.ok) {
            // Refresh from server to get any server-side changes (deduplication, timestamps)
            await refreshSnippets(false);
            alert('Snippets saved to saved/graphite_snippets.json');
        } else {
            alert('Failed to save snippets');
        }
    } catch (error) {
        alert('Error saving snippets: ' + error.message);
    }
}

async function loadSnippetsFromFile() {
    try {
        const response = await fetch('/api/snippets');
        if (response.ok) {
            const loadedSnippets = await response.json();
            console.log('Loaded snippets from API:', loadedSnippets.length);
            snippets = loadedSnippets;
            localStorage.setItem('graphite_snippets', JSON.stringify(snippets));
            renderSnippetList();
            if (snippets.length > 0) {
                loadSnippet(snippets[0].id);
            } else {
                updatePreview();
            }
            alert('Snippets loaded from saved/graphite_snippets.json');
        } else {
            alert('Failed to load snippets');
        }
    } catch (error) {
        alert('Error loading snippets: ' + error.message);
    }
}

// Refresh snippets from server (used to sync after external changes)
async function refreshSnippets(showAlert = false) {
    try {
        const response = await fetch('/api/snippets');
        if (response.ok) {
            const serverSnippets = await response.json();
            const oldLength = snippets.length;
            snippets = serverSnippets;
            localStorage.setItem('graphite_snippets', JSON.stringify(snippets));
            renderSnippetList();
            if (showAlert && serverSnippets.length !== oldLength) {
                alert(`Snippet library refreshed: ${serverSnippets.length} snippets (was ${oldLength})`);
            }
        }
    } catch (error) {
        console.error('Failed to refresh snippets:', error);
    }
}

// Initial Loading from server (with localStorage fallback)
async function initStorage() {
    try {
        // Try to load from server first
        const response = await fetch('/api/snippets');
        if (response.ok) {
            const serverSnippets = await response.json();
            snippets = serverSnippets;
            localStorage.setItem('graphite_snippets', JSON.stringify(snippets));
            console.log('Loaded snippets from server:', snippets.length);
        } else {
            throw new Error('Server load failed');
        }
    } catch (error) {
        console.warn('Failed to load from server, falling back to localStorage:', error);
        const local = localStorage.getItem('graphite_snippets');
        if (local) {
            try {
                snippets = JSON.parse(local);
                console.log('Loaded snippets from localStorage:', snippets.length);
            } catch (e) {
                console.error('Failed to parse localStorage data');
                snippets = [];
            }
        } else {
            snippets = [];
        }
    }

    renderSnippetList();
    if (snippets.length > 0) loadSnippet(snippets[0].id);
    else updatePreview();
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.code-editor').forEach(e => e.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-editor`).classList.add('active');
    });
});

// Update Preview
function updatePreview() {
    const html = htmlEditor.value;
    const css = cssEditor.value;
    const js = jsEditor.value;

    const source = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>${css}</style>
            </head>
            <body>
                ${html}
                <script>${js}<\/script>
            </body>
        </html>
    `;

    const blob = new Blob([source], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    previewIframe.src = url;
}

// Throttled update
let timeout;
[htmlEditor, cssEditor, jsEditor].forEach(editor => {
    editor.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(updatePreview, 500);
    });
});

// Persistence
async function saveSnippet() {
    const name = snippetNameInput.value.trim() || 'Untitled_Snippet';
    const newSnippet = {
        id: currentSnippetId || Date.now().toString(),
        name: name,
        html: htmlEditor.value,
        css: cssEditor.value,
        js: jsEditor.value,
        timestamp: new Date().toLocaleString()
    };

    if (currentSnippetId) {
        snippets = snippets.map(s => s.id === currentSnippetId ? newSnippet : s);
    } else {
        snippets.unshift(newSnippet);
        currentSnippetId = newSnippet.id;
    }

    localStorage.setItem('graphite_snippets', JSON.stringify(snippets));
    renderSnippetList();
    closeModal();
}

async function deleteSnippet(id, e) {
    if (e) e.stopPropagation();
    snippets = snippets.filter(s => s.id !== id);
    if (currentSnippetId === id) {
        currentSnippetId = null;
        clearEditors();
    }
    localStorage.setItem('graphite_snippets', JSON.stringify(snippets));
    renderSnippetList();
}

function loadSnippet(id) {
    const snippet = snippets.find(s => s.id === id);
    if (!snippet) return;

    currentSnippetId = snippet.id;
    htmlEditor.value = snippet.html;
    cssEditor.value = snippet.css;
    jsEditor.value = snippet.js;

    updatePreview();
    renderSnippetList();
}

function clearEditors() {
    currentSnippetId = null;
    htmlEditor.value = '';
    cssEditor.value = '';
    jsEditor.value = '';
    updatePreview();
    renderSnippetList();
}

// Rendering
function renderSnippetList() {
    console.log('renderSnippetList called with', snippets.length, 'snippets');
    snippetList.innerHTML = '';
    repoCount.textContent = `OBJECTS: ${snippets.length}`;

    snippets.forEach(snippet => {
        const item = document.createElement('div');
        item.className = `snippet-item ${snippet.id === currentSnippetId ? 'active' : ''}`;
        item.innerHTML = `
            <span>${snippet.timestamp} // ${snippet.id.slice(-4)}</span>
            <h3>${snippet.name}</h3>
            <div class="delete-snippet" onclick="deleteSnippet('${snippet.id}', event)">[DELETE]</div>
        `;
        item.addEventListener('click', () => loadSnippet(snippet.id));
        snippetList.appendChild(item);
    });
}

// Modal handling
function openModal() {
    const current = snippets.find(s => s.id === currentSnippetId);
    snippetNameInput.value = current ? current.name : '';
    modal.classList.add('active');
    snippetNameInput.focus();
}

function closeModal() {
    modal.classList.remove('active');
}

// Event Listeners
saveBtn.addEventListener('click', openModal);
clearBtn.addEventListener('click', clearEditors);
newBtn.addEventListener('click', clearEditors);
modalSave.addEventListener('click', saveSnippet);
modalCancel.addEventListener('click', closeModal);
snippetNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSnippet();
});

// Export/Import functionality
exportBtn.addEventListener('click', saveSnippetsToFile);
importBtn.addEventListener('click', loadSnippetsFromFile);

// Sidebar Toggle
toggleSidebar.addEventListener('click', () => {
    mainContainer.classList.toggle('sidebar-collapsed');
    toggleSidebar.textContent = mainContainer.classList.contains('sidebar-collapsed') ? '+' : '_';
});

// Preview Resizer
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    resizer.classList.add('dragging');
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const width = window.innerWidth - e.clientX;
    const percentage = (width / window.innerWidth) * 100;
    // Limit resize between 20% and 75%
    if (percentage > 20 && percentage < 75) {
        document.documentElement.style.setProperty('--preview-width', `${percentage}%`);
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'crosshair';
        resizer.classList.remove('dragging');
    }
});

// Initialize
initStorage();

// Kinetic Mouse tracking (from original)
const pane = document.querySelector('.preview-pane');
const canvas = document.querySelector('.preview-canvas');

pane.addEventListener('mousemove', (e) => {
    const rect = pane.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 25; // Adjusted sensitivity
    const rotateY = (centerX - x) / 25;

    canvas.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

pane.addEventListener('mouseleave', () => {
    canvas.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg)`;
});
