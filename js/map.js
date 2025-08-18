
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



const sheetUrl = 'https://corsproxy.io/?https://docs.google.com/spreadsheets/d/16LhO82rFlzNwrnF6B64rKK91_Q7o0Cc9VhhuuJLu9eY/export?format=tsv&id=16LhO82rFlzNwrnF6B64rKK91_Q7o0Cc9VhhuuJLu9eY&gid=0';

let clips = [];

async function loadClips(tag) {
  const res = await fetch(sheetUrl);
  const tsvText = await res.text();

  const lines = tsvText.trim().split('\n');

  clips = lines.map(line => {
    const [latStr, lonStr, date, heure, dureeStr, titre, description, lien, categories] = line.split('\t');

    return {
      lat: latStr && typeof latStr === 'string' ? parseFloat(latStr.replace(',', '.')) : NaN,
lon: lonStr && typeof lonStr === 'string' ? parseFloat(lonStr.replace(',', '.')) : NaN,
      date: (date && typeof date === 'string') ? date.trim() : '',
heure: (heure && typeof heure === 'string') ? heure.trim() : '',
duree: parseFloat(dureeStr),
titre: (titre && typeof titre === 'string') ? titre.trim() : '',
description: (description && typeof description === 'string') ? description.trim() : '',
lien: (lien && typeof lien === 'string') ? lien.trim() : '',
categories: (categories && typeof categories === 'string') ? stringToArray(categories.trim()) : []
    };
  });

  if(tag.length > 0){
     clips = clips.filter(c => c.categories.some(cat => cat.toLowerCase() === tag)); 
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
  derniers.forEach((clip, idx) => {

    
    const card = document.createElement('div');
card.className = 'clip-card';

    if (clip.categories.length > 0){
      // Récupérer l'objet avec l'id 'enfance'
const itemEnfance = collections.find(item => item.id === clip.categories[0]);
// Récupérer le lien
const lienEnfance = itemEnfance ? itemEnfance.image : null;
if(lienEnfance){
  card.style.backgroundImage = `url(${lienEnfance})`;
}


      console.log(clip.categories[0], styleAdd);
    }

    
    card.innerHTML = `
      <div class="clip-title">${clip.titre}</div>
      <div class="clip-meta">${clip.date} • ${clip.heure} • ${clip.duree}s</div>
      <div style="margin-top:8px">${clip.description || ''}</div>
      <div class="clip-controls mt-3">
        <button class="btn play-latest" data-url="${normalizedLink(clip.lien)}">▶ Écouter</button>
      </div>
    `;
    container.appendChild(card);
  });

  // Lecture au clic
  document.querySelectorAll('.play-latest').forEach(btn => {
    btn.addEventListener('click', () => {
      const audio = document.getElementById('globalAudio');
      audio.src = btn.dataset.url;
      audio.play();
    });
  });}

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
        // then markercluster (depends on L)
        await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
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
      // match /d/<id>/ or /d/<id>$
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
      if(m && m[1]) return `https://corsproxy.io/?https://drive.google.com/uc?export=download&id=${m[1]}`;
      // fallback to leaving the URL as-is
      return url;}

    function initMap() {
      try {
        // create map
        const map = L.map('map', { zoomControl:true, attributionControl:false }).setView([43.6,1.38], 12);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);

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

  console.log("ajout :", uniqueCategories);
  return Array.from(uniqueCategories);
}



        function addClipsToSidebar(list){
          const container = document.getElementById('clipsList');
          container.innerHTML='';
          list.forEach((clip, idx)=> container.appendChild(createClipCard(clip, idx)));

          // hook buttons
          container.querySelectorAll('.play').forEach(btn=>{
            btn.addEventListener('click', e=>{
              const i = Number(btn.dataset.idx);
              playClip(i);
            });
          });
          container.querySelectorAll('.locate').forEach(btn=>{
            const i = Number(btn.dataset.idx);
            btn.addEventListener('click', ()=>{
              const c = list[i];
              if(c) map.flyTo([c.lat,c.lon],16);
            })
          })
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
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 36 50">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 12.03 18 32 18 32s18-19.97 18-32C36 8.06 27.94 0 18 0z" fill="#762B84"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      `,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
      popupAnchor: [0, -50]
    });

    // icône cercle violet (zoom éloigné)
    const simpleIcon = new L.DivIcon({
      className: 'custom-circle-icon',
      html: `<svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="30" fill="purple" stroke="white" stroke-width="4" filter="url(#shadow)" />
</svg>
`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
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
          if (btn) btn.addEventListener('click', () => playClip(idx));
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
    function updateIcons() {
      const currentZoom = map.getZoom();
      allMarkers.forEach(m => {
        m.setIcon(currentZoom < ZOOM_THRESHOLD ? simpleIcon : detailedIcon);
      });
    }

    // appel initial + écoute des changements
    updateIcons();
    map.on('zoomend', updateIcons);



        // Fit bounds if we have coordinates (safe handling for 1 point)
        const latlngs = clips.filter(c=>typeof c.lat === 'number' && typeof c.lon === 'number').map(c=>[c.lat,c.lon]);
        safeFitBounds(latlngs, map);

        // Play logic
        function playClip(idx){
          const clip = clips[idx];
          if(!clip) return;
          const url = normalizedLink(clip.lien);
          currentId = idx;
          audio.src = url;
          audio.play().catch(err=>{
            console.warn('Lecture bloquée par le navigateur — interaction requise',err);
          });
          // update mobile player
          document.getElementById('mp-title').textContent = clip.titre;
          document.getElementById('mp-meta').textContent = `${clip.date} • ${formatDuration(clip.duree)}`;
          document.getElementById('mobilePlayer').style.display = '';
          document.getElementById('mp-play').textContent = 'Pause';
        }

        // audio event handlers
        audio.addEventListener('ended', ()=>{
          document.getElementById('mp-play').textContent = 'Play';
        });

        document.getElementById('mp-play').addEventListener('click', ()=>{
          if(audio.paused){
            audio.play();
            document.getElementById('mp-play').textContent = 'Pause';
          } else {
            audio.pause();
            document.getElementById('mp-play').textContent = 'Play';
          }
        });

        // Search & filter
        const search = document.getElementById('search');

        function filterClips(q){
          if(!q) return clips;
          q = q.toLowerCase().trim();
          return clips.filter(c=> (c.titre||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q) || (c.date||'').toLowerCase().includes(q));
        }

        search.addEventListener('input', ()=>{
          const filtered = filterClips(search.value);
          addClipsToSidebar(filtered);
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





