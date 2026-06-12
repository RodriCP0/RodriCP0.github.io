/* ============================================================
   NEXO — Rede social
   Aplicação 100% client-side com persistência em localStorage.
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   UTILITÁRIOS
   ------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const escapeHTML = (s = '') =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Converte texto em HTML seguro, com hashtags clicáveis. */
function richText(text) {
  return escapeHTML(text).replace(/#([\p{L}\d_]+)/gu,
    '<span class="hashtag" data-tag="$1">#$1</span>');
}

/** Tempo relativo em português. */
function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(ts).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function timeHM(ts) {
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

/** Gera um avatar SVG (iniciais + gradiente) como data URI — funciona offline. */
function makeAvatar(name, hue) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const h2 = (hue + 50) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},70%,55%)"/>` +
    `<stop offset="1" stop-color="hsl(${h2},70%,45%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="100" height="100" fill="url(#g)"/>` +
    `<text x="50" y="50" dy=".36em" font-family="Arial,sans-serif" font-size="40" ` +
    `font-weight="bold" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/** Imagem de recurso (gradiente SVG) para quando uma imagem externa falha. */
window.imgFallback = function (el, seed = '') {
  el.onerror = null;
  const hue = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},60%,60%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 70) % 360},60%,40%)"/>` +
    `</linearGradient></defs><rect width="900" height="600" fill="url(#g)"/>` +
    `<text x="450" y="300" dy=".36em" font-family="Arial" font-size="120" fill="rgba(255,255,255,.5)" text-anchor="middle">📷</text></svg>`;
  el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/** Redimensiona uma imagem carregada para caber no localStorage. */
function fileToDataURL(file, maxSide = 1080) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ------------------------------------------------------------
   ESTADO E PERSISTÊNCIA
   ------------------------------------------------------------ */
const STORAGE_KEY = 'nexo.v1';

let state = null;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Armazenamento cheio — apaga publicações com imagens grandes.');
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch { return null; }
}

/* ------------------------------------------------------------
   DADOS DE DEMONSTRAÇÃO
   ------------------------------------------------------------ */
const now = Date.now();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

function seedState() {
  const demoUsers = [
    { id: 'u-mariana', name: 'Mariana Costa', handle: 'marianac', hue: 330,
      bio: 'Fotógrafa de viagens 📷 · Sempre com a mala feita', verified: true },
    { id: 'u-tiago', name: 'Tiago Almeida', handle: 'tiagodev', hue: 210,
      bio: 'Engenheiro de software · Apaixonado por open source e café ☕', verified: true },
    { id: 'u-ines', name: 'Inês Ribeiro', handle: 'ines.fit', hue: 150,
      bio: 'Personal trainer 💪 · Corrida, força e boa disposição' },
    { id: 'u-goncalo', name: 'Gonçalo Martins', handle: 'gmartins', hue: 25,
      bio: 'Chef amador 🍳 · Receitas simples para dias ocupados' },
    { id: 'u-beatriz', name: 'Beatriz Lopes', handle: 'beatriz_arte', hue: 270,
      bio: 'Ilustradora freelance ✏️ · Comissões abertas' },
    { id: 'u-rui', name: 'Rui Fernandes', handle: 'ruif', hue: 190,
      bio: 'Estudante de Erasmus na Eslovénia 🇸🇮 · A explorar a Europa' },
    { id: 'u-sofia', name: 'Sofia Mendes', handle: 'sofiam', hue: 45,
      bio: 'Jornalista de tecnologia · Escrevo sobre o futuro 🚀' },
    { id: 'u-pedro', name: 'Pedro Santos', handle: 'pedro.music', hue: 0,
      bio: 'Músico e produtor 🎸 · Novo single em breve' },
  ].map(u => ({
    ...u,
    avatar: makeAvatar(u.name, u.hue),
    isDemo: true,
    followers: [], following: [],
    joinedAt: now - 200 * DAY,
  }));

  const pic = (seed, w = 900, h = 650) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  const demoPosts = [
    { author: 'u-mariana', ts: now - 26 * MIN, img: pic('nexo-alps'),
      text: 'Acordar às 5h valeu cada segundo. O nascer do sol nos Alpes é outra coisa. 🏔️ #viagens #fotografia' },
    { author: 'u-tiago', ts: now - 1.2 * HOUR,
      text: 'Acabei de publicar a versão 2.0 do meu projeto open source! Reescrita completa, 3x mais rápido e finalmente com documentação decente. O sentimento de carregar no botão de release nunca envelhece. 🚀 #dev #opensource' },
    { author: 'u-ines', ts: now - 2.5 * HOUR, img: pic('nexo-run', 900, 600),
      text: 'Meia maratona feita! 1h52 — novo recorde pessoal. 🏃‍♀️ Quem disse que segundas-feiras são más não corre de manhã. #corrida #fitness' },
    { author: 'u-goncalo', ts: now - 4 * HOUR, img: pic('nexo-food', 900, 700),
      text: 'Risotto de cogumelos em 25 minutos. O segredo? Caldo sempre quente e paciência no fim. Receita completa nos comentários 👇 #cozinha #receitas' },
    { author: 'u-rui', ts: now - 6 * HOUR, img: pic('nexo-ljubljana', 900, 600),
      text: 'Ljubljana ao entardecer. Cada vez mais convencido de que o Erasmus foi a melhor decisão da minha vida. 🇸🇮 #erasmus #eslovenia' },
    { author: 'u-beatriz', ts: now - 9 * HOUR, img: pic('nexo-art', 800, 800),
      text: 'Trabalho terminado! Ilustração para a capa de um livro infantil que sai em setembro. Não podia estar mais orgulhosa deste. ✏️✨ #ilustracao #arte' },
    { author: 'u-sofia', ts: now - 13 * HOUR,
      text: 'Hot take: a melhor funcionalidade de qualquer rede social continua a ser o botão de silenciar. Usem-no sem culpa, a vossa saúde mental agradece. 🧘' },
    { author: 'u-pedro', ts: now - 1 * DAY,
      text: 'Última sessão de estúdio antes da masterização. Este single tem sido um ano inteiro de trabalho e finalmente está quase cá fora. 🎸 #musica' },
    { author: 'u-mariana', ts: now - 1.3 * DAY, img: pic('nexo-sea', 900, 600),
      text: 'O Adriático num dia de vento. Às vezes a melhor fotografia é a que não estava planeada. 🌊 #mar #fotografia' },
    { author: 'u-tiago', ts: now - 1.8 * DAY,
      text: 'Dica de produtividade que mudou a minha semana: bloquear 2 horas de manhã sem reuniões, sem chat, sem e-mail. Só código. A diferença é absurda. #produtividade' },
    { author: 'u-ines', ts: now - 2.2 * DAY,
      text: 'Lembrete amigável: descansar também é treinar. O músculo cresce na recuperação, não no ginásio. 😴 #fitness #saude' },
    { author: 'u-goncalo', ts: now - 2.6 * DAY, img: pic('nexo-bread', 900, 650),
      text: 'Primeiro pão de fermentação lenta. 48 horas de espera, 10 minutos a existir. Valeu a pena? Absolutamente. 🍞' },
  ].map(p => ({
    id: uid(), author: p.author, text: p.text, img: p.img || null,
    ts: p.ts, likes: [], comments: [], isDemo: true,
  }));

  // Gostos e comentários de demonstração entre utilizadores demo
  const ids = demoUsers.map(u => u.id);
  const demoComments = {
    0: [['u-rui', 'Que fotografia incrível! 😍'], ['u-beatriz', 'As cores estão perfeitas.']],
    1: [['u-sofia', 'Parabéns! Vou escrever sobre isto 👀']],
    2: [['u-pedro', 'Máquina! 💪'], ['u-mariana', 'Inspirador, tenho de voltar a correr.']],
    3: [['u-ines', 'Receita, por favor! 🙏'], ['u-rui', 'A fazer isto no fim de semana.']],
    4: [['u-mariana', 'A minha cidade preferida da Europa!'], ['u-tiago', 'Que saudades de viajar.']],
    5: [['u-goncalo', 'Tens um talento enorme. Parabéns!']],
    7: [['u-beatriz', 'Mal posso esperar para ouvir! 🎧']],
  };
  demoPosts.forEach((post, i) => {
    const nLikes = 2 + ((i * 7) % 5);
    post.likes = ids.filter(id => id !== post.author).slice(0, nLikes);
    (demoComments[i] || []).forEach(([author, text], j) => {
      post.comments.push({ id: uid(), author, text, ts: post.ts + (j + 1) * 9 * MIN });
    });
  });

  // Rede de seguidores entre contas demo
  demoUsers.forEach((u, i) => {
    demoUsers.forEach((v, j) => {
      if (i !== j && (i + j) % 2 === 0) { u.following.push(v.id); v.followers.push(u.id); }
    });
  });

  return {
    users: demoUsers,
    posts: demoPosts,
    me: null,                 // id do utilizador com sessão iniciada
    notifications: [],        // {id, type, from, postId?, text?, ts, read}
    conversations: {},        // userId -> [{from, text, ts, read}]
    saved: [],                // ids de publicações guardadas
    theme: 'light',
  };
}

/* ------------------------------------------------------------
   ACESSO A DADOS
   ------------------------------------------------------------ */
const getUser = id => state.users.find(u => u.id === id);
const getPost = id => state.posts.find(p => p.id === id);
const me = () => getUser(state.me);

function notify(type, from, extra = {}) {
  state.notifications.unshift({ id: uid(), type, from, ts: Date.now(), read: false, ...extra });
  if (state.notifications.length > 60) state.notifications.length = 60;
  save();
  updateBadges();
}

function unreadNotifs() { return state.notifications.filter(n => !n.read).length; }
function unreadMsgs() {
  return Object.values(state.conversations)
    .reduce((acc, msgs) => acc + msgs.filter(m => m.from !== state.me && !m.read).length, 0);
}

function updateBadges() {
  const n = unreadNotifs(), m = unreadMsgs();
  for (const [id, val] of [['#notifBadge', n], ['#msgBadge', m], ['#notifBadgeMobile', n]]) {
    const el = $(id);
    if (!el) continue;
    el.textContent = val;
    el.classList.toggle('hidden', val === 0);
  }
}

/* ------------------------------------------------------------
   ATIVIDADE SIMULADA
   Os utilizadores de demonstração reagem às tuas ações com um
   pequeno atraso, para a rede parecer viva.
   ------------------------------------------------------------ */
const REACTIONS = [
  'Adoro! 🔥', 'Que bom! 👏', 'Concordo a 100%.', 'Excelente publicação!',
  'Isto fez-me o dia 😄', 'Muito bem visto.', 'Top! 🚀', 'Obrigado por partilhares!',
];
const DM_REPLIES = [
  'Olá! Tudo bem por aí? 😄', 'Boa, conta-me mais!', 'Haha, exatamente!',
  'Sim! Estava mesmo a pensar nisso.', 'Que fixe! 👌', 'Combinado então!',
  'A sério? Não sabia!', 'Faz sentido. E tu, como estás?',
];
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

function simulateEngagement(postId) {
  const demoIds = state.users.filter(u => u.isDemo).map(u => u.id);
  const fans = [...demoIds].sort(() => Math.random() - .5).slice(0, 2 + Math.floor(Math.random() * 3));
  fans.forEach((fanId, i) => {
    setTimeout(() => {
      const post = getPost(postId);
      if (!post || !state.me) return;
      if (!post.likes.includes(fanId)) {
        post.likes.push(fanId);
        notify('like', fanId, { postId });
      }
      if (i === 0) {
        post.comments.push({ id: uid(), author: fanId, text: pickRandom(REACTIONS), ts: Date.now() });
        notify('comment', fanId, { postId, text: post.comments.at(-1).text });
      }
      save();
      rerenderIfVisible(postId);
    }, 4000 + i * (5000 + Math.random() * 8000));
  });
}

function simulateFollowBack(userId) {
  setTimeout(() => {
    const u = getUser(userId), m = me();
    if (!u || !m || u.following.includes(m.id)) return;
    if (Math.random() < 0.7) {
      u.following.push(m.id);
      m.followers.push(u.id);
      notify('follow', u.id);
      save();
    }
  }, 6000 + Math.random() * 10000);
}

function simulateDMReply(userId) {
  const convo = state.conversations[userId];
  if (!convo) return;
  // indicador "a escrever"
  setTimeout(() => {
    const body = $('#chatBody');
    if (body && currentChat === userId) {
      const t = document.createElement('div');
      t.className = 'typing'; t.id = 'typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
    }
  }, 1500);
  setTimeout(() => {
    $('#typing')?.remove();
    convo.push({ from: userId, text: pickRandom(DM_REPLIES), ts: Date.now(), read: currentChat === userId });
    if (currentChat !== userId) notify('message', userId);
    save();
    updateBadges();
    if (location.hash.startsWith('#/messages')) renderMessages(currentChat);
  }, 3500 + Math.random() * 3000);
}

/* ------------------------------------------------------------
   ROUTER
   ------------------------------------------------------------ */
let currentChat = null;

function route() {
  if (!state.me) return;
  const hash = location.hash || '#/feed';
  const [, page, param] = hash.split('/');

  $$('#sideNav a, #mobileNav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === page);
  });

  window.scrollTo(0, 0);
  switch (page) {
    case 'explore': renderExplore(); break;
    case 'notifications': renderNotifications(); break;
    case 'messages': renderMessages(param || null); break;
    case 'saved': renderSaved(); break;
    case 'profile': renderProfile(param || state.me); break;
    case 'post': renderSinglePost(param); break;
    case 'tag': renderTag(decodeURIComponent(param || '')); break;
    default: renderFeed();
  }
  renderRightbar();
}

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

function rerenderIfVisible(postId) {
  if (isTyping()) { updateBadges(); return; }
  const hash = location.hash || '#/feed';
  if (hash.startsWith('#/feed') || hash.startsWith('#/profile') ||
      hash.startsWith('#/saved') || hash.includes(postId)) {
    route();
  } else {
    updateBadges();
  }
}

/* ------------------------------------------------------------
   COMPONENTES
   ------------------------------------------------------------ */
function userLink(u) {
  return `<a class="post-author" href="#/profile/${u.id}">${escapeHTML(u.name)}</a>`;
}

function followBtn(u, small = false) {
  if (u.id === state.me) return '';
  const isFollowing = me().following.includes(u.id);
  return `<button class="btn-follow ${isFollowing ? 'following' : ''}" data-follow="${u.id}">
    ${isFollowing ? 'A seguir' : 'Seguir'}</button>`;
}

function postCard(post, { withComments = false } = {}) {
  const author = getUser(post.author);
  if (!author) return '';
  const liked = post.likes.includes(state.me);
  const saved = state.saved.includes(post.id);
  const isMine = post.author === state.me;

  const visibleComments = withComments ? post.comments : post.comments.slice(-2);
  const hiddenCount = post.comments.length - visibleComments.length;

  return `
  <article class="card post" data-post="${post.id}">
    <div class="post-head">
      <a href="#/profile/${author.id}"><img class="avatar" src="${author.avatar}" alt="${escapeHTML(author.name)}" /></a>
      <div class="post-head-info">
        <div>${userLink(author)} ${author.verified ? '✔️' : ''}</div>
        <div class="post-meta">@${escapeHTML(author.handle)} · <a href="#/post/${post.id}">${timeAgo(post.ts)}</a></div>
      </div>
      ${isMine ? `<button class="post-menu-btn" data-delete="${post.id}" title="Apagar publicação">🗑️</button>` : ''}
    </div>
    <div class="post-body">${richText(post.text)}</div>
    ${post.img ? `<img class="post-img" src="${post.img}" alt="" loading="lazy" data-lightbox="${post.img}" onerror="imgFallback(this,'${post.id}')" />` : ''}
    <div class="post-actions">
      <button class="post-action ${liked ? 'liked' : ''}" data-like="${post.id}">
        <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 4.7 6 4.2c2.1-.3 4.1.7 6 3 1.9-2.3 3.9-3.3 6-3 3.6.5 5.4 4.4 4 7.5C19.5 16.3 12 21 12 21Z"/></svg>
        <span>${post.likes.length || ''}</span>
      </button>
      <button class="post-action" data-comment-focus="${post.id}">
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.7-.8L3 21l1.9-5.3a8.4 8.4 0 1 1 16.1-4.2Z"/></svg>
        <span>${post.comments.length || ''}</span>
      </button>
      <button class="post-action ${saved ? 'saved-on' : ''}" data-save="${post.id}" style="margin-left:auto">
        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>
      </button>
    </div>
    <div class="comments">
      ${hiddenCount > 0 ? `<a class="comment-time" href="#/post/${post.id}">Ver os ${hiddenCount} comentários anteriores</a>` : ''}
      ${visibleComments.map(c => {
        const cu = getUser(c.author);
        return cu ? `
        <div class="comment">
          <a href="#/profile/${cu.id}"><img class="avatar avatar-sm" src="${cu.avatar}" alt="" /></a>
          <div class="comment-bubble">
            <span class="comment-author">${escapeHTML(cu.name)}</span>
            <div class="comment-text">${richText(c.text)}</div>
            <div class="comment-time">${timeAgo(c.ts)}</div>
          </div>
        </div>` : '';
      }).join('')}
      <form class="comment-form" data-comment-form="${post.id}">
        <img class="avatar avatar-sm" src="${me().avatar}" alt="" />
        <input type="text" maxlength="280" placeholder="Escreve um comentário…" />
        <button type="submit">Enviar</button>
      </form>
    </div>
  </article>`;
}

/* ------------------------------------------------------------
   PÁGINAS
   ------------------------------------------------------------ */
function renderFeed() {
  const m = me();
  const visible = state.posts
    .filter(p => p.author === state.me || m.following.includes(p.author) || getUser(p.author)?.isDemo)
    .sort((a, b) => b.ts - a.ts);

  $('#main').innerHTML = `
    <div class="page-head"><h2>Início</h2></div>
    <div class="card inline-composer" id="inlineComposer">
      <img class="avatar" src="${m.avatar}" alt="" />
      <div class="fake-input">O que se passa, ${escapeHTML(m.name.split(' ')[0])}?</div>
    </div>
    <div class="feed">
      ${visible.length ? visible.map(p => postCard(p)).join('') :
        emptyState('📝', 'Ainda não há publicações', 'Segue pessoas em Explorar ou cria a tua primeira publicação.')}
    </div>`;
  $('#inlineComposer')?.addEventListener('click', openComposer);
}

function renderExplore(query = '') {
  const q = query.trim().toLowerCase();
  const users = state.users.filter(u => u.id !== state.me &&
    (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)));
  const posts = state.posts.filter(p =>
    (!q || p.text.toLowerCase().includes(q)) && p.img).sort((a, b) => b.likes.length - a.likes.length);
  const textPosts = q ? state.posts.filter(p => p.text.toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts) : [];

  $('#main').innerHTML = `
    <div class="page-head"><h2>Explorar</h2></div>
    <div class="explore-search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" id="exploreInput" placeholder="Pesquisar pessoas, publicações, #hashtags…" value="${escapeHTML(query)}" />
    </div>
    ${users.length ? `<div class="section-label">Pessoas</div>
      <div class="card" style="padding:8px 18px">
        ${users.map(u => `
          <div class="rb-user">
            <a href="#/profile/${u.id}"><img class="avatar" src="${u.avatar}" alt="" /></a>
            <div class="rb-user-info">
              <a class="rb-user-name" href="#/profile/${u.id}">${escapeHTML(u.name)} ${u.verified ? '✔️' : ''}</a>
              <div class="rb-user-handle">@${escapeHTML(u.handle)} · ${u.followers.length} seguidores</div>
            </div>
            ${followBtn(u)}
          </div>`).join('')}
      </div>` : ''}
    ${q && textPosts.length ? `<div class="section-label">Publicações</div>
      <div class="feed">${textPosts.map(p => postCard(p)).join('')}</div>` : ''}
    ${!q ? `<div class="section-label">Em destaque</div>
      <div class="explore-grid">
        ${posts.map(p => `<a class="explore-tile" href="#/post/${p.id}"><img src="${p.img}" alt="" loading="lazy" onerror="imgFallback(this,'${p.id}')" /></a>`).join('')}
      </div>` : ''}
    ${q && !users.length && !textPosts.length ?
      emptyState('🔍', 'Sem resultados', `Não encontrámos nada para “${escapeHTML(query)}”.`) : ''}`;

  const input = $('#exploreInput');
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    renderExplore(input.value);
    const el = $('#exploreInput');
    el.focus(); el.setSelectionRange(pos, pos);
  });
  if (q) { input.focus(); input.setSelectionRange(q.length, q.length); }
}

function renderTag(tag) {
  const posts = state.posts.filter(p => p.text.toLowerCase().includes('#' + tag.toLowerCase()))
    .sort((a, b) => b.ts - a.ts);
  $('#main').innerHTML = `
    <div class="page-head">
      <button class="back-btn" onclick="history.back()">←</button>
      <div><h2>#${escapeHTML(tag)}</h2><div class="page-sub">${posts.length} publicações</div></div>
    </div>
    <div class="feed">${posts.length ? posts.map(p => postCard(p)).join('') :
      emptyState('🏷️', 'Nada por aqui', 'Ainda ninguém usou esta hashtag.')}</div>`;
}

function renderNotifications() {
  const list = state.notifications;
  const ICONS = { like: '❤️', comment: '💬', follow: '👤', message: '✉️' };
  const LABEL = {
    like: 'gostou da tua publicação',
    comment: 'comentou a tua publicação',
    follow: 'começou a seguir-te',
    message: 'enviou-te uma mensagem',
  };

  $('#main').innerHTML = `
    <div class="page-head"><h2>Notificações</h2></div>
    <div class="notif-list">
      ${list.length ? list.map(n => {
        const u = getUser(n.from);
        if (!u) return '';
        const href = n.type === 'follow' ? `#/profile/${u.id}` :
                     n.type === 'message' ? `#/messages/${u.id}` : `#/post/${n.postId}`;
        return `
        <a class="card notif ${n.read ? '' : 'unread'}" href="${href}">
          <span class="notif-icon">${ICONS[n.type]}</span>
          <img class="avatar avatar-sm" src="${u.avatar}" alt="" />
          <div class="notif-body">
            <div><b>${escapeHTML(u.name)}</b> ${LABEL[n.type]}.</div>
            ${n.text ? `<div class="notif-snippet">“${escapeHTML(n.text)}”</div>` : ''}
          </div>
          <span class="notif-time">${timeAgo(n.ts)}</span>
        </a>`;
      }).join('') : emptyState('🔔', 'Tudo em dia', 'Quando alguém interagir contigo, aparece aqui.')}
    </div>`;

  state.notifications.forEach(n => { n.read = true; });
  save();
  updateBadges();
}

function renderMessages(userId) {
  currentChat = userId;
  const demoUsers = state.users.filter(u => u.isDemo);
  const convos = demoUsers
    .map(u => ({ u, msgs: state.conversations[u.id] || [] }))
    .sort((a, b) => (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0));

  const active = userId ? getUser(userId) : null;
  const msgs = active ? (state.conversations[active.id] || []) : [];

  // marcar como lidas
  msgs.forEach(msg => { if (msg.from !== state.me) msg.read = true; });
  save();

  $('#main').innerHTML = `
    <div class="page-head"><h2>Mensagens</h2></div>
    <div class="card messages-layout">
      <div class="convo-list ${active ? 'chat-open' : ''}">
        ${convos.map(({ u, msgs }) => {
          const last = msgs.at(-1);
          const unread = msgs.filter(m => m.from !== state.me && !m.read).length;
          return `
          <button class="convo-item ${active?.id === u.id ? 'active' : ''}" data-chat="${u.id}">
            <img class="avatar" src="${u.avatar}" alt="" />
            <div class="convo-info">
              <div class="convo-name">${escapeHTML(u.name)}</div>
              <div class="convo-last">${last ? escapeHTML(last.text) : 'Inicia uma conversa 👋'}</div>
            </div>
            ${unread ? `<span class="nav-badge">${unread}</span>` : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="chat ${active ? 'chat-open' : ''}">
        ${active ? `
          <div class="chat-head">
            <button class="back-btn" data-chat-back style="width:32px;height:32px">←</button>
            <a href="#/profile/${active.id}"><img class="avatar avatar-sm" src="${active.avatar}" alt="" /></a>
            <div>
              <div class="chat-head-name">${escapeHTML(active.name)}</div>
              <div class="chat-head-status">● online</div>
            </div>
          </div>
          <div class="chat-body" id="chatBody">
            ${msgs.length ? msgs.map(msg => `
              <div class="bubble ${msg.from === state.me ? 'out' : 'in'}">
                ${escapeHTML(msg.text)}
                <span class="bubble-time">${timeHM(msg.ts)}</span>
              </div>`).join('') :
              `<div class="chat-empty">Diz olá a ${escapeHTML(active.name.split(' ')[0])}! 👋</div>`}
          </div>
          <form class="chat-form" id="chatForm">
            <input type="text" maxlength="500" placeholder="Escreve uma mensagem…" autocomplete="off" />
            <button type="submit" title="Enviar">
              <svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </form>` :
          `<div class="chat-empty" style="margin:auto">
            <div style="font-size:2.4rem;margin-bottom:10px">💬</div>
            Seleciona uma conversa para começar.
          </div>`}
      </div>
    </div>`;

  const body = $('#chatBody');
  if (body) body.scrollTop = body.scrollHeight;
  updateBadges();

  $$('[data-chat]').forEach(btn =>
    btn.addEventListener('click', () => { location.hash = `#/messages/${btn.dataset.chat}`; }));
  $('[data-chat-back]')?.addEventListener('click', () => { location.hash = '#/messages'; });

  $('#chatForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    (state.conversations[active.id] ||= []).push({ from: state.me, text, ts: Date.now(), read: true });
    save();
    renderMessages(active.id);
    simulateDMReply(active.id);
  });
}

function renderSaved() {
  const posts = state.saved.map(getPost).filter(Boolean).sort((a, b) => b.ts - a.ts);
  $('#main').innerHTML = `
    <div class="page-head"><h2>Guardados</h2></div>
    <div class="feed">${posts.length ? posts.map(p => postCard(p)).join('') :
      emptyState('🔖', 'Nada guardado', 'Toca no ícone de marcador numa publicação para a guardares aqui.')}</div>`;
}

function renderProfile(userId, tab = 'posts') {
  const u = getUser(userId);
  if (!u) { location.hash = '#/feed'; return; }
  const isMe = u.id === state.me;
  const posts = state.posts.filter(p => p.author === u.id).sort((a, b) => b.ts - a.ts);
  const likedPosts = state.posts.filter(p => p.likes.includes(u.id)).sort((a, b) => b.ts - a.ts);
  const shown = tab === 'likes' ? likedPosts : posts;

  $('#main').innerHTML = `
    <div class="page-head">
      <button class="back-btn" onclick="history.back()">←</button>
      <div><h2>${escapeHTML(u.name)}</h2><div class="page-sub">${posts.length} publicações</div></div>
    </div>
    <div class="card profile-card">
      <div class="profile-cover" style="background:linear-gradient(135deg,hsl(${u.hue},70%,55%),hsl(${(u.hue + 60) % 360},70%,45%))"></div>
      <div class="profile-body">
        <div class="profile-top">
          <img class="avatar avatar-xl" src="${u.avatar}" alt="" />
          <div class="profile-actions">
            ${isMe ?
              `<button class="btn-ghost" id="editProfileBtn">Editar perfil</button>
               <button class="btn-ghost" id="logoutBtn" title="Terminar sessão">Sair</button>` :
              `<button class="btn-ghost" data-chat-open="${u.id}">Mensagem</button> ${followBtn(u)}`}
          </div>
        </div>
        <div class="profile-name">${escapeHTML(u.name)} ${u.verified ? '✔️' : ''}</div>
        <div class="profile-handle">@${escapeHTML(u.handle)}</div>
        ${u.bio ? `<div class="profile-bio">${richText(u.bio)}</div>` : ''}
        <div class="profile-stats">
          <span><b>${posts.length}</b> publicações</span>
          <span><b>${u.followers.length}</b> seguidores</span>
          <span><b>${u.following.length}</b> a seguir</span>
        </div>
        <div class="profile-tabs">
          <button class="profile-tab ${tab === 'posts' ? 'active' : ''}" data-tab="posts">Publicações</button>
          <button class="profile-tab ${tab === 'likes' ? 'active' : ''}" data-tab="likes">Gostos</button>
        </div>
      </div>
    </div>
    <div class="feed">${shown.length ? shown.map(p => postCard(p)).join('') :
      emptyState('📭', tab === 'likes' ? 'Sem gostos' : 'Sem publicações',
        tab === 'likes' ? 'As publicações gostadas aparecem aqui.' : 'Ainda não há nada para mostrar.')}</div>`;

  $$('.profile-tab').forEach(btn =>
    btn.addEventListener('click', () => renderProfile(userId, btn.dataset.tab)));
  $('#editProfileBtn')?.addEventListener('click', openEditProfile);
  $('#logoutBtn')?.addEventListener('click', logout);
  $('[data-chat-open]')?.addEventListener('click', e => {
    location.hash = `#/messages/${e.currentTarget.dataset.chatOpen}`;
  });
}

function renderSinglePost(postId) {
  const post = getPost(postId);
  if (!post) { location.hash = '#/feed'; return; }
  $('#main').innerHTML = `
    <div class="page-head">
      <button class="back-btn" onclick="history.back()">←</button>
      <h2>Publicação</h2>
    </div>
    <div class="feed">${postCard(post, { withComments: true })}</div>`;
}

function renderRightbar() {
  const m = me();
  const suggestions = state.users
    .filter(u => u.id !== state.me && !m.following.includes(u.id))
    .sort((a, b) => b.followers.length - a.followers.length)
    .slice(0, 4);

  // hashtags em alta
  const tagCount = {};
  state.posts.forEach(p => {
    (p.text.match(/#[\p{L}\d_]+/gu) || []).forEach(t => {
      const k = t.slice(1).toLowerCase();
      tagCount[k] = (tagCount[k] || 0) + 1 + p.likes.length;
    });
  });
  const trends = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  $('#rightbar').innerHTML = `
    <div class="rb-search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" id="rbSearch" placeholder="Pesquisar no Nexo" />
    </div>
    ${suggestions.length ? `
    <div class="card rb-card">
      <h4>Sugestões para ti</h4>
      ${suggestions.map(u => `
        <div class="rb-user">
          <a href="#/profile/${u.id}"><img class="avatar" src="${u.avatar}" alt="" /></a>
          <div class="rb-user-info">
            <a class="rb-user-name" href="#/profile/${u.id}">${escapeHTML(u.name)}</a>
            <div class="rb-user-handle">@${escapeHTML(u.handle)}</div>
          </div>
          ${followBtn(u)}
        </div>`).join('')}
    </div>` : ''}
    ${trends.length ? `
    <div class="card rb-card">
      <h4>Em alta</h4>
      ${trends.map(([tag, score]) => `
        <a class="rb-trend" href="#/tag/${encodeURIComponent(tag)}">
          <div class="rb-trend-tag">#${escapeHTML(tag)}</div>
          <div class="rb-trend-count">${score} interações</div>
        </a>`).join('')}
    </div>` : ''}
    <p class="rb-foot">Nexo · Demo client-side<br>Feito com ❤️ em GitHub Pages</p>`;

  $('#rbSearch')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      location.hash = '#/explore';
      setTimeout(() => {
        const input = $('#exploreInput');
        if (input) { input.value = e.target.value; input.dispatchEvent(new Event('input')); }
      }, 50);
    }
  });
}

function emptyState(icon, title, sub) {
  return `<div class="card empty"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

/* ------------------------------------------------------------
   AÇÕES (delegação de eventos global)
   ------------------------------------------------------------ */
document.addEventListener('click', e => {
  const likeBtn = e.target.closest('[data-like]');
  if (likeBtn) {
    const post = getPost(likeBtn.dataset.like);
    const i = post.likes.indexOf(state.me);
    if (i === -1) {
      post.likes.push(state.me);
      likeBtn.classList.add('liked', 'pop');
    } else {
      post.likes.splice(i, 1);
      likeBtn.classList.remove('liked');
    }
    likeBtn.querySelector('span').textContent = post.likes.length || '';
    save();
    return;
  }

  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) {
    const id = saveBtn.dataset.save;
    const i = state.saved.indexOf(id);
    if (i === -1) { state.saved.push(id); toast('Publicação guardada 🔖'); }
    else { state.saved.splice(i, 1); toast('Removida dos guardados'); }
    saveBtn.classList.toggle('saved-on', i === -1);
    save();
    return;
  }

  const followEl = e.target.closest('[data-follow]');
  if (followEl) {
    const targetId = followEl.dataset.follow;
    const m = me(), target = getUser(targetId);
    const i = m.following.indexOf(targetId);
    if (i === -1) {
      m.following.push(targetId);
      target.followers.push(m.id);
      toast(`Agora segues @${target.handle}`);
      simulateFollowBack(targetId);
    } else {
      m.following.splice(i, 1);
      target.followers.splice(target.followers.indexOf(m.id), 1);
    }
    save();
    route();
    return;
  }

  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    if (confirm('Apagar esta publicação? Esta ação não pode ser anulada.')) {
      state.posts = state.posts.filter(p => p.id !== delBtn.dataset.delete);
      state.saved = state.saved.filter(id => id !== delBtn.dataset.delete);
      save();
      toast('Publicação apagada');
      route();
    }
    return;
  }

  const focusBtn = e.target.closest('[data-comment-focus]');
  if (focusBtn) {
    const card = focusBtn.closest('.post');
    card.querySelector('.comment-form input')?.focus();
    return;
  }

  const tagEl = e.target.closest('.hashtag');
  if (tagEl) {
    location.hash = `#/tag/${encodeURIComponent(tagEl.dataset.tag)}`;
    return;
  }

  const lightboxImg = e.target.closest('[data-lightbox]');
  if (lightboxImg) {
    $('#lightboxImg').src = lightboxImg.dataset.lightbox;
    $('#lightbox').classList.remove('hidden');
    return;
  }

  if (e.target.closest('#lightbox')) {
    $('#lightbox').classList.add('hidden');
    return;
  }

  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) {
    $('#' + closeBtn.dataset.close).classList.add('hidden');
    return;
  }

  // fechar modal ao clicar no fundo
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('[data-comment-form]');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('input');
  const text = input.value.trim();
  if (!text) return;
  const post = getPost(form.dataset.commentForm);
  post.comments.push({ id: uid(), author: state.me, text, ts: Date.now() });
  save();
  route();
});

/* ------------------------------------------------------------
   COMPOSER
   ------------------------------------------------------------ */
let composerImg = null;

function openComposer() {
  composerImg = null;
  $('#composerText').value = '';
  $('#composerCount').textContent = '0/500';
  $('#composerPreview').classList.add('hidden');
  $('#composerSubmit').disabled = true;
  $('#composerAvatar').src = me().avatar;
  $('#composerModal').classList.remove('hidden');
  setTimeout(() => $('#composerText').focus(), 50);
}

function initComposer() {
  $('#openComposer').addEventListener('click', openComposer);
  $('#openComposerMobile').addEventListener('click', openComposer);

  const textEl = $('#composerText');
  textEl.addEventListener('input', () => {
    $('#composerCount').textContent = `${textEl.value.length}/500`;
    $('#composerSubmit').disabled = !textEl.value.trim() && !composerImg;
  });

  $('#composerFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      composerImg = await fileToDataURL(file);
      $('#composerPreviewImg').src = composerImg;
      $('#composerPreview').classList.remove('hidden');
      $('#composerSubmit').disabled = false;
    } catch { toast('Não foi possível carregar a imagem.'); }
    e.target.value = '';
  });

  $('#composerRemoveImg').addEventListener('click', () => {
    composerImg = null;
    $('#composerPreview').classList.add('hidden');
    $('#composerSubmit').disabled = !textEl.value.trim();
  });

  $('#composerSubmit').addEventListener('click', () => {
    const text = textEl.value.trim();
    if (!text && !composerImg) return;
    const post = { id: uid(), author: state.me, text, img: composerImg, ts: Date.now(), likes: [], comments: [] };
    state.posts.push(post);
    save();
    $('#composerModal').classList.add('hidden');
    toast('Publicado! 🎉');
    location.hash = '#/feed';
    route();
    simulateEngagement(post.id);
  });
}

/* ------------------------------------------------------------
   EDITAR PERFIL
   ------------------------------------------------------------ */
let epAvatar = null;

function openEditProfile() {
  const m = me();
  epAvatar = null;
  $('#epName').value = m.name;
  $('#epBio').value = m.bio || '';
  $('#epAvatarPreview').src = m.avatar;
  $('#editProfileModal').classList.remove('hidden');
}

function initEditProfile() {
  $('#epAvatar').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      epAvatar = await fileToDataURL(file, 400);
      $('#epAvatarPreview').src = epAvatar;
    } catch { toast('Não foi possível carregar a imagem.'); }
  });

  $('#editProfileForm').addEventListener('submit', e => {
    e.preventDefault();
    const m = me();
    m.name = $('#epName').value.trim() || m.name;
    m.bio = $('#epBio').value.trim();
    if (epAvatar) m.avatar = epAvatar;
    save();
    $('#editProfileModal').classList.add('hidden');
    toast('Perfil atualizado ✅');
    renderSidebarMe();
    route();
  });
}

/* ------------------------------------------------------------
   TEMA
   ------------------------------------------------------------ */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const dark = state.theme === 'dark';
  $('#themeToggle .tt-icon').textContent = dark ? '☀️' : '🌙';
  $('#themeToggle .tt-label').textContent = dark ? 'Tema claro' : 'Tema escuro';
}

/* ------------------------------------------------------------
   AUTENTICAÇÃO
   ------------------------------------------------------------ */
let authMode = 'signup'; // ou 'login'

function renderAuthMode() {
  const signup = authMode === 'signup';
  $('#authTitle').textContent = signup ? 'Cria a tua conta' : 'Bem-vindo de volta';
  $('#authSub').textContent = signup
    ? 'Demora menos de um minuto. Os teus dados ficam guardados neste dispositivo.'
    : 'Introduz o teu nome de utilizador para continuar.';
  $('#fieldName').classList.toggle('hidden', !signup);
  $('#fieldBio').classList.toggle('hidden', !signup);
  $('#authBtn').textContent = signup ? 'Criar conta' : 'Entrar';

  const hasAccounts = state.users.some(u => !u.isDemo);
  $('#authSwitch').innerHTML = signup
    ? (hasAccounts ? 'Já tens conta? <button type="button" id="switchMode">Inicia sessão</button>' : '')
    : 'Ainda não tens conta? <button type="button" id="switchMode">Cria uma</button>';
  $('#switchMode')?.addEventListener('click', () => {
    authMode = signup ? 'login' : 'signup';
    $('#handleHint').textContent = '';
    renderAuthMode();
  });
}

function initAuth() {
  renderAuthMode();
  $('#authForm').addEventListener('submit', e => {
    e.preventDefault();
    const handle = $('#inHandle').value.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    const hint = $('#handleHint');
    hint.classList.remove('error');

    if (authMode === 'login') {
      const u = state.users.find(u => !u.isDemo && u.handle === handle);
      if (!u) {
        hint.textContent = 'Utilizador não encontrado neste dispositivo.';
        hint.classList.add('error');
        return;
      }
      loginAs(u.id);
      return;
    }

    const name = $('#inName').value.trim();
    if (!name) { hint.textContent = 'Indica o teu nome.'; hint.classList.add('error'); return; }
    if (handle.length < 3) { hint.textContent = 'O nome de utilizador precisa de pelo menos 3 caracteres.'; hint.classList.add('error'); return; }
    if (state.users.some(u => u.handle === handle)) {
      hint.textContent = 'Esse nome de utilizador já está ocupado.'; hint.classList.add('error'); return;
    }

    const user = {
      id: 'u-' + uid(),
      name, handle,
      bio: $('#inBio').value.trim(),
      hue: Math.floor(Math.random() * 360),
      avatar: null,
      followers: [], following: [],
      joinedAt: Date.now(),
    };
    user.avatar = makeAvatar(name, user.hue);
    state.users.push(user);

    // boas-vindas: alguns utilizadores demo seguem-te logo
    state.users.filter(u => u.isDemo).slice(0, 3).forEach(u => {
      u.following.push(user.id);
      user.followers.push(u.id);
    });

    loginAs(user.id);
    toast(`Bem-vindo ao Nexo, ${name.split(' ')[0]}! 🎉`);

    // primeira notificação + primeira mensagem para dar vida
    setTimeout(() => {
      notify('follow', 'u-mariana');
      notify('follow', 'u-tiago');
    }, 3000);
    setTimeout(() => {
      (state.conversations['u-mariana'] ||= []).push({
        from: 'u-mariana',
        text: `Olá ${name.split(' ')[0]}! Bem-vindo ao Nexo 👋 Adorei o teu perfil!`,
        ts: Date.now(), read: false,
      });
      notify('message', 'u-mariana');
      save();
    }, 8000);
  });
}

function loginAs(userId) {
  state.me = userId;
  save();
  $('#authScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  renderSidebarMe();
  updateBadges();
  if (!location.hash) location.hash = '#/feed';
  route();
}

function logout() {
  state.me = null;
  save();
  location.hash = '';
  $('#app').classList.add('hidden');
  $('#authScreen').classList.remove('hidden');
  authMode = state.users.some(u => !u.isDemo) ? 'login' : 'signup';
  renderAuthMode();
}

function renderSidebarMe() {
  const m = me();
  if (!m) return;
  $('#sidebarMe').innerHTML = `
    <img class="avatar avatar-sm" src="${m.avatar}" alt="" />
    <div class="me-text">
      <div class="me-name">${escapeHTML(m.name)}</div>
      <div class="me-handle">@${escapeHTML(m.handle)}</div>
    </div>`;
  $('#sidebarMe').onclick = () => { location.hash = '#/profile'; };
}

/* ------------------------------------------------------------
   ARRANQUE
   ------------------------------------------------------------ */
function init() {
  state = load() || seedState();

  // garantir campos novos em estados antigos
  state.saved ||= [];
  state.conversations ||= {};
  state.notifications ||= [];

  applyTheme();
  initComposer();
  initEditProfile();
  initAuth();

  $('#themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save();
    applyTheme();
  });

  window.addEventListener('hashchange', route);

  if (state.me && getUser(state.me)) {
    loginAs(state.me);
  } else {
    authMode = state.users.some(u => !u.isDemo) ? 'login' : 'signup';
    renderAuthMode();
    $('#authScreen').classList.remove('hidden');
  }

  // atualizar tempos relativos periodicamente
  setInterval(() => {
    if (state.me && !document.hidden && !isTyping()) route();
  }, 120_000);
}

init();
