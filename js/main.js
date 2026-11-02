import { supabase, isConfigured } from './supabase-config.js';

// ---- Config ----
const WHATSAPP_NUMBER = '5562999159551'; // (62) 9 9915-9551
const INSTAGRAM_HANDLE = '_wellnessfitstore_';

let PRODUCTS = [];

async function loadProducts() {
  if (!isConfigured) {
    document.getElementById('catalogGrid').innerHTML =
      '<p class="catalog-error">Catálogo em configuração — chama a gente no WhatsApp que já te passamos as peças disponíveis!</p>';
    return false;
  }
  const { data, error } = await supabase
    .from('wellness_products')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Erro ao carregar produtos:', error);
    document.getElementById('catalogGrid').innerHTML =
      '<p class="catalog-error">Não foi possível carregar o catálogo agora. Tente novamente em instantes.</p>';
    return false;
  }
  PRODUCTS = data || [];
  return true;
}

const currency = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Padroniza o nome com inicial maiúscula em cada palavra, pra qualquer nome
// que tenha sido salvo fora do padrão continuar aparecendo certo no site.
function titleCase(str) {
  return (str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}

function waLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function dumbbellIcon() {
  return `<svg class="icon-dumbbell" viewBox="0 0 64 64" fill="rgba(255,255,255,0.85)"><rect x="10" y="24" width="8" height="16" rx="3" /><rect x="4" y="27" width="6" height="10" rx="2.5" /><rect x="46" y="24" width="8" height="16" rx="3" /><rect x="54" y="27" width="6" height="10" rx="2.5" /><rect x="18" y="30" width="28" height="4" rx="2" /></svg>`;
}

// Uma foto dentro de uma moldura: a foto inteira (contain) sobre um fundo
// borrado com a mesma imagem — sem cortar nem sobrar borda, tipo Instagram.
function mediaFrame(m, name) {
  return `<div class="media-frame">
    <img class="media-backdrop" src="${m.url}" alt="" aria-hidden="true" />
    <img class="media-fill" src="${m.url}" alt="${name}" loading="lazy" />
  </div>`;
}

// Monta o carrossel (arrasta pro lado, tipo Instagram). Com 1 foto só (ou
// nenhuma), mostra estático — sem trilho/bolinhas à toa.
function mediaHtml(media, name) {
  const items = media || [];
  if (items.length === 0) {
    return `${dumbbellIcon()}<span class="placeholder-tag">foto em breve</span>`;
  }
  if (items.length === 1) {
    return mediaFrame(items[0], name);
  }
  const slides = items.map((m) => `<div class="media-slide">${mediaFrame(m, name)}</div>`).join('');
  const dots = items.map((_, i) => `<span class="media-dot${i === 0 ? ' active' : ''}"></span>`).join('');
  return `
    <div class="media-carousel">
      <div class="media-track">${slides}</div>
      <div class="media-dots">${dots}</div>
    </div>`;
}

// Ativa arrastar (mouse e toque) + sincroniza as bolinhas.
function wireCarousels(root) {
  root.querySelectorAll('.media-carousel').forEach((carousel) => {
    const track = carousel.querySelector('.media-track');
    const dots = [...carousel.querySelectorAll('.media-dot')];

    function syncActiveSlide() {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    }

    let scrollTimeout;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(syncActiveSlide, 80);
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      });
    });

    // No toque, o próprio navegador arrasta na horizontal (overflow + scroll-snap).
    // O arrasto manual abaixo é só pro MOUSE, senão briga com o toque no celular.
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      isDown = true;
      dragged = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const delta = e.clientX - startX;
      if (Math.abs(delta) > 4) dragged = true;
      track.scrollLeft = startScroll - delta;
    });
    function endDrag() {
      if (!isDown) return;
      isDown = false;
      const index = Math.round(track.scrollLeft / track.clientWidth);
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointerleave', endDrag);
    track.addEventListener(
      'click',
      (e) => {
        if (dragged) e.preventDefault();
      },
      true
    );

    syncActiveSlide();
  });
}

function hasPromo(p) {
  return p.original_price != null && Number(p.original_price) > Number(p.price);
}

function discountPercent(p) {
  return Math.round((1 - Number(p.price) / Number(p.original_price)) * 100);
}

function renderFilters() {
  const filters = document.getElementById('categoryFilters');
  const categories = ['all', ...new Set(PRODUCTS.map((p) => p.category))];
  filters.innerHTML = categories
    .map(
      (c) =>
        `<button class="filter-btn${c === 'all' ? ' active' : ''}" data-filter="${c}">${
          c === 'all' ? 'Todas' : c
        }</button>`
    )
    .join('');

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filters.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(btn.dataset.filter);
  });
}

function renderGrid(filter = 'all') {
  const grid = document.getElementById('catalogGrid');
  const items = filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  if (items.length === 0) {
    grid.innerHTML = '<p class="catalog-empty">Nenhuma peça por aqui ainda — volte em breve!</p>';
    return;
  }

  grid.innerHTML = items
    .map((p) => {
      const name = titleCase(p.name);
      const promo = hasPromo(p);
      const message = `Olá! Tenho interesse na peça "${name}" (${currency(p.price)}) que vi no site da Wellness Fit Store.`;
      const media = mediaHtml(p.media, name);
      const badge = promo ? `<span class="discount-badge">-${discountPercent(p)}%</span>` : '';
      const priceMarkup = promo
        ? `<span class="card-price"><span class="card-price-original">${currency(Number(p.original_price))}</span><span class="card-price-promo">${currency(p.price)}</span></span>`
        : `<span class="card-price">${currency(p.price)}</span>`;
      return `
        <article class="card">
          <div class="card-media">
            ${media}
            ${badge}
          </div>
          <div class="card-body">
            <span class="card-category">${p.category}</span>
            <h3 class="card-name">${name}</h3>
            ${priceMarkup}
            <a class="btn btn-whatsapp btn-sm card-cta" href="${waLink(message)}">
              Perguntar no WhatsApp
            </a>
          </div>
        </article>`;
    })
    .join('');
  wireCarousels(grid);
}

function renderFeatured() {
  const container = document.getElementById('featuredSection');
  const featured = PRODUCTS.find((p) => p.featured);
  if (!featured) {
    container.innerHTML = '';
    return;
  }

  const featuredName = titleCase(featured.name);
  const promo = hasPromo(featured);
  const message = `Olá! Tenho interesse na peça "${featuredName}" (${currency(featured.price)}) que vi no site da Wellness Fit Store.`;
  const media = mediaHtml(featured.media, featuredName);
  const prices = promo
    ? `
      <span class="featured-price-original">${currency(Number(featured.original_price))}</span>
      <span class="featured-price-promo">${currency(featured.price)}</span>
      <span class="featured-discount">-${discountPercent(featured)}%</span>`
    : `<span class="featured-price-promo">${currency(featured.price)}</span>`;

  container.innerHTML = `
    <section class="featured">
      <div class="container">
        <div class="featured-card">
          <div class="featured-media">${media}</div>
          <div>
            <span class="featured-badge">${promo ? 'Oferta em destaque' : 'Destaque'}</span>
            <div class="featured-category">${featured.category}</div>
            <h2 class="featured-name">${featuredName}</h2>
            <div class="featured-prices">${prices}</div>
            <a class="btn btn-whatsapp btn-lg" href="${waLink(message)}">
              Perguntar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>`;
  wireCarousels(container);
}

function wireGenericWhatsappLinks() {
  const generic = waLink('Olá! Vi o site da Wellness Fit Store e gostaria de fazer um pedido.');
  document.querySelectorAll('[data-wa-generic]').forEach((el) => (el.href = generic));
}

function wireInstagramLink() {
  const link = document.getElementById('instagramLink');
  if (link) link.href = `https://instagram.com/${INSTAGRAM_HANDLE}`;
}

function wireMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mobileNav');
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  nav.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
}

async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  wireGenericWhatsappLinks();
  wireInstagramLink();
  wireMobileMenu();
  const loaded = await loadProducts();
  if (loaded) {
    renderFeatured();
    renderFilters();
    renderGrid();
  }
}

init();
