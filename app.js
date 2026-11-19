const STORAGE_KEY = 'ain_seen_questions_v1';
const THEME_KEY = 'ain_seen_theme';

let questions = [];
let currentTab = 'pending'; // 'pending' | 'approved'

// DOM Elements
const jsonFileInput = document.getElementById('jsonFileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const dropZone = document.getElementById('dropZone');
const cardsGrid = document.getElementById('cardsGrid');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDesc = document.getElementById('emptyDesc');

const countAll = document.getElementById('countAll');
const countPending = document.getElementById('countPending');
const countApproved = document.getElementById('countApproved');
const tabPendingCount = document.getElementById('tabPendingCount');
const tabApprovedCount = document.getElementById('tabApprovedCount');

const tabPending = document.getElementById('tabPending');
const tabApproved = document.getElementById('tabApproved');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');

const exportApprovedBtn = document.getElementById('exportApprovedBtn');
const exportPendingBtn = document.getElementById('exportPendingBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

// Edit Modal Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editIndex = document.getElementById('editIndex');
const editId = document.getElementById('editId');
const editCategory = document.getElementById('editCategory');
const editQuestion = document.getElementById('editQuestion');
const optionsContainer = document.getElementById('optionsContainer');
const addOptionBtn = document.getElementById('addOptionBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const toastEl = document.getElementById('toast');

// Theme Initialization
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    themeIcon.textContent = '☀️';
    themeLabel.textContent = 'الوضع الفاتح';
  } else {
    themeIcon.textContent = '🌙';
    themeLabel.textContent = 'الوضع الداكن';
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Toast Notification
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

// Normalize uploaded JSON structures
function normalizeQuestion(raw, idx) {
  const qText = raw.question || raw.q || raw.text || raw.title || '';
  const cat = raw.category || raw.cat || raw.topic || 'عام';
  let opts = [];

  if (Array.isArray(raw.options)) {
    opts = raw.options.map(o => (typeof o === 'object' && o !== null ? (o.text || o.label || String(o)) : String(o)));
  } else if (Array.isArray(raw.choices)) {
    opts = raw.choices.map(String);
  } else if (raw.option1 || raw.a) {
    opts = [raw.option1 || raw.a, raw.option2 || raw.b, raw.option3 || raw.c, raw.option4 || raw.d].filter(Boolean).map(String);
  }

  let answer = raw.answer ?? raw.correctAnswer ?? raw.correct ?? '';
  if (typeof answer === 'number' && opts[answer] !== undefined) {
    answer = opts[answer];
  } else {
    answer = String(answer);
  }

  if (answer && !opts.includes(answer)) {
    opts.unshift(answer);
  }

  return {
    _uid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${idx}_${Math.random()}`,
    id: raw.id ?? idx + 1,
    category: String(cat),
    question: String(qText),
    options: opts,
    answer: answer,
    status: raw.status === 'approved' ? 'approved' : 'pending'
  };
}

function extractArrayFromJson(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.items)) return parsed.items;
    // Handle object grouped by category: { "تاريخ": [ ... ], "علوم": [ ... ] }
    const grouped = [];
    for (const [key, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item && typeof item === 'object') {
            grouped.push({ category: key, ...item });
          }
        });
      }
    }
    if (grouped.length > 0) return grouped;
  }
  return null;
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const arr = extractArrayFromJson(parsed);
      if (!arr || arr.length === 0) {
        showToast('لم يتم العثور على أسئلة صالحة داخل الملف');
        return;
      }
      const normalized = arr.map((item, i) => normalizeQuestion(item, questions.length + i));
      questions = [...questions, ...normalized];
      saveState();
      refreshCategories();
      render();
      showToast(`تم استيراد ${normalized.length} سؤال بنجاح`);
    } catch (err) {
      showToast('خطأ في قراءة ملف JSON، تأكد من صحة الصيغة');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// File Input & Drag-Drop Events
selectFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  jsonFileInput.click();
});

dropZone.addEventListener('click', () => jsonFileInput.click());

jsonFileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
  jsonFileInput.value = '';
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});

// Persistence
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      questions = JSON.parse(raw);
    }
  } catch {
    questions = [];
  }
}

// Categories Dropdown
function refreshCategories() {
  const currentVal = categoryFilter.value;
  const cats = [...new Set(questions.map(q => q.category).filter(Boolean))];
  categoryFilter.innerHTML = '<option value="all">جميع التصنيفات</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categoryFilter.appendChild(opt);
  });
  if (cats.includes(currentVal)) {
    categoryFilter.value = currentVal;
  }
}

// Render Cards
function render() {
  const pendingList = questions.filter(q => q.status === 'pending');
  const approvedList = questions.filter(q => q.status === 'approved');

  countAll.textContent = questions.length;
  countPending.textContent = pendingList.length;
  countApproved.textContent = approvedList.length;
  tabPendingCount.textContent = pendingList.length;
  tabApprovedCount.textContent = approvedList.length;

  exportApprovedBtn.disabled = approvedList.length === 0;
  exportPendingBtn.disabled = pendingList.length === 0;

  const selectedCat = categoryFilter.value;
  const query = searchInput.value.trim().toLowerCase();

  const filtered = questions.filter(q => {
    if (q.status !== currentTab) return false;
    if (selectedCat !== 'all' && q.category !== selectedCat) return false;
    if (query) {
      const inQ = q.question.toLowerCase().includes(query);
      const inA = q.answer.toLowerCase().includes(query);
      const inOpts = q.options.some(o => o.toLowerCase().includes(query));
      return inQ || inA || inOpts;
    }
    return true;
  });

  cardsGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (questions.length === 0) {
      emptyTitle.textContent = 'لا توجد أسئلة حالياً';
      emptyDesc.textContent = 'ارفع ملف JSON للبدء في مراجعة الأسئلة واعتمادها.';
    } else if (currentTab === 'pending') {
      emptyTitle.textContent = 'لا توجد أسئلة في قسم جارِ الاعتماد';
      emptyDesc.textContent = 'تم اعتماد جميع الأسئلة المطابقة أو لا توجد نتائج للبحث.';
    } else {
      emptyTitle.textContent = 'لا توجد أسئلة معتمدة بعد';
      emptyDesc.textContent = 'انتقل إلى قسم جارِ الاعتماد واضغط على زر "اعتماد" لنقل الأسئلة هنا.';
    }
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'q-card card';

    const optionsHtml = item.options.map(opt => {
      const isCorrect = opt.trim() === item.answer.trim();
      return `
        <li class="option-item ${isCorrect ? 'correct' : ''}">
          <span>${escapeHtml(opt)}</span>
          ${isCorrect ? '<span class="correct-tag">✔ الإجابة</span>' : ''}
        </li>
      `;
    }).join('');

    const approveBtnHtml = item.status === 'pending'
      ? `<button type="button" class="btn btn-success btn-sm" data-action="approve" data-uid="${item._uid}">✅ اعتماد</button>`
      : `<button type="button" class="btn btn-secondary btn-sm" data-action="unapprove" data-uid="${item._uid}">↩️ إعادة للمراجعة</button>`;

    card.innerHTML = `
      <div>
        <div class="q-header">
          <span class="badge-category">#${escapeHtml(String(item.id))} • ${escapeHtml(item.category)}</span>
          <span class="badge-status ${item.status}">
            ${item.status === 'pending' ? 'جارِ الاعتماد' : 'معتمد'}
          </span>
        </div>
        <h3 class="q-text">${escapeHtml(item.question)}</h3>
      </div>

      <ul class="options-list">${optionsHtml}</ul>

      <div class="q-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-uid="${item._uid}">✏️ تعديل</button>
        ${approveBtnHtml}
      </div>
    `;

    cardsGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Card Actions (Delegation)
cardsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const action = btn.dataset.action;
  const idx = questions.findIndex(q => q._uid === uid);
  if (idx === -1) return;

  if (action === 'approve') {
    questions[idx].status = 'approved';
    saveState();
    render();
    showToast('تم اعتماد السؤال ونقله للمعتمدة');
  } else if (action === 'unapprove') {
    questions[idx].status = 'pending';
    saveState();
    render();
    showToast('تمت إعادة السؤال إلى جارِ الاعتماد');
  } else if (action === 'edit') {
    openEditModal(idx);
  }
});

// Edit Modal Logic
function openEditModal(idx) {
  const item = questions[idx];
  editIndex.value = idx;
  editId.value = item.id;
  editCategory.value = item.category;
  editQuestion.value = item.question;

  optionsContainer.innerHTML = '';
  item.options.forEach((opt, i) => {
    const isCorrect = opt.trim() === item.answer.trim();
    addOptionRow(opt, isCorrect || (i === 0 && !item.options.some(o => o.trim() === item.answer.trim())));
  });

  editModal.classList.remove('hidden');
}

function addOptionRow(value = '', isChecked = false) {
  const row = document.createElement('div');
  row.className = 'option-edit-row';
  row.innerHTML = `
    <input type="radio" name="correctOption" ${isChecked ? 'checked' : ''} title="تعيين كإجابة صحيحة" />
    <input type="text" class="input option-text-input" value="${escapeHtml(value)}" placeholder="نص الخيار..." required />
    <button type="button" class="btn-icon remove-opt-btn" title="حذف الخيار">✕</button>
  `;
  row.querySelector('.remove-opt-btn').addEventListener('click', () => {
    if (optionsContainer.children.length <= 2) {
      showToast('يجب أن يحتوي السؤال على خيارين على الأقل');
      return;
    }
    const wasChecked = row.querySelector('input[type="radio"]').checked;
    row.remove();
    if (wasChecked && optionsContainer.firstElementChild) {
      optionsContainer.firstElementChild.querySelector('input[type="radio"]').checked = true;
    }
  });
  optionsContainer.appendChild(row);
}

addOptionBtn.addEventListener('click', () => addOptionRow('', false));

function closeEditModal() {
  editModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const idx = Number(editIndex.value);
  if (!questions[idx]) return;

  const rows = [...optionsContainer.querySelectorAll('.option-edit-row')];
  const newOptions = [];
  let newAnswer = '';

  rows.forEach(row => {
    const val = row.querySelector('.option-text-input').value.trim();
    const checked = row.querySelector('input[type="radio"]').checked;
    if (val) {
      newOptions.push(val);
      if (checked) newAnswer = val;
    }
  });

  if (newOptions.length < 2) {
    showToast('أدخل خيارين على الأقل');
    return;
  }

  if (!newAnswer) newAnswer = newOptions[0];

  const rawId = editId.value.trim();
  questions[idx].id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
  questions[idx].category = editCategory.value.trim() || 'عام';
  questions[idx].question = editQuestion.value.trim();
  questions[idx].options = newOptions;
  questions[idx].answer = newAnswer;

  saveState();
  refreshCategories();
  render();
  closeEditModal();
  showToast('تم حفظ التعديلات');
});

// Tabs & Filters Events
tabPending.addEventListener('click', () => {
  currentTab = 'pending';
  tabPending.classList.add('active');
  tabApproved.classList.remove('active');
  render();
});

tabApproved.addEventListener('click', () => {
  currentTab = 'approved';
  tabApproved.classList.add('active');
  tabPending.classList.remove('active');
  render();
});

categoryFilter.addEventListener('change', render);
searchInput.addEventListener('input', render);

// Export Functions
function downloadJson(data, filename) {
  const cleanData = data.map(({ id, category, question, options, answer }) => ({
    id,
    category,
    question,
    options,
    answer
  }));

  const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

exportApprovedBtn.addEventListener('click', () => {
  const approved = questions.filter(q => q.status === 'approved');
  if (!approved.length) return;
  downloadJson(approved, 'ain-seen-approved.json');
  showToast(`تم تصدير ${approved.length} سؤال معتمد`);
});

exportPendingBtn.addEventListener('click', () => {
  const pending = questions.filter(q => q.status === 'pending');
  if (!pending.length) return;
  downloadJson(pending, 'ain-seen-pending.json');
  showToast(`تم تصدير ${pending.length} سؤال جارِ الاعتماد`);
});

clearDataBtn.addEventListener('click', () => {
  if (!questions.length) return;
  if (confirm('هل أنت متأكد من مسح جميع الأسئلة المحفوظة في المتصفح؟')) {
    questions = [];
    saveState();
    refreshCategories();
    render();
    showToast('تم مسح جميع البيانات');
  }
});

// Initialize
initTheme();
loadState();
refreshCategories();
render();
