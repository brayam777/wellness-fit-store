import { supabase, isConfigured } from './supabase-config.js';

// Sobe o arquivo pra S3 (não pro Supabase) — pede uma URL de upload assinada
// pra function serverless (que confere a sessão de admin no servidor e nunca
// entrega a chave secreta da S3 pro navegador), depois envia o arquivo direto
// pra S3 usando essa URL.
async function uploadToS3(blob, ext, contentType) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada, entre novamente.');

  const presignResp = await fetch('/api/presign-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ext, contentType }),
  });
  if (!presignResp.ok) {
    const body = await presignResp.json().catch(() => ({}));
    throw new Error(body.error || 'Não foi possível preparar o upload.');
  }
  const { uploadUrl, publicUrl } = await presignResp.json();

  const putResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResp.ok) throw new Error('Falha ao enviar o arquivo.');

  return publicUrl;
}

const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const sessionInfo = document.getElementById('sessionInfo');
const panelMessage = document.getElementById('panelMessage');
const logoutBtn = document.getElementById('logoutBtn');
const productForm = document.getElementById('productForm');
const productList = document.getElementById('productList');
const categoryOptions = document.getElementById('categoryOptions');
const seedBtn = document.getElementById('seedBtn');
const productFormTitle = document.getElementById('productFormTitle');
const productFormSubmit = document.getElementById('productFormSubmit');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editingProductId = document.getElementById('editingProductId');
const productNameInput = document.getElementById('productName');
const productCategoryInput = document.getElementById('productCategory');
const productPriceInput = document.getElementById('productPrice');
const productOriginalPriceInput = document.getElementById('productOriginalPrice');
const productFeaturedInput = document.getElementById('productFeatured');
const mediaPreview = document.getElementById('mediaPreview');
const addMediaBtn = document.getElementById('addMediaBtn');
const productMediaInput = document.getElementById('productMedia');

const SEED_PRODUCTS = [
  { name: 'Legging Suplex Preta', category: 'Leggings', price: 99.9 },
  { name: 'Legging Estampada Bolso', category: 'Leggings', price: 109.9 },
  { name: 'Top Fitness Nadador', category: 'Tops', price: 59.9 },
  { name: 'Top Cropped Alça Fina', category: 'Tops', price: 54.9 },
  { name: 'Conjunto Legging + Top', category: 'Conjuntos', price: 149.9 },
  { name: 'Conjunto Short + Cropped', category: 'Conjuntos', price: 129.9 },
  { name: 'Short Saia Fitness', category: 'Shorts', price: 79.9 },
  { name: 'Macaquinho Ieza', category: 'Macaquinhos', price: 95.9, original_price: 130.9, featured: true },
];

// Fotos da peça em edição: as já salvas que sobrevivem + arquivos novos ainda
// não enviados. A ordem das duas listas juntas vira a ordem do carrossel.
let existingMedia = []; // [{ url, type: 'image' }]
let pendingFiles = []; // [{ file, previewUrl }]
let products = [];

const currency = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Padroniza o nome da peça com inicial maiúscula em cada palavra, não importa
// como foi digitado ("macaquinho ieza", "MACAQUINHO IEZA" etc. viram sempre
// "Macaquinho Ieza").
function titleCase(str) {
  return (str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}

function showMessage(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function dumbbellIcon() {
  return `<svg class="icon-dumbbell" viewBox="0 0 64 64" fill="rgba(255,255,255,0.85)"><rect x="10" y="24" width="8" height="16" rx="3" /><rect x="4" y="27" width="6" height="10" rx="2.5" /><rect x="46" y="24" width="8" height="16" rx="3" /><rect x="54" y="27" width="6" height="10" rx="2.5" /><rect x="18" y="30" width="28" height="4" rx="2" /></svg>`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Fotos de celular costumam vir bem grandes — cada MB desses é baixado de
// novo a cada visita ao site. Redimensiona pra um tamanho generoso o
// suficiente pra tela (1440px) e reduz a qualidade do JPEG antes de subir.
async function compressImage(file, { maxDim = 1440, quality = 0.85 } = {}) {
  const objectUrl = URL.createObjectURL(file);
  let photo;
  try {
    photo = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const scale = Math.min(1, maxDim / Math.max(photo.naturalWidth, photo.naturalHeight));
  const w = Math.round(photo.naturalWidth * scale);
  const h = Math.round(photo.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(photo, 0, 0, w, h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  // Só usa a versão comprimida se ela realmente ficou menor.
  return blob && blob.size < file.size ? blob : file;
}

function currentMediaItems() {
  return [
    ...existingMedia.map((m, i) => ({ ...m, group: 'existing', index: i })),
    ...pendingFiles.map((p, i) => ({ url: p.previewUrl, group: 'pending', index: i })),
  ];
}

function renderMediaPreview() {
  const items = currentMediaItems();
  if (items.length === 0) {
    mediaPreview.hidden = true;
    mediaPreview.innerHTML = '';
    return;
  }
  mediaPreview.hidden = false;
  mediaPreview.innerHTML = items
    .map(
      (m, order) => `
      <div class="admin-media-thumb">
        <img src="${m.url}" alt="" />
        <span class="admin-media-order">${order + 1}</span>
        <button type="button" class="admin-media-thumb-remove" data-group="${m.group}" data-index="${m.index}" title="Remover">×</button>
      </div>`
    )
    .join('');
}

function clearPendingPreviews() {
  pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  pendingFiles = [];
}

function enterEditMode(product) {
  editingProductId.value = product.id;
  existingMedia = [...(product.media || [])];
  clearPendingPreviews();
  productNameInput.value = product.name;
  productCategoryInput.value = product.category;
  productPriceInput.value = product.price;
  productOriginalPriceInput.value = product.original_price ?? '';
  productFeaturedInput.checked = !!product.featured;
  productFormTitle.textContent = 'Editar peça';
  productFormSubmit.textContent = 'Salvar alterações';
  cancelEditBtn.hidden = false;
  renderMediaPreview();
  productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
  editingProductId.value = '';
  existingMedia = [];
  clearPendingPreviews();
  productForm.reset();
  productFormTitle.textContent = 'Adicionar peça';
  productFormSubmit.textContent = 'Adicionar';
  cancelEditBtn.hidden = true;
  renderMediaPreview();
}

function handleAddMedia() {
  Array.from(productMediaInput.files).forEach((file) => {
    pendingFiles.push({ file, previewUrl: URL.createObjectURL(file) });
  });
  productMediaInput.value = '';
  renderMediaPreview();
}

function handleMediaPreviewClick(e) {
  const removeBtn = e.target.closest('[data-group]');
  if (!removeBtn) return;
  const index = Number(removeBtn.dataset.index);
  if (removeBtn.dataset.group === 'existing') {
    existingMedia.splice(index, 1);
  } else {
    URL.revokeObjectURL(pendingFiles[index].previewUrl);
    pendingFiles.splice(index, 1);
  }
  renderMediaPreview();
}

async function loadProductList() {
  const { data, error } = await supabase
    .from('wellness_products')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    showMessage(panelMessage, 'Não foi possível carregar as peças agora.', true);
    return;
  }

  products = data;

  categoryOptions.innerHTML = [...new Set(data.map((p) => p.category))]
    .map((c) => `<option value="${c}"></option>`)
    .join('');

  seedBtn.hidden = data.length > 0;

  if (data.length === 0) {
    productList.innerHTML = '<p class="admin-list-empty">Nenhuma peça cadastrada ainda.</p>';
    return;
  }

  productList.innerHTML = data
    .map((p) => {
      const media = p.media || [];
      const thumb = media[0]
        ? `<img class="admin-list-thumb" src="${media[0].url}" alt="${p.name}" />`
        : `<span class="admin-list-thumb">${dumbbellIcon()}</span>`;
      const photoLabel = media.length === 0 ? 'sem foto' : media.length === 1 ? '1 foto' : `${media.length} fotos`;
      return `
      <div class="admin-list-item" data-id="${p.id}">
        ${thumb}
        <div class="admin-list-info">
          <div class="admin-list-name">${p.name}${p.featured ? ' ⭐' : ''}</div>
          <div class="admin-list-meta">${p.category} · ${
            p.original_price ? `de ${currency(Number(p.original_price))} por ` : ''
          }${currency(Number(p.price))} · ${photoLabel}</div>
        </div>
        <button class="admin-list-delete" data-delete="${p.id}">Remover</button>
      </div>`;
    })
    .join('');
}

async function handleSeed() {
  if (!confirm('Importar os 8 produtos de exemplo pro catálogo?')) return;
  showMessage(panelMessage, 'Importando...');
  const { error } = await supabase.from('wellness_products').insert(SEED_PRODUCTS);
  if (error) {
    console.error('seed error', error);
    showMessage(panelMessage, 'Não foi possível importar os produtos de exemplo.', true);
  } else {
    showMessage(panelMessage, 'Produtos de exemplo importados!');
  }
  loadProductList();
}

// Login é por senha única compartilhada — por trás dos panos ainda é uma
// conta normal do Supabase Auth, só que com e-mail fixo (não pedimos e-mail
// na tela). O e-mail continua sendo o que está autorizado em wellness_admins.
const SHARED_LOGIN_EMAIL = 'brayamfelipe02@gmail.com';

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('loginPassword').value;
  showMessage(loginMessage, 'Entrando...');
  const { error } = await supabase.auth.signInWithPassword({
    email: SHARED_LOGIN_EMAIL,
    password,
  });
  if (error) {
    showMessage(loginMessage, 'Senha incorreta. Tente novamente.', true);
    return;
  }
  loginForm.reset();
}

async function handleLogout() {
  await supabase.auth.signOut();
}

async function handleSubmitProduct(e) {
  e.preventDefault();
  const id = editingProductId.value;
  const name = titleCase(productNameInput.value);
  const category = productCategoryInput.value.trim();
  const price = parseFloat(productPriceInput.value);
  const original_price = productOriginalPriceInput.value
    ? parseFloat(productOriginalPriceInput.value)
    : null;
  const featured = productFeaturedInput.checked;

  showMessage(panelMessage, 'Salvando...');

  const newMedia = [];
  for (let i = 0; i < pendingFiles.length; i++) {
    const { file } = pendingFiles[i];
    showMessage(panelMessage, `Preparando fotos (${i + 1}/${pendingFiles.length})...`);
    let uploadBody = file;
    let ext = file.name.split('.').pop();
    let contentType = file.type || 'image/jpeg';
    try {
      uploadBody = await compressImage(file);
      if (uploadBody !== file) {
        ext = 'jpg';
        contentType = 'image/jpeg';
      }
    } catch (compressError) {
      console.error('compress image error', compressError);
      // Se a compressão falhar por qualquer motivo, sobe a foto original em vez de travar o cadastro.
      uploadBody = file;
    }
    let url;
    try {
      url = await uploadToS3(uploadBody, ext, contentType);
    } catch (uploadError) {
      console.error('upload error', uploadError);
      showMessage(panelMessage, `Não foi possível enviar uma das fotos: ${uploadError.message}`, true);
      return;
    }
    newMedia.push({ url, type: 'image' });
  }

  showMessage(panelMessage, 'Salvando...');
  const media = [...existingMedia, ...newMedia];

  const payload = { name, category, price, original_price, featured, media };
  const { data: saved, error } = id
    ? await supabase.from('wellness_products').update(payload).eq('id', id).select().single()
    : await supabase.from('wellness_products').insert(payload).select().single();

  if (error) {
    console.error('save error', error);
    showMessage(panelMessage, `Não foi possível salvar a peça: ${error.message}`, true);
    return;
  }

  // Só uma peça pode ficar destacada por vez.
  if (featured && saved) {
    await supabase.from('wellness_products').update({ featured: false }).neq('id', saved.id);
  }

  exitEditMode();
  showMessage(panelMessage, id ? 'Peça atualizada!' : 'Peça adicionada!');
  loadProductList();
}

async function handleProductListClick(e) {
  const deleteBtn = e.target.closest('[data-delete]');
  if (deleteBtn) {
    if (!confirm('Remover esta peça do catálogo?')) return;
    const { error } = await supabase.from('wellness_products').delete().eq('id', deleteBtn.dataset.delete);
    if (error) {
      showMessage(panelMessage, 'Não foi possível remover a peça.', true);
      return;
    }
    if (editingProductId.value === deleteBtn.dataset.delete) exitEditMode();
    loadProductList();
    return;
  }

  const item = e.target.closest('.admin-list-item');
  if (!item) return;
  const product = products.find((p) => p.id === item.dataset.id);
  if (product) enterEditMode(product);
}

async function renderForSession(session) {
  if (session) {
    loginView.hidden = true;
    panelView.hidden = false;
    sessionInfo.textContent = 'Logado';
    await loadProductList();
  } else {
    loginView.hidden = false;
    panelView.hidden = true;
  }
}

loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
productForm.addEventListener('submit', handleSubmitProduct);
productList.addEventListener('click', handleProductListClick);
cancelEditBtn.addEventListener('click', exitEditMode);
seedBtn.addEventListener('click', handleSeed);
mediaPreview.addEventListener('click', handleMediaPreviewClick);
addMediaBtn.addEventListener('click', () => productMediaInput.click());
productMediaInput.addEventListener('change', handleAddMedia);

if (isConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    renderForSession(session);
  });
  supabase.auth.getSession().then(({ data }) => renderForSession(data.session));
} else {
  loginView.hidden = false;
  panelView.hidden = true;
  showMessage(loginMessage, 'O backend (Supabase) ainda não foi configurado pra esse site.', true);
}
