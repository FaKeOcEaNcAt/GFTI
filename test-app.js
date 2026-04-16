
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

const dims = ["command","reserve","discipline","adaptation","warmth","teamTrust","volatility"];
const dimLabel = {command:"指挥", reserve:"保留", discipline:"纪律", adaptation:"适应", warmth:"温度", teamTrust:"队信", volatility:"波动"};
const SCORING_ALPHA = 1.6;
const introView = document.getElementById("introView");
const quizView = document.getElementById("quizView");
const resultView = document.getElementById("resultView");
const startBtn = document.getElementById("startBtn");
const prevBtn = document.getElementById("prevBtn");
const retryBtn = document.getElementById("retryBtn");
const exportBtn = document.getElementById("exportBtn");
const downloadImageBtn = document.getElementById("downloadImageBtn");
const importBtn = document.getElementById("importBtn");
const importBtnResult = document.getElementById("importBtnResult");
const importInput = document.getElementById("importInput");
const questionText = document.getElementById("questionText");
const optionList = document.getElementById("optionList");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const resultWarning = document.getElementById("resultWarning");

let current = 0;
let answers = [];
let latestResult = null;

const SCORING_MODEL = buildScoringModel();

function replayAnimation(node, className) {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function defaultScore(){ return {command:50,reserve:50,discipline:50,adaptation:50,warmth:50,teamTrust:50,volatility:50}; }
function clamp(v){ return Math.max(0, Math.min(100, Math.round(v))); }
function clampUnit(v){ return Math.max(0, Math.min(1, v)); }
function buildScoringModel(){
  const poolStats = {};
  dims.forEach((dim) => {
    const values = GFTI_MATCH_POOL.map((item) => item.scores?.[dim] ?? 50);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    poolStats[dim] = {
      mean,
      sd: Math.sqrt(variance) || 1
    };
  });

  const centeredQuestions = GFTI_TEST_QUESTIONS.map((question) => {
    const means = {};
    dims.forEach((dim) => {
      means[dim] = question.options.reduce((sum, option) => sum + (option[1][dim] || 0), 0) / question.options.length;
    });
    return question.options.map((option) => {
      const centered = {};
      dims.forEach((dim) => {
        centered[dim] = (option[1][dim] || 0) - means[dim];
      });
      return centered;
    });
  });

  const possibleRange = {};
  dims.forEach((dim) => {
    possibleRange[dim] = { min: 0, max: 0, maxAbs: 1 };
  });
  centeredQuestions.forEach((options) => {
    dims.forEach((dim) => {
      const values = options.map((option) => option[dim]);
      possibleRange[dim].min += Math.min(...values);
      possibleRange[dim].max += Math.max(...values);
    });
  });
  dims.forEach((dim) => {
    possibleRange[dim].maxAbs = Math.max(Math.abs(possibleRange[dim].min), Math.abs(possibleRange[dim].max)) || 1;
  });

  return { poolStats, centeredQuestions, possibleRange };
}
function summarizeAnswerPattern(answerSnapshot){
  const optionCounts = [0, 0, 0, 0];
  let longestStreak = 0;
  let currentStreak = 0;
  let previous = null;
  answerSnapshot.forEach((answer) => {
    if (answer === undefined) return;
    optionCounts[answer] = (optionCounts[answer] || 0) + 1;
    if (answer === previous) currentStreak += 1;
    else currentStreak = 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previous = answer;
  });
  const answeredCount = answerSnapshot.filter((answer) => answer !== undefined).length;
  const dominantShare = answeredCount ? Math.max(...optionCounts) / answeredCount : 0;
  const uniqueOptions = optionCounts.filter((count) => count > 0).length;
  return { answeredCount, optionCounts, dominantShare, uniqueOptions, longestStreak };
}
function calcScoreDetails(answerSnapshot = answers){
  const raw = Object.fromEntries(dims.map((dim) => [dim, 0]));
  answerSnapshot.forEach((answer, questionIndex) => {
    if (answer === undefined) return;
    const optionScore = SCORING_MODEL.centeredQuestions[questionIndex]?.[answer];
    if (!optionScore) return;
    dims.forEach((dim) => {
      raw[dim] += optionScore[dim];
    });
  });

  const normalized = {};
  const score = {};
  dims.forEach((dim) => {
    const norm = raw[dim] / SCORING_MODEL.possibleRange[dim].maxAbs;
    normalized[dim] = Math.max(-1, Math.min(1, norm));
    const projected = SCORING_MODEL.poolStats[dim].mean + normalized[dim] * SCORING_MODEL.poolStats[dim].sd * SCORING_ALPHA;
    score[dim] = clamp(projected);
  });

  return { score, normalized, answerPattern: summarizeAnswerPattern(answerSnapshot) };
}
function evaluateResultQuality(score, normalized, ranked, answerPattern){
  const absStrength = dims.reduce((sum, dim) => sum + Math.abs(normalized[dim] || 0), 0) / dims.length;
  const scoreValues = dims.map((dim) => score[dim]);
  const mean = scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length;
  const spread = Math.sqrt(scoreValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / scoreValues.length);
  const spreadScore = clampUnit(spread / 18);
  const topGap = ranked[1] ? ranked[1].distance - ranked[0].distance : 12;
  const gapScore = clampUnit(topGap / 10);
  const patternPenalty =
    (answerPattern.dominantShare > 0.82 ? 0.18 : 0) +
    (answerPattern.longestStreak >= 9 ? 0.15 : 0) +
    (answerPattern.uniqueOptions <= 2 ? 0.12 : 0);
  const confidence = clamp((absStrength * 0.45 + spreadScore * 0.25 + gapScore * 0.30 - patternPenalty) * 100);
  const warning =
    answerPattern.dominantShare >= 0.86 ||
    answerPattern.longestStreak >= 11 ||
    (answerPattern.uniqueOptions <= 2 && answerPattern.dominantShare >= 0.72) ||
    (confidence < 18 && (answerPattern.dominantShare >= 0.72 || answerPattern.longestStreak >= 8));
  const message = warning
    ? "这次答题路径明显偏单一，可能存在连续按同一路径作答的情况。想获得更准确的分析结果，建议按第一反应认真完成测试。"
    : "";
  return { confidence, warning, message };
}
function scoreToCode(s){
  const a = s.command >= 67 ? 'C' : s.reserve >= 67 ? 'R' : s.volatility >= 67 ? 'F' : 'O';
  const b = s.discipline >= 67 ? 'D' : s.adaptation >= 67 ? 'A' : s.reserve >= 74 ? 'R' : 'V';
  const c = s.warmth >= 67 ? 'A' : s.warmth <= 38 ? 'C' : s.volatility >= 67 ? 'F' : 'R';
  const d = s.teamTrust >= 70 ? 'T' : s.volatility >= 70 ? 'R' : s.command >= 78 ? 'D' : 'S';
  return a+b+c+d;
}
function profileText(s){
  const lines = [];
  if (s.command >= 70) lines.push('你有明显的主导欲和接管倾向，遇到混乱更想自己把方向拉正。');
  else if (s.command <= 42) lines.push('你不太执着于站在台前，更倾向把空间留给更适合发号施令的人。');
  if (s.reserve >= 70) lines.push('你的边界感较重，不会轻易暴露自己，也不喜欢情绪被随意读取。');
  else if (s.warmth >= 72) lines.push('你在人际上更偏开放与安抚，天然有“让别人没那么紧绷”的能力。');
  if (s.discipline >= 72) lines.push('你很看重秩序、标准和可执行性，对低效和失控容忍度偏低。');
  if (s.adaptation >= 72) lines.push('你也具备很强的变通能力，必要时会为了结果重写路径。');
  if (s.teamTrust >= 74) lines.push('你对“自己人”投入度高，可靠感更多体现在托底与站队。');
  if (s.volatility >= 72) lines.push('你的情绪和行动热度都偏高，强烈、直接、有爆发力。');
  if (!lines.length) lines.push('你的轮廓比较均衡，不容易被单一标签概括，更像会随场景切换状态的人。');
  return lines.join('');
}
function renderQuestion(){
  const q = GFTI_TEST_QUESTIONS[current];
  questionText.textContent = q.text;
  progressText.textContent = `${answers.filter(v => v !== undefined).length} / ${GFTI_TEST_QUESTIONS.length}`;
  progressBar.style.width = `${(answers.filter(v => v !== undefined).length / GFTI_TEST_QUESTIONS.length) * 100}%`;
  optionList.innerHTML = q.options.map((opt, idx) => `
    <button class="option-btn ${answers[current] === idx ? 'active' : ''}" data-idx="${idx}">${String.fromCharCode(65+idx)}. ${opt[0]}</button>
  `).join('');
  optionList.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      answers[current] = Number(btn.dataset.idx);
      if (current < GFTI_TEST_QUESTIONS.length - 1) {
        current += 1;
        renderQuestion();
      } else {
        showResult();
      }
    });
  });
  replayAnimation(questionText, 'quiz-text-enter');
  replayAnimation(optionList, 'quiz-options-enter');
  prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
}
function distance(a,b){
  let sum = 0;
  dims.forEach(k => { sum += Math.pow((a[k] ?? 50) - (b[k] ?? 50), 2); });
  return Math.sqrt(sum);
}
function renderScores(target, s){
  target.innerHTML = dims.map(k => `
    <div class="score-row"><span>${dimLabel[k]}</span><div class="bar"><i style="width:${s[k]}%"></i></div><strong>${s[k]}</strong></div>
  `).join('');
}
function rankMatches(score){
  return GFTI_MATCH_POOL.map(item => ({...item, distance: distance(score, item.scores)})).sort((a,b)=>a.distance-b.distance);
}
function buildResultPayload(score, ranked, answersSnapshot, quality){
  const code = scoreToCode(score);
  const best = ranked[0];
  return {
    schema: "gfti-result-v1",
    exportedAt: new Date().toISOString(),
    answerCount: answersSnapshot.filter(v => v !== undefined).length,
    answers: answersSnapshot,
    score,
    code,
    quality,
    bestMatch: {
      id: best.id,
      name: best.name,
      team: best.team,
      typeName: best.typeName,
      summary: best.summary,
      quote: best.quote,
      basis: best.basis,
      sources: best.sources || [],
      aliases: best.aliases || []
    },
    topMatches: ranked.slice(0,4).map((item, idx) => ({
      rank: idx + 1,
      id: item.id,
      name: item.name,
      team: item.team,
      typeName: item.typeName,
      fit: Math.round(100 - item.distance * 0.9)
    }))
  };
}
function buildAnswerExportPayload(answersSnapshot){
  return {
    schema: "gfti-answers-v1",
    exportedAt: new Date().toISOString(),
    answerCount: answersSnapshot.filter(v => v !== undefined).length,
    answers: answersSnapshot
  };
}
function applyResultPayload(payload){
  const score = payload.score;
  const best = payload.bestMatch;
  introView.hidden = true;
  quizView.hidden = true;
  resultView.hidden = false;
  document.getElementById('resultName').textContent = best.name;
  document.getElementById('resultCode').textContent = payload.code;
  document.getElementById('resultType').textContent = best.typeName;
  document.getElementById('resultTeam').textContent = best.team;
  document.getElementById('resultSummary').textContent = best.summary;
  document.getElementById('resultQuote').textContent = `“${best.quote}”`;
  renderScores(document.getElementById('resultScores'), score);
  document.getElementById('profileText').textContent = profileText(score);
  document.getElementById('basisList').innerHTML = (best.basis || []).map(x => `<li>${x}</li>`).join('');
  const sourceWrap = document.getElementById('resultSources');
  if (sourceWrap) sourceWrap.innerHTML = (best.sources || []).map(key => `<a class="source-chip" href="${GFTI_SOURCE_REGISTRY[key]?.url || '#'}" target="_blank" rel="noreferrer">${GFTI_SOURCE_REGISTRY[key]?.label || key}</a>`).join('');
  const aliasWrap = document.getElementById('resultAliases');
  if (aliasWrap) aliasWrap.innerHTML = (best.aliases || []).map(a => `<span class="alias-chip">${a.kind}：${a.value}</span>`).join('');
  document.getElementById('topMatches').innerHTML = (payload.topMatches || []).map((item, idx) => {
    return `<div class="match-row"><span class="tag">#${idx+1}</span><div><strong>${item.name}</strong><div class="mini">${item.typeName} · ${item.team}</div></div><strong>${item.fit}%</strong></div>`;
  }).join('');
  if (resultWarning) {
    const warningText = payload.quality?.warning ? payload.quality.message : "";
    resultWarning.hidden = !warningText;
    resultWarning.textContent = warningText;
  }
  latestResult = payload;
  try { localStorage.setItem("gfti_latest_result", JSON.stringify(payload)); } catch(e) {}
}
function showResult(){
  const details = calcScoreDetails(answers.slice());
  const score = details.score;
  const ranked = rankMatches(score);
  const quality = evaluateResultQuality(score, details.normalized, ranked, details.answerPattern);
  const payload = buildResultPayload(score, ranked, answers.slice(), quality);
  applyResultPayload(payload);
}
function downloadJSON(filename, obj){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function buildExportTimestamp(date = new Date()){
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
}
function normalizeCaptureDetails(cloneRoot, cloneDocument){
  cloneRoot.querySelectorAll("details").forEach((detailsNode) => {
    const summaryNode = detailsNode.querySelector("summary");
    const replacement = cloneDocument.createElement("div");
    replacement.style.marginTop = detailsNode.style.marginTop || "16px";
    replacement.style.padding = "12px 14px";
    replacement.style.border = "1px solid rgba(255,255,255,.08)";
    replacement.style.borderRadius = "14px";
    replacement.style.background = "rgba(255,255,255,.025)";

    if (summaryNode) {
      const title = cloneDocument.createElement("div");
      title.textContent = summaryNode.textContent || "";
      title.style.marginBottom = "10px";
      title.style.fontWeight = "700";
      title.style.color = "var(--text)";
      replacement.appendChild(title);
    }

    Array.from(detailsNode.children).forEach((child) => {
      if (child.tagName === "SUMMARY") return;
      replacement.appendChild(child.cloneNode(true));
    });

    detailsNode.replaceWith(replacement);
  });
}
async function downloadResultImage(){
  if (!window.html2canvas || !latestResult) return;
  const captureTarget = resultView;
  const originalText = downloadImageBtn?.textContent;
  if (downloadImageBtn) {
    downloadImageBtn.disabled = true;
    downloadImageBtn.textContent = "生成图片中...";
  }
  try {
    const canvas = await window.html2canvas(captureTarget, {
      backgroundColor: "#0b1020",
      scale: Math.min(window.devicePixelRatio || 1, 2),
      useCORS: true,
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.getElementById("resultView");
        if (!clonedRoot) return;
        normalizeCaptureDetails(clonedRoot, clonedDocument);
      }
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `GFTI-${buildExportTimestamp()}.png`;
    link.click();
  } catch (err) {
    alert("下载失败：截图生成未完成，请重试。");
  } finally {
    if (downloadImageBtn) {
      downloadImageBtn.disabled = false;
      downloadImageBtn.textContent = originalText || "下载分析结果";
    }
  }
}
function importResultFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const importedAnswers = Array.isArray(payload?.answers) ? payload.answers : null;
      const isAnswerExport = payload?.schema === "gfti-answers-v1";
      const isLegacyResultExport = payload?.schema === "gfti-result-v1";
      if ((!isAnswerExport && !isLegacyResultExport) || !importedAnswers) {
        throw new Error("invalid schema");
      }
      answers = importedAnswers;
      current = 0;
      showResult();
    } catch (err) {
      alert("导入失败：这不是可识别的 GFTI 答题记录 JSON。");
    }
  };
  reader.readAsText(file, "utf-8");
}
startBtn.addEventListener('click', () => {
  introView.hidden = true;
  quizView.hidden = false;
  resultView.hidden = true;
  current = 0;
  answers = [];
  renderQuestion();
});
prevBtn.addEventListener('click', () => {
  if (current > 0) { current -= 1; renderQuestion(); }
});
retryBtn.addEventListener('click', () => {
  resultView.hidden = true;
  introView.hidden = false;
  quizView.hidden = true;
  current = 0;
  answers = [];
  latestResult = null;
});
if (exportBtn) exportBtn.addEventListener('click', () => {
  if (!latestResult) return;
  const payload = buildAnswerExportPayload(answers.slice());
  const name = `GFTI-${buildExportTimestamp()}.json`;
  downloadJSON(name, payload);
});
if (downloadImageBtn) downloadImageBtn.addEventListener('click', downloadResultImage);
if (importBtn) importBtn.addEventListener('click', () => importInput.click());
if (importBtnResult) importBtnResult.addEventListener('click', () => importInput.click());
if (importInput) importInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) importResultFromFile(file);
  e.target.value = "";
});
try {
  const cached = localStorage.getItem("gfti_latest_result");
  if (cached) latestResult = JSON.parse(cached);
} catch(e) {}
