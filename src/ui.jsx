// ===== jintoria HUD/UI (React) =====
// Phaserの盤面(src/game.js)は変更せず、その周辺のDOM UI(HUD・アクションシート・
// 各種バナー・デバッグログパネルなど)だけをこのファイルでReact管理する。
// game.jsからは window.__jintoriaUI.* を呼ぶだけにし、DOM直接操作は行わない。
(function () {
  'use strict';

  // ===== 自前ミニストア(useSyncExternalStoreで購読する) =====
  function createStore(initialState) {
    let state = initialState;
    const listeners = new Set();
    return {
      getState() { return state; },
      setState(patch) {
        state = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch);
        listeners.forEach((fn) => fn());
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
    };
  }

  const store = createStore({
    selectedLabel: 'なし',
    pauseBannerVisible: false,
    multiSelectActive: false,
    multiSelectCount: 0,
    running: false,
    speedMode: 'fast',
    zoomMode: 'in',
    victoryCharActive: true,
    hud: {
      playerCountLabel: '-', enemyCountLabel: '-',
      playerTroopPct: 50, enemyTroopPct: 50,
      playerTerritoryLabel: '-', enemyTerritoryLabel: '-',
      playerTerrPct: 0, enemyTerrPct: 0
    },
    actionSheet: null,     // { labels, onPick } | null
    resultBanner: null,    // string | null
    victoryOverlay: null   // 画像src | null
  });

  function useStoreState() {
    return React.useSyncExternalStore(store.subscribe, store.getState);
  }

  // ===== game.js から呼ばれる橋渡しAPI =====
  function setHud(hud) { store.setState({ hud }); }
  function setSelectedLabel(text) { store.setState({ selectedLabel: text }); }
  function setPauseBannerVisible(visible) { store.setState({ pauseBannerVisible: !!visible }); }
  function setMultiSelectActive(active) { store.setState({ multiSelectActive: !!active }); }
  function setMultiSelectCount(count) { store.setState({ multiSelectCount: count }); }
  function setRunState(running) { store.setState({ running: !!running }); }
  function setSpeedMode(mode) { store.setState({ speedMode: mode }); }
  function setZoomMode(mode) { store.setState({ zoomMode: mode }); }
  function setVictoryCharActive(active) { store.setState({ victoryCharActive: !!active }); }
  function showActionSheet(labels, onPick) { store.setState({ actionSheet: { labels, onPick } }); }
  function closeActionSheet() { store.setState({ actionSheet: null }); }
  function showResultBanner(text) { store.setState({ resultBanner: text }); }
  function showVictoryOverlay(imgSrc) { store.setState({ victoryOverlay: imgSrc }); }
  function hideVictoryOverlay() { store.setState({ victoryOverlay: null }); }

  window.__jintoriaUI = {
    setHud, setSelectedLabel, setPauseBannerVisible,
    setMultiSelectActive, setMultiSelectCount, setRunState,
    setSpeedMode, setZoomMode, setVictoryCharActive,
    showActionSheet, closeActionSheet,
    showResultBanner, showVictoryOverlay, hideVictoryOverlay
  };

  // ===== デバッグログの購読(バッファ自体はshell.html冒頭の生JSが管理) =====
  const debugListeners = new Set();
  window.__notifyDebugLog = function () {
    debugListeners.forEach((fn) => fn());
  };
  function useDebugLines() {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
      debugListeners.add(bump);
      return () => debugListeners.delete(bump);
    }, []);
    return window.__debugLines || [];
  }

  // ===== コンポーネント =====
  function HudTop({ settingsOpen, onToggleSettings }) {
    return (
      <div id="hud-top">
        <span id="version-label">Jintoria v5.2</span>
        <button id="settings-toggle" className={settingsOpen ? 'active' : ''} onClick={onToggleSettings}>⚙️ 設定</button>
      </div>
    );
  }

  function StatsPanel() {
    const { hud } = useStoreState();
    return (
      <div id="stats-panel">
        <div className="stat-row">
          <span className="stat-label">兵力</span>
          <div className="bar-track">
            <div className="bar-fill player" id="bar-troops-player" style={{ width: hud.playerTroopPct + '%' }}></div>
            <div className="bar-fill enemy" id="bar-troops-enemy" style={{ width: hud.enemyTroopPct + '%' }}></div>
          </div>
          <span className="stat-nums">
            <span className="player" id="player-count">{hud.playerCountLabel}</span>/<span className="enemy" id="enemy-count">{hud.enemyCountLabel}</span>
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">占領</span>
          <div className="bar-track">
            <div className="bar-fill player" id="bar-territory-player" style={{ width: hud.playerTerrPct + '%' }}></div>
            <div className="bar-fill enemy" id="bar-territory-enemy" style={{ width: hud.enemyTerrPct + '%' }}></div>
          </div>
          <span className="stat-nums">
            <span className="player" id="player-territory">{hud.playerTerritoryLabel}</span>/<span className="enemy" id="enemy-territory">{hud.enemyTerritoryLabel}</span>
          </span>
        </div>
      </div>
    );
  }

  function SelectedLabel() {
    const { selectedLabel } = useStoreState();
    return <div>選択中: <span id="selected-label">{selectedLabel}</span></div>;
  }

  function MultiSelectControls() {
    const { multiSelectActive, multiSelectCount } = useStoreState();
    return (
      <div id="multi-select-controls">
        <button id="multi-select-toggle" className={multiSelectActive ? 'active' : ''}
          onClick={() => window.__jintoriaScene && window.__jintoriaScene.toggleMultiSelectMode()}>複数選択</button>
        <button id="multi-issue-btn" style={{ display: multiSelectCount > 0 ? 'inline-flex' : 'none' }}
          onClick={() => window.__jintoriaScene && window.__jintoriaScene.beginMultiCommandMode()}>
          指示を出す(<span id="multi-select-count">{multiSelectCount}</span>)
        </button>
      </div>
    );
  }

  function RunToggleButton() {
    const { running } = useStoreState();
    const btnRef = React.useRef(null);
    const isFirst = React.useRef(true);

    React.useEffect(() => {
      if (isFirst.current) { isFirst.current = false; return; }
      const btn = btnRef.current;
      if (!btn) return;
      // クリック時にポップアニメーションを再生(v5.0)。強制リフローで再トリガーする
      btn.classList.remove('run-pop');
      void btn.offsetWidth;
      btn.classList.add('run-pop');
      const onEnd = () => btn.classList.remove('run-pop');
      btn.addEventListener('animationend', onEnd, { once: true });
    }, [running]);

    return (
      <button id="run-toggle" ref={btnRef} className={running ? 'running' : ''}
        onClick={() => window.__jintoriaScene && window.__jintoriaScene.toggleRun()}>
        <span className="run-icon">{running ? '⏸' : '▶'}</span>
        <span className="run-label">{running ? '停止' : '開始'}</span>
      </button>
    );
  }

  const SPEED_LABELS = { slow: 'ゆっくり', normal: 'ふつう', fast: '速い' };
  const ZOOM_LABELS = { in: '拡大', normal: 'ふつう', out: '縮小' };

  function SettingsPanel({ open }) {
    const { speedMode, zoomMode, victoryCharActive } = useStoreState();
    return (
      <div id="settings-panel" className={open ? 'open' : ''}>
        <div id="speed-controls">
          {['slow', 'normal', 'fast'].map((m) => (
            <button key={m} id={'speed-' + m} className={speedMode === m ? 'active' : ''}
              onClick={() => window.__jintoriaScene && window.__jintoriaScene.setSpeed(m)}>{SPEED_LABELS[m]}</button>
          ))}
        </div>
        <div id="zoom-controls">
          {['in', 'normal', 'out'].map((m) => (
            <button key={m} id={'zoom-' + m} className={zoomMode === m ? 'active' : ''}
              onClick={() => window.__jintoriaScene && window.__jintoriaScene.setZoomMode(m)}>{ZOOM_LABELS[m]}</button>
          ))}
        </div>
        <button id="victory-char-toggle" className={victoryCharActive ? 'active' : ''}
          onClick={() => window.__jintoriaScene && window.__jintoriaScene.toggleVictoryCharSetting()}>勝利キャラ表示</button>
      </div>
    );
  }

  function ResultBanner() {
    const { resultBanner } = useStoreState();
    return <div id="result-banner" style={{ display: resultBanner ? 'block' : 'none' }}>{resultBanner || ''}</div>;
  }

  function VictoryOverlay() {
    const { victoryOverlay } = useStoreState();
    return (
      <div id="victory-overlay" style={{ display: victoryOverlay ? 'flex' : 'none' }}>
        <div id="victory-overlay-inner">
          <div id="victory-overlay-text">勝利!</div>
          <div id="victory-overlay-imgwrap">
            <img id="victory-overlay-img" src={victoryOverlay || ''} alt="勝利" />
            <button id="victory-close" onClick={hideVictoryOverlay}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  function PauseBanner() {
    const { pauseBannerVisible } = useStoreState();
    return (
      <div id="pause-banner" style={{ display: pauseBannerVisible ? 'flex' : 'none' }}>
        ⏸ 指示待ち
        <button onClick={() => window.__jintoriaScene && window.__jintoriaScene.cancelCommand()}>✕ キャンセル</button>
      </div>
    );
  }

  function ActionSheet() {
    const { actionSheet } = useStoreState();
    if (!actionSheet) return <div id="action-sheet"></div>;
    return (
      <div id="action-sheet" style={{ display: 'flex' }}>
        {actionSheet.labels.map((label, i) => (
          <button key={i} className={label === '待機' ? 'wait-btn' : 'action-btn'}
            onClick={() => actionSheet.onPick(label)}>{label}</button>
        ))}
      </div>
    );
  }

  function DebugLogPanel({ open, onClose }) {
    const lines = useDebugLines();
    const [copyState, setCopyState] = React.useState('idle'); // idle | copied | failed
    const copyTimerRef = React.useRef(null);

    const handleCopy = () => {
      const text = lines.join('\n');
      const showCopied = (ok) => {
        setCopyState(ok ? 'copied' : 'failed');
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopyState('idle'), 1500);
      };
      const fallbackCopy = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          showCopied(ok);
        } catch (e) {
          showCopied(false);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showCopied(true)).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    };

    return (
      <div id="debug-log" style={{ display: open ? 'block' : 'none' }}>
        <div id="debug-log-header">
          <button id="debug-log-copy" className={copyState === 'copied' ? 'copied' : ''} onClick={handleCopy}>
            {copyState === 'copied' ? '✓コピーしました' : copyState === 'failed' ? '✗コピー失敗' : '📋コピー'}
          </button>
          <button id="debug-log-close" onClick={onClose}>✕</button>
        </div>
        <div id="debug-log-text">{lines.join('\n')}</div>
      </div>
    );
  }

  function GameUI() {
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [debugOpen, setDebugOpen] = React.useState(false);

    return (
      <div id="game-container">
        <div id="hud">
          <HudTop settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} />
          <div id="hud-main">
            <StatsPanel />
            <SelectedLabel />
            <MultiSelectControls />
            <RunToggleButton />
          </div>
          <SettingsPanel open={settingsOpen} />
        </div>
        <div id="phaser-target">
          {/* Phaserのcanvasはgame.js側がこの空divの中にappendする。Reactは以後この中身を管理しない */}
          <div id="phaser-mount"></div>
          <ResultBanner />
          <VictoryOverlay />
          <PauseBanner />
          <ActionSheet />
          <button id="debug-toggle" onClick={() => setDebugOpen((o) => !o)}>🐞ログ</button>
          <DebugLogPanel open={debugOpen} onClose={() => setDebugOpen(false)} />
        </div>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  // createRoot().render()は(トップレベルscriptからの呼び出しでは)DOMコミットが
  // 非同期にスケジュールされることがある。#phaser-mountがこの時点で確実にDOMへ
  // 存在している必要があるため、flushSyncで初回コミットを同期化する。
  ReactDOM.flushSync(() => {
    root.render(<GameUI />);
  });

  // このscriptはtype="text/babel"のため、Babel standaloneがDOMContentLoaded時に
  // 非同期でトランスパイル・実行する(通常のscriptタグより後回しになる)。そのため
  // 後続の<script src="game.js">のほうが先に実行され得る。game.js側は
  // new Phaser.Game()を呼ぶ前にこのイベント(または既にtrueならフラグ)を待つことで、
  // #phaser-mountが実際にDOMへ存在してから初期化されることを保証する。
  window.__jintoriaUIReady = true;
  window.dispatchEvent(new Event('jintoria-ui-ready'));
})();
