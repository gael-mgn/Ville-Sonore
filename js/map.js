const AUDIO_WORKER_BASE = "https://ville-sonore.gael-maignan.workers.dev/audio";

// Passe à true pendant le développement pour retrouver les logs verbeux dans la console.
// Les console.error / console.warn restent actifs quel que soit DEBUG (diagnostics utiles en prod).
const DEBUG = false;
function debug(...args){ if (DEBUG) console.log(...args); }

function audioViaWorker(driveUrl){
  if(!driveUrl) return driveUrl;
  return `${AUDIO_WORKER_BASE}?url=${encodeURIComponent(driveUrl)}`;
}

/* -------- Helpers de chargement pour boutons + loader mobile title -------- */
(function(){



  const audio = document.getElementById('globalAudio');

  // éviter préchargement automatique : on charge à la demande
  if(audio){ audio.preload = 'none';
  audio.removeAttribute('crossorigin');
}

  let activeLoadingButton = null; // bouton qui affiche actuellement le spinner

  function createLoaderElement(){
    const s = document.createElement('span');
    s.className = 'loader';
    s.setAttribute('aria-hidden','true');
    return s;
  }

  // petit loader pour le titre mobile
  function createSmallLoaderElement(){
    const s = document.createElement('span');
    s.className = 'mp-loader-small';
    s.setAttribute('aria-hidden','true');
    return s;
  }

  // affiche le loader à côté du titre mobile
  function showMobileTitleLoader(){
    const mpTitle = document.getElementById('mp-title');
    if(!mpTitle) return;
    // éviter doublons
    if(mpTitle._smallLoader) return;
    mpTitle.setAttribute('aria-busy','true');
    const small = createSmallLoaderElement();
    // stocker ref et ajouter
    mpTitle._smallLoader = small;
    mpTitle.appendChild(small);
  }

  // cache le loader du titre mobile
  function hideMobileTitleLoader(){
    const mpTitle = document.getElementById('mp-title');
    if(!mpTitle) return;
    mpTitle.removeAttribute('aria-busy');
    if(mpTitle._smallLoader && mpTitle.contains(mpTitle._smallLoader)){
      mpTitle.removeChild(mpTitle._smallLoader);
    }
    delete mpTitle._smallLoader;
  }

  window.showLoadingOnButton = function(btn){
    if(!btn) return;
    if(btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    btn.setAttribute('aria-busy','true');
    btn.classList.add('loading');
    // inject loader
    const loader = createLoaderElement();
    btn.appendChild(loader);
    // store ref (pratique pour retirer proprement)
    btn._loader = loader;
    activeLoadingButton = btn;

    // afficher aussi le loader à côté du titre mobile
    showMobileTitleLoader();
  };

  window.hideLoadingOnButton = function(btn){
    if(!btn) return;
    if(btn.dataset.loading !== '1') return;
    btn.removeAttribute('aria-busy');
    btn.classList.remove('loading');
    btn.dataset.loading = '0';
    if(btn._loader && btn.contains(btn._loader)){
      btn.removeChild(btn._loader);
    }
    delete btn._loader;
    if(activeLoadingButton === btn) activeLoadingButton = null;

    // cacher loader mobile
    hideMobileTitleLoader();
  };

  // Si on change de source ou qu'une autre lecture démarre => masquer l'ancien loader
  function clearActiveLoader(){
    if(activeLoadingButton) hideLoadingOnButton(activeLoadingButton);
    else hideMobileTitleLoader(); // si pas de bouton actif, s'assurer de retirer loader mobile
  }

  // Événements audio : quand l'audio commence réellement à jouer, on enlève le loader
  if(audio){
    audio.addEventListener('playing', ()=> {
      clearActiveLoader();
      // s'assurer que le preload redevienne 'auto' pour lecture fluide si besoin
      audio.preload = 'auto';
    });

    // erreurs -> cacher loader et informer
    audio.addEventListener('error', (e)=>{
      if(activeLoadingButton){
        hideLoadingOnButton(activeLoadingButton);
      } else {
        hideMobileTitleLoader();
      }
      console.warn('Erreur de lecture audio', e);
      // tu peux afficher un toast ou message UI ici si tu veux
    });

    // cas où le navigateur met en attente ou ne peut pas jouer : retirer loader
    audio.addEventListener('stalled', clearActiveLoader);
    audio.addEventListener('abort', clearActiveLoader);
    audio.addEventListener('ended', clearActiveLoader);
  }

  /* Fonction centrale : lance une URL et affiche spinner sur le bouton */
  window.playUrlWithSpinner = async function(btn, url){
    if(!audio) return;
    try {
      // si un autre bouton a un loader, on le nettoie — mais on ne stoppe l'audio automatiquement
      if(activeLoadingButton && activeLoadingButton !== btn) hideLoadingOnButton(activeLoadingButton);

      // afficher loader (si btn falsy on utilisera showLoadingOnButton sur le bouton mobile via playClip/startPlayback)
      if(btn) showLoadingOnButton(btn);
      else showMobileTitleLoader();

      // préparer la source
      // (mettre preload=auto pour encourager le buffering si c'était none)
      audio.preload = 'auto';

      // si la même source est déjà chargée et en pause -> reprendre sans réafficher le loader inutilement
      const sameSrc = audio.src && audio.src === url;
      if(!sameSrc){
        // interrompt la lecture courante (si besoin)
        try { audio.pause(); } catch(e){/* noop */ }
        audio.src = url;
        // forcer reload en cas de cache problématique : audio.load();
        try { audio.load(); } catch(e){/* certains navigateurs gèrent différemment */ }
      }

      // essayer de jouer — peut renvoyer une promesse rejetée si autobloqué par le navigateur
      const p = audio.play();
      if(p && typeof p.then === 'function'){
        p.then(()=> {
          // la promesse peut se résoudre avant l'event 'playing' ; on laisse 'playing' supprimer le loader
        }).catch(err=>{
          // autoplay bloqué -> on enlève le loader et basculera côté utilisateur pour cliquer play
          console.warn('play() rejeté : interaction requise', err);
          if(btn) hideLoadingOnButton(btn);
          else hideMobileTitleLoader();
          // optionnel : change text to 'Play' on mobile player, etc.
        });
      }
    } catch(err){
      console.error('Erreur dans playUrlWithSpinner', err);
      if(btn) hideLoadingOnButton(btn);
      else hideMobileTitleLoader();
    }
  };

})();

/* -------- Start playback (met à jour le mobile player puis utilise playUrlWithSpinner) -------- */
window.startPlayback = function(url, opts = {}, btn = null){
  // opts possible: { title: string, meta: string }
  // éléments UI
  const mpTitle = document.getElementById('mp-title');
  const mpMeta = document.getElementById('mp-meta');
  const mobilePlayer = document.getElementById('mobilePlayer');
  const mpPlayBtn = document.getElementById('mp-play');

  // tenter de retrouver un clip dans la liste (clips est global dans ton script)
  try {
    const found = (window.clips || []).find(c => {
      try { return normalizedLink(c.lien) === url; } catch(e){ return false; }
    });
    if(found){
      opts.title = opts.title || found.titre || 'Lecture';
      const duree = (found.duree || 0);
      opts.meta = opts.meta || `${found.date || ''} ${found.heure ? '• ' + found.heure : ''} • ${duree ? Math.round(duree*10)/10 + 's' : ''}`.trim();
    }
  } catch(e){
    // ignore
  }

  // mettre à jour l'UI mobile player
  if(mpTitle) mpTitle.textContent = opts.title || 'Lecture en cours';
  if(mpMeta) mpMeta.textContent = opts.meta || '';
  if(mobilePlayer) mobilePlayer.style.display = '';
  if(mpPlayBtn) mpPlayBtn.textContent = 'Pause';

  // déléguer la lecture (affiche spinner sur btn ou sur mpPlayBtn si btn absent)
  if(typeof playUrlWithSpinner === 'function'){
    playUrlWithSpinner(btn || mpPlayBtn, url);
  } else {
    // fallback : jouer directement si helper absent (rare)
    const a = document.getElementById('globalAudio');
    if(a){
      a.src = url;
      a.play().catch(()=>{});
    }
  }
};

    // Fonction pour générer le HTML
    function generateTags(collections) {
        const tagSection = document.getElementById('tag-section');
        
        collections.forEach(item => {
            const tag = document.createElement('div');
            tag.classList.add('tag');
            tag.id = item.id;

            tag.style.backgroundImage = `url('${item.image}')`;

            const overlay = document.createElement('div');
            overlay.classList.add('absolute', 'inset-0', 'hero-overlay');
            tag.appendChild(overlay);

            const tagContent = document.createElement('div');
            tagContent.classList.add('tag-content');

            const title = document.createElement('h2');
            title.classList.add('tag-title');
            title.textContent = item.titre;
            tagContent.appendChild(title);

            const description = document.createElement('p');
            description.classList.add('tag-description');
            description.textContent = item.description || 'Description non disponible.';
            tagContent.appendChild(description);

            const link = document.createElement('a');
            link.href = item.lien;
            link.textContent = 'En savoir plus';
            tagContent.appendChild(link);

            tag.appendChild(tagContent);
            tagSection.appendChild(tag);
        });
    }

    // Appel de la fonction pour générer les tags
    //generateTags(collections);





const enableClustering = false; 
// URL de ton Worker — attention au double https:// (corrigé)
const sheetUrl = "https://ville-sonore.gael-maignan.workers.dev/";
// 

let clips = [];

const CLIPS_CACHE_KEY = 'ville-sonore:clips-cache-v1';
const CLIPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLIPS_FETCH_TIMEOUT_MS = 8000; // au-delà, on ne fait plus attendre l'utilisateur sur mobile

function readClipsCache(){
  try {
    const raw = localStorage.getItem(CLIPS_CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!ts || (Date.now() - ts) > CLIPS_CACHE_TTL_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch(e){ return null; }
}

function writeClipsCache(data){
  try {
    localStorage.setItem(CLIPS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch(e){ /* quota dépassé ou storage indisponible (navigation privée) : on ignore */ }
}

async function loadClips(tag = "") {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIPS_FETCH_TIMEOUT_MS);
  try {
    debug('fetching sheetUrl →', sheetUrl);
    const res = await fetch(sheetUrl, { signal: controller.signal });
    debug('sheet fetch status:', res.status, res.statusText);

    if (!res.ok) {
      const body = await res.text().catch(()=>'<no body>');
      console.error('Erreur fetch sheet:', res.status, body.slice(0,800));
      clips = readClipsCache() || [];
      return;
    }

    const txt = await res.text();
    const start = (txt || '').trim().slice(0,80).toLowerCase();

    // Si la réponse semble être du HTML -> abort
    if (start.startsWith('<') || start.includes('<!doctype') || start.includes('<html')) {
      console.error('La réponse reçue semble être du HTML (erreur d\'hôte ou d\'authent). Contenu:', txt.slice(0,800));
      clips = [];
      return;
    }

    let rows = [];
    // --- Cas 1 : gviz JS wrapper "google.visualization.Query.setResponse({...});" ---
    if (txt.includes('google.visualization') || txt.match(/setResponse\s*\(/)) {
      // retirer le wrapper JS et récupérer l'objet JSON
      const jsonText = txt.replace(/^[^\(]*\(|\);?$/g, '');
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch(parseErr) {
        console.error('Erreur parse JSON gviz:', parseErr, jsonText.slice(0,400));
        clips = [];
        return;
      }
      rows = (parsed.table && parsed.table.rows) ? parsed.table.rows : [];
    }
    // --- Cas 2 : JSON brut (ex: worker qui renvoie JSON) ---
    else if (txt.trim().startsWith('{') || txt.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(txt);
        // si structure gviz
        if (parsed.table && parsed.table.rows) {
          rows = parsed.table.rows;
        } else if (Array.isArray(parsed)) {
          // tableau simple de lignes (assume valeur déjà bien formée)
          rows = parsed.map(r => ({ c: r }));
        } else if (parsed.values) {
          // Sheets API style values: array of arrays
          rows = (parsed.values || []).map(r => ({ c: r.map(v => ({ v })) }));
        } else {
          console.warn('JSON reçu non attendu, inspecte parsed:', parsed);
          rows = [];
        }
      } catch(err) {
        console.error('Erreur parse JSON brut:', err);
        clips = [];
        return;
      }
    }
    // --- Cas 3 : TSV brut ---
    else if (txt.includes('\t')) {
      const lines = txt.trim().split('\n').filter(l=>l.trim()!=='');
      // skip header éventuellement
      if (lines.length > 0 && /^lat/i.test(lines[0].split('\t')[0])) lines.shift();
      rows = lines.map(line => {
        const cols = line.split('\t');
        return { c: cols.map(v => ({ v })) };
      });
    } else {
      console.warn('Format de réponse non reconnu. Début:', txt.slice(0,200));
      clips = [];
      return;
    }

    // mapping rows -> clips (on suppose l'ordre des colonnes: lat, lon, date, heure, duree, titre, description, lien, categories)
    clips = rows.map(r => {
      const c = r.c || [];
      const get = i => {
        const cell = c[i];
        if (!cell) return '';
        // dans certains cas cell.v existe, dans d'autres cell peut être une primitive (si on a transformé)
        return (cell.v !== undefined && cell.v !== null) ? String(cell.v) : (typeof cell === 'string' ? cell : '');
      };
      const latStr = get(0);
      const lonStr = get(1);
      const date = get(2);
      const heure = get(3);
      const dureeStr = get(4);
      const titre = get(5);
      const description = get(6);
      const lien = get(7);
      const categories = get(8);

      return {
        lat: latStr ? parseFloat(String(latStr).replace(',', '.')) : NaN,
        lon: lonStr ? parseFloat(String(lonStr).replace(',', '.')) : NaN,
        date: (date || '').trim(),
        heure: (heure || '').trim(),
        duree: parseFloat(dureeStr) || 0,
        titre: (titre || '').trim(),
        description: (description || '').trim(),
        lien: (lien || '').trim(),
        categories: (categories || '').trim() ? stringToArray(categories.trim()) : []
      };
    });

    // filtrage par tag (si applicable)
    if (typeof tag === 'string' && tag.length > 0 && tag !== 'all') {
      clips = clips.filter(c => c.categories.some(cat => cat.toLowerCase() === tag));
    }

    debug('Clips chargés:', clips.length);
    writeClipsCache(clips);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`Chargement des données interrompu après ${CLIPS_FETCH_TIMEOUT_MS}ms (réseau lent) — tentative de repli sur le cache local.`);
    } else {
      console.error('Erreur loadClips:', err);
    }
    // Réseau capricieux (fréquent sur mobile) : mieux vaut afficher des données un peu
    // périmées que rien du tout.
    clips = readClipsCache() || [];
  } finally {
    clearTimeout(timeoutId);
  }
}




// Fonction principale qui attend le chargement
async function map(tag = "") {

  await loadClips(tag);
  document.getElementById("latestClips-skeletons").classList.add("hidden");
  document.getElementById("latestClips").classList.remove("hidden");
  function afficherDerniersAudios() {
  // On trie par date (puis heure) du plus récent au plus ancien
  const derniers = [...clips].sort((a, b) => {
    const da = new Date(a.date.split('/').reverse().join('-') + 'T' + (a.heure || '00:00'));
    const db = new Date(b.date.split('/').reverse().join('-') + 'T' + (b.heure || '00:00'));
    return db - da;
  }).slice(0, 3);

  const container = document.getElementById('latestClips');
  container.innerHTML = '';

  let styleAdd = "";
// --- remplacement dans afficherDerniersAudios() ---
derniers.forEach((clip, idx) => {
  const card = document.createElement('div');
  card.className = 'clip-card';

  if (clip.categories.length > 0){
        const item = collections.find(item => item.id === clip.categories[0]);
        const lienImg = item ? item.image : null;
        if(lienImg) card.style.backgroundImage = `url(${lienImg})`;
      }

  // contenu principal (sans bouton pour l'instant)
  card.innerHTML = `
    <div class="clip-title">${clip.titre}</div>
    <div class="clip-meta">${clip.date} • ${clip.heure} • ${clip.duree}s</div>
    <div style="margin-top:8px">${clip.description || ''}</div>
    <div class="clip-controls mt-3"></div>
  `;

  // créer le bouton et y rattacher le listener directement
  const controls = card.querySelector('.clip-controls');
  const btn = document.createElement('button');
  btn.className = 'btn play-latest';
  btn.type = 'button';
  btn.dataset.url = audioViaWorker(normalizedLink(clip.lien));
  // stocker meta utiles pour le player
  btn.dataset.title = clip.titre || '';
  btn.dataset.meta = `${clip.date || ''} • ${clip.heure || ''} • ${clip.duree ? Math.round(clip.duree*10)/10 + 's' : ''}`.trim();
  btn.textContent = '▶ Écouter';

  // attach listener : utilise startPlayback pour afficher le mobile player + spinner
  btn.addEventListener('click', () => {
    startPlayback(btn.dataset.url, { title: btn.dataset.title, meta: btn.dataset.meta }, btn);
  });

  controls.appendChild(btn);
  container.appendChild(card);
});


  // Lecture au clic
document.querySelectorAll('.play-latest').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const url = btn.dataset.url;
    playUrlWithSpinner(btn, url);
  });
});

}

  afficherDerniersAudios();

    function loadScript(src){
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // preserve execution order
        s.onload = () => resolve(src);
        s.onerror = (e) => reject(new Error('Failed to load script: ' + src));
        document.head.appendChild(s);
      });}

    function showFatalError(message, details){
      console.error(message, details);
      const overlay = document.createElement('div');
      overlay.className = 'loader-overlay';
      overlay.innerHTML = `<div class="loader-box"><strong>${message}</strong><div style="margin-top:8px;color:#666">${details || ''}</div></div>`;
      document.body.appendChild(overlay);}

    // try to load leaflet + markercluster sequentially, then init
    (async function bootstrap(){
      try{
        // load Leaflet first
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        // MarkerCluster ne sert (et n'est téléchargé) que si le clustering est activé :
        // inutile de faire payer ce poids réseau supplémentaire aux mobiles quand enableClustering=false.
        if (enableClustering) {
          await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        }
        // short pause to ensure globals are set (usually unnecessary but safe)
        if(typeof L === 'undefined'){
          // give a tiny delay and re-check
          await new Promise(r=>setTimeout(r,50));
        }
        if(typeof L === 'undefined') throw new Error('Leaflet global (L) not available after loading scripts');
        initMap();
      }catch(err){
        showFatalError('Erreur : impossible de charger les bibliothèques cartographiques.', err.message || err);
      }
    })();

function normalizedLink(url){
  if(!url) return url;
  // if it's already the uc?export=download form, return
  if(url.includes('uc?export=download')) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if(m && m[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url;
}


    function initMap() {
      try {
        // create map
        const map = L.map('map', { zoomControl:true, attributionControl:false }).setView([43.6,1.38], 12);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);

        // Sécurité mobile : le conteneur #map peut changer de taille juste après l'init
        // (rotation d'écran, classes Tailwind CDN appliquées après coup, clavier virtuel qui
        // redimensionne le viewport...). Leaflet ne redétecte pas ça tout seul.
        requestAnimationFrame(() => map.invalidateSize());
        setTimeout(() => map.invalidateSize(), 300);
        window.addEventListener('resize', () => map.invalidateSize());
        window.addEventListener('orientationchange', () => setTimeout(() => map.invalidateSize(), 250));

        // ✅ soit un cluster group, soit un simple layer group
        const markers = enableClustering ? L.markerClusterGroup() : L.layerGroup();

        const audio = document.getElementById('globalAudio');
        let currentId = null;

        function formatDuration(sec){
          if(!sec && sec !== 0) return '0s';
          return Math.round(sec*10)/10 + 's';
        }

        function createClipCard(clip, idx){
          const div = document.createElement('div');
          div.className = 'clip-card';
          div.dataset.idx = idx;

          div.innerHTML = `
            <div class="clip-title">${escapeHtml(clip.titre)}</div>
            <div class="clip-meta">${escapeHtml(clip.date)} • ${escapeHtml(clip.heure)} • ${formatDuration(clip.duree)}</div>
            <div style="margin-top:8px">${escapeHtml(clip.description || '')}</div>
            <div class="clip-controls">
              <button class="btn play" data-idx="${idx}">Écouter</button>
              <button class="btn locate" data-idx="${idx}">Voir sur la carte</button>
            </div>
          `;/* <a class="btn-secondary" href="${escapeAttr(clip.lien)}" target="_blank" rel="noopener">Télécharger</a> */

          return div;
        }

        // Fonction pour récupérer 3 catégories uniques
function getUniqueCategories(clips) {
  let uniqueCategories = new Set();
  let index = 0;

  while (uniqueCategories.size < 3 && index < clips.length) {
    const clip = clips[index];

    // Vérifie que clip.categories est un tableau valide
    if (
      Array.isArray(clip.categories) &&
      clip.categories.length > 0 &&
      !(clip.categories.length === 1 && clip.categories[0].trim() === '')
    ) {
      // Ajouter uniquement les catégories non vides (filtrées)
      clip.categories
        .filter(cat => cat.trim() !== '')
        .forEach(cat => uniqueCategories.add(cat));
    }

    index++;
  }

  debug("ajout :", uniqueCategories);
  return Array.from(uniqueCategories);
}



        const clipsListContainer = document.getElementById('clipsList');

        // Délégation d'événements posée une seule fois : évite de ré-attacher des
        // listeners à chaque recherche/re-render (coûteux et inutile sur mobile).
        clipsListContainer.addEventListener('click', (e) => {
          const playBtn = e.target.closest('.play');
          if (playBtn) {
            const idx = Number(playBtn.dataset.idx);
            playClip(idx, playBtn); // idx = index dans le tableau clips global (cf. createClipCard)
            return;
          }
          const locateBtn = e.target.closest('.locate');
          if (locateBtn) {
            const idx = Number(locateBtn.dataset.idx);
            const c = clips[idx];
            if (c) map.flyTo([c.lat, c.lon], 16);
          }
        });

        function addClipsToSidebar(list){
          clipsListContainer.innerHTML = '';
          // DocumentFragment : un seul reflow pour insérer toute la liste, au lieu d'un par carte.
          const frag = document.createDocumentFragment();
          list.forEach((clip) => {
            // Important : `list` peut être une sélection filtrée (recherche). L'index à stocker
            // doit rester celui du tableau `clips` global, sinon "Écouter"/"Voir sur la carte"
            // pointe sur le mauvais clip dès qu'un filtre est actif.
            const globalIdx = clips.indexOf(clip);
            frag.appendChild(createClipCard(clip, globalIdx));
          });
          clipsListContainer.appendChild(frag);
        }

        clips.reverse();
        // Appel de la fonction
        const categories = getUniqueCategories(clips);
        const filteredCollections = collections.filter(item => categories.includes(item.id));
        generateTags(filteredCollections);
        document.getElementById("tag-section-skeletons").classList.add("hidden");
        document.getElementById("tag-section").classList.remove("hidden");


      // icône détaillée (zoom proche)
    const detailedIcon = new L.DivIcon({
      className: 'custom-svg-icon',
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50" style="display:block">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 12.03 18 32 18 32s18-19.97 18-32C36 8.06 27.94 0 18 0z" fill="#762B84"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      `,
      iconSize: [36, 50],
      iconAnchor: [18, 50], // pointe du pin (bas, centré horizontalement) — correspond au path ci-dessus
      popupAnchor: [0, -50]
    });

    // icône cercle violet (zoom éloigné)
    const simpleIcon = new L.DivIcon({
      className: 'custom-circle-icon',
      html: `<svg width="16" height="16" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="30" fill="purple" stroke="white" stroke-width="4" filter="url(#shadow)" />
</svg>
`,
      iconSize: [16, 16],
      iconAnchor: [8, 8] // centre exact du cercle, désormais cohérent avec la taille réelle du SVG
    });

    // stocker tous les marqueurs
    const allMarkers = [];




      clips.forEach((clip, idx) => {
      if(typeof clip.lat !== 'number' || typeof clip.lon !== 'number') return;

      const m = L.marker([clip.lat, clip.lon], { icon: detailedIcon });

      const popupContent = document.createElement('div');
      popupContent.innerHTML = `<strong>${escapeHtml(clip.titre)}</strong><br/><em>${escapeHtml(clip.date)} ${escapeHtml(clip.heure)}</em><br/><div style='margin-top:8px'>${escapeHtml(clip.description || '')}</div><div style='margin-top:8px'><button data-idx='${idx}' class='popup-play'>▶ Écouter</button></div>`;

      m.bindPopup(popupContent);

      m.on('popupopen', (e) => {
  try {
    const btn = e.popup._contentNode?.querySelector('.popup-play');
    // le contenu du popup est conservé entre deux ouvertures : sans cette garde,
    // on empilerait un listener supplémentaire à chaque clic sur le marqueur.
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => playClip(idx, btn));
    }
  } catch(err) {
    console.warn('Impossible d’attacher l’événement popup-play', err);
  }
});


      markers.addLayer(m);
      allMarkers.push(m);
    });

    // ✅ ajoute au bon type de couche
    map.addLayer(markers);



    // ✅ changement d'icône selon le zoom
    const ZOOM_THRESHOLD = 10; // seuil de zoom à partir duquel on met l’icône détaillée
    let currentIconMode = null; // 'simple' | 'detailed' — évite de retraiter tous les marqueurs pour rien
    function updateIcons() {
      const mode = map.getZoom() < ZOOM_THRESHOLD ? 'simple' : 'detailed';
      if (mode === currentIconMode) return; // le mode n'a pas changé : rien à refaire
      currentIconMode = mode;
      const icon = mode === 'simple' ? simpleIcon : detailedIcon;
      allMarkers.forEach(m => m.setIcon(icon));
    }

    // appel initial + écoute des changements
    updateIcons();
    map.on('zoomend', updateIcons);



        // Fit bounds if we have coordinates (safe handling for 1 point)
        const latlngs = clips.filter(c=>typeof c.lat === 'number' && typeof c.lon === 'number').map(c=>[c.lat,c.lon]);
        safeFitBounds(latlngs, map);

        // Play logic
        // Remplacer l'ancienne fonction playClip par celle-ci
function playClip(idx, btn = null){
  const clip = clips[idx];
  if(!clip) return;
  const url = audioViaWorker(normalizedLink(clip.lien));
  currentId = idx;

  // update mobile player UI
  const mpTitle = document.getElementById('mp-title');
  const mpMeta = document.getElementById('mp-meta');
  const mobilePlayer = document.getElementById('mobilePlayer');
  const mpPlayBtn = document.getElementById('mp-play');

  if(mpTitle) mpTitle.textContent = clip.titre;
  if(mpMeta) mpMeta.textContent = `${clip.date} • ${formatDuration(clip.duree)}`;
  if(mobilePlayer) mobilePlayer.style.display = '';

  if(mpPlayBtn) mpPlayBtn.textContent = 'Pause';

  // si aucun bouton explicite fourni, utiliser le bouton de lecture mobile comme fallback
  if(!btn){
    // tenter de récupérer le bouton correspondant dans la sidebar
    btn = document.querySelector('.clip .play[data-idx="'+idx+'"]') || document.querySelector('.popup-play') || mpPlayBtn;
  }

  // utilise le helper central pour gérer le spinner + démarrer la lecture
  playUrlWithSpinner(btn || mpPlayBtn, url);
}


        // audio event handlers
        audio.addEventListener('ended', ()=>{
          document.getElementById('mp-play').textContent = 'Relancer';
        });

        document.getElementById('mp-play').addEventListener('click', ()=>{
          if(audio.paused){
            audio.play();
            document.getElementById('mp-play').textContent = 'Pause';
          } else {
            audio.pause();
            document.getElementById('mp-play').textContent = 'Reprendre';
          }
        });

        // Search & filter
        const search = document.getElementById('search');

        function filterClips(q){
          if(!q) return clips;
          q = q.toLowerCase().trim();
          return clips.filter(c=> (c.titre||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q) || (c.date||'').toLowerCase().includes(q));
        }

        let searchDebounceTimer = null;
        search.addEventListener('input', ()=>{
          clearTimeout(searchDebounceTimer);
          // 150ms : assez court pour rester réactif, assez long pour éviter un re-render
          // complet de la sidebar à chaque caractère tapé (sensible sur mobile bas/moyen de gamme).
          searchDebounceTimer = setTimeout(() => {
            addClipsToSidebar(filterClips(search.value));
          }, 150);
        });

        // initially populate sidebar
        addClipsToSidebar(clips);

        // Accessibility: keyboard focus for popups
        map.on('popupopen', ()=>{
          const el = document.querySelector('.leaflet-popup button');
          if(el) el.focus();
        });

        // helper functions
        function safeFitBounds(lls, mapInstance){
          if(!lls || lls.length===0) return;
          if(lls.length===1) mapInstance.setView(lls[0], 14);
          else mapInstance.fitBounds(lls, {padding:[40,40]});
        }

        // micro-helpers to prevent XSS from data
        function escapeHtml(str){
          if(!str) return '';
          return String(str).replace(/[&<>\"']/g, function(s){
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
          });
        }
        function escapeAttr(s){ return s ? s.replace(/"/g, '&quot;') : ''; }

      }catch(err){
        showFatalError('Erreur d\'initialisation de la carte', err && err.message ? err.message : err);
      }
    }
}