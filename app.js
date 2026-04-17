
const GFTI_SOURCE_REGISTRY = {
  "moegirl": {
    "label": "萌娘百科",
    "url": "https://mzh.moegirl.org.cn/",
    "note": "用于角色公开介绍、关系描述与社区已公开整理信息。",
    "copyright": "文字内容默认使用 CC BY-NC-SA 3.0 中国大陆；页面转载应遵循原站标注。"
  },
  "iopwiki": {
    "label": "IOP Wiki",
    "url": "https://iopwiki.com/",
    "note": "用于战术人形索引、阵营、小队和公开设定信息。",
    "copyright": "页面内容版权与站点规则以原站说明为准；本站仅作来源指向。"
  },
  "gf2bwiki": {
    "label": "少前2：追放WIKI_BWIKI_哔哩哔哩",
    "url": "https://wiki.biligame.com/gf2/",
    "note": "用于追放侧的角色索引、别名/现名对照和公开图鉴导航。",
    "copyright": "站内内容版权与使用规范以 BWIKI / 哔哩哔哩及相关权利方说明为准。"
  },
  "gfwiki": {
    "label": "少女前线 Wiki",
    "url": "https://www.gfwiki.org/",
    "note": "预留为后续补全旧作资料的补充信源。",
    "copyright": "请以原站版权与转载规范为准。"
  },
  "ncwiki": {
    "label": "云图计划 Wiki（42LAB）",
    "url": "http://wiki.42lab.cloud/",
    "note": "预留为后续补充跨企划角色资料的补充信源。",
    "copyright": "请以原站版权与转载规范为准。"
  }
};

const scoreLabels = {
  command: "指挥",
  reserve: "保留",
  discipline: "纪律",
  adaptation: "适应",
  warmth: "温度",
  teamTrust: "队信",
  volatility: "波动"
};

const popularGrid = document.getElementById("popularGrid");
const searchInput = document.getElementById("searchInput");
const teamFilter = document.getElementById("teamFilter");
const heroMetaNote = document.getElementById("heroMetaNote");

document.getElementById("popularCount").textContent = GFTI_POPULAR.length;
if (heroMetaNote) {
  heroMetaNote.textContent = `当前已收录 ${GFTI_POPULAR.length} 名热门人形，支持在线测试与结果导出。`;
}

const teams = [...new Set(GFTI_POPULAR.map(x => x.team))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
teams.forEach(team => {
  const option = document.createElement("option");
  option.value = team;
  option.textContent = team;
  teamFilter.appendChild(option);
});

function scoreRow(label, value) {
  return `
    <div class="score-row">
      <span>${label}</span>
      <div class="bar"><i style="width:${value}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
}

function renderPopular(items) {
  popularGrid.innerHTML = items.map(item => `
    <article class="card">
      <div class="topline">
        <div>
          <h3>${item.name}</h3>
          <div class="summary">${item.team} · ${item.weaponClass} · ${"★".repeat(item.rarity)}</div>
        </div>
        <div class="code">${item.code}</div>
      </div>
      <div class="badges">
        <span class="badge">${item.typeName}</span>
        <span class="badge">${item.headline}</span>
      </div>
      <p class="summary">${item.summary}</p>
      <div class="scores">
        ${Object.entries(item.scores).map(([k, v]) => scoreRow(scoreLabels[k] || k, v)).join("")}
      </div>
      ${item.aliases?.length ? `<div class="alias-row">` + item.aliases.map(a => `<span class="alias-chip">${a.kind}：${a.value}</span>`).join('') + `</div>` : ''}
      <div class="source-row">${(item.sources || []).map(key => `<a class="source-chip" href="${GFTI_SOURCE_REGISTRY[key]?.url || '#'}" target="_blank" rel="noreferrer">${GFTI_SOURCE_REGISTRY[key]?.label || key}</a>`).join('')}</div>
      <div class="quote">“${item.quote}”</div>
      <details style="margin-top:12px">
        <summary>判定依据</summary>
        <ul>${item.basis.map(x => `<li>${x}</li>`).join("")}</ul>
      </details>
    </article>
  `).join("");
}

function applyFilter() {
  const keyword = searchInput.value.trim().toLowerCase();
  const team = teamFilter.value;
  const filtered = GFTI_POPULAR.filter(item => {
    const hitKeyword = !keyword || [item.name, item.team, item.typeName, item.code, item.summary].join(" ").toLowerCase().includes(keyword);
    const hitTeam = !team || item.team === team;
    return hitKeyword && hitTeam;
  });
  renderPopular(filtered);
}

searchInput.addEventListener("input", applyFilter);
teamFilter.addEventListener("change", applyFilter);

renderPopular(GFTI_POPULAR);


const sourceRegistryNode = document.getElementById("sourceRegistry");
if (sourceRegistryNode) {
  sourceRegistryNode.innerHTML = Object.entries(GFTI_SOURCE_REGISTRY).map(([key, src]) => `
    <a class="source-block" href="${src.url}" target="_blank" rel="noreferrer">
      <strong>${src.label}</strong>
      <span>${src.note}</span>
      <em>${src.copyright}</em>
    </a>
  `).join("");
}
