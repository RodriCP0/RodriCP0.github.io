/* ============================================================
   NEXO — Rede social · v2
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

function richText(text) {
  return escapeHTML(text).replace(/#([\p{L}\d_]+)/gu,
    '<span class="hashtag" data-tag="$1">#$1</span>');
}

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

function dayLabel(ts) {
  const d = new Date(ts), today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
}

/** Avatar SVG (iniciais + gradiente) como data URI — funciona offline. */
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

const VBADGE = `<svg class="vbadge" viewBox="0 0 24 24" aria-label="Conta verificada"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2-3.43-3.43 1.41-1.41 2.02 2.02 4.79-4.79 1.41 1.41-6.2 6.2z"/></svg>`;

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

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

/* ------------------------------------------------------------
   ESTADO E PERSISTÊNCIA
   ------------------------------------------------------------ */
const STORAGE_KEY = 'nexo.v1';
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

let state = null;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Armazenamento cheio — apaga publicações com imagens grandes.');
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
}

const pic = (seed, w = 900, h = 650) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

/* ------------------------------------------------------------
   DADOS DE DEMONSTRAÇÃO
   ------------------------------------------------------------ */
function seedState() {
  const now = Date.now();

  const demoUsers = [
    { id: 'u-mariana', name: 'Mariana Costa', handle: 'marianac', hue: 330,
      bio: 'Fotógrafa de viagens 📷 · Sempre com a mala feita', verified: true },
    { id: 'u-tiago', name: 'Tiago Almeida', handle: 'tiagodev', hue: 210,
      bio: 'Engenheiro de software · Apaixonado por open source e café ☕', verified: true },
    { id: 'u-ines', name: 'Inês Ribeiro', handle: 'ines.fit', hue: 150,
      bio: 'Personal trainer 💪 · Corrida, força e boa disposição', verified: true },
    { id: 'u-goncalo', name: 'Gonçalo Martins', handle: 'gmartins', hue: 25,
      bio: 'Chef amador 🍳 · Receitas simples para dias ocupados' },
    { id: 'u-beatriz', name: 'Beatriz Lopes', handle: 'beatriz_arte', hue: 270,
      bio: 'Ilustradora freelance ✏️ · Comissões abertas' },
    { id: 'u-rui', name: 'Rui Fernandes', handle: 'ruif', hue: 190,
      bio: 'Estudante de Erasmus na Eslovénia 🇸🇮 · A explorar a Europa' },
    { id: 'u-sofia', name: 'Sofia Mendes', handle: 'sofiam', hue: 45,
      bio: 'Jornalista de tecnologia · Escrevo sobre o futuro 🚀', verified: true },
    { id: 'u-pedro', name: 'Pedro Santos', handle: 'pedro.music', hue: 0,
      bio: 'Músico e produtor 🎸 · Novo single em breve' },
  ].map(u => ({
    ...u,
    avatar: makeAvatar(u.name, u.hue),
    cover: null,
    isDemo: true,
    followers: [], following: [],
    joinedAt: now - 200 * DAY,
  }));

  const demoPosts = [
    { author: 'u-mariana', ts: now - 26 * MIN, imgs: [pic('nexo-alps'), pic('nexo-alps2')],
      text: 'Acordar às 5h valeu cada segundo. O nascer do sol nos Alpes é outra coisa. 🏔️ #viagens #fotografia' },
    { author: 'u-tiago', ts: now - 1.2 * HOUR,
      text: 'Acabei de publicar a versão 2.0 do meu projeto open source! Reescrita completa, 3x mais rápido e finalmente com documentação decente. O sentimento de carregar no botão de release nunca envelhece. 🚀 #dev #opensource' },
    { author: 'u-ines', ts: now - 2.5 * HOUR, imgs: [pic('nexo-run', 900, 600)],
      text: 'Meia maratona feita! 1h52 — novo recorde pessoal. 🏃‍♀️ Quem disse que segundas-feiras são más não corre de manhã. #corrida #fitness' },
    { author: 'u-goncalo', ts: now - 4 * HOUR, imgs: [pic('nexo-food', 900, 700), pic('nexo-food2', 900, 700), pic('nexo-food3', 900, 700)],
      text: 'Risotto de cogumelos em 25 minutos, passo a passo. O segredo? Caldo sempre quente e paciência no fim. 👨‍🍳 #cozinha #receitas' },
    { author: 'u-rui', ts: now - 6 * HOUR, imgs: [pic('nexo-ljubljana', 900, 600)],
      text: 'Ljubljana ao entardecer. Cada vez mais convencido de que o Erasmus foi a melhor decisão da minha vida. 🇸🇮 #erasmus #eslovenia' },
    { author: 'u-beatriz', ts: now - 9 * HOUR, imgs: [pic('nexo-art', 800, 800)],
      text: 'Trabalho terminado! Ilustração para a capa de um livro infantil que sai em setembro. Não podia estar mais orgulhosa deste. ✏️✨ #ilustracao #arte' },
    { author: 'u-sofia', ts: now - 13 * HOUR,
      text: 'Hot take: a melhor funcionalidade de qualquer rede social continua a ser o botão de silenciar. Usem-no sem culpa, a vossa saúde mental agradece. 🧘' },
    { author: 'u-pedro', ts: now - 1 * DAY,
      text: 'Última sessão de estúdio antes da masterização. Este single tem sido um ano inteiro de trabalho e finalmente está quase cá fora. 🎸 #musica' },
    { author: 'u-mariana', ts: now - 1.3 * DAY, imgs: [pic('nexo-sea', 900, 600)],
      text: 'O Adriático num dia de vento. Às vezes a melhor fotografia é a que não estava planeada. 🌊 #mar #fotografia' },
    { author: 'u-tiago', ts: now - 1.8 * DAY,
      text: 'Dica de produtividade que mudou a minha semana: bloquear 2 horas de manhã sem reuniões, sem chat, sem e-mail. Só código. A diferença é absurda. #produtividade' },
    { author: 'u-ines', ts: now - 2.2 * DAY,
      text: 'Lembrete amigável: descansar também é treinar. O músculo cresce na recuperação, não no ginásio. 😴 #fitness #saude' },
    { author: 'u-goncalo', ts: now - 2.6 * DAY, imgs: [pic('nexo-bread', 900, 650)],
      text: 'Primeiro pão de fermentação lenta. 48 horas de espera, 10 minutos a existir. Valeu a pena? Absolutamente. 🍞' },
  ].map(p => ({
    id: uid(), author: p.author, text: p.text, imgs: p.imgs || [],
    ts: p.ts, likes: [], comments: [], reposts: [], isDemo: true,
  }));

  const ids = demoUsers.map(u => u.id);
  const demoComments = {
    0: [['u-rui', 'Que fotografia incrível! 😍'], ['u-beatriz', 'As cores estão perfeitas.']],
    1: [['u-sofia', 'Parabéns! Vou escrever sobre isto 👀']],
    2: [['u-pedro', 'Máquina! 💪'], ['u-mariana', 'Inspirador, tenho de voltar a correr.']],
    3: [['u-ines', 'Receita guardada! 🙏'], ['u-rui', 'A fazer isto no fim de semana.']],
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

  // Reposts de demonstração (entrada no feed + contagem no original)
  demoPosts[1].reposts.push('u-sofia');
  demoPosts.push({ id: uid(), author: 'u-sofia', repostOf: demoPosts[1].id, ts: now - 50 * MIN });
  demoPosts[2].reposts.push('u-pedro');
  demoPosts.push({ id: uid(), author: 'u-pedro', repostOf: demoPosts[2].id, ts: now - 2 * HOUR });

  // Rede de seguidores entre contas demo
  demoUsers.forEach((u, i) => {
    demoUsers.forEach((v, j) => {
      if (i !== j && (i + j) % 2 === 0) { u.following.push(v.id); v.followers.push(u.id); }
    });
  });

  return {
    users: demoUsers,
    posts: demoPosts,
    stories: seedStories(now),
    me: null,
    notifications: [],
    conversations: {},
    saved: [],
    theme: 'light',
  };
}

function seedStories(now = Date.now()) {
  return [
    { id: uid(), author: 'u-mariana', ts: now - 2 * HOUR, img: pic('nexo-story-alps', 600, 1066), caption: 'Bom dia desde os Alpes ⛰️', viewed: false },
    { id: uid(), author: 'u-mariana', ts: now - 1 * HOUR, img: pic('nexo-story-lake', 600, 1066), caption: 'Este lago não é real 😍', viewed: false },
    { id: uid(), author: 'u-ines', ts: now - 3 * HOUR, img: pic('nexo-story-gym', 600, 1066), caption: 'Treino das 7h feito ✅', viewed: false },
    { id: uid(), author: 'u-goncalo', ts: now - 5 * HOUR, img: pic('nexo-story-pasta', 600, 1066), caption: 'Hoje há massa fresca 🍝', viewed: false },
    { id: uid(), author: 'u-rui', ts: now - 7 * HOUR, img: pic('nexo-story-city', 600, 1066), caption: 'Tarde livre em Ljubljana', viewed: false },
    { id: uid(), author: 'u-pedro', ts: now - 9 * HOUR, gradient: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', text: 'SINGLE NOVO\nSEXTA-FEIRA 🎸', viewed: false },
  ];
}

/** Acrescenta campos novos a estados guardados com a versão antiga. */
function migrate(s) {
  s.saved ||= [];
  s.conversations ||= {};
  s.notifications ||= [];
  s.stories ||= seedStories();
  s.users.forEach(u => { u.cover ??= null; });
  s.posts.forEach(p => {
    if (p.img && !p.imgs) p.imgs = [p.img];
    delete p.img;
    p.imgs ||= [];
    p.reposts ||= [];
  });
  // stories expiram após 24 h
  s.stories = s.stories.filter(st => Date.now() - st.ts < DAY);
  return s;
}

/* ------------------------------------------------------------
   ACESSO A DADOS
   ------------------------------------------------------------ */
const getUser = id => state.users.find(u => u.id === id);
const getPost = id => state.posts.find(p => p.id === id);
const me = () => getUser(state.me);

function notify(type, from, extra = {}) {
  state.notifications.unshift({ id: uid(), type, from, ts: Date.now(), read: false, ...extra });
  if (state.notifications.length > 80) state.notifications.length = 80;
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
  for (const [id, val] of [['#notifBadge', n], ['#msgBadge', m], ['#notifBadgeMobile', n], ['#msgBadgeMobile', m]]) {
    const el = $(id);
    if (!el) continue;
    el.textContent = val;
    el.classList.toggle('hidden', val === 0);
  }
  const total = n + m;
  document.title = (total ? `(${total}) ` : '') + 'Nexo — A tua rede social';
}

/* ------------------------------------------------------------
   SIMULAÇÃO — a rede parece viva
   ------------------------------------------------------------ */
const REACTIONS = [
  'Adoro! 🔥', 'Que bom! 👏', 'Concordo a 100%.', 'Excelente publicação!',
  'Isto fez-me o dia 😄', 'Muito bem visto.', 'Top! 🚀', 'Obrigado por partilhares!',
  'Que fotografia! 😍', 'Preciso de saber mais sobre isto.',
];

const LIVE_POOL = [
  { author: 'u-tiago', text: 'Debugging às 23h: o erro era uma vírgula. Uma. Vírgula. 🙃 #dev' },
  { author: 'u-mariana', text: 'A organizar as fotos da última viagem e já com saudades. Próxima paragem: Islândia? 🇮🇸 #viagens', img: () => pic('nexo-live-' + uid(), 900, 600) },
  { author: 'u-ines', text: 'Quem treinou hoje levanta a mão 🙋‍♀️ Não interessa quanto, interessa aparecer. #fitness' },
  { author: 'u-goncalo', text: 'Confissão: já queimei mais alho do que estou disposto a admitir. 🧄😅 #cozinha' },
  { author: 'u-beatriz', text: 'Novo sketch no caderno. Às vezes as melhores ideias chegam no café da manhã. ☕✏️ #arte', img: () => pic('nexo-live-' + uid(), 800, 800) },
  { author: 'u-rui', text: 'Update do Erasmus: hoje aprendi a dizer "obrigado" em esloveno. Hvala! 🇸🇮 #erasmus' },
  { author: 'u-sofia', text: 'A escrever sobre o futuro das redes sociais e a pensar: e se a próxima grande rede for... mais pequena? 🤔 #tech' },
  { author: 'u-pedro', text: 'Aquele momento em que a música finalmente encaixa toda. Arrepios. 🎶 #musica' },
  { author: 'u-tiago', text: 'PSA: façam backups. Não perguntem porquê. 🥲' },
  { author: 'u-mariana', text: 'Golden hour é a prova de que o universo gosta de fotógrafos. 🌅 #fotografia', img: () => pic('nexo-live-' + uid(), 900, 600) },
  { author: 'u-ines', text: 'Receita pós-treino: banana, aveia, manteiga de amendoim. Simples e funciona. 🍌' },
  { author: 'u-sofia', text: 'Li 3 artigos sobre IA hoje. Conclusão: ninguém sabe nada e está tudo entusiasmado. Adoro esta área. 🤖 #tech' },
];

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
      if (i === 1 && Math.random() < 0.4 && !post.reposts.includes(fanId)) {
        post.reposts.push(fanId);
        state.posts.push({ id: uid(), author: fanId, repostOf: post.id, ts: Date.now() });
        notify('repost', fanId, { postId });
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

/** Resposta de DM consciente do contexto. */
function smartReply(text) {
  const t = text.toLowerCase();
  if (/(^|\s)(olá|ola|oi|hey|bom dia|boa tarde|boa noite)/.test(t))
    return pickRandom(['Olá! Tudo bem por aí? 😄', 'Hey! Que bom ver-te por aqui 👋', 'Olá olá! Como vai isso?']);
  if (/(^|\s)obrigad/.test(t))
    return pickRandom(['De nada! 😊', 'Sempre às ordens!', 'Quando precisares!']);
  if (t.includes('?'))
    return pickRandom(['Boa pergunta! Deixa-me pensar… acho que sim!', 'Hmm, diria que depende. Mas inclino-me para o sim 😄', 'Sinceramente? Acho que sim. Tu o que achas?']);
  if (/(^|\s)(foto|fotografia|imagem|publica)/.test(t))
    return pickRandom(['Vi a tua última publicação, está top! 🔥', 'Adorei o que tens partilhado ultimamente!', 'Tens de publicar mais, a sério 👏']);
  if (/(^|\s)(adeus|xau|até logo|até já|fica bem)/.test(t))
    return pickRandom(['Até já! 👋', 'Fica bem! Falamos em breve 😊', 'Xau! Aparece mais vezes.']);
  return pickRandom([
    'Boa, conta-me mais!', 'Haha, exatamente!', 'Sim! Estava mesmo a pensar nisso.',
    'Que fixe! 👌', 'Combinado então!', 'A sério? Não sabia!',
    'Faz sentido. E tu, como estás?', 'Isso! 💯',
  ]);
}

function simulateDMReply(userId, userText) {
  const convo = state.conversations[userId];
  if (!convo) return;
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
    // a resposta marca as tuas mensagens como lidas (✓✓)
    convo.forEach(m => { if (m.from === state.me) m.seen = true; });
    convo.push({ from: userId, text: smartReply(userText), ts: Date.now(), read: currentChat === userId });
    if (currentChat !== userId) notify('message', userId);
    save();
    updateBadges();
    if (location.hash.startsWith('#/messages')) renderMessages(currentChat);
  }, 3200 + Math.random() * 3000);
}

/* ---------- Feed ao vivo ---------- */
let liveSpawned = 0;

function spawnDemoPost() {
  if (!state.me || liveSpawned >= 12) return;
  const tpl = pickRandom(LIVE_POOL);
  const post = {
    id: uid(), author: tpl.author, text: tpl.text,
    imgs: tpl.img ? [tpl.img()] : [],
    ts: Date.now(), likes: [], comments: [], reposts: [], isDemo: true,
  };
  state.posts.push(post);
  liveSpawned++;
  save();

  const onFeed = (location.hash || '#/feed').startsWith('#/feed');
  if (onFeed && window.scrollY < 80 && !isTyping()) {
    route();
  } else if (onFeed) {
    $('#newPostsPill')?.classList.remove('hidden');
  }
}

function spawnDemoStory() {
  if (!state.me) return;
  const authors = ['u-mariana', 'u-ines', 'u-rui', 'u-beatriz', 'u-sofia'];
  const captions = ['Agora mesmo 📍', 'Dia destes…', 'Não podia não partilhar', 'Momento do dia ✨', 'Olhem isto!'];
  state.stories.push({
    id: uid(), author: pickRandom(authors), ts: Date.now(),
    img: pic('nexo-story-' + uid(), 600, 1066),
    caption: pickRandom(captions), viewed: false,
  });
  save();
  if ((location.hash || '#/feed').startsWith('#/feed') && !isTyping() && window.scrollY < 80) route();
}

function startLiveLoop() {
  setInterval(() => { if (!document.hidden && Math.random() < .75) spawnDemoPost(); }, 55_000 + Math.random() * 20_000);
  setInterval(() => { if (!document.hidden && Math.random() < .5) spawnDemoStory(); }, 150_000);
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

  if (page !== 'feed') $('#newPostsPill')?.classList.add('hidden');
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
function nameHTML(u) {
  return `${escapeHTML(u.name)}${u.verified ? VBADGE : ''}`;
}

function followBtn(u) {
  if (u.id === state.me) return '';
  const isFollowing = me().following.includes(u.id);
  return `<button class="btn-follow ${isFollowing ? 'following' : ''}" data-follow="${u.id}">
    ${isFollowing ? 'A seguir' : 'Seguir'}</button>`;
}

function userRow(u) {
  return `
  <div class="rb-user">
    <a href="#/profile/${u.id}"><img class="avatar" src="${u.avatar}" alt="" /></a>
    <div class="rb-user-info">
      <a class="rb-user-name" href="#/profile/${u.id}">${nameHTML(u)}</a>
      <div class="rb-user-handle">@${escapeHTML(u.handle)}</div>
    </div>
    ${followBtn(u)}
  </div>`;
}

function mediaGrid(post) {
  const imgs = post.imgs || [];
  if (!imgs.length) return '';
  const n = Math.min(imgs.length, 4);
  return `
  <div class="post-media n${n}" data-media="${post.id}">
    ${imgs.slice(0, 4).map((src, i) =>
      `<img src="${src}" alt="" loading="lazy" data-lightbox="${post.id}" data-idx="${i}" onerror="imgFallback(this,'${post.id}${i}')" />`
    ).join('')}
  </div>`;
}

function postCard(entry, { withComments = false } = {}) {
  // entrada de repost: cabeçalho + cartão original
  if (entry.repostOf) {
    const original = getPost(entry.repostOf);
    if (!original) return '';
    const reposter = getUser(entry.author);
    if (!reposter) return '';
    return `
    <div class="card post" data-entry="${entry.id}">
      <div class="repost-label">
        <svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
        <a href="#/profile/${reposter.id}">${escapeHTML(reposter.name)} repartilhou</a>
      </div>
      ${postInner(original, withComments)}
    </div>`;
  }
  return `<article class="card post" data-entry="${entry.id}">${postInner(entry, withComments)}</article>`;
}

function postInner(post, withComments) {
  const author = getUser(post.author);
  if (!author) return '';
  const liked = post.likes.includes(state.me);
  const reposted = post.reposts.includes(state.me);
  const saved = state.saved.includes(post.id);
  const isMine = post.author === state.me;

  const visibleComments = withComments ? post.comments : post.comments.slice(-2);
  const hiddenCount = post.comments.length - visibleComments.length;

  return `
    <div class="post-head">
      <a href="#/profile/${author.id}"><img class="avatar" src="${author.avatar}" alt="${escapeHTML(author.name)}" /></a>
      <div class="post-head-info">
        <div><a class="post-author" href="#/profile/${author.id}">${nameHTML(author)}</a></div>
        <div class="post-meta">@${escapeHTML(author.handle)} · <a href="#/post/${post.id}">${timeAgo(post.ts)}</a></div>
      </div>
      ${isMine ? `<button class="post-menu-btn" data-delete="${post.id}" title="Apagar publicação">🗑️</button>` : ''}
    </div>
    <div class="post-body">${richText(post.text)}</div>
    ${mediaGrid(post)}
    <div class="post-actions">
      <button class="post-action ${liked ? 'liked' : ''}" data-like="${post.id}" title="Gosto">
        <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.4 4.7 6 4.2c2.1-.3 4.1.7 6 3 1.9-2.3 3.9-3.3 6-3 3.6.5 5.4 4.4 4 7.5C19.5 16.3 12 21 12 21Z"/></svg>
        <span>${post.likes.length || ''}</span>
      </button>
      <button class="post-action" data-comment-focus="${post.id}" title="Comentar">
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.7-.8L3 21l1.9-5.3a8.4 8.4 0 1 1 16.1-4.2Z"/></svg>
        <span>${post.comments.length || ''}</span>
      </button>
      <button class="post-action ${reposted ? 'reposted' : ''}" data-repost="${post.id}" title="Repartilhar">
        <svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
        <span>${post.reposts.length || ''}</span>
      </button>
      <button class="post-action" data-share="${post.id}" title="Partilhar" style="margin-left:auto">
        <svg viewBox="0 0 24 24"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>
      </button>
      <button class="post-action ${saved ? 'saved-on' : ''}" data-save="${post.id}" title="Guardar">
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
            <span class="comment-author">${nameHTML(cu)}</span>
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
    </div>`;
}

/* ---------- Barra de stories ---------- */
function storiesBarHTML() {
  const m = me();
  const groups = {};
  state.stories
    .filter(st => Date.now() - st.ts < DAY)
    .sort((a, b) => a.ts - b.ts)
    .forEach(st => { (groups[st.author] ||= []).push(st); });

  const myStories = groups[state.me] || [];
  delete groups[state.me];

  const order = Object.keys(groups).sort((a, b) => {
    const aSeen = groups[a].every(s => s.viewed), bSeen = groups[b].every(s => s.viewed);
    if (aSeen !== bSeen) return aSeen ? 1 : -1;
    return groups[b].at(-1).ts - groups[a].at(-1).ts;
  });

  return `
  <div class="card stories-bar">
    <div class="story-tile" data-story-action="${myStories.length ? 'view-mine' : 'create'}">
      ${myStories.length
        ? `<div class="story-ring"><img src="${m.avatar}" alt="" /></div>`
        : `<div class="story-add-ring"><img src="${m.avatar}" alt="" /></div>`}
      <span class="story-name">O teu story</span>
    </div>
    ${order.map(authorId => {
      const u = getUser(authorId);
      if (!u) return '';
      const seen = groups[authorId].every(s => s.viewed);
      return `
      <div class="story-tile" data-story-user="${authorId}">
        <div class="story-ring ${seen ? 'seen' : ''}"><img src="${u.avatar}" alt="" /></div>
        <span class="story-name">${escapeHTML(u.name.split(' ')[0])}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function emptyState(icon, title, sub) {
  return `<div class="card empty"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

/* ------------------------------------------------------------
   PÁGINAS
   ------------------------------------------------------------ */
function renderFeed() {
  const m = me();
  const visible = state.posts
    .filter(p => {
      const authorOk = p.author === state.me || m.following.includes(p.author) || getUser(p.author)?.isDemo;
      return authorOk && (!p.repostOf || getPost(p.repostOf));
    })
    .sort((a, b) => b.ts - a.ts);

  $('#main').innerHTML = `
    ${storiesBarHTML()}
    <div class="card inline-composer" id="inlineComposer">
      <img class="avatar" src="${m.avatar}" alt="" />
      <div class="fake-input">O que se passa, ${escapeHTML(m.name.split(' ')[0])}?</div>
    </div>
    <div class="feed">
      ${visible.length ? visible.map(p => postCard(p)).join('') :
        emptyState('📝', 'Ainda não há publicações', 'Segue pessoas em Explorar ou cria a tua primeira publicação.')}
    </div>`;
  $('#inlineComposer')?.addEventListener('click', openComposer);
  $('#newPostsPill')?.classList.add('hidden');
}

function renderExplore(query = '') {
  const q = query.trim().toLowerCase();
  const users = state.users.filter(u => u.id !== state.me &&
    (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)));
  const mediaPosts = state.posts.filter(p => !p.repostOf && p.imgs?.length && (!q || p.text.toLowerCase().includes(q)))
    .sort((a, b) => b.likes.length - a.likes.length);
  const textPosts = q ? state.posts.filter(p => !p.repostOf && p.text.toLowerCase().includes(q)).sort((a, b) => b.ts - a.ts) : [];

  $('#main').innerHTML = `
    <div class="page-head"><h2>Explorar</h2></div>
    <div class="explore-search">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" id="exploreInput" placeholder="Pesquisar pessoas, publicações, #hashtags…" value="${escapeHTML(query)}" />
    </div>
    ${users.length ? `<div class="section-label">Pessoas</div>
      <div class="card" style="padding:8px 18px">
        ${users.map(u => userRow(u)).join('')}
      </div>` : ''}
    ${q && textPosts.length ? `<div class="section-label">Publicações</div>
      <div class="feed">${textPosts.map(p => postCard(p)).join('')}</div>` : ''}
    ${!q ? `<div class="section-label">Em destaque</div>
      <div class="explore-grid">
        ${mediaPosts.map(p => `
        <a class="explore-tile" href="#/post/${p.id}">
          <img src="${p.imgs[0]}" alt="" loading="lazy" onerror="imgFallback(this,'${p.id}')" />
          <span class="tile-stats">❤️ ${p.likes.length} · 💬 ${p.comments.length}</span>
        </a>`).join('')}
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
  const posts = state.posts.filter(p => !p.repostOf && p.text.toLowerCase().includes('#' + tag.toLowerCase()))
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
  const ICONS = { like: '❤️', comment: '💬', follow: '👤', message: '✉️', repost: '🔁' };
  const LABEL = {
    like: 'gostou da tua publicação',
    comment: 'comentou a tua publicação',
    follow: 'começou a seguir-te',
    message: 'enviou-te uma mensagem',
    repost: 'repartilhou a tua publicação',
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
            <div><b>${nameHTML(u)}</b> ${LABEL[n.type]}.</div>
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

  msgs.forEach(msg => { if (msg.from !== state.me) msg.read = true; });
  save();

  // bolhas com separadores de dia
  let lastDay = '';
  const bubbles = msgs.map(msg => {
    const day = dayLabel(msg.ts);
    const sep = day !== lastDay ? `<div class="day-sep">${day}</div>` : '';
    lastDay = day;
    const mine = msg.from === state.me;
    return `${sep}
      <div class="bubble ${mine ? 'out' : 'in'}">
        ${escapeHTML(msg.text)}
        <span class="bubble-meta">${timeHM(msg.ts)}${mine ? `<span class="bubble-ticks ${msg.seen ? 'read' : ''}">${msg.seen ? '✓✓' : '✓'}</span>` : ''}</span>
      </div>`;
  }).join('');

  $('#main').innerHTML = `
    <div class="page-head"><h2>Mensagens</h2></div>
    <div class="card messages-layout">
      <div class="convo-list ${active ? 'chat-open' : ''}">
        ${convos.map(({ u, msgs }) => {
          const last = msgs.at(-1);
          const unread = msgs.filter(m => m.from !== state.me && !m.read).length;
          return `
          <button class="convo-item ${active?.id === u.id ? 'active' : ''}" data-chat="${u.id}">
            <span class="convo-avatar-wrap"><img class="avatar" src="${u.avatar}" alt="" /><span class="online-dot"></span></span>
            <div class="convo-info">
              <div class="convo-name">${nameHTML(u)}</div>
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
              <div class="chat-head-name">${nameHTML(active)}</div>
              <div class="chat-head-status">● online</div>
            </div>
          </div>
          <div class="chat-body" id="chatBody">
            ${msgs.length ? bubbles :
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
    (state.conversations[active.id] ||= []).push({ from: state.me, text, ts: Date.now(), read: true, seen: false });
    save();
    renderMessages(active.id);
    simulateDMReply(active.id, text);
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
  const authored = state.posts.filter(p => p.author === u.id).sort((a, b) => b.ts - a.ts);
  const ownPosts = authored.filter(p => !p.repostOf);
  const likedPosts = state.posts.filter(p => !p.repostOf && p.likes.includes(u.id)).sort((a, b) => b.ts - a.ts);
  const mediaPosts = ownPosts.filter(p => p.imgs?.length);

  let content = '';
  if (tab === 'media') {
    content = mediaPosts.length ? `
      <div class="media-grid">
        ${mediaPosts.map(p => `
        <a href="#/post/${p.id}">
          <img src="${p.imgs[0]}" alt="" loading="lazy" onerror="imgFallback(this,'${p.id}')" />
          ${p.imgs.length > 1 ? '<span class="multi-dot">⧉</span>' : ''}
        </a>`).join('')}
      </div>` :
      emptyState('🖼️', 'Sem multimédia', 'As publicações com fotografias aparecem aqui.');
  } else {
    const shown = tab === 'likes' ? likedPosts : authored;
    content = `<div class="feed">${shown.length ? shown.map(p => postCard(p)).join('') :
      emptyState('📭', tab === 'likes' ? 'Sem gostos' : 'Sem publicações',
        tab === 'likes' ? 'As publicações gostadas aparecem aqui.' : 'Ainda não há nada para mostrar.')}</div>`;
  }

  const coverStyle = u.cover
    ? `background-image:url('${u.cover}')`
    : `background:linear-gradient(135deg,hsl(${u.hue},70%,55%),hsl(${(u.hue + 60) % 360},70%,45%))`;

  $('#main').innerHTML = `
    <div class="page-head">
      <button class="back-btn" onclick="history.back()">←</button>
      <div><h2>${escapeHTML(u.name)}</h2><div class="page-sub">${ownPosts.length} publicações</div></div>
    </div>
    <div class="card profile-card">
      <div class="profile-cover" style="${coverStyle}"></div>
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
        <div class="profile-name">${nameHTML(u)}</div>
        <div class="profile-handle">@${escapeHTML(u.handle)}</div>
        ${u.bio ? `<div class="profile-bio">${richText(u.bio)}</div>` : ''}
        <div class="profile-stats">
          <span><b>${ownPosts.length}</b> publicações</span>
          <button data-list="followers" data-user="${u.id}"><b>${u.followers.length}</b> seguidores</button>
          <button data-list="following" data-user="${u.id}"><b>${u.following.length}</b> a seguir</button>
        </div>
        <div class="profile-tabs">
          <button class="profile-tab ${tab === 'posts' ? 'active' : ''}" data-tab="posts">Publicações</button>
          <button class="profile-tab ${tab === 'media' ? 'active' : ''}" data-tab="media">Multimédia</button>
          <button class="profile-tab ${tab === 'likes' ? 'active' : ''}" data-tab="likes">Gostos</button>
        </div>
      </div>
    </div>
    ${content}`;

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
  if (!post || post.repostOf) { location.hash = '#/feed'; return; }
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

  const tagCount = {};
  state.posts.forEach(p => {
    if (p.repostOf) return;
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
    ${trends.length ? `
    <div class="card rb-card">
      <h4>Em alta para ti</h4>
      ${trends.map(([tag, score], i) => `
        <a class="rb-trend" href="#/tag/${encodeURIComponent(tag)}">
          <div class="rb-trend-label">${i + 1} · Tendência</div>
          <div class="rb-trend-tag">#${escapeHTML(tag)}</div>
          <div class="rb-trend-count">${score} interações</div>
        </a>`).join('')}
    </div>` : ''}
    ${suggestions.length ? `
    <div class="card rb-card">
      <h4>Sugestões para ti</h4>
      ${suggestions.map(u => userRow(u)).join('')}
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

/* ------------------------------------------------------------
   AÇÕES GLOBAIS
   ------------------------------------------------------------ */
function applyLike(postId, btn, forceLike = false) {
  const post = getPost(postId);
  if (!post) return;
  const i = post.likes.indexOf(state.me);
  if (i === -1) {
    post.likes.push(state.me);
  } else if (!forceLike) {
    post.likes.splice(i, 1);
  }
  // atualizar todos os botões deste post no DOM (feed pode ter repost duplicado)
  $$(`[data-like="${postId}"]`).forEach(b => {
    b.classList.toggle('liked', post.likes.includes(state.me));
    if (b === btn) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    b.querySelector('span').textContent = post.likes.length || '';
  });
  save();
}

document.addEventListener('click', e => {
  const likeBtn = e.target.closest('[data-like]');
  if (likeBtn) { applyLike(likeBtn.dataset.like, likeBtn); return; }

  const repostBtn = e.target.closest('[data-repost]');
  if (repostBtn) {
    const post = getPost(repostBtn.dataset.repost);
    if (!post) return;
    const i = post.reposts.indexOf(state.me);
    if (i === -1) {
      post.reposts.push(state.me);
      state.posts.push({ id: uid(), author: state.me, repostOf: post.id, ts: Date.now() });
      toast('Repartilhado 🔁');
    } else {
      post.reposts.splice(i, 1);
      state.posts = state.posts.filter(p => !(p.repostOf === post.id && p.author === state.me));
      toast('Repartilha removida');
    }
    $$(`[data-repost="${post.id}"]`).forEach(b => {
      b.classList.toggle('reposted', post.reposts.includes(state.me));
      b.querySelector('span').textContent = post.reposts.length || '';
    });
    save();
    return;
  }

  const shareBtn = e.target.closest('[data-share]');
  if (shareBtn) {
    const url = location.origin + location.pathname + '#/post/' + shareBtn.dataset.share;
    if (navigator.share) {
      navigator.share({ title: 'Nexo', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url)
        .then(() => toast('Ligação copiada 🔗'))
        .catch(() => toast(url));
    }
    return;
  }

  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) {
    const id = saveBtn.dataset.save;
    const i = state.saved.indexOf(id);
    if (i === -1) { state.saved.push(id); toast('Publicação guardada 🔖'); }
    else { state.saved.splice(i, 1); toast('Removida dos guardados'); }
    $$(`[data-save="${id}"]`).forEach(b => b.classList.toggle('saved-on', i === -1));
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
    if (!$('#listModal').classList.contains('hidden')) {
      // atualizar botão dentro do modal sem o fechar
      followEl.outerHTML = followBtn(target);
    } else {
      route();
    }
    return;
  }

  const listBtn = e.target.closest('[data-list]');
  if (listBtn) {
    openUserList(listBtn.dataset.list, listBtn.dataset.user);
    return;
  }

  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    if (confirm('Apagar esta publicação? Esta ação não pode ser anulada.')) {
      const id = delBtn.dataset.delete;
      state.posts = state.posts.filter(p => p.id !== id && p.repostOf !== id);
      state.saved = state.saved.filter(s => s !== id);
      save();
      toast('Publicação apagada');
      route();
    }
    return;
  }

  const focusBtn = e.target.closest('[data-comment-focus]');
  if (focusBtn) {
    focusBtn.closest('.post')?.querySelector('.comment-form input')?.focus();
    return;
  }

  const tagEl = e.target.closest('.hashtag');
  if (tagEl) { location.hash = `#/tag/${encodeURIComponent(tagEl.dataset.tag)}`; return; }

  const lightboxImg = e.target.closest('[data-lightbox]');
  if (lightboxImg) {
    openLightbox(lightboxImg.dataset.lightbox, +lightboxImg.dataset.idx);
    return;
  }

  // stories
  const storyTile = e.target.closest('[data-story-user]');
  if (storyTile) { openStoryViewer(storyTile.dataset.storyUser); return; }
  const storyAction = e.target.closest('[data-story-action]');
  if (storyAction) {
    if (storyAction.dataset.storyAction === 'create') openStoryComposer();
    else openStoryViewer(state.me);
    return;
  }

  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) { $('#' + closeBtn.dataset.close).classList.add('hidden'); return; }

  if (e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

/* ---------- Double-tap / duplo clique para gostar ---------- */
document.addEventListener('dblclick', e => {
  const img = e.target.closest('.post-media img');
  if (!img) return;
  e.preventDefault();
  const media = img.closest('.post-media');
  const postId = media.dataset.media;
  applyLike(postId, null, true);
  const heart = document.createElement('div');
  heart.className = 'heart-burst';
  heart.textContent = '❤️';
  media.appendChild(heart);
  setTimeout(() => heart.remove(), 850);
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

/* ---------- Lista de seguidores / a seguir ---------- */
function openUserList(kind, userId) {
  const u = getUser(userId);
  if (!u) return;
  const ids = kind === 'followers' ? u.followers : u.following;
  $('#listModalTitle').textContent = kind === 'followers' ? 'Seguidores' : 'A seguir';
  $('#listModalBody').innerHTML = ids.length
    ? ids.map(id => getUser(id)).filter(Boolean).map(x => userRow(x)).join('')
    : `<div class="empty"><div class="empty-icon">👥</div><p>Ainda não há ninguém aqui.</p></div>`;
  $('#listModal').classList.remove('hidden');
}

/* ---------- Lightbox com navegação ---------- */
let lbImgs = [], lbIdx = 0;

function openLightbox(postId, idx = 0) {
  const post = getPost(postId);
  if (!post?.imgs?.length) return;
  lbImgs = post.imgs;
  lbIdx = idx;
  updateLightbox();
  $('#lightbox').classList.remove('hidden');
}

function updateLightbox() {
  $('#lightboxImg').src = lbImgs[lbIdx];
  $('#lightboxPrev').classList.toggle('hidden', lbImgs.length < 2);
  $('#lightboxNext').classList.toggle('hidden', lbImgs.length < 2);
}

function initLightbox() {
  $('#lightboxClose').addEventListener('click', () => $('#lightbox').classList.add('hidden'));
  $('#lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') $('#lightbox').classList.add('hidden');
  });
  $('#lightboxPrev').addEventListener('click', () => { lbIdx = (lbIdx - 1 + lbImgs.length) % lbImgs.length; updateLightbox(); });
  $('#lightboxNext').addEventListener('click', () => { lbIdx = (lbIdx + 1) % lbImgs.length; updateLightbox(); });
  document.addEventListener('keydown', e => {
    if ($('#lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape') $('#lightbox').classList.add('hidden');
    if (e.key === 'ArrowLeft') $('#lightboxPrev').click();
    if (e.key === 'ArrowRight') $('#lightboxNext').click();
  });
}

/* ------------------------------------------------------------
   COMPOSER DE PUBLICAÇÕES
   ------------------------------------------------------------ */
let composerImgs = [];
const EMOJIS = ['😀', '😂', '😍', '🥹', '😎', '🤔', '😭', '🥳', '❤️', '🔥', '👏', '🙌', '💪', '🙏', '✨', '🎉', '🚀', '🌍', '☕', '🍕'];
const MAX_CHARS = 500;
const RING_C = 81.7;

function openComposer() {
  composerImgs = [];
  $('#composerText').value = '';
  renderComposerPreviews();
  updateCharRing();
  $('#composerSubmit').disabled = true;
  $('#composerAvatar').src = me().avatar;
  $('#emojiBar').classList.remove('open');
  $('#composerModal').classList.remove('hidden');
  setTimeout(() => $('#composerText').focus(), 50);
}

function renderComposerPreviews() {
  $('#composerPreviews').innerHTML = composerImgs.map((src, i) => `
    <div class="composer-preview">
      <img src="${src}" alt="" />
      <button data-remove-img="${i}" type="button">✕</button>
    </div>`).join('');
  $$('#composerPreviews [data-remove-img]').forEach(b =>
    b.addEventListener('click', () => {
      composerImgs.splice(+b.dataset.removeImg, 1);
      renderComposerPreviews();
      syncComposerState();
    }));
}

function updateCharRing() {
  const len = $('#composerText').value.length;
  const frac = Math.min(1, len / MAX_CHARS);
  const fg = $('#charRingFg');
  fg.style.strokeDashoffset = RING_C * (1 - frac);
  fg.classList.toggle('warn', len > MAX_CHARS * .85);
  fg.classList.toggle('over', len >= MAX_CHARS);
}

function syncComposerState() {
  $('#composerSubmit').disabled = !$('#composerText').value.trim() && !composerImgs.length;
}

function initComposer() {
  $('#openComposer').addEventListener('click', openComposer);
  $('#openComposerMobile').addEventListener('click', openComposer);

  const textEl = $('#composerText');
  textEl.addEventListener('input', () => { updateCharRing(); syncComposerState(); });

  $('#composerFile').addEventListener('change', async e => {
    for (const file of [...e.target.files].slice(0, 4 - composerImgs.length)) {
      try { composerImgs.push(await fileToDataURL(file)); }
      catch { toast('Não foi possível carregar uma imagem.'); }
    }
    renderComposerPreviews();
    syncComposerState();
    e.target.value = '';
  });

  // emojis
  $('#emojiBar').innerHTML = EMOJIS.map(em => `<button type="button" data-emoji="${em}">${em}</button>`).join('');
  $('#emojiToggle').addEventListener('click', () => $('#emojiBar').classList.toggle('open'));
  $('#emojiBar').addEventListener('click', e => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    const el = $('#composerText');
    const pos = el.selectionStart ?? el.value.length;
    el.value = el.value.slice(0, pos) + b.dataset.emoji + el.value.slice(pos);
    el.focus();
    el.setSelectionRange(pos + b.dataset.emoji.length, pos + b.dataset.emoji.length);
    updateCharRing(); syncComposerState();
  });

  $('#composerSubmit').addEventListener('click', () => {
    const text = textEl.value.trim();
    if (!text && !composerImgs.length) return;
    const post = {
      id: uid(), author: state.me, text, imgs: [...composerImgs],
      ts: Date.now(), likes: [], comments: [], reposts: [],
    };
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
   STORIES — composer e visualizador
   ------------------------------------------------------------ */
const STORY_GRADIENTS = [
  'linear-gradient(135deg,#6c5ce7,#00cec9)',
  'linear-gradient(135deg,#f09433,#dc2743)',
  'linear-gradient(135deg,#11998e,#38ef7d)',
  'linear-gradient(135deg,#fc466b,#3f5efb)',
  'linear-gradient(135deg,#0f2027,#2c5364)',
];
let storyImg = null, storyGradient = STORY_GRADIENTS[0];

function openStoryComposer() {
  storyImg = null;
  storyGradient = STORY_GRADIENTS[0];
  $('#storyText').value = '';
  updateStoryCanvas();
  $('#storyGradients').innerHTML = STORY_GRADIENTS.map((g, i) =>
    `<button type="button" data-grad="${i}" style="background:${g}" class="${i === 0 ? 'active' : ''}"></button>`).join('');
  $('#storyComposerModal').classList.remove('hidden');
}

function updateStoryCanvas() {
  const canvas = $('#storyCanvas');
  if (storyImg) {
    canvas.style.background = `url('${storyImg}') center/cover`;
  } else {
    canvas.style.background = storyGradient;
  }
  $('#storyCanvasText').textContent = $('#storyText').value || (storyImg ? '' : 'O teu story');
}

function initStoryComposer() {
  $('#storyText').addEventListener('input', updateStoryCanvas);
  $('#storyGradients').addEventListener('click', e => {
    const b = e.target.closest('[data-grad]');
    if (!b) return;
    storyImg = null;
    storyGradient = STORY_GRADIENTS[+b.dataset.grad];
    $$('#storyGradients button').forEach(x => x.classList.toggle('active', x === b));
    updateStoryCanvas();
  });
  $('#storyFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { storyImg = await fileToDataURL(file, 900); updateStoryCanvas(); }
    catch { toast('Não foi possível carregar a imagem.'); }
    e.target.value = '';
  });
  $('#storySubmit').addEventListener('click', () => {
    const text = $('#storyText').value.trim();
    if (!storyImg && !text) { toast('Adiciona uma foto ou escreve algo.'); return; }
    state.stories.push({
      id: uid(), author: state.me, ts: Date.now(),
      img: storyImg, gradient: storyImg ? null : storyGradient,
      caption: storyImg ? text : null,
      text: storyImg ? null : text,
      viewed: true,
    });
    save();
    $('#storyComposerModal').classList.add('hidden');
    toast('Story partilhado ⚡');
    route();
  });
}

/* ---------- Visualizador ---------- */
let svStories = [], svIdx = 0, svTimer = null;
const STORY_DUR = 5000;

function openStoryViewer(authorId) {
  svStories = state.stories
    .filter(st => st.author === authorId && Date.now() - st.ts < DAY)
    .sort((a, b) => a.ts - b.ts);
  if (!svStories.length) { if (authorId === state.me) openStoryComposer(); return; }
  svIdx = Math.max(0, svStories.findIndex(st => !st.viewed));
  if (svIdx === -1) svIdx = 0;
  $('#storyViewer').classList.remove('hidden');
  showStory();
}

function showStory() {
  clearTimeout(svTimer);
  const st = svStories[svIdx];
  if (!st) { closeStoryViewer(); return; }
  st.viewed = true;
  save();

  const author = getUser(st.author);
  $('#storyProgress').innerHTML = svStories.map((_, i) =>
    `<i class="${i < svIdx ? 'done' : i === svIdx ? 'active' : ''}"></i>`).join('');
  $('#storyHead').innerHTML = `
    <img class="avatar avatar-sm" src="${author.avatar}" alt="" />
    <div><b>${escapeHTML(author.name)}</b> <span>${timeAgo(st.ts)}</span></div>`;
  $('#storyMedia').innerHTML = st.img
    ? `<img src="${st.img}" alt="" onerror="imgFallback(this,'${st.id}')" />`
    : `<div class="story-gradient-bg" style="background:${st.gradient}">${escapeHTML(st.text || '')}</div>`;
  $('#storyCaption').textContent = st.caption || '';

  svTimer = setTimeout(nextStory, STORY_DUR);
}

function nextStory() {
  if (svIdx < svStories.length - 1) { svIdx++; showStory(); }
  else closeStoryViewer();
}

function prevStory() {
  if (svIdx > 0) { svIdx--; showStory(); }
  else showStory();
}

function closeStoryViewer() {
  clearTimeout(svTimer);
  $('#storyViewer').classList.add('hidden');
  if ((location.hash || '#/feed').startsWith('#/feed')) route();
}

function initStoryViewer() {
  $('#storyNext').addEventListener('click', nextStory);
  $('#storyPrev').addEventListener('click', prevStory);
  $('#storyClose').addEventListener('click', closeStoryViewer);
  document.addEventListener('keydown', e => {
    if ($('#storyViewer').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeStoryViewer();
    if (e.key === 'ArrowRight') nextStory();
    if (e.key === 'ArrowLeft') prevStory();
  });
}

/* ------------------------------------------------------------
   EDITAR PERFIL
   ------------------------------------------------------------ */
let epAvatar = null, epCover = null;

function openEditProfile() {
  const m = me();
  epAvatar = null; epCover = null;
  $('#epName').value = m.name;
  $('#epBio').value = m.bio || '';
  $('#epAvatarPreview').src = m.avatar;
  const cov = $('#epCoverPreview');
  cov.style.background = m.cover
    ? `url('${m.cover}') center/cover`
    : `linear-gradient(135deg,hsl(${m.hue},70%,55%),hsl(${(m.hue + 60) % 360},70%,45%))`;
  $('#editProfileModal').classList.remove('hidden');
}

function initEditProfile() {
  $('#epAvatar').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try { epAvatar = await fileToDataURL(file, 400); $('#epAvatarPreview').src = epAvatar; }
    catch { toast('Não foi possível carregar a imagem.'); }
  });
  $('#epCover').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      epCover = await fileToDataURL(file, 1200);
      $('#epCoverPreview').style.background = `url('${epCover}') center/cover`;
    } catch { toast('Não foi possível carregar a imagem.'); }
  });
  $('#editProfileForm').addEventListener('submit', e => {
    e.preventDefault();
    const m = me();
    m.name = $('#epName').value.trim() || m.name;
    m.bio = $('#epBio').value.trim();
    if (epAvatar) m.avatar = epAvatar;
    if (epCover) m.cover = epCover;
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
  const mob = $('#themeToggleMobile');
  if (mob) mob.textContent = dark ? '☀️' : '🌙';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
}

/* ------------------------------------------------------------
   AUTENTICAÇÃO
   ------------------------------------------------------------ */
let authMode = 'signup';

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
      avatar: null, cover: null,
      followers: [], following: [],
      joinedAt: Date.now(),
    };
    user.avatar = makeAvatar(name, user.hue);
    state.users.push(user);

    state.users.filter(u => u.isDemo).slice(0, 3).forEach(u => {
      u.following.push(user.id);
      user.followers.push(u.id);
    });

    loginAs(user.id);
    toast(`Bem-vindo ao Nexo, ${name.split(' ')[0]}! 🎉`);

    setTimeout(() => { notify('follow', 'u-mariana'); notify('follow', 'u-tiago'); }, 3000);
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
  $('#mobileTopAvatar').innerHTML = `<img class="avatar avatar-sm" src="${m.avatar}" alt="Perfil" />`;
}

/* ------------------------------------------------------------
   ARRANQUE
   ------------------------------------------------------------ */
function init() {
  state = migrate(load() || seedState());

  applyTheme();
  initComposer();
  initStoryComposer();
  initStoryViewer();
  initEditProfile();
  initLightbox();
  initAuth();

  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#themeToggleMobile').addEventListener('click', toggleTheme);

  $('#newPostsPill').addEventListener('click', () => {
    $('#newPostsPill').classList.add('hidden');
    window.scrollTo({ top: 0 });
    route();
  });

  window.addEventListener('hashchange', route);

  if (state.me && getUser(state.me)) {
    loginAs(state.me);
  } else {
    authMode = state.users.some(u => !u.isDemo) ? 'login' : 'signup';
    renderAuthMode();
    $('#authScreen').classList.remove('hidden');
  }

  startLiveLoop();

  // atualizar tempos relativos periodicamente
  setInterval(() => {
    if (state.me && !document.hidden && !isTyping()) route();
  }, 120_000);

  // PWA
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  setTimeout(() => $('#splash').classList.add('off'), 350);
}

init();
