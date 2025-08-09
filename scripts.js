(function(){
  const board = document.getElementById('board');
  const newFileBtn = document.getElementById('newFileBtn');
  const openFileBtn = document.getElementById('openFileBtn');
  const saveFileBtn = document.getElementById('saveFileBtn');
  const saveFileAsBtn = document.getElementById('saveFileAsBtn');
  const addGroupBtn = document.getElementById('addGroupBtn');
  const groupTpl = document.getElementById('group-tpl');
  const noteTpl = document.getElementById('note-tpl');
  const trackerTpl = document.getElementById('tracker-tpl');
  const fileInput = document.getElementById('fileInput');
  const fileMenuToggle = document.getElementById('fileMenuToggle');
  const fileMenu = document.getElementById('fileMenu');

  const GROUP_COLORS = [
      '#2e2e2e',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffff00',
      '#ff8c00',
      '#800080'
  ];

  let state = {
    groups: [],
    trash: [],
    tracker: {
      roomsSoldCount: 0,
      adultsCount: 0,
      childrenCount: 0,
      arrivalsCount: 0
    },
    currentFileName: 'File'
  };
  let isUnsaved = false;
  let appTitle = document.title;

  function updateTitle() {
    document.title = isUnsaved ? `${appTitle}*` : appTitle;
  }

  function markAsUnsaved() {
    if (!isUnsaved) {
      isUnsaved = true;
      updateTitle();
    }
  }
  function markAsSaved() {
      isUnsaved = false;
      updateTitle();
  }

  window.addEventListener('beforeunload', (e) => {
      if (isUnsaved) {
          e.preventDefault();
          e.returnValue = '';
      }
  });

  const uid = () => Math.random().toString(36).slice(2,9);

  function saveToLocalStorage() {
    try {
      localStorage.setItem('scratchpad-state', JSON.stringify(state));
      markAsSaved();
    } catch(e){ console.error(e); }
  }
  function loadFromLocalStorage(){
    try {
      const j = localStorage.getItem('scratchpad-state');
      if(j) {
        state = JSON.parse(j);
        state.groups = state.groups || [];
        state.trash = state.trash || [];
        state.tracker = state.tracker || { roomsSoldCount: 0, adultsCount: 0, childrenCount: 0, arrivalsCount: 0 };
      }
    } catch(e){ console.error(e); }
  }

  function createGroup(name){ return { id: uid(), name: name || 'New Group', notes: [], colorIndex: 0 }; }
  function createNote(text){ return { id: uid(), text: text || '', created: Date.now() , collapsed: false }; }

  function render(){
    board.innerHTML = '';
    state.groups.forEach(g => {
      board.appendChild(renderGroup(g));
    });
    if(state.trash.length > 0) {
      board.appendChild(renderTrashGroup());
    }
    renderTracker();
  }
  
  function renderTracker() {
    const trackerContainer = document.getElementById('tracker');
    trackerContainer.innerHTML = '';

    const trackerData = [
      { key: 'roomsSoldCount', label: 'RMS' },
      { key: 'adultsCount', label: 'A' },
      { key: 'childrenCount', label: 'C' },
      { key: 'arrivalsCount', label: 'RES' }
    ];

    trackerData.forEach(item => {
      const frag = trackerTpl.content.cloneNode(true);
      const trackerItem = frag.querySelector('.tracker-item');
      const valueEl = trackerItem.querySelector('.tracker-value');
      const increaseBtn = trackerItem.querySelector('.increase');
      const decreaseBtn = trackerItem.querySelector('.decrease');
      const labelEl = trackerItem.querySelector('.tracker-label');

      valueEl.textContent = state.tracker[item.key];
      labelEl.textContent = item.label;

      increaseBtn.addEventListener('click', () => {
        state.tracker[item.key]++;
        markAsUnsaved();
        saveToLocalStorage();
        renderTracker();
      });

      decreaseBtn.addEventListener('click', () => {
        if (state.tracker[item.key] > 0) {
          state.tracker[item.key]--;
          markAsUnsaved();
          saveToLocalStorage();
          renderTracker();
        }
      });
      trackerContainer.appendChild(trackerItem);
    });
  }


  function renderGroup(group){
    const frag = groupTpl.content.cloneNode(true);
    const section = frag.querySelector('.group');
    section.dataset.id = group.id;
    section.style.backgroundColor = GROUP_COLORS[group.colorIndex];
    section.style.borderColor = '#444444';

    const nameInput = section.querySelector('.group-name');
    nameInput.value = group.name;
    nameInput.addEventListener('input', (e)=> {
      group.name = e.target.value;
      markAsUnsaved();
      saveToLocalStorage();
    });

    const noteList = section.querySelector('.note-list');

    noteList.addEventListener('dragover', e => {
      e.preventDefault();
      const after = getDragAfterElement(noteList, e.clientY);
      showDropHint(noteList, after);
    });
    noteList.addEventListener('dragleave', e => { hideDropHints(noteList); });
    noteList.addEventListener('drop', e => {
      e.preventDefault();
      hideDropHints(noteList);
      const noteId = e.dataTransfer.getData('text/plain');
      if(!noteId) return;
      const fromGroup = findNoteOwner(noteId);
      if(!fromGroup) return;
      const note = fromGroup.notes.find(n=>n.id===noteId);
      if(!note) return;
      fromGroup.notes = fromGroup.notes.filter(n=>n.id!==noteId);
      const after = getDragAfterElement(noteList, e.clientY);
      const targetGroup = state.groups.find(g => g.id === section.dataset.id);
      if(after == null){
        targetGroup.notes.push(note);
      } else {
        const idx = Array.from(noteList.children).indexOf(after);
        targetGroup.notes.splice(idx, 0, note);
      }
      markAsUnsaved();
      saveToLocalStorage();
      render();
    });

    const toggleColorBtn = section.querySelector('.btn-color');
    toggleColorBtn.addEventListener('click', () => {
      group.colorIndex = (group.colorIndex + 1) % GROUP_COLORS.length;
      section.style.backgroundColor = GROUP_COLORS[group.colorIndex];
      
      const notesInGroup = section.querySelectorAll('.note');
      notesInGroup.forEach(noteEl => {
          noteEl.style.backgroundColor = GROUP_COLORS[group.colorIndex];
      });

      markAsUnsaved();
      saveToLocalStorage();
    });

    const deleteGroupBtn = section.querySelector('.btn-delete-group');
    deleteGroupBtn.addEventListener('click', ()=>{
      if(!confirm(`Delete group "${group.name}" and its ${group.notes.length} notes?`)) return;
      state.groups = state.groups.filter(g=>g.id !== group.id);
      state.trash.unshift(group);
      markAsUnsaved();
      saveToLocalStorage();
      render();
    });

    group.notes.forEach(n => noteList.appendChild(renderNote(n, group.colorIndex)));

    const addNoteHere = document.createElement('div');
    addNoteHere.className = 'add-note-button';
    addNoteHere.textContent = '+ Add Note';
    addNoteHere.addEventListener('click', () => {
        const n = createNote('');
        group.notes.push(n);
        markAsUnsaved();
        saveToLocalStorage();
        render();
        setTimeout(() => {
            const el = document.querySelector(`[data-id="${n.id}"] .note-body`);
            if (el) { el.focus(); placeCaretAtEnd(el); }
        }, 50);
    });
    noteList.appendChild(addNoteHere);

    return section;
  }

  function renderTrashGroup() {
    const trashGroup = { id: 'trash', name: 'Trash', notes: state.trash.flatMap(g => g.notes), colorIndex: 0 };
    const frag = groupTpl.content.cloneNode(true);
    const section = frag.querySelector('.group');
    section.classList.add('trash-group');
    section.querySelector('.group-name').value = 'Trash';
    section.querySelector('.group-name').setAttribute('disabled', true);
    section.querySelector('.group-actions').innerHTML = `
        <button class="btn-icon btn-clear-trash" title="Empty Trash"><i class="material-icons">delete_sweep</i></button>
    `;

    const noteList = section.querySelector('.note-list');

    trashGroup.notes.forEach(n => {
        const noteArt = renderNote(n, trashGroup.colorIndex);
        noteArt.querySelector('.btn-delete').style.display = 'none';
        noteArt.querySelector('.btn-collapse').style.display = 'none';
        noteArt.draggable = false;

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'btn-icon';
        restoreBtn.innerHTML = '<i class="material-icons">restore_from_trash</i>';
        restoreBtn.title = 'Restore';
        restoreBtn.addEventListener('click', () => {
            const owner = state.trash.find(g => g.notes.some(note => note.id === n.id));
            owner.notes = owner.notes.filter(note => note.id !== n.id);
            if (!state.groups.find(g => g.name === owner.name)) {
                state.groups.push(owner);
            } else {
                const originalGroup = state.groups.find(g => g.name === owner.name);
                originalGroup.notes.push(n);
            }
            state.trash = state.trash.filter(g => g.notes.length > 0);
            markAsUnsaved();
            saveToLocalStorage();
            render();
        });
        noteArt.querySelector('.note-controls').prepend(restoreBtn);
        noteList.appendChild(noteArt);
    });

    const clearTrashBtn = section.querySelector('.btn-clear-trash');
    clearTrashBtn.addEventListener('click', () => {
        if (confirm('Permanently delete all notes in the trash?')) {
            state.trash = [];
            markAsUnsaved();
            saveToLocalStorage();
            render();
        }
    });

    return section;
  }


  function renderNote(note, groupColorIndex){
    const frag = noteTpl.content.cloneNode(true);
    const art = frag.querySelector('.note');
    art.dataset.id = note.id;
    art.style.backgroundColor = GROUP_COLORS[groupColorIndex];
    const body = art.querySelector('.note-body');
    body.innerText = note.text || '';
    body.setAttribute('aria-label', 'Note');
    
    if(note.collapsed){
      body.classList.add('collapsed');
      body.setAttribute('contenteditable', 'false');
      body.innerText = firstLine(note.text || '');
      art.querySelector('.btn-collapse i').textContent = 'expand_more';
    } else {
      body.classList.remove('collapsed');
      body.setAttribute('contenteditable', 'true');
      art.querySelector('.btn-collapse i').textContent = 'expand_less';
    }

    body.addEventListener('input', ()=> {
      note.text = body.innerText;
      markAsUnsaved();
      saveToLocalStorage();
    });

    const copyBtn = art.querySelector('.btn-copy');
    copyBtn.addEventListener('click', async ()=>{
      try {
        await copyToClipboard(note.text || '');
        temporarilyNotify(copyBtn, '✓');
      } catch(e){
        alert('Copy failed: ' + (e && e.message ? e.message : e));
      }
    });

    const collapseBtn = art.querySelector('.btn-collapse');
    collapseBtn.addEventListener('click', ()=>{
      note.collapsed = !note.collapsed;
      if(note.collapsed){
        body.setAttribute('contenteditable', 'false');
        body.classList.add('collapsed');
        body.innerText = firstLine(note.text || '');
        collapseBtn.querySelector('i').textContent = 'expand_more';
      } else {
        body.setAttribute('contenteditable', 'true');
        body.classList.remove('collapsed');
        body.innerText = note.text || '';
        collapseBtn.querySelector('i').textContent = 'expand_less';
        setTimeout(()=> { body.focus(); placeCaretAtEnd(body); }, 40);
      }
      markAsUnsaved();
      saveToLocalStorage();
    });

    const deleteBtn = art.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', ()=>{
      if(!confirm('Delete this note?')) return;
      const owner = findNoteOwner(note.id);
      if(!owner) return;
      owner.notes = owner.notes.filter(n=>n.id !== note.id);
      state.trash.unshift(createNote(note.text));
      markAsUnsaved();
      saveToLocalStorage();
      render();
    });

    art.addEventListener('dragstart', e=>{
      art.classList.add('dragging');
      e.dataTransfer.setData('text/plain', note.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    art.addEventListener('dragend', e=>{
      art.classList.remove('dragging');
      const list = art.closest('.note-list');
      hideDropHints(list);
    });

    return art;
  }

  function firstLine(text){
    if(!text) return '';
    const idx = text.indexOf('\n');
    if(idx === -1) return text;
    return text.slice(0, idx);
  }

  function findNoteOwner(noteId){
    for(const g of state.groups) if(g.notes.some(n => n.id === noteId)) return g;
    return null;
  }

  function getDragAfterElement(container, y){
    const draggableElements = [...container.querySelectorAll('.note:not(.dragging)')];
    let closest = null;
    let offset = Number.NEGATIVE_INFINITY;
    for(const child of draggableElements){
      const box = child.getBoundingClientRect();
      const offsetVal = y - box.top - box.height/2;
      if(offsetVal > offset){
        offset = offsetVal;
        closest = child;
      }
    }
    return closest;
  }

  function showDropHint(list, afterEl){
    hideDropHints(list);
    const hint = document.createElement('div');
    hint.className = 'drop-hint';
    hint.dataset.hint = '1';
    if(afterEl) list.insertBefore(hint, afterEl);
    else list.appendChild(hint);
  }
  function hideDropHints(list){
    if(!list) return;
    list.querySelectorAll('[data-hint]').forEach(n => n.remove());
  }

  async function copyToClipboard(text){
    if(!text) text = '';
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try{
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if(ok) resolve();
        else reject(new Error('copy command failed'));
      }catch(err){ reject(err); }
    });
  }

  function temporarilyNotify(btn, text){
    const prev = btn.textContent;
    btn.textContent = text;
    setTimeout(()=> btn.textContent = prev, 800);
  }

  function placeCaretAtEnd(el){
    el.focus();
    if (typeof window.getSelection != "undefined"
      && typeof document.createRange != "undefined"){
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
      const textRange = document.body.createTextRange();
      textRange.moveToElementText(el);
      textRange.collapse(false);
      textRange.select();
    }
  }

  function saveFile(saveAs) {
      if (!isUnsaved && !saveAs) {
          return;
      }

      let fileName = state.currentFileName;
      if (!fileName || saveAs) {
          fileName = prompt("Enter a file name:", state.currentFileName || 'MyNotes');
          if (!fileName) {
              return;
          }
          state.currentFileName = fileName;
      }
      document.getElementById('fileName').textContent = fileName;

      const trackerData = `${state.tracker.roomsSoldCount} ROOMS SOLD, ${state.tracker.adultsCount} ADULTS, ${state.tracker.childrenCount} CHILDREN, ${state.tracker.arrivalsCount} ARRIVALS`;
      const firstGroupNotes = state.groups.length > 0 ? state.groups[0].notes : [];
      const notesData = firstGroupNotes.map(n => n.text).join("\n\n");
      const fileContent = `${trackerData}\n\n${notesData}`;

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      markAsSaved();
  }

  function newFile() {
      if (isUnsaved && !confirm('You have unsaved changes. Do you want to discard them and create a new file?')) {
          return;
      }
      state = {
          groups: [createGroup('Untagged')],
          trash: [],
          tracker: { roomsSoldCount: 0, adultsCount: 0, childrenCount: 0, arrivalsCount: 0 },
          currentFileName: 'File'
      };
      document.getElementById('fileName').textContent = 'File';
      markAsSaved();
      render();
  }

  function openFile() {
      fileInput.click();
  }

  function handleFileLoad(event) {
      const fileContent = event.target.result;
      const lines = fileContent.split('\n');
      let parsed = false;

      const trackerParts = lines[0].split(',');
      if (trackerParts.length === 4) {
          parsed = true;
          state.tracker.roomsSoldCount = parseInt(trackerParts[0].trim().split(' ')[0]);
          state.tracker.adultsCount = parseInt(trackerParts[1].trim().split(' ')[0]);
          state.tracker.childrenCount = parseInt(trackerParts[2].trim().split(' ')[0]);
          state.tracker.arrivalsCount = parseInt(trackerParts[3].trim().split(' ')[0]);
      }

      state.groups = [];
      const newGroup = createGroup(state.currentFileName);
      state.groups.push(newGroup);

      const notesContent = parsed ? lines.slice(2).join('\n') : lines.join('\n');
      const noteTexts = notesContent.split('\n\n');

      noteTexts.forEach(text => {
          if (text.trim()) {
              newGroup.notes.push(createNote(text));
          }
      });

      markAsSaved();
      render();
  }
  
  fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = handleFileLoad;
          reader.readAsText(file);
          state.currentFileName = file.name.replace(/\.[^/.]+$/, "");
          document.getElementById('fileName').textContent = state.currentFileName;
      }
  });
  
  fileMenuToggle.addEventListener('click', () => {
      fileMenu.classList.toggle('visible');
  });

  window.addEventListener('click', (e) => {
      if (!fileMenuToggle.contains(e.target) && !fileMenu.contains(e.target)) {
          fileMenu.classList.remove('visible');
      }
  });

  newFileBtn.addEventListener('click', newFile);
  openFileBtn.addEventListener('click', openFile);
  saveFileBtn.addEventListener('click', () => saveFile(false));
  saveFileAsBtn.addEventListener('click', () => saveFile(true));
  
  addGroupBtn.addEventListener('click', () => {
    const g = createGroup('New Group');
    state.groups.push(g);
    markAsUnsaved();
    saveToLocalStorage();
    render();
    setTimeout(()=> {
        const el = document.querySelector(`[data-id="${g.id}"] .group-name`);
        if(el){ el.focus(); el.select(); }
    }, 40);
  });

  window.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === 'n'){
      e.preventDefault();
      if(!state.groups.length) state.groups.push(createGroup('Untagged'));
      const note = createNote('');
      state.groups[0].notes.unshift(note);
      markAsUnsaved();
      saveToLocalStorage();
      render();
      setTimeout(()=> {
        const el = document.querySelector(`[data-id="${note.id}"] .note-body`);
        if(el){ el.focus(); placeCaretAtEnd(el); }
      }, 60);
    }
  });

  (function init(){
    loadFromLocalStorage();
    if(!state.groups || !state.groups.length){
      state.groups.push(createGroup('Untagged'));
      state.groups[0].notes.push(createNote('This is a new scratchpad. Ctrl/Cmd+N to add a new note.'));
    }
    render();
    window.__scratchpad = { state, saveToLocalStorage, loadFromLocalStorage, render };
  })();

})();