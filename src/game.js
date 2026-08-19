// ===== 定数 =====
const TILE_SIZE = 48; // 当たり判定・従来ロジック用の基準値(座標系はcol/rowのまま、見た目のみ下記アイソメ変換を使用)
const GRID_COLS = 14; // v4.31: 12→14に拡張(左右2列ずつ広く)
const GRID_ROWS = 9;
const FENCE_COL = 8;            // 中央の柵がある列。ここから敵側(col >= FENCE_COL)を低くする(v4.39)
const ELEVATION_STEP = 10;      // 段差の高さ(px)。大きくするほど段差が目立つ(v4.39)

// ===== アイソメトリック(3D風)投影設定 =====
const ISO_W = 64;       // ダイヤ1枚の横幅
const ISO_H = 32;       // ダイヤ1枚の縦幅
const ISO_GROUND_DEPTH = 14;  // 地面ブロックの厚み
const ISO_WALL_DEPTH = 16;    // 城壁ブロックの厚み(隣接マスを隠しすぎないよう抑えめに)
const ISO_FENCE_DEPTH = 18;   // 柵ブロックの厚み(同上)
const ISO_ORIGIN_X = (GRID_ROWS - 1) * (ISO_W / 2) + 48; // 盤面全体が画面内に収まるよう原点をずらす
const ISO_ORIGIN_Y = 150; // 柵・城壁・王冠など背の高いものの描画余白を上に確保
const AUTO_MOVE_INTERVAL_BASE = 1400; // 自律移動の間隔(ms)。基準値(ふつう速度)
const SPEED_PRESETS = { slow: 2.0, normal: 1.0, fast: 0.5 }; // 倍速設定(値が小さいほど速い)
const ZOOM_PRESETS = { out: 0.75, normal: 1.0, in: 1.4 }; // カメラズーム倍率
const COMMAND_TIMEOUT_TICKS = 10; // プレイヤー指示の有効期間(実際に処理されたtick数。v3.20で実時間msから変更。
const STEP_TOWARD_WAIT_TICKS = 3; // 自動AI(stepToward)が直進方向をふさがれた時、迂回を試みるまで待つtick数
const AUTO_STUCK_PATHFIND_TICKS = 6; // 自動AIが目標に何tick近づけなければBFS経路探索に切り替えるか
                                   // 実時間ベースだとゲーム未開始/一時停止/城壁を壊している間の実時間も
                                   // カウントしてしまい、指示が途中で解除されるバグがあったため)

// ===== 兵力(strength)の3段階定義 =====
// 弱キャラ: 1〜999 / 中キャラ: 1000〜9999 / 強キャラ: 10000以上
// 王(女王)は兵力1で固定(常に敗北する仕様は変更なし。数値上は「弱」扱い)
const STRENGTH_MID_MIN = 1000;
const STRENGTH_STRONG_MIN = 10000;
const KING_STRENGTH = 1;
function strengthTier(strength) {
  if (strength >= STRENGTH_STRONG_MIN) return 'strong';
  if (strength >= STRENGTH_MID_MIN) return 'mid';
  return 'weak';
}
// 王の表示サイズは兵力の数値(=1)によらず固定(isKing補正1.25倍と合わせて使う)
const KING_DISPLAY_SCALE = 1.05;
// ティアごとの表示倍率・強さバーの充填率・バー色(旧しきい値 強>=6/中>=4/弱 の色をそのまま踏襲)
const TIER_SCALE = { weak: 0.85, mid: 1.05, strong: 1.3 };
const TIER_BAR_RATIO = { weak: 0.35, mid: 0.7, strong: 1.0 };
const TIER_BAR_COLOR = { weak: 0x90a4ae, mid: 0x9ccc65, strong: 0xffd166 };

const WALL_HP = 200;           // 城壁の耐久値(v4.0: HP制、tier別ダメージで削る)
const FLUSTER_HOLD_TICKS = 20; // 城壁攻撃後、王が「焦り顔」を保持するtick数(この間攻撃が無ければ通常顔に戻す。v4.25)
const SIEGE_LOG_LIMIT = 24; // v4.44: 調査完了につき通常値(24)に復帰
const HOUSE_HP = 100;          // 家の耐久値(v4.0: HP制)
const HOUSE_SHRINK_HP_THRESHOLD = 50; // 家の残HPがこれ以下になったら見た目が縮み始める
const HOUSE_LIFE_COST_CAP = 100; // 家作りで消費する兵力の上限(強い兵でもここまでしか減らない)
const HOUSE_SPAWN_INTERVAL = 20;  // 家が新兵を生産する間隔(tick数)。2回目以降の生産間隔として使用
const HOUSE_SPAWN_STRENGTH = 100; // 家から生まれる兵士の強さ(弱キャラ帯、固定値)
const HOUSE_FIRST_SPAWN_DELAY_MIN = 1;  // 初回生産までのtick数(消費兵力が上限いっぱいの場合。最速)
const HOUSE_FIRST_SPAWN_DELAY_MAX = 20; // 初回生産までのtick数(消費兵力がごくわずかな場合。最遅)

// ===== 領土タイル・攻城ダメージ(v4.0) =====
// 城壁・家・普通タイルはすべて「1tickごとにユニットの強さ帯に応じた固定ダメージを受けるHP制」に統一。
// 攻撃側ユニット自身はもう兵力を消耗しない(旧SIEGE_STRENGTH_LOSS_RATIOは廃止)。
const TIER_DAMAGE = { weak: 10, mid: 20, strong: 50 }; // 1tickごとに対象のHPから引かれる値
const TERRITORY_TILE_HP = 30;             // 普通タイル(城壁でも家でもない占領マス)のHP
const TERRITORY_AUTO_CLAIM_CHANCE = 0.15;  // 家の周囲1マス(斜め含む)が毎tick自動占有される確率



// ユニット初期配置(自軍は左側、敵軍は右側に配置)
// color = 髪色(個体差をつけるための識別色)
// v4.50: A・Cの初期位置を入れ替え、Aの初期兵力を10000に変更
const UNIT_DEFS = [
  { id: 'A', team: 'player', col: 3, row: 4, color: 0xffd54f, strength: 10000 },
  { id: 'B', team: 'player', col: 1, row: 7, color: 0xa1887f, strength: 1000 },
  { id: 'C', team: 'player', col: 1, row: 1, color: 0xce93d8, strength: 500 },
  { id: 'E1', team: 'enemy', col: 12, row: 1, color: 0x37474f, strength: 1000 },
  { id: 'E2', team: 'enemy', col: 12, row: 7, color: 0x6d4c41, strength: 500 },
  { id: 'E3', team: 'enemy', col: 10, row: 4, color: 0x8d6e63, strength: 100 }
];

// 王ユニット:各陣地の一番奥(自軍は左端、敵軍は右端)に配置。動けず、待機のみ。兵力は1で固定。
const KING_DEFS = [
  { id: '王', team: 'player', col: 1,  row: 4, color: 0xffd700, strength: KING_STRENGTH, isKing: true },
  { id: '王', team: 'enemy',  col: 12, row: 4, color: 0xffd700, strength: KING_STRENGTH, isKing: true }
];

// 王を囲む城壁(破壊されるまで通行不可)。3x3の8マス全てを城壁で完全に囲む。
// piece: 使用するスプライトの種類(角4種+辺4種)。team = どちらの王を守っているか(敵側からしか破壊できない)
function ringWallDefs(kingCol, kingRow, team) {
  const domePiece = team === 'player' ? 'castle_corner_dome' : 'castle_corner_dome_enemy';
  return [
    { col: kingCol - 1, row: kingRow - 1, team, piece: domePiece },
    { col: kingCol,     row: kingRow - 1, team, piece: 'castle_wall_full' },
    { col: kingCol + 1, row: kingRow - 1, team, piece: domePiece },
    { col: kingCol - 1, row: kingRow,     team, piece: 'castle_wall_full', flipX: true },
    { col: kingCol + 1, row: kingRow,     team, piece: 'castle_wall_full', flipX: true },
    // 手前(南側、プレイヤーに近い側)の城壁は、王の上半身が見えるよう他より低くする
    { col: kingCol - 1, row: kingRow + 1, team, piece: domePiece, heightOverride: 48 },
    { col: kingCol,     row: kingRow + 1, team, piece: 'castle_wall_full', heightOverride: 36 },
    { col: kingCol + 1, row: kingRow + 1, team, piece: domePiece, heightOverride: 48 }
  ];
}
const WALL_DEFS = [
  ...ringWallDefs(1, 4, 'player'),
  ...ringWallDefs(12, 4, 'enemy')
];

// 柵(マップ中央の縦の隔たり)。row=4だけ自然に開いた通路。
// row=2の1マスだけ「橋を架けられる」柵として、破壊ではなく建設で通行可能にできる。
const FENCE_DEFS = [0, 1, 2, 3, 5, 6, 7, 8].map(row => ({ col: FENCE_COL, row })); // 柵の列。段差の境目(FENCE_COL)と共通

// ===== グリッド <-> ピクセル変換(アイソメトリック) =====
// 返す座標は「そのマスのダイヤ(菱形)の中心」。承認済みのプレビュー(jintoria-iso-preview.html)と同じ計算式。
// v4.39: 敵味方の陣営の境目に軽い段差をつける。柵の列(FENCE_COL)より敵側のマスを一段低く配置する
// (画面上では下方向=+yにずらすと「低い」ように見える)
function tileElevation(col) {
  return col >= FENCE_COL ? ELEVATION_STEP : 0;
}
function gridToPixel(col, row) {
  return {
    x: ISO_ORIGIN_X + (col - row) * (ISO_W / 2),
    y: ISO_ORIGIN_Y + (col + row) * (ISO_H / 2) + tileElevation(col)
  };
}
function pixelToGrid(x, y) {
  // 段差ぶんのyオフセットを考慮して逆算する。まず段差なしで仮に求め、
  // その結果が敵側だった場合は段差ぶんを引いてもう一度求め直す
  const solve = (elev) => {
    const dx = x - ISO_ORIGIN_X;
    const dy = y - ISO_ORIGIN_Y - elev;
    return { col: Math.round(dx / ISO_W + dy / ISO_H), row: Math.round(dy / ISO_H - dx / ISO_W) };
  };
  const flat = solve(0);
  if (flat.col >= FENCE_COL) {
    const stepped = solve(ELEVATION_STEP);
    if (stepped.col >= FENCE_COL) return stepped;
  }
  return flat;
}
// 色を明るく/暗くする(アイソメブロックの陰影づけ用)
function shadeColor(color, amt) {
  let r = (color >> 16) + amt, g = ((color >> 8) & 0xff) + amt, b = (color & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return (r << 16) | (g << 8) | b;
}
// Graphicsに絶対座標でアイソメブロック(上面+左右側面)を描く。tint指定で上面に半透明色を重ねる(陣地の色分け用)
function drawIsoBlockAbs(g, x, y, depth, topColor, tint, tintAlpha) {
  const w2 = ISO_W / 2, h2 = ISO_H / 2;
  const top = { x: x, y: y - h2 }, right = { x: x + w2, y: y }, bottom = { x: x, y: y + h2 }, left = { x: x - w2, y: y };
  if (depth > 0) {
    g.fillStyle(shadeColor(topColor, -60), 1);
    g.beginPath();
    g.moveTo(left.x, left.y); g.lineTo(bottom.x, bottom.y); g.lineTo(bottom.x, bottom.y + depth); g.lineTo(left.x, left.y + depth);
    g.closePath(); g.fillPath();

    g.fillStyle(shadeColor(topColor, -90), 1);
    g.beginPath();
    g.moveTo(right.x, right.y); g.lineTo(bottom.x, bottom.y); g.lineTo(bottom.x, bottom.y + depth); g.lineTo(right.x, right.y + depth);
    g.closePath(); g.fillPath();
  }
  g.fillStyle(topColor, 1);
  g.beginPath();
  g.moveTo(top.x, top.y); g.lineTo(right.x, right.y); g.lineTo(bottom.x, bottom.y); g.lineTo(left.x, left.y);
  g.closePath(); g.fillPath();
  if (tint != null) {
    g.fillStyle(tint, tintAlpha != null ? tintAlpha : 0.3);
    g.beginPath();
    g.moveTo(top.x, top.y); g.lineTo(right.x, right.y); g.lineTo(bottom.x, bottom.y); g.lineTo(left.x, left.y);
    g.closePath(); g.fillPath();
  }
}
// (col+row)を基準にした奥行きソート用の深度値。tierで同じマス内の前後関係を決める(地面<構造物<ユニット<エフェクト)
function isoDepth(col, row, tier) {
  return (col + row) * 10 + tier;
}
function inBounds(col, row) {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}
function sign(n) { return n > 0 ? 1 : (n < 0 ? -1 : 0); }

// 強さ→キャラクターの表示倍率(弱/中/強の3段階で決まる。合体で強さが変わればティアも切り替わる)
function strengthToScale(strength) {
  return TIER_SCALE[strengthTier(strength)];
}

class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
  }

  // preload()ではなく、addBase64で明示的に非同期読み込みする
  // (Phaserのload.image()はdata: URIを直接サポートしていないため("Local data URIs are not supported"エラーになる))
  preload() {
  }

  // 強さ・階級・チームから使用するスプライトキーを決める
  // (強キャラ=騎士、中キャラ=盾兵、弱キャラ=剣士。王は兵力の値によらず専用スプライト)
  spriteKeyFor(strength, isKing, team) {
    let base;
    if (isKing) base = 'king';
    else {
      const tier = strengthTier(strength);
      base = tier === 'strong' ? 'knight' : tier === 'mid' ? 'spear_shield' : 'sword_light';
    }
    return `${base}_${team}`;
  }

  // タップ座標から最も近いユニットを探す(アイソメの菱形は縦に薄く、マス目そのままだとタップしづらいため
  // 見た目の大きさ+余白ぶんの許容範囲でユニット自体を直接判定する)
  findUnitNearPixel(x, y, opts) {
    opts = opts || {};
    let best = null, bestDist = Infinity;
    for (const u of this.units) {
      if (!u.alive) continue;
      if (opts.team && u.team !== opts.team) continue;
      if (opts.excludeKing && u.isKing) continue;
      const dx = x - u.container.x, dy = y - u.container.y;
      const dist = Math.hypot(dx, dy);
      const threshold = 16 * u.scale + 16;
      if (dist <= threshold && dist < bestDist) { bestDist = dist; best = u; }
    }
    return best;
  }

  // スプライト画像(base64)を全て読み込み終えてから本体のcreateを実行する
  create() {
    const spriteKeys = Object.keys(SPRITE_DATA);
    let loaded = 0;
    let started = false;
    const tryStart = () => {
      if (started) return;
      started = true;
      this.buildWorld();
    };

    this.textures.on('addtexture', () => {
      loaded++;
      if (loaded >= spriteKeys.length) tryStart();
    });
    this.textures.on('onerror', (key) => {
      window.__logDebug && window.__logDebug('[texture load error] ' + key);
      loaded++;
      if (loaded >= spriteKeys.length) tryStart();
    });

    spriteKeys.forEach((key) => this.textures.addBase64(key, SPRITE_DATA[key]));

    // 万一イベントが取りこぼされた場合の保険(通常は即座に発火するので数msで十分)
    this.time.delayedCall(1500, tryStart);
  }

  buildWorld() {
    this.gameOver = false;
    this.spawnCounter = 0;
    this.speedMode = 'fast';
    this.autoMoveInterval = AUTO_MOVE_INTERVAL_BASE * SPEED_PRESETS.fast;
    this.zoomMode = 'in';
    this.cameras.main.setZoom(ZOOM_PRESETS.in);
    this.showVictoryChar = true; // v4.46: 勝利キャラ表示トグルのデフォルト値(ON)

    this.graphics = this.add.graphics();
    this.drawGrid();

    // ===== 陣地の占領状況(マス単位) =====
    this.tileOwners = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    // 各マスの残りHP(v4.0)。占領されていない、または家/城壁自身のマスはnullのまま
    this.tileHp = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    this.territoryDirty = false;
    this.territoryGfx = this.add.graphics();
    this.territoryGfx.setDepth(-999);

    // ===== 地形・構造物生成 =====
    this.fences = FENCE_DEFS.map(c => this.createFence(c));
    this.walls = WALL_DEFS.map(w => this.createWall(w));
    this.houses = [];

    // ===== 石タイル(v4.14) =====
    // 城壁があったマス、および王(女王)が立っているマスは「石タイル」として、
    // 城壁が破壊された後も家を建てたり陣地として占有したりできない特別なマスにする
    this.stoneTiles = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
    WALL_DEFS.forEach(w => { this.stoneTiles[w.row][w.col] = true; });
    KING_DEFS.forEach(k => { this.stoneTiles[k.row][k.col] = true; });

    // ===== 全ユニット生成(簡易チビキャラ+武器+表情、王ユニットを含む) =====
    this.units = [...UNIT_DEFS, ...KING_DEFS].map(def => this.createUnit(def));
    // v4.0: 初期の陣地占有ロジックは廃止(ユニットの配置のみ行い、マスの所有権は持たせない)

    this.selectedUnit = null;
    this.selectedUnits = new Set(); // 複数選択モードで選ばれたユニット群(v3.19)
    this.multiSelectMode = false;   // 複数選択モードのON/OFF
    this.paused = false;
    this.gameRunning = false; // デフォルトは停止状態。開始ボタンを押すまでティックは進まない
    this.awaitingChoice = false;
    this.tickCount = 0; // 実際に処理されたゲームtick数(v3.20)。指示の有効期限をこれで数える(実時間ベースだと
                         // ゲーム未開始/一時停止/action-sheet表示中でも進んでしまい、城壁を壊している間などに
                         // 指示が意図せず早期に解除されるバグがあったため、tickベースのカウントに変更)
    this.updateHud();
    this.redrawTerritory(); // v4.38: 石タイル(城壁・王座)のグレー表示を初期表示時から反映する
    window.__jintoriaScene = this; // キャンセルボタン(DOM)からアクセスするための参照

    if (this.input.mouse) this.input.mouse.disableContextMenu();

    // ===== 入力 =====
    // ・自軍ユニットをタップ/クリック(PCは左クリック。右クリックも従来通り使用可): 一時停止してコマンドモードへ
    // ・コマンドモード中に別マスをタップ: 対象に応じた選択肢を表示
    // ・コマンドモード中に選択中ユニット自身をタップ: キャンセル
    this.input.on('pointerdown', (pointer) => {
      if (this.gameOver || this.awaitingChoice) return;

      // 複数選択モードで「指示を出す」を押した後: 対象マスのタップ待ち
      if (this.paused && this.selectedUnits.size > 0) {
        this.handleMultiCommandTarget(pointer.worldX, pointer.worldY);
        return;
      }

      if (this.paused && this.selectedUnit) {
        this.handleCommandTarget(pointer.worldX, pointer.worldY);
        return;
      }

      // PC(マウス)は左クリック(通常クリック)で反応。スマホ/タブレット(タッチ)はタップで反応
      // (右クリックも従来通り使えるように残す。leftButtonDown()はpointerdown時点では
      //  ボタン種別により信頼できない環境があるため、rightButtonDown()でないことをもって左クリック扱いする)
      if (!pointer.wasTouch && pointer.rightButtonDown()) return;

      const tappedUnit = this.findUnitNearPixel(pointer.worldX, pointer.worldY, { team: 'player', excludeKing: true });

      // 複数選択モード中: タップで選択セットへの追加/解除のみ行う(単体コマンドモードには入らない)
      if (this.multiSelectMode) {
        if (tappedUnit) this.toggleUnitSelection(tappedUnit);
        return;
      }

      if (tappedUnit) {
        this.beginCommandMode(tappedUnit);
        return;
      }

      // 自軍(王以外)以外(敵ユニット・王)は指示できないので、兵力の値だけポップアップ表示する
      const infoUnit = this.findUnitNearPixel(pointer.worldX, pointer.worldY, {});
      if (infoUnit) {
        this.showUnitValuePopup(infoUnit);
      }
    });

    // ===== 自律行動タイマー(全ユニット共通、一時停止中は進行しない) =====
    this.startAutoTimer();
  }

  // 自律行動タイマーを(再)作成する。速度変更時に既存タイマーを消して新しい間隔で作り直すために使う
  startAutoTimer() {
    if (this.autoTimer) this.autoTimer.remove();
    this.autoTimer = this.time.addEvent({
      delay: this.autoMoveInterval,
      loop: true,
      callback: () => {
        if (this.gameOver || this.paused || !this.gameRunning) return;
        this.tickCount++; // 実際に処理されたtickのみを数える(指示の有効期限判定に使用。v3.20)
        try {
          const engaged = this.resolveAdjacentBattles(); // 隣接した敵味方はここで戦闘
          this.resolveAdjacentMerges(engaged);            // 隣接した味方同士はここで自動合体
          this.resolveHouseSieges(engaged);               // 隣接した敵の家はここで攻撃
          this.resolveTerritorySieges(engaged);           // 隣接した敵領土(家なし)はここで奪う
          this.updateKingFluster();                        // 城壁攻撃が止まった王を焦り顔から戻す(v4.25)
          this.autoClaimTerritoryAroundHouses();          // 家の周囲1マスの自動占有(v4.0)
          this.houses.filter(h => h.alive).forEach(h => this.tickHouse(h)); // 家の兵士生産
          this.units.filter(u => u.alive && !engaged.has(u)).forEach(u => {
            try {
              this.tickUnit(u);
            } catch (err) {
              window.__logDebug('[tickUnit:' + u.id + '] ' + (err && err.message ? err.message : err) + (err && err.stack ? '\n' + err.stack.split('\n').slice(0,3).join('\n') : ''));
            }
          });
        } catch (err) {
          window.__logDebug('[mainLoop] ' + (err && err.message ? err.message : err));
        }
      }
    });
  }

  // 開始/停止をトグルする。デフォルトは停止状態
  toggleRun() {
    if (this.gameOver) return;
    this.gameRunning = !this.gameRunning;
    const btn = document.getElementById('run-toggle');
    if (btn) {
      btn.classList.toggle('running', this.gameRunning);
      btn.querySelector('.run-icon').textContent = this.gameRunning ? '⏸' : '▶';
      btn.querySelector('.run-label').textContent = this.gameRunning ? '停止' : '開始';
      // クリック時にポップアニメーションを再生(v5.0: 開始ボタンにアニメーション追加)
      btn.classList.remove('run-pop');
      // 強制リフローでアニメーションを再トリガーさせる
      void btn.offsetWidth;
      btn.classList.add('run-pop');
      btn.addEventListener('animationend', () => btn.classList.remove('run-pop'), { once: true });
    }
  }

  // 速度モードを切り替える('slow' | 'normal' | 'fast')。ふつうがデフォルト
  setSpeed(mode) {
    if (!SPEED_PRESETS[mode]) return;
    this.speedMode = mode;
    this.autoMoveInterval = AUTO_MOVE_INTERVAL_BASE * SPEED_PRESETS[mode];
    this.startAutoTimer();
    ['slow', 'normal', 'fast'].forEach(m => {
      const btn = document.getElementById('speed-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
  }

  // ズームモードを切り替える('out' | 'normal' | 'in')。ふつうがデフォルト
  setZoomMode(mode) {
    if (!ZOOM_PRESETS[mode]) return;
    this.zoomMode = mode;
    this.cameras.main.setZoom(ZOOM_PRESETS[mode]);
    ['out', 'normal', 'in'].forEach(m => {
      const btn = document.getElementById('zoom-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
  }

  // Phaserが毎フレーム自動的に呼ぶ。陣地の再描画はここでまとめて処理し、
  // 同一フレーム内に何度claimTileが呼ばれても実際の再描画は1回で済ませる(パフォーマンス対策)
  update() {
    // v4.41: スプライト読み込み完了(buildWorld実行)前にもPhaserがupdate()を毎フレーム呼ぶため、
    // this.unitsなど未初期化の状態でアクセスしてエラーになる不具合を修正
    if (!this.units) return;
    if (this.territoryDirty) {
      this.redrawTerritory();
      this.territoryDirty = false;
    }
    this.updateTopStrengthMarks();
  }

  // 敵味方それぞれ、現在の最大兵力を持つユニット(複数いれば全て)の右下に黄色い星マークを表示する。
  // 兵力は戦闘・合体・生産などで毎フレーム変わりうるため、位置と表示可否を毎フレーム再計算する。
  // 王(女王)は兵力が常に1固定の特殊ユニットのため、判定対象から除外する
  // (敵味方問わずユニットが全滅すると、残った王が唯一の生存ユニットとして誤って
  //  「最大兵力」判定されてしまうのを防ぐため)
  updateTopStrengthMarks() {
    const aliveUnits = this.units.filter(u => u.alive && !u.isKing);
    const maxByTeam = { player: -Infinity, enemy: -Infinity };
    aliveUnits.forEach(u => {
      if (u.strength > maxByTeam[u.team]) maxByTeam[u.team] = u.strength;
    });
    aliveUnits.forEach(u => {
      if (!u.topStarMark) return;
      const isTop = maxByTeam[u.team] > -Infinity && u.strength === maxByTeam[u.team];
      u.topStarMark.setVisible(isTop);
      if (isTop) {
        // ユニット本体(container)の右下(足元より少し右)に追従させる
        const x = u.container.x + u.container.displayWidth * 0.32;
        const y = u.container.y - u.container.displayHeight * 0.06;
        u.topStarMark.setPosition(x, y);
        u.topStarMark.setDepth(isoDepth(u.col, u.row, 9.5));
      }
    });
    // 王は判定対象外なので、万一星が付いたままになっていないか念のため非表示にしておく
    this.units.forEach(u => {
      if (u.isKing && u.topStarMark) u.topStarMark.setVisible(false);
    });
  }

  // 敵味方が隣接した(距離1)ペアを見つけて戦闘させる。同じマスに重ならなくても隣り合った時点で開戦する
  resolveAdjacentBattles() {
    const engaged = new Set();
    const alive = this.units.filter(u => u.alive && !u.moving);

    for (const u of alive) {
      if (engaged.has(u)) continue;
      const foe = alive.find(o => o.team !== u.team && !engaged.has(o) &&
        Math.abs(o.col - u.col) + Math.abs(o.row - u.row) === 1);
      if (foe) {
        // 王は動けず戦えないので、隣接した組み合わせでは必ず「防御側」として扱う
        // (王が先に見つかったことで攻撃側=勝者になってしまうのを防ぐ)
        const attacker = u.isKing ? foe : u;
        const defender = u.isKing ? u : foe;

        // 指示中のユニットは、隣接した相手が指示の目的地(攻撃対象)と一致しない限り、
        // 強制的な隣接戦闘の対象にしない(攻撃側・防御側どちらの立場でも同様)。
        // これが無いと、目的地までの経路上でたまたま隣接しただけの無関係な敵と戦わされ、
        // 勝利後にその敵がいた位置から経路を再計算することになり、結果的に遠回り
        // (例: 女王の側面の城壁に向かってしまう)になっていた。
        // なお、指示中のユニット自身の経路が実際にその敵のマスへ踏み込む場合は、
        // advanceAlongPath側の保険(defenderチェック)で通常通り戦闘になるため、
        // 経路上の敵を完全に無視して素通りできてしまうわけではない。
        const attackerBlocks = attacker.state === 'commanded' && attacker.goal &&
          !(attacker.goal.col === defender.col && attacker.goal.row === defender.row);
        const defenderBlocks = defender.state === 'commanded' && defender.goal &&
          !(defender.goal.col === attacker.col && defender.goal.row === attacker.row);
        if (attackerBlocks || defenderBlocks) continue;

        engaged.add(u);
        engaged.add(foe);
        this.setBubble(attacker, 'attack');
        if (!defender.isKing) this.setBubble(defender, 'defend');
        const isGoalTile = !!(attacker.goal && attacker.goal.col === defender.col && attacker.goal.row === defender.row);
        this.resolveBattle(attacker, defender, { col: defender.col, row: defender.row }, isGoalTile);
      }
    }

    return engaged;
  }

  // 味方同士が隣接した(距離1)、または何らかの理由で完全に重なってしまった(距離0)ペアを見つけて自動で合体させる。
  // 指示なしでも合体してよい仕様。距離0の救済は、移動タイミングの競合で稀に「合体せず重なる」不具合が
  // 起きた場合の保険(通常は移動開始時のclaimedByAllyチェックで未然に防いでいる)
  resolveAdjacentMerges(engaged) {
    const alive = this.units.filter(u => u.alive && !u.moving && !u.isKing && !engaged.has(u));

    for (const u of alive) {
      if (engaged.has(u)) continue;
      if (u.moving) continue; // v4.19: このループ内で既に合体moverとして処理され、movingになった直後のユニットを除外
      const overlapping = alive.find(o => o !== u && o.team === u.team && !engaged.has(o) && !o.moving &&
        o.col === u.col && o.row === u.row);
      const ally = overlapping || alive.find(o => o !== u && o.team === u.team && !engaged.has(o) && !o.moving &&
        Math.abs(o.col - u.col) + Math.abs(o.row - u.row) === 1);
      if (ally) {
        // どちらかが指示中(目的地あり)ならその意思を優先して「動く側」にする
        const mover = u.state === 'commanded' ? u : ally;
        const target = mover === u ? ally : u;
        // mover・target双方について、指示中(目的地あり)なら「隣接した相手がその指示の対象と一致する」
        // 場合に限り合体を許可する。指示と無関係な相手に隣接しただけでは、どちらの指示も上書きしない
        // (=指示中は基本優先度より指示を優先する)
        const moverBlocks = mover.state === 'commanded' && mover.goal &&
          !(mover.goal.col === target.col && mover.goal.row === target.row);
        const targetBlocks = target.state === 'commanded' && target.goal &&
          !(target.goal.col === mover.col && target.goal.row === mover.row);
        if (moverBlocks || targetBlocks) continue;
        // 消える側(mover)だけengagedにする。受け側(target)は同じtick内でも自分の行動ができるようにする
        // (受け側もengagedにしてしまうと、次々と新しいユニットが隣接し続けた場合に一切動けなくなるバグがあった)
        engaged.add(mover);
        this.setBubble(target, 'reinforce');
        const isGoalTile = !!(mover.goal && mover.goal.col === target.col && mover.goal.row === target.row);
        this.mergeUnits(mover, target, { col: target.col, row: target.row }, isGoalTile);
      }
    }
  }

  // 敵の家に隣接しているユニットがいれば、そこを攻撃させる(engagedに追加してその他の行動をスキップ)
  resolveHouseSieges(engaged) {
    const alive = this.units.filter(u => u.alive && !u.moving && !engaged.has(u));
    for (const u of alive) {
      const targetHouse = this.houses.find(h => h.alive && h.team !== u.team &&
        Math.abs(h.col - u.col) + Math.abs(h.row - u.row) === 1);
      if (targetHouse) {
        // 指示中のユニットは、隣接した家が指示の目的地と一致しない限り攻撃せず、指示(移動)を続ける
        if (u.state === 'commanded' && u.goal &&
            !(u.goal.col === targetHouse.col && u.goal.row === targetHouse.row)) {
          continue;
        }
        engaged.add(u);
        this.setBubble(u, 'attack');
        this.hitHouse(u, targetHouse);
        // 指示中ユニットが家を攻撃し続けている間も、指示の有効期限が切れないよう更新する
        if (u.state === 'commanded') u.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
      }
    }
  }

  // 家のない敵領土マスに隣接(斜め不可)しているユニットが、そのマスを壊して自軍領土に変える
  resolveTerritorySieges(engaged) {
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const alive = this.units.filter(u => u.alive && !u.moving && !engaged.has(u));
    for (const u of alive) {
      // 指示中のユニットは、明示的に命じられていない敵領土を自動で削らない(指示を優先する)
      if (u.state === 'commanded') continue;
      const enemyOwner = u.team === 'player' ? 'enemy' : 'player';
      for (const [dc, dr] of dirs) {
        const nc = u.col + dc, nr = u.row + dr;
        if (!inBounds(nc, nr)) continue;
        if (this.tileOwners[nr][nc] !== enemyOwner) continue;
        if (this.houses.some(h => h.alive && h.col === nc && h.row === nr)) continue; // 家は別処理(hitHouse)
        // タイルの上に敵ユニットが立っている場合は、まず戦闘を終わらせる必要がある
        // (resolveAdjacentBattlesが先に処理する。この関数はそちらでengagedにならなかった時のみ届く)
        if (this.units.some(o => o.alive && o.team !== u.team && o.col === nc && o.row === nr)) continue;
        // そのマスに家を建てられる状態なら、攻撃(HPを削る)より建築による占領を優先する。
        // ここでengagedにせず素通りすることで、この後のdecideAutoStep内の②(敵陣地に建築)に判断を譲る
        if (this.canBuildHouseAt(nc, nr, u.team)) continue;
        // v4.28: [siege]ログは記録回数に上限を設ける(無条件だとログバッファを食い尽くすため)
        if ((window.__siegeCount = (window.__siegeCount || 0) + 1) <= SIEGE_LOG_LIMIT) {
          window.__logDebug('[siege] ' + u.id + '(' + u.team + ') -> 隣接する敵タイル(' + nc + ',' + nr + ')を攻撃(建築不可: ' + this.debugWhyCantBuildHouseAt(nc, nr, u.team) + ')');
        }
        engaged.add(u);
        this.setBubble(u, 'attack');
        this.hitTerritory(u, nc, nr);
        break;
      }
    }
  }

  // 長押し/右クリックで発動:全体を一時停止し、対象マス選択待ちにする
  beginCommandMode(unit) {
    this.paused = true;
    this.units.forEach(u => u.selectRing.setVisible(false));
    this.selectedUnit = unit;
    unit.selectRing.setVisible(true);
    document.getElementById('selected-label').textContent = `ユニット${unit.id}(指示中) 兵力${this.formatStrengthDisplay(unit.strength)}`;
    document.getElementById('pause-banner').style.display = 'flex';
    this.setSpotlight(unit);
  }

  // コマンドモードを終了して再開する
  endCommandMode() {
    this.paused = false;
    if (this.selectedUnit) this.selectedUnit.selectRing.setVisible(false);
    this.selectedUnit = null;
    document.getElementById('selected-label').textContent = 'なし';
    document.getElementById('pause-banner').style.display = 'none';
    this.closeActionSheet();
    this.clearSpotlight();
  }

  // 選択中ユニット以外を少し暗くして、どのユニットに指示を出しているか一目でわかるようにする
  setSpotlight(selectedUnit) {
    this.units.forEach(u => {
      if (!u.alive) return;
      const alpha = u === selectedUnit ? 1 : 0.35;
      u.container.setAlpha(alpha);
      u.label.setAlpha(alpha);
      u.barBg.setAlpha(alpha);
      u.barFill.setAlpha(alpha);
      if (u.shadow) u.shadow.setAlpha(alpha);
    });
  }

  // スポットライト演出を解除し、全ユニットを通常の明るさに戻す
  clearSpotlight() {
    this.units.forEach(u => {
      if (!u.alive) return;
      u.container.setAlpha(1);
      u.label.setAlpha(1);
      u.barBg.setAlpha(1);
      u.barFill.setAlpha(1);
      if (u.shadow) u.shadow.setAlpha(1);
    });
  }

  // ===== 複数選択モード(v3.19) =====
  // スマホでの範囲ドラッグは操作が難しいため、「複数選択」トグルON中は
  // 自軍ユニットをタップするたびに選択セットへ追加/解除する方式にしている。

  // HUDの「複数選択」ボタンでON/OFFを切り替える
  toggleMultiSelectMode() {
    this.multiSelectMode = !this.multiSelectMode;
    const btn = document.getElementById('multi-select-toggle');
    if (btn) btn.classList.toggle('active', this.multiSelectMode);
    if (!this.multiSelectMode) {
      // モードを抜ける時は選択状態もリセットする
      if (this.paused && this.selectedUnits.size > 0) {
        this.endMultiCommandMode();
      } else {
        this.selectedUnits.forEach(u => { if (u.selectRing) u.selectRing.setVisible(false); });
        this.selectedUnits.clear();
        this.clearSpotlight();
        this.updateMultiSelectLabel();
      }
    }
  }

  // 複数選択モード中のユニットタップ: 選択セットへの追加/解除をトグルする
  toggleUnitSelection(unit) {
    if (this.selectedUnits.has(unit)) {
      this.selectedUnits.delete(unit);
      unit.selectRing.setVisible(false);
    } else {
      this.selectedUnits.add(unit);
      unit.selectRing.setVisible(true);
    }
    this.updateMultiSelectLabel();
    this.setMultiSpotlight();
  }

  // 選択数のラベル・「指示を出す」ボタンの表示を更新する
  updateMultiSelectLabel() {
    const count = this.selectedUnits.size;
    if (!this.paused) {
      document.getElementById('selected-label').textContent = count > 0 ? `${count}体選択中` : 'なし';
    }
    const issueBtn = document.getElementById('multi-issue-btn');
    const countLabel = document.getElementById('multi-select-count');
    if (countLabel) countLabel.textContent = count;
    if (issueBtn) issueBtn.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  // 選択中の複数ユニットにスポットライトを当て、それ以外を暗くする(setSpotlightの複数版)
  setMultiSpotlight() {
    if (this.selectedUnits.size === 0) { this.clearSpotlight(); return; }
    this.units.forEach(u => {
      if (!u.alive) return;
      const alpha = this.selectedUnits.has(u) ? 1 : 0.35;
      u.container.setAlpha(alpha);
      u.label.setAlpha(alpha);
      u.barBg.setAlpha(alpha);
      u.barFill.setAlpha(alpha);
      if (u.shadow) u.shadow.setAlpha(alpha);
    });
  }

  // 「指示を出す」ボタン: 選択済みユニット群に対する目的地タップ待ちに入る
  beginMultiCommandMode() {
    if (this.selectedUnits.size === 0) return;
    this.paused = true;
    document.getElementById('pause-banner').style.display = 'flex';
    document.getElementById('selected-label').textContent = `${this.selectedUnits.size}体に指示中`;
  }

  // 複数選択の指示モードを終了する(単体用のendCommandModeとは別。選択セットも解除する)
  endMultiCommandMode() {
    this.paused = false;
    this.selectedUnits.forEach(u => { if (u.selectRing) u.selectRing.setVisible(false); });
    this.selectedUnits.clear();
    document.getElementById('selected-label').textContent = 'なし';
    document.getElementById('pause-banner').style.display = 'none';
    this.closeActionSheet();
    this.clearSpotlight();
    this.updateMultiSelectLabel();
  }

  // 一時停止バナーの「✕ キャンセル」用の共通ラッパー。単体/複数どちらの指示待ち中かで分岐する
  cancelCommand() {
    if (this.selectedUnits.size > 0) {
      this.endMultiCommandMode();
    } else {
      this.endCommandMode();
    }
  }

  // 複数選択中にタップされた対象マスを判定し、選択済み全ユニットへ同じ指示を発行する
  // (単体用のhandleCommandTargetと同じ分岐ロジックを、選択セット全員に適用する版)
  handleMultiCommandTarget(x, y) {
    const units = [...this.selectedUnits];
    if (units.length === 0) { this.endMultiCommandMode(); return; }
    const source = units[0]; // 全員自軍(player)なのでチーム判定の代表として使う

    const nearUnit = this.findUnitNearPixel(x, y, {});
    const g = pixelToGrid(x, y);
    let col = g.col, row = g.row;
    if (nearUnit) { col = nearUnit.col; row = nearUnit.row; }
    if (!inBounds(col, row)) return;

    // 選択中ユニット自身(のいずれか)のマスをタップ = キャンセル
    if (units.some(u => u.col === col && u.row === row)) {
      this.endMultiCommandMode();
      return;
    }

    const enemyAtTile = this.units.find(u => u.alive && u.team !== source.team && u.col === col && u.row === row);
    const allyAtTile = this.units.find(u => u.alive && !units.includes(u) && u.team === source.team && !u.isKing && u.col === col && u.row === row);
    const enemyHouseAtTile = this.houses.find(h => h.alive && h.team !== source.team && h.col === col && h.row === row);

    if (enemyAtTile || enemyHouseAtTile) {
      this.openActionSheet(['攻撃', '待機'], (choice) => {
        if (choice === '攻撃') units.forEach(u => this.issueCommand(u, col, row, 'attack'));
        this.endMultiCommandMode();
      });
    } else if (allyAtTile) {
      this.openActionSheet(['援軍', '待機'], (choice) => {
        if (choice === '援軍') units.forEach(u => this.issueCommand(u, col, row, 'reinforce'));
        this.endMultiCommandMode();
      });
    } else {
      // v4.51: 建築可能なマスにだけ「家を作る」を出す。建てられないマスでは選択肢に出さず、
      // 誤タップで「建てられると思って移動したら建たなかった」を防ぐ
      const buildable = this.canBuildHouseAt(col, row, source.team);
      const labels = buildable ? ['家を作る', '移動', '待機'] : ['移動', '待機'];
      this.openActionSheet(labels, (choice) => {
        // 建築は複数人で指示しても実際に建つのは1軒のみ(canBuildHouseAtが2軒目以降を弾く)
        if (choice === '家を作る') units.forEach(u => this.issueCommand(u, col, row, 'build'));
        else if (choice === '移動') units.forEach(u => this.issueCommand(u, col, row, 'move'));
        this.endMultiCommandMode();
      });
    }
  }

  // 指示先のマスが「敵/敵の家/味方/空き」のどれかを判定する(クイック操作でのアイコン判定にも使用)
  classifyTarget(unit, col, row) {
    const enemyAtTile = this.units.find(u => u.alive && u.team !== unit.team && u.col === col && u.row === row);
    if (enemyAtTile) return 'attack';
    const enemyHouseAtTile = this.houses.find(h => h.alive && h.team !== unit.team && h.col === col && h.row === row);
    if (enemyHouseAtTile) return 'attack';
    const allyAtTile = this.units.find(u => u.alive && u !== unit && u.team === unit.team && !u.isKing && u.col === col && u.row === row);
    if (allyAtTile) return 'reinforce';
    return 'move';
  }

  // コマンドモード中にタップされた座標を判定し、対象に応じて分岐する
  // ・まず座標に近いユニット(敵・味方問わず)をタップ許容範囲で優先判定し、なければマス目で判定する
  handleCommandTarget(x, y) {
    const source = this.selectedUnit;

    const nearUnit = this.findUnitNearPixel(x, y, {});
    const g = pixelToGrid(x, y);
    let col = g.col, row = g.row;
    if (nearUnit) { col = nearUnit.col; row = nearUnit.row; }
    if (!inBounds(col, row)) return;

    if (col === source.col && row === source.row) {
      this.endCommandMode(); // 自分自身をタップ = キャンセル
      return;
    }

    const enemyAtTile = this.units.find(u => u.alive && u.team !== source.team && u.col === col && u.row === row);
    const allyAtTile = this.units.find(u => u.alive && u !== source && u.team === source.team && !u.isKing && u.col === col && u.row === row);
    const enemyHouseAtTile = this.houses.find(h => h.alive && h.team !== source.team && h.col === col && h.row === row);

    if (enemyAtTile || enemyHouseAtTile) {
      // 敵ユニット or 敵の家のマス: 攻撃 or 待機(何もせず取り消し)
      this.openActionSheet(['攻撃', '待機'], (choice) => {
        if (choice === '攻撃') this.issueCommand(source, col, row, 'attack');
        this.endCommandMode();
      });
    } else if (allyAtTile) {
      // 味方ユニットのマス: 援軍(合体) or 待機(何もせず取り消し)
      this.openActionSheet(['援軍', '待機'], (choice) => {
        if (choice === '援軍') this.issueCommand(source, col, row, 'reinforce');
        this.endCommandMode();
      });
    } else {
      // 空きマス(自軍の家・王のマスは実行時に弾かれる)
      // v4.51: 建築可能なマスにだけ「家を作る」を出す。建てられないマスでは選択肢に出さず、
      // 誤タップで「建てられると思って移動したら建たなかった」を防ぐ
      const buildable = this.canBuildHouseAt(col, row, source.team);
      const labels = buildable ? ['家を作る', '移動', '待機'] : ['移動', '待機'];
      this.openActionSheet(labels, (choice) => {
        if (choice === '家を作る') this.issueCommand(source, col, row, 'build');
        else if (choice === '移動') this.issueCommand(source, col, row, 'move');
        this.endCommandMode();
      });
    }
  }

  // 画面下部に選択肢ボタンを表示する
  openActionSheet(labels, onPick) {
    this.awaitingChoice = true;
    const el = document.getElementById('action-sheet');
    el.innerHTML = '';
    labels.forEach(label => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = label === '待機' ? 'wait-btn' : 'action-btn';
      btn.onclick = () => {
        this.awaitingChoice = false;
        onPick(label);
      };
      el.appendChild(btn);
    });
    el.style.display = 'flex';
  }

  closeActionSheet() {
    this.awaitingChoice = false;
    document.getElementById('action-sheet').style.display = 'none';
  }

  // 強さの階級(弱/中/強)に応じた武器パーツを作る(短剣/剣/斧)
  createWeaponParts(strength) {
    const parts = [];
    const tier = strengthTier(strength);
    if (tier === 'strong') {
      const handle = this.add.rectangle(10, 5, 3, 18, 0x6d4c41).setAngle(-15);
      const head = this.add.triangle(10, -6, 0, 0, 14, 0, 7, 16, 0xcfd8dc).setAngle(-15);
      head.setStrokeStyle(1, 0x37474f, 0.5);
      parts.push(handle, head);
    } else if (tier === 'mid') {
      const blade = this.add.rectangle(11, 0, 4, 17, 0xcfd8dc).setAngle(-25);
      const guard = this.add.rectangle(11, 8, 9, 2, 0x8d6e63).setAngle(-25);
      const hilt = this.add.rectangle(11, 11, 3, 5, 0x5d4037).setAngle(-25);
      parts.push(blade, guard, hilt);
    } else {
      const blade = this.add.rectangle(10, 3, 3, 10, 0xcfd8dc).setAngle(-30);
      const hilt = this.add.rectangle(10, 9, 4, 4, 0x6d4c41).setAngle(-30);
      parts.push(blade, hilt);
    }
    return parts;
  }

  // 王の頭上に飾る冠パーツを作る
  createCrownParts() {
    const base = this.add.rectangle(0, -23, 16, 5, 0xffd700).setStrokeStyle(1, 0x8d6e00, 0.6);
    const s1 = this.add.triangle(-5, -27, 0, 9, 6, 9, 3, 0, 0xffd700);
    const s2 = this.add.triangle(0, -29, 0, 9, 6, 9, 3, 0, 0xffd700);
    const s3 = this.add.triangle(5, -27, 0, 9, 6, 9, 3, 0, 0xffd700);
    return [base, s1, s2, s3];
  }

  // スプライト画像でキャラを配置する。強さ・階級に応じて4種のスプライト(王/騎士/盾兵/剣士)を使い分ける
  createUnit(def) {
    const pos = gridToPixel(def.col, def.row);
    const key = this.spriteKeyFor(def.strength, !!def.isKing, def.team);
    const strengthScale = (def.isKing ? KING_DISPLAY_SCALE : strengthToScale(def.strength)) * (def.isKing ? 1.25 : 1);

    const sprite = this.add.image(pos.x, pos.y + 6, key);
    sprite.setOrigin(0.5, 1); // 足元を基準点にして、どのスプライトでも地面に立っているように揃える
    const displayScale = (SPRITE_TARGET_H / sprite.height) * strengthScale;
    sprite.setScale(displayScale);

    const footY = pos.y + 6;
    const topY = footY - sprite.displayHeight;

    const label = this.add.text(pos.x, footY + 6, def.id, {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    const barW = 26, barH = 4;
    const barY = topY - 6;
    const barBg = this.add.rectangle(pos.x, barY, barW, barH, 0x000000, 0.5);
    const fillRatio = TIER_BAR_RATIO[strengthTier(def.strength)];
    const barColor = TIER_BAR_COLOR[strengthTier(def.strength)];
    const barFill = this.add.rectangle(pos.x - barW / 2, barY, barW * fillRatio, barH, barColor).setOrigin(0, 0.5);

    const flagColor = def.team === 'player' ? 0x4dd0e1 : 0xef5350;
    const markerShadow = this.add.ellipse(0, 2, 14, 5, 0x000000, 0.35);
    const markerPole = this.add.rectangle(0, 0, 2, 22, 0xf5f5f5).setOrigin(0.5, 1);
    const markerFlag = this.add.triangle(0, -22, 0, 0, 13, 4, 0, 8, flagColor).setOrigin(0, 0);
    markerFlag.setStrokeStyle(1, 0x000000, 0.35);
    const targetMarker = this.add.container(0, 0, [markerShadow, markerPole, markerFlag]);
    targetMarker.setVisible(false);
    targetMarker.setDepth(9000);

    const selectRing = this.add.ellipse(pos.x, footY - sprite.displayHeight * 0.5, sprite.displayWidth * 1.3, sprite.displayHeight * 1.15, 0x000000, 0);
    selectRing.setStrokeStyle(3, 0xffd166);
    selectRing.setVisible(false);

    const shadow = this.add.ellipse(pos.x, footY + 2, sprite.displayWidth * 0.9, sprite.displayWidth * 0.35, 0x000000, 0.35);

    // 最大兵力マーク(黄色い星)。該当ユニットのみ毎フレームvisible=trueにして表示する(位置はupdate()で追従)
    const topStarMark = this.add.star(pos.x, footY, 5, 5, 10, 0xffd700, 1).setOrigin(0.5);
    topStarMark.setStrokeStyle(1.5, 0x8a6d00, 1);
    topStarMark.setDepth(9500);
    topStarMark.setVisible(false);

    const unit = {
      id: def.id, team: def.team, strength: def.strength, scale: strengthScale, isKing: !!def.isKing,
      col: def.col, row: def.row, spriteKey: key,
      state: 'auto', path: [], goal: null, intentType: null, intentIcon: null, buildTarget: null,
      autoTarget: null, // 自動AIが「敵陣地へ接近」中に目指しているマス(一度決めたら目標を維持するため)
      autoTargetBestDist: Infinity, // 現在のautoTargetに対して、これまでに縮められた最短マンハッタン距離
      autoTargetStuckTicks: 0, // 上記の距離が縮まらないまま経過した連続tick数(往復・足踏みの検知用)
      stuckTicks: 0, // stepTowardで直進方向が塞がれ続けている連続tick数(一定を超えるまでは待って迂回しない)
      commandExpireAt: 0, // 指示の有効期限(v3.20から実時間msではなくtickCountの値を保持する)
      moving: false, alive: true, moveTargetCol: null, moveTargetRow: null,
      defeated: false, // 王のみ使用: 敗北しても消えず、泣き顔でその場に残る
      container: sprite, label, barBg, barFill, targetMarker, selectRing, shadow, topStarMark
    };

    this.updateUnitDepth(unit);

    return unit;
  }

  // ユニット本体・ラベル・バー・影などをそのマスの奥行き順に合わせて再設定する(アイソメ表示の前後関係)
  updateUnitDepth(unit) {
    this.updateUnitDepthAt(unit, unit.col, unit.row);
  }
  updateUnitDepthAt(unit, col, row) {
    const d = isoDepth(col, row, 5);
    unit.container.setDepth(d);
    unit.label.setDepth(d + 0.1);
    unit.barBg.setDepth(d + 0.1);
    unit.barFill.setDepth(d + 0.11);
    unit.selectRing.setDepth(d + 0.05);
    if (unit.shadow) unit.shadow.setDepth(isoDepth(col, row, 4));
    if (unit.intentIcon) unit.intentIcon.setDepth(d + 0.2);
  }

  // 表情差分:'calm'(穏やか) / 'focused'(臨戦・集中)を眉の角度で表現
  // スプライト画像化により眉パーツが無くなったため現在は使用していない(呼び出し箇所は残すが何もしない)
  setExpression(unit, mode) {
    // no-op
  }

  // 型ごとに変化しない時は呼び出しを省略できる薄いラッパー。毎tick同じ状態のまま
  // updateIntentIcon(=吹き出しの再生成)を呼び続けるのを防ぐための入り口(v4.48)
  setBubble(unit, type) {
    if (unit.intentType === type) return;
    this.updateIntentIcon(unit, type);
  }

  // 現在の行動を、頭上の吹き出し(背景+しっぽ+絵文字)で表示する(v4.48: モナークモナーク風に
  // 「今なにをしているか」を可視化。旧版はキャラ右上の小さな絵文字アイコンのみだった)
  updateIntentIcon(unit, type) {
    if (unit.intentIcon) {
      unit.intentIcon.destroy();
      unit.intentIcon = null;
    }
    unit.intentType = type;
    if (!type) return;

    const glyphMap = { attack: '⚔️', defend: '🛡️', reinforce: '🤝', build: '🏠', move: '➡️', idle: '💭' };
    const glyph = glyphMap[type] || '➡️';

    const bubbleW = 24, bubbleH = 20;
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 6);
    bg.fillTriangle(-4, bubbleH / 2 - 1, 4, bubbleH / 2 - 1, 0, bubbleH / 2 + 6);
    bg.lineStyle(1.5, 0x333333, 0.9);
    bg.strokeRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 6);

    const text = this.add.text(0, -1, glyph, { fontSize: '13px' }).setOrigin(0.5);

    const bubble = this.add.container(0, 0, [bg, text]);
    bubble.setScale(0);
    unit.intentIcon = bubble;
    this.updateUnitDepth(unit);
    this.syncUnitVisuals(unit);
    this.tweens.add({ targets: bubble, scale: 1, duration: 160, ease: 'Back.easeOut' });
  }

  drawGrid() {
    const order = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) order.push({ col: c, row: r });
    }
    order.sort((a, b) => (a.col + a.row) - (b.col + b.row));
    for (const t of order) {
      const pos = gridToPixel(t.col, t.row);
      const base = (t.col + t.row) % 2 === 0 ? 0x2a3444 : 0x232c3a;
      // v4.39: 低い側(敵陣)は地面ブロックを段差ぶん厚くして、崖のように繋がって見えるようにする
      const depth = ISO_GROUND_DEPTH + tileElevation(t.col);
      drawIsoBlockAbs(this.graphics, pos.x, pos.y, depth, base);
    }
    this.graphics.setDepth(-1000);
  }

  // 城壁タイルを1枚生成する(石積み風の見た目のブロック)
  createWall(def) {
    const pos = gridToPixel(def.col, def.row);
    const isTower = def.piece.indexOf('corner') !== -1; // 通常の角 + ドーム角はどちらも「塔」として高く
    // heightOverride指定時はそちらを優先(王の手前だけ低くする等の個別調整用)
    const WALL_TARGET_H = def.heightOverride != null ? def.heightOverride : (isTower ? 58 : 44); // 角=塔として高く、辺=繋ぎの城壁として少し低く
    const sprite = this.add.image(pos.x, pos.y + 6, def.piece);
    if (def.flipX) sprite.setFlipX(true);
    sprite.setOrigin(0.5, 1); // 足元(地面)基準
    const baseScale = WALL_TARGET_H / sprite.height;
    sprite.setScale(baseScale);
    const depth = isoDepth(def.col, def.row, 2);
    sprite.setDepth(depth);
    return { col: def.col, row: def.row, team: def.team, hp: WALL_HP, maxHp: WALL_HP, alive: true, gfx: sprite, baseScale };
  }

  // 城壁への攻撃(ユニットが城壁マスへ進もうとした時に呼ばれる)
  hitWall(unit, wall) {
    const dmg = TIER_DAMAGE[strengthTier(unit.strength)];
    wall.hp = Math.max(0, wall.hp - dmg);
    const pos = gridToPixel(wall.col, wall.row);
    const spark = this.add.star(pos.x, pos.y, 6, 5, 12, 0xffab40, 0.9);
    spark.setDepth(isoDepth(wall.col, wall.row, 9));
    this.tweens.add({ targets: spark, alpha: 0, scale: 1.4, duration: 250, onComplete: () => spark.destroy() });

    // 自陣の城壁が攻撃されている間、その陣営の王を「焦り顔」にする(v4.25)
    this.notifyWallUnderAttack(wall.team);

    if (wall.hp <= 0) {
      wall.alive = false;
      this.tweens.add({
        targets: wall.gfx,
        alpha: 0, scale: wall.baseScale * 0.6,
        duration: 300,
        onComplete: () => wall.gfx.destroy()
      });
    } else {
      wall.gfx.setScale(wall.baseScale * (wall.hp / wall.maxHp));
    }
  }

  // 柵タイルを1枚生成する(マップ中央を分ける柵の見た目)
  createFence(def) {
    const pos = gridToPixel(def.col, def.row);
    // 柵スプライト(通行を阻む柵として表示。常に通行不可の障害物)
    const fence = this.add.image(pos.x, pos.y + 6, 'cliff_fence');
    fence.setOrigin(0.5, 1);
    const FENCE_TARGET_H = 46;
    const baseScale = FENCE_TARGET_H / fence.height;
    fence.setScale(baseScale);
    const depth = isoDepth(def.col, def.row, 2);
    fence.setDepth(depth + 0.1);
    return { col: def.col, row: def.row, built: false, gfx: fence };
  }

  // 家を1軒生成する(屋根・壁・扉のシンプルな見た目)
  createHouse(def) {
    const pos = gridToPixel(def.col, def.row);
    const key = `house_${def.team}`;
    const HOUSE_TARGET_H = 34;
    const sprite = this.add.image(pos.x, pos.y + 6, key);
    sprite.setOrigin(0.5, 1); // 足元(地面)基準。ユニットと同じ接地ルール
    const baseScale = HOUSE_TARGET_H / sprite.height;
    sprite.setScale(baseScale);
    const depth = isoDepth(def.col, def.row, 1);
    sprite.setDepth(depth);
    // 初回生産までのtick数: 家作りで消費した兵力(cost)が多いほど短くなる(最速1〜最遅20)。
    // 例: 消費100(上限)→1tick、消費50→10tick、消費わずか→20tick付近。
    // def.costが未指定(初期配置の家など)の場合は通常間隔を使う。
    const firstSpawnDelay = def.cost != null
      ? Math.max(
          HOUSE_FIRST_SPAWN_DELAY_MIN,
          Math.min(
            HOUSE_FIRST_SPAWN_DELAY_MAX,
            Math.floor(HOUSE_FIRST_SPAWN_DELAY_MAX - (def.cost / HOUSE_LIFE_COST_CAP) * (HOUSE_FIRST_SPAWN_DELAY_MAX - HOUSE_FIRST_SPAWN_DELAY_MIN))
          )
        )
      : HOUSE_SPAWN_INTERVAL;
    return {
      col: def.col, row: def.row, team: def.team, hp: HOUSE_HP, maxHp: HOUSE_HP, alive: true,
      spawnTimer: 0, hasSpawnedOnce: false, firstSpawnDelay,
      gfx: [sprite], baseScale
    };
  }

  // 家への攻撃(ユニットが隣接、または家のマスへ進もうとした時に呼ばれる)
  // v4.0: 攻撃側の兵力消費は廃止。tier別の固定ダメージでHPを削る
  hitHouse(unit, house) {
    const dmg = TIER_DAMAGE[strengthTier(unit.strength)];
    house.hp = Math.max(0, house.hp - dmg);

    const pos = gridToPixel(house.col, house.row);
    const spark = this.add.star(pos.x, pos.y, 6, 5, 12, 0xff7043, 0.9);
    spark.setDepth(isoDepth(house.col, house.row, 9));
    this.tweens.add({ targets: spark, alpha: 0, scale: 1.4, duration: 250, onComplete: () => spark.destroy() });

    if (house.hp <= 0) {
      house.alive = false;
      // 家が全壊したら、そのマスはどちらの領土でもない空きマスに戻す
      // (家が建っていた間は建てたチームの領土として扱われていたが、
      //  破壊後もそのまま所有権を残すと不自然なため)
      this.unclaimTile(house.col, house.row);
      this.tweens.add({
        targets: house.gfx, alpha: 0, scale: house.baseScale * 0.6, duration: 300,
        onComplete: () => house.gfx.forEach(g => g.destroy())
      });
    } else {
      // 残HPがHOUSE_SHRINK_HP_THRESHOLD(50)を超えている間は満タン表示のまま、
      // 50以下になったら残HPに比例して縮んでいく
      const scaleRatio = house.hp <= HOUSE_SHRINK_HP_THRESHOLD
        ? Math.max(0.4, house.hp / HOUSE_SHRINK_HP_THRESHOLD)
        : 1;
      house.gfx.forEach(g => g.setScale(house.baseScale * scaleRatio));
    }
  }

  // 敵領土(家のない敵陣地マス)を攻撃してHPを削る。v4.0: 即座に自軍領土にはならず、
  // HPが0になったらどちらの領土でもない空きマスに戻る(再び所有者を得るには、
  // 家の周囲1マス自動占有の抽選を待つ必要がある)。攻撃側の兵力消費は廃止
  hitTerritory(unit, col, row) {
    const dmg = TIER_DAMAGE[strengthTier(unit.strength)];
    const currentHp = this.tileHp[row][col] != null ? this.tileHp[row][col] : TERRITORY_TILE_HP;
    const newHp = Math.max(0, currentHp - dmg);
    this.tileHp[row][col] = newHp;

    const pos = gridToPixel(col, row);
    const shardColor = unit.team === 'player' ? 0x1565c0 : 0xb71c1c;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const shard = this.add.rectangle(pos.x, pos.y, 8, 8, shardColor, 0.9);
      shard.setAngle(45);
      shard.setDepth(isoDepth(col, row, 9));
      this.tweens.add({
        targets: shard,
        x: pos.x + Math.cos(angle) * 22,
        y: pos.y + Math.sin(angle) * 22,
        alpha: 0,
        scale: 0.3,
        duration: 350,
        onComplete: () => shard.destroy()
      });
    }

    if (newHp <= 0) {
      this.unclaimTile(col, row);
    }
  }

  // v4.0: 家の周囲1マス(斜め含む)の自動占有。毎tick、味方の家から先に判定する。
  // 対象は「誰の領土でもない、かつ家/城壁/柵が無い普通マス」のみ。
  // マス上に敵ユニットが立っている場合は占有できない(味方ユニットが立っているのは問題ない)
  autoClaimTerritoryAroundHouses() {
    const dirs8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const teamOrder = ['player', 'enemy']; // 味方の家を先に判定する
    for (const team of teamOrder) {
      const teamHouses = this.houses.filter(h => h.alive && h.team === team);
      for (const house of teamHouses) {
        for (const [dc, dr] of dirs8) {
          const nc = house.col + dc, nr = house.row + dr;
          if (!inBounds(nc, nr)) continue;
          if (this.stoneTiles[nr][nc]) continue; // 石タイル(城壁跡地・王座)は対象外
          if (this.tileOwners[nr][nc] !== null) continue; // 既に誰かの領土のマスは対象外
          if (this.walls.some(w => w.alive && w.col === nc && w.row === nr)) continue;
          if (this.fences.some(f => !f.built && f.col === nc && f.row === nr)) continue;
          if (this.houses.some(h => h.alive && h.col === nc && h.row === nr)) continue;
          const enemyOnTile = this.units.some(o => o.alive && o.team !== team && o.col === nc && o.row === nr);
          if (enemyOnTile) continue;
          if (Math.random() < TERRITORY_AUTO_CLAIM_CHANCE) {
            this.claimTile(nc, nr, team, TERRITORY_TILE_HP);
          }
        }
      }
    }
  }

  // 家の生産tick:一定間隔で隣接する空きマスに新兵を1体生む
  tickHouse(house) {
    house.spawnTimer += 1;
    // 初回は建築時の消費兵力に応じた間隔、2回目以降は通常間隔(HOUSE_SPAWN_INTERVAL)で固定
    const threshold = house.hasSpawnedOnce ? HOUSE_SPAWN_INTERVAL : house.firstSpawnDelay;
    if (house.spawnTimer < threshold) return;
    house.spawnTimer = 0;
    house.hasSpawnedOnce = true;

    // 画面上で家の「奥・上側」に見える2方向((col,row-1)と(col-1,row))だけを候補にする。
    // このアイソメ座標系では col+row が小さいほど画面上で上に表示されるため、
    // 横や手前(下)から出てくるのを防ぎ、家の上から出てくるように見せる。
    const dirs = [[0, -1], [-1, 0]];
    Phaser.Utils.Array.Shuffle(dirs);
    for (const [dc, dr] of dirs) {
      const nc = house.col + dc, nr = house.row + dr;
      if (!inBounds(nc, nr)) continue;
      const enemyOwner = house.team === 'player' ? 'enemy' : 'player';
      if (this.tileOwners[nr][nc] === enemyOwner) continue; // 万一敵陣地になっていたら避ける(念のための保険)
      const occupied =
        this.units.some(u => u.alive && u.col === nc && u.row === nr) ||
        this.walls.some(w => w.alive && w.col === nc && w.row === nr) ||
        this.fences.some(c => !c.built && c.col === nc && c.row === nr) ||
        this.houses.some(h => h.alive && h.col === nc && h.row === nr);
      if (occupied) continue;
      this.spawnUnitAt(house, nc, nr);
      return;
    }
  }

  // 家から新しい兵士を1体生み出す(家の位置から生えてくるような出現演出つき)
  spawnUnitAt(house, col, row) {
    this.spawnCounter += 1;
    const palette = [0xffd54f, 0xa1887f, 0xce93d8, 0x90caf9, 0x80cbc4, 0xf48fb1, 0xffab91];
    const def = {
      id: `兵${this.spawnCounter}`, team: house.team, col, row,
      color: Phaser.Utils.Array.GetRandom(palette),
      strength: HOUSE_SPAWN_STRENGTH
    };
    const unit = this.createUnit(def);
    this.units.push(unit);
    this.claimTile(col, row, house.team, TERRITORY_TILE_HP);
    this.updateHud();

    // 出現演出: 家の位置からスケール0で始まり、目的マスまで伸び上がるように拡大しながら移動する
    const housePos = gridToPixel(house.col, house.row);
    const spawnOriginY = housePos.y - 6; // 屋根の少し上あたりを起点にする
    const parts = [unit.container, unit.shadow, unit.label, unit.barBg, unit.barFill];
    const endX = { c: unit.container.x, s: unit.shadow.x, l: unit.label.x, bb: unit.barBg.x, bf: unit.barFill.x };
    const endY = { c: unit.container.y, s: unit.shadow.y, l: unit.label.y, bb: unit.barBg.y, bf: unit.barFill.y };
    const endScaleX = { c: unit.container.scaleX, bf: unit.barFill.scaleX };
    const endScaleY = { c: unit.container.scaleY };

    parts.forEach(p => { p.x = housePos.x; p.y = spawnOriginY; p.alpha = 0; });
    unit.container.setScale(0.05);
    unit.barFill.setScale(0.05, 1);

    this.tweens.add({
      targets: unit.container,
      x: endX.c, y: endY.c, scaleX: endScaleX.c, scaleY: endScaleY.c, alpha: 1,
      duration: 420, ease: 'Back.easeOut'
    });
    this.tweens.add({
      targets: [unit.shadow, unit.label, unit.barBg, unit.barFill],
      alpha: 1, duration: 300, delay: 150
    });
    this.tweens.add({ targets: unit.shadow, x: endX.s, y: endY.s, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: unit.label, x: endX.l, y: endY.l, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: unit.barBg, x: endX.bb, y: endY.bb, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: unit.barFill, x: endX.bf, y: endY.bf, scaleX: endScaleX.bf, duration: 420, ease: 'Back.easeOut' });
  }

  // 指定マスに家を建てられるか判定する
  // ・柵/城壁/ユニット/王のマスには不可 ・自軍の既存の家から距離1以内(斜め含む)には不可
  // (敵の家とは隣接しても問題ないため、teamで自軍の家のみを判定対象にする)
  // v4.28: 建築可否の判定はこの1箇所に集約する。
  // 建てられる場合は null、建てられない場合はその理由の文字列を返す。
  // (以前は canBuildHouseAt と debugWhyCantBuildHouseAt に同じ条件が二重に書かれており、
  //  片方に条件を足し忘れると「建築不可なのに理由不明」というログが出てしまう状態だった)
  houseBuildBlockReason(col, row, team) {
    if (!inBounds(col, row)) return '範囲外';
    if (this.stoneTiles[row][col]) return '石タイル(城壁跡地・王座)のため不可';
    if (this.fences.some(c => !c.built && c.col === col && c.row === row)) return '柵がある';
    if (this.walls.some(w => w.alive && w.col === col && w.row === row)) return '城壁がある';
    if (this.units.some(u => u.alive && u.col === col && u.row === row)) return 'ユニットが立っている';
    // 移動中(tween実行中でまだcol/rowが更新されていない)で、まさにこのマスへ向かっているユニットが
    // いる場合も不可。これが無いと、移動完了前に別のユニットがこのマスへ家を建ててしまい、
    // 移動先に到着したユニットが家と重なって見える不具合が起きる
    if (this.units.some(u => u.alive && u.moving && u.moveTargetCol === col && u.moveTargetRow === row)) return '別のユニットが移動中(まさにこのマスへ向かっている)';
    const nearHouse = this.houses.find(h => h.alive && h.team === team && Math.max(Math.abs(h.col - col), Math.abs(h.row - row)) <= 1);
    if (nearHouse) return '自軍の既存の家(' + nearHouse.col + ',' + nearHouse.row + ')から距離1以内';
    return null;
  }

  canBuildHouseAt(col, row, team) {
    return this.houseBuildBlockReason(col, row, team) === null;
  }

  // 【デバッグ用】建築できない理由を文字列で返す(ログ調査用)
  debugWhyCantBuildHouseAt(col, row, team) {
    return this.houseBuildBlockReason(col, row, team) || '(理由不明・本来は建築可能なはず)';
  }

  // ユニットの隣接マス(斜めなし)に家を1軒建てる。建てたユニット自身はライフの半分(上限あり)を消費して生き残る
  buildHouseAdjacent(unit, col, row) {
    const cost = Math.max(1, Math.floor(Math.min(unit.strength / 2, HOUSE_LIFE_COST_CAP)));
    unit.strength = Math.max(1, unit.strength - cost);
    this.refreshAppearance(unit);

    const house = this.createHouse({ col, row, team: unit.team, cost });
    this.houses.push(house);
    this.claimTile(col, row, unit.team);

    const pos = gridToPixel(col, row);
    const spark = this.add.star(pos.x, pos.y, 5, 5, 12, 0xffd166, 0.9);
    spark.setDepth(isoDepth(col, row, 9));
    this.tweens.add({ targets: spark, alpha: 0, scale: 1.5, duration: 400, onComplete: () => spark.destroy() });

    this.updateHud();
  }

  // マスの占領者を更新し、領土の色分けを再描画する。
  // hpを指定した場合、そのマスのHPも同時に設定する(新規に「普通タイル」として占有した場合など)。
  // 家自身の足元マスなど、HP管理させたくない場合はhpを省略する
  claimTile(col, row, team, hp) {
    if (this.stoneTiles[row][col]) return; // 石タイル(城壁跡地・王座)は誰の陣地にもならない
    const alreadySameOwner = this.tileOwners[row][col] === team;
    if (alreadySameOwner && hp == null) return;
    this.tileOwners[row][col] = team;
    if (hp != null) this.tileHp[row][col] = hp;
    this.territoryDirty = true; // 実際の再描画はtickの最後にまとめて1回だけ行う(毎回全108マス再描画すると重いため)
  }

  // マスの占領者を空(未占領)に戻す。家が破壊された時や、タイルのHPが0になった時などに使う
  unclaimTile(col, row) {
    if (this.tileOwners[row][col] === null) return;
    this.tileOwners[row][col] = null;
    this.tileHp[row][col] = null;
    this.territoryDirty = true;
  }

  redrawTerritory() {
    this.territoryGfx.clear();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const owner = this.tileOwners[r][c];
        // v4.38: 城壁・王(女王)のタイルは占有率の対象外であることが分かるよう薄いグレーで塗る
        const isStone = this.stoneTiles[r][c];
        if (!owner && !isStone) continue;
        const pos = gridToPixel(c, r);
        const w2 = ISO_W / 2, h2 = ISO_H / 2;
        if (isStone) this.territoryGfx.fillStyle(0xbdbdbd, 0.30);
        else this.territoryGfx.fillStyle(owner === 'player' ? 0x1e88e5 : 0xc62828, 0.28);
        this.territoryGfx.beginPath();
        this.territoryGfx.moveTo(pos.x, pos.y - h2);
        this.territoryGfx.lineTo(pos.x + w2, pos.y);
        this.territoryGfx.lineTo(pos.x, pos.y + h2);
        this.territoryGfx.lineTo(pos.x - w2, pos.y);
        this.territoryGfx.closePath();
        this.territoryGfx.fillPath();
      }
    }
  }

  // 兵力の表示用に大きい数値を省略形にする(例: 32000 → "32k")
  formatStrengthDisplay(n) {
    if (n >= 1000) {
      const val = n / 1000;
      return (Number.isInteger(val) ? val.toFixed(0) : val.toFixed(1)) + 'k';
    }
    return String(n);
  }

  updateHud() {
    const playerStrength = this.units.filter(u => u.alive && u.team === 'player')
      .reduce((sum, u) => sum + u.strength, 0);
    const enemyStrength = this.units.filter(u => u.alive && u.team === 'enemy')
      .reduce((sum, u) => sum + u.strength, 0);
    document.getElementById('player-count').textContent = this.formatStrengthDisplay(playerStrength);
    document.getElementById('enemy-count').textContent = this.formatStrengthDisplay(enemyStrength);

    const troopTotal = playerStrength + enemyStrength;
    const playerTroopPct = troopTotal ? (playerStrength / troopTotal * 100) : 50;
    const enemyTroopPct = troopTotal ? (enemyStrength / troopTotal * 100) : 50;
    document.getElementById('bar-troops-player').style.width = playerTroopPct + '%';
    document.getElementById('bar-troops-enemy').style.width = enemyTroopPct + '%';

    let playerTiles = 0, enemyTiles = 0, total = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isFence = this.fences.some(cl => !cl.built && cl.col === c && cl.row === r);
        if (isFence) continue; // 未建設の柵は集計対象外
        if (this.stoneTiles[r][c]) continue; // v4.38: 城壁・王(女王)のタイルは占有率の対象外
        total++;
        const owner = this.tileOwners[r][c];
        if (owner === 'player') playerTiles++;
        else if (owner === 'enemy') enemyTiles++;
      }
    }
    const playerTerrPct = total ? (playerTiles / total * 100) : 0;
    const enemyTerrPct = total ? (enemyTiles / total * 100) : 0;
    document.getElementById('player-territory').textContent = Math.round(playerTerrPct) + '%';
    document.getElementById('enemy-territory').textContent = Math.round(enemyTerrPct) + '%';
    document.getElementById('bar-territory-player').style.width = playerTerrPct + '%';
    document.getElementById('bar-territory-enemy').style.width = enemyTerrPct + '%';

    if (!this.gameOver) {
      // 勝敗は「王が敗北したか(defeated)」で決まる。王は敗北しても消えず、その場に残る
      const playerKing = this.units.find(u => u.isKing && u.team === 'player');
      const enemyKing = this.units.find(u => u.isKing && u.team === 'enemy');
      if (enemyKing && enemyKing.defeated) {
        if (playerKing) this.celebrateKing(playerKing);
        this.showResult('勝利!', true);
      } else if (playerKing && playerKing.defeated) {
        if (enemyKing) this.celebrateKing(enemyKing);
        this.showResult('敗北...', false);
      }
    }
  }

  // v4.46: HUDの「勝利キャラ表示」トグル。デフォルトはON(表示する)
  toggleVictoryCharSetting() {
    this.showVictoryChar = !this.showVictoryChar;
    const btn = document.getElementById('victory-char-toggle');
    if (btn) btn.classList.toggle('active', this.showVictoryChar);
  }

  showResult(text, isVictory) {
    this.gameOver = true;
    // v4.45: 勝利時は文字バナーの代わりに、キャラクター画像のオーバーレイを表示する
    // v4.46: ただし「勝利キャラ表示」トグルがOFFの場合は、勝利時も従来通りの文字バナーにする
    if (isVictory && this.showVictoryChar) {
      const img = document.getElementById('victory-overlay-img');
      img.src = VICTORY_IMAGE;
      document.getElementById('victory-overlay').style.display = 'flex';
      return;
    }
    const banner = document.getElementById('result-banner');
    banner.textContent = text;
    banner.style.display = 'block';
  }

  selectUnit(unit) {
    this.units.forEach(u => u.selectRing.setVisible(false));
    if (this.selectedUnit === unit) {
      this.selectedUnit = null;
      document.getElementById('selected-label').textContent = 'なし';
      return;
    }
    this.selectedUnit = unit;
    unit.selectRing.setVisible(true);
    document.getElementById('selected-label').textContent = `ユニット${unit.id}`;
  }

  issueCommand(unit, col, row, intentType) {
    // 建築は指定マスそのものではなく、隣接マス(斜めなし)から行う。実際に建てる場所を別途覚えておく
    let destCol = col, destRow = row;
    unit.buildTarget = null;
    if (intentType === 'build') {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      let bestAdj = null, bestDist = Infinity;
      dirs.forEach(([dc, dr]) => {
        const ac = col + dc, ar = row + dr;
        if (!inBounds(ac, ar)) return;
        const d = Math.abs(ac - unit.col) + Math.abs(ar - unit.row);
        if (d < bestDist) { bestDist = d; bestAdj = { col: ac, row: ar }; }
      });
      if (!bestAdj) return; // 隣接マスが存在しない(通常は起こらない)
      destCol = bestAdj.col;
      destRow = bestAdj.row;
      unit.buildTarget = { col, row };
    }

    unit.state = 'commanded';
    unit.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
    unit.goal = { col: destCol, row: destRow };
    unit.path = this.buildPath(unit.col, unit.row, destCol, destRow, unit.team);

    const target = gridToPixel(col, row);
    unit.targetMarker.setPosition(target.x, target.y);
    unit.targetMarker.setVisible(true);
    unit.targetMarker.setScale(0);
    this.tweens.add({
      targets: unit.targetMarker, scale: 1, duration: 260, ease: 'Back.easeOut'
    });

    this.setExpression(unit, 'focused');
    this.updateIntentIcon(unit, intentType);
    this.spawnCommandPopup(unit.container.x, unit.container.y - unit.container.displayHeight - 10);

    // 既に隣接マスにいる場合、移動が発生しないためこの場で建築を完了させる
    // v4.52: ゲーム開始前(gameRunning=false)は他の行動がtickループ側で止まっているのに、
    // この即時建築だけはtickを経由しないため素通りしてしまい、開始前に家が建つバグがあった。
    // ここでも同様にgameRunningを確認し、開始前は保留(指示状態のまま待機させ、開始と同時に建つ)にする。
    if (intentType === 'build' && unit.path.length === 0 && this.gameRunning) {
      this.finishBuildIfReady(unit);
    }
  }

  // 建築対象マスに家を建てられれば建て、指示を完了して自律行動に戻す
  finishBuildIfReady(unit) {
    if (unit.buildTarget && this.canBuildHouseAt(unit.buildTarget.col, unit.buildTarget.row, unit.team)) {
      this.buildHouseAdjacent(unit, unit.buildTarget.col, unit.buildTarget.row);
    }
    unit.buildTarget = null;
    this.revertToAuto(unit, '建築完了');
  }

  // プレイヤーが指示を出した瞬間に「!」を表示する演出
  spawnCommandPopup(x, y) {
    const mark = this.add.text(x, y, '!', {
      fontSize: '18px', color: '#ffd166', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: mark,
      y: y - 16,
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeOut',
      onComplete: () => mark.destroy()
    });
  }

  // ユニットをタップした際に、頭上へ兵力の値を一時的にポップアップ表示する
  // (指示できない敵ユニット・王をタップした時の「値を見る」用。しばらくすると自動で消える)
  showUnitValuePopup(unit) {
    const x = unit.container.x;
    const y = unit.container.y - unit.container.displayHeight - 14;
    const labelText = `${unit.id} 兵力${this.formatStrengthDisplay(unit.strength)}`;
    const color = unit.team === 'player' ? '#4dd0e1' : '#ef5350';

    const text = this.add.text(x, y, labelText, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(10000);
    text.setStroke(color, 2);

    this.tweens.add({
      targets: text,
      y: y - 16,
      alpha: 0,
      duration: 1100,
      delay: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  // 指示状態を解除して自律行動に戻す(自軍は表情・アイコンも穏やかに戻す)
  revertToAuto(unit, reason) {
    if (unit.state === 'commanded') {
      window.__logDebug('[revert] ' + unit.id + '(' + unit.team + ') 指示解除 理由=' + (reason || '不明') +
        ' goal=' + (unit.goal ? '(' + unit.goal.col + ',' + unit.goal.row + ')' : 'なし'));
    }
    unit.state = 'auto';
    unit.goal = null;
    unit.autoTarget = null; // 指示中に古くなった自動AIの目標を引きずらないよう、復帰時にリセットする
    unit.autoTargetBestDist = Infinity;
    unit.autoTargetStuckTicks = 0;
    unit.stuckTicks = 0;
    unit.targetMarker.setVisible(false);
    if (unit.team === 'player') {
      this.setExpression(unit, 'calm');
      this.updateIntentIcon(unit, null);
    }
  }

  // ユニット1体ぶんのtick処理(待機中は優先度AIで行動、王は常に待機)
  tickUnit(unit) {
    if (unit.isKing) return; // 王は動かず・戦わず、その場に待機するのみ

    // v4.52: ゲーム開始前に隣接マスへの建築が指示された場合、issueCommand側では即時実行しない
    // (開始前に家が建ってしまうバグの対策)ため、ここでtickのたびに「建築待ちのまま止まっている
    // ユニット」を拾って完了させる。ゲーム開始後の最初のtickで確実に建つ
    if (unit.state === 'commanded' && unit.intentType === 'build' && unit.buildTarget &&
        !unit.moving && unit.path.length === 0) {
      this.finishBuildIfReady(unit);
      return;
    }

    if (unit.state === 'commanded' && this.tickCount > unit.commandExpireAt) {
      this.revertToAuto(unit, 'タイムアウト(' + COMMAND_TIMEOUT_TICKS + 'tick経過)');
    }
    if (unit.moving) return;

    if (unit.path.length === 0 && unit.state === 'auto') {
      this.decideAutoStep(unit);
    }

    this.advanceAlongPath(unit);
  }

  // 待機中ユニットの行動優先度: ⓪敵の王を囲む城壁に開いた箇所があれば最優先で王を攻撃
  // → ①隣接に未占領地があれば家を建てる → ②隣接に敵陣地があれば家を建てる(占領)
  // → ③どちらも無ければ敵陣地に近づく → ④敵陣地も無ければその場で待機
  // 敵味方どちらも同じ規則で動く。実際の戦闘・合体は移動の結果隣接した時にresolveAdjacentBattles/Mergesが処理する
  decideAutoStep(unit) {
    // v4.44: 調査完了につき通常値(24)に復帰
    window.__decCount = (window.__decCount || 0) + 1;
    const logIt = window.__decCount <= 24;

    const enemyOwner = unit.team === 'player' ? 'enemy' : 'player';

    // ⓪最優先: 敵の王を守る城壁が1箇所でも破壊されていれば、他の優先度をすべて無視して王を攻撃しに向かう
    const enemyKing = this.units.find(u => u.alive && u.isKing && u.team === enemyOwner);
    if (enemyKing) {
      const kingWalls = this.walls.filter(w => w.team === enemyOwner);
      const wallOpen = kingWalls.length > 0 && kingWalls.some(w => !w.alive);
      if (wallOpen) {
        if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ⓪王城の壁が開いている!王を最優先攻撃');
        this.setBubble(unit, 'attack');
        this.stepToward(unit, enemyKing.col, enemyKing.row);
        return;
      }
    }

    // 弱ユニット(強さ帯weak)は建築専任: 隣接に未占領地があれば無条件で建てる。
    // 中・強ユニットは、進軍の妨げにならないよう、目的地までの経路上でだけ建てる(後述③内で判定)
    const tier = strengthTier(unit.strength);
    if (tier === 'weak' && this.tryBuildAdjacent(unit, owner => owner === null)) {
      if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ①未占領地に建築(弱ユニット)');
      this.setBubble(unit, 'build');
      return;
    }

    if (this.tryBuildAdjacent(unit, owner => owner === enemyOwner)) {
      if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ②敵陣地を占領');
      this.setBubble(unit, 'build');
      return;
    }

    // ③敵陣地へ接近: 一度目標マスを決めたら、それが敵陣地でなくなる(奪還される)か
    // 到達するまでは同じ目標を目指し続ける(毎tick再計算すると、味方陣地の奥に敵が
    // 一時的に単独潜入して作った「飛び地」の方を近いと誤認し、前線と飛び地の間を
    // 何度も往復してしまう不具合があった)
    if (unit.autoTarget) {
      const { col: tc, row: tr } = unit.autoTarget;
      if (unit.col === tc && unit.row === tr) {
        unit.autoTarget = null; // 到達済み(通常はここに来る前に隣接処理で決着しているはずの保険)
      } else if (!unit.autoTargetIsKingFallback && this.tileOwners[tr][tc] !== enemyOwner) {
        unit.autoTarget = null; // 奪還されるなどして目標が無効化された場合のみ再計算する
      }
    }
    if (!unit.autoTarget) {
      unit.autoTarget = this.findNearestTileMatching(unit, owner => owner === enemyOwner);
      unit.autoTargetIsKingFallback = false;
      unit.autoTargetBestDist = Infinity;
      unit.autoTargetStuckTicks = 0;
    }
    // 敵陣地が1マスも見当たらない場合、敵の城壁・王を直接の目標にする
    // (v4.0で「歩いたら占領」を廃止したことで、序盤〜中盤は敵陣地がほぼ存在しないため)
    if (!unit.autoTarget && enemyKing) {
      unit.autoTarget = { col: enemyKing.col, row: enemyKing.row };
      unit.autoTargetIsKingFallback = true;
      unit.autoTargetBestDist = Infinity;
      unit.autoTargetStuckTicks = 0;
    }
    if (unit.autoTarget) {
      // 中・強ユニットは、目的地に近づく方向にある未占領マスに限り、ついでに建てながら進む
      // (遠回りしてまで建てにいくことはしない。弱ユニットは①で既に処理済みのためここでは行わない)
      if (tier !== 'weak' &&
          this.tryBuildAdjacent(unit, owner => owner === null, unit.autoTarget)) {
        if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ①´経路上の未占領地に建築(中・強ユニット)');
        this.setBubble(unit, 'build');
        return;
      }

      // 【一時的なデバッグ用】座標を含めて記録し、実際に前進しているか(往復していないか)を
      // ログだけで確認できるようにしている。調査が終わったら座標部分は外してよい。
      if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ③敵陣地へ接近 unit=(' + unit.col + ',' + unit.row + ') target=(' + unit.autoTarget.col + ',' + unit.autoTarget.row + ') stuck=' + unit.autoTargetStuckTicks);
      this.setBubble(unit, 'attack');

      // 目標までのマンハッタン距離が過去最短を更新できているかで、実際に前進できているかを判定する。
      // stepToward()の1マスずつの迂回だけでは解消できない行き詰まり(味方の密集で特定の2マスを
      // 機械的に往復し続けるデッドロックなど)を検知するための保険。
      const dist = Math.abs(unit.col - unit.autoTarget.col) + Math.abs(unit.row - unit.autoTarget.row);
      if (dist < unit.autoTargetBestDist) {
        unit.autoTargetBestDist = dist;
        unit.autoTargetStuckTicks = 0;
      } else {
        unit.autoTargetStuckTicks = (unit.autoTargetStuckTicks || 0) + 1;
      }

      if (unit.autoTargetStuckTicks >= AUTO_STUCK_PATHFIND_TICKS) {
        // 長時間近づけていない場合は、指示中ユニットと同じBFS経路探索(buildPath)に切り替える。
        // buildPathは味方ユニットの位置を考慮しないため、経路上に味方がいても
        // (advanceAlongPathの合体処理により)合体して通過でき、行き詰まりを解消できる。
        if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ③-保険 足踏み検知、BFS経路探索に切替');
        unit.path = this.buildPath(unit.col, unit.row, unit.autoTarget.col, unit.autoTarget.row, unit.team);
        unit.autoTargetStuckTicks = 0;
        unit.autoTargetBestDist = dist;
        return;
      }

      this.stepToward(unit, unit.autoTarget.col, unit.autoTarget.row);
      return;
    }

    if (logIt) window.__logDebug('[AI] ' + unit.id + '(' + unit.team + ') -> ④待機');
    this.setBubble(unit, 'idle');
    // 敵陣地が存在しない(ほぼ勝敗が決した状態)ため、その場で待機する
  }

  // 優先度①②の判定・処理:隣接マス(斜めなし)に条件を満たすマスがあれば、そこに家を建てる
  // targetを渡した場合(中・強ユニット用)は、隣接マスのうち目的地に近づく方向にあるものだけを対象にする。
  // 遠回りになる方向のマスを除外することで、進軍中に寄り道させない。
  // targetを省略した場合(弱ユニット用)は、隣接4マスすべてが対象。
  // (v4.28: 旧 tryBuildAdjacentOnRouteOnly を統合。差分は「距離が縮む方向か」の判定1つだけだった)
  tryBuildAdjacent(unit, ownerPredicate, target) {
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const curDist = target ? Math.abs(unit.col - target.col) + Math.abs(unit.row - target.row) : 0;
    for (const [dc, dr] of dirs) {
      const nc = unit.col + dc, nr = unit.row + dr;
      if (!inBounds(nc, nr)) continue;
      if (target && Math.abs(nc - target.col) + Math.abs(nr - target.row) >= curDist) continue;
      if (!ownerPredicate(this.tileOwners[nr][nc])) continue;
      if (!this.canBuildHouseAt(nc, nr, unit.team)) continue;
      this.buildHouseAdjacent(unit, nc, nr);
      return true;
    }
    return false;
  }

  // 条件(predicate)に合う最も近い(マンハッタン距離)マスを探す。柵・城壁・家の近く(建築不可な場所)は候補から除外。
  // さらに、周囲4マスに同条件のマスが1つも無い「孤立したマス」(敵が味方陣地の奥に単独潜入して
  // 一時的に作った飛び地である可能性が高い)は、本来の前線とは呼べないため第一候補からは除外し、
  // 孤立していないマスが1つも無い場合にのみフォールバックとして候補に含める
  findNearestTileMatching(unit, predicate) {
    const dirs4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const isCandidate = (r, c) => {
      if (!predicate(this.tileOwners[r][c])) return false;
      if (this.fences.some(cl => !cl.built && cl.col === c && cl.row === r)) return false;
      if (this.walls.some(w => w.alive && w.col === c && w.row === r)) return false;
      if (this.houses.some(h => h.alive && Math.max(Math.abs(h.col - c), Math.abs(h.row - r)) <= 1)) return false;
      return true;
    };
    const isIsolated = (r, c) => dirs4.every(([dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      if (!inBounds(nc, nr)) return true;
      return !predicate(this.tileOwners[nr][nc]);
    });

    let best = null, bestDist = Infinity;
    let bestFallback = null, bestFallbackDist = Infinity;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!isCandidate(r, c)) continue;
        const d = Math.abs(c - unit.col) + Math.abs(r - unit.row);
        if (isIsolated(r, c)) {
          if (d < bestFallbackDist) { bestFallbackDist = d; bestFallback = { col: c, row: r }; }
          continue;
        }
        if (d < bestDist) { bestDist = d; best = { col: c, row: r }; }
      }
    }
    return best || bestFallback;
  }

  // 最も近い(王以外の)生存中の味方を探す(合体先として、ユニットそのものを返す)
  // 目標マスへ1歩近づく方向を選ぶ(既存の衝突回避ロジックを踏襲)
  // exemptUnitを指定すると、そのユニットのマスだけは味方衝突回避の対象から除外する(合体対象への到達用)
  stepToward(unit, tcol, trow, exemptUnit) {
    if (unit.col === tcol && unit.row === trow) return; // 既にそのマスにいる

    const dc = sign(tcol - unit.col);
    const dr = sign(trow - unit.row);
    const isOpen = (nc, nr) => {
      if (!inBounds(nc, nr)) return false;
      const sameTeamBlock = this.units.some(u => u.alive && u !== unit && u !== exemptUnit && u.team === unit.team && u.col === nc && u.row === nr);
      if (sameTeamBlock) return false;
      const fenceBlock = this.fences.some(c2 => !c2.built && c2.col === nc && c2.row === nr);
      if (fenceBlock) return false;
      return true;
    };

    // まずは目標に最短で近づく方向(縦横)だけを試す。塞がっていてもすぐには迂回せず、
    // STEP_TOWARD_WAIT_TICKS回連続で塞がれ続けた場合のみ迂回を試みる。
    // (混雑は味方が動くことで自然に解消することが多いため、少し待つだけで直進できることが多い)
    const primary = [];
    if (dc !== 0) primary.push([dc, 0]);
    if (dr !== 0) primary.push([0, dr]);
    for (const [c, r] of primary) {
      const nc = unit.col + c, nr = unit.row + r;
      if (isOpen(nc, nr)) {
        unit.stuckTicks = 0;
        unit.path = [{ col: nc, row: nr }];
        return;
      }
    }

    unit.stuckTicks = (unit.stuckTicks || 0) + 1;
    if (unit.stuckTicks < STEP_TOWARD_WAIT_TICKS) {
      return; // まだ様子見(この場で足踏み)
    }

    // 一定tick以上待っても直進できない場合のみ、横方向への迂回を試す。
    // 迂回方向の2択(上/下または左/右)はランダムに順序を入れ替える。固定順にすると、
    // 隘路で複数tickにわたり同じ2マスの間を機械的に往復し続けるデッドロックが起きていたため
    // (例: 柵の通行可能な行の手前で、味方に阻まれるたびに同じ迂回先へ行き来してしまう)。
    // v4.47: 以前は迂回でも塞がっている場合の最終手段として「後退」(目標から離れる方向へ移動)も
    // 試していたが、これにより大量合体で前線が渋滞した際、敵の家に接近・攻撃していたユニットまで
    // 味方陣地側へ後戻りしてしまう不具合があった。後退はせず、その場で足踏みを続ける(=次のtickで
    // 密集が解消され次第、前進または迂回を再試行する)方針に変更。
    const sideways = [];
    if (dc !== 0) sideways.push(...(Math.random() < 0.5 ? [[0, 1], [0, -1]] : [[0, -1], [0, 1]]));
    if (dr !== 0) sideways.push(...(Math.random() < 0.5 ? [[1, 0], [-1, 0]] : [[-1, 0], [1, 0]]));

    for (const [c, r] of sideways) {
      const nc = unit.col + c, nr = unit.row + r;
      if (isOpen(nc, nr)) {
        unit.stuckTicks = 0;
        unit.path = [{ col: nc, row: nr }];
        return;
      }
    }
  }

  advanceAlongPath(unit) {
    if (unit.path.length === 0) return;
    const next = unit.path.shift();

    // 柵:常に通行不可
    const cliff = this.fences.find(c => !c.built && c.col === next.col && c.row === next.row);
    if (cliff) {
      unit.path = [];
      if (unit.state === 'commanded') this.revertToAuto(unit, '柵で通行不可(next=' + next.col + ',' + next.row + ')');
      return;
    }

    // 城壁:敵の城壁は破壊できるが、自陣の城壁は壊せない(通行不可のまま)
    const wall = this.walls.find(w => w.alive && w.col === next.col && w.row === next.row);
    if (wall) {
      if (wall.team === unit.team) {
        unit.path = [];
        if (unit.state === 'commanded') this.revertToAuto(unit, '自陣の城壁で通行不可(next=' + next.col + ',' + next.row + ')');
        return;
      }
      this.setBubble(unit, 'attack');
      this.hitWall(unit, wall);
      // 指示中ユニットが城壁を攻撃し続けている間は、実際に1マスも進めていなくても
      // 指示の有効期限が切れないよう更新する(でないと長時間の攻城中に指示が解除され、
      // 自動AIに切り替わって攻撃をやめてしまう不具合になる)
      if (unit.state === 'commanded') unit.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
      unit.path.unshift(next);
      return;
    }

    // 敵の家:マスの上に乗ることはできない。v4.23より、経路上でぶつかった場合は素通りせず
    // 城壁と同様にその場で攻撃してHPを削る(通常はresolveHouseSieges(隣接時の攻撃)が
    // 先に対処するためここに来ることは稀だが、経路が家を貫通している場合や、
    // 経路計算後に新しく家が建った場合などにここで攻撃する)
    const enemyHouseAtTile = this.houses.find(h => h.alive && h.team !== unit.team && h.col === next.col && h.row === next.row);
    if (enemyHouseAtTile) {
      this.setBubble(unit, 'attack');
      this.hitHouse(unit, enemyHouseAtTile);
      // 指示中ユニットが家を攻撃し続けている間は、実際に1マスも進めていなくても
      // 指示の有効期限が切れないよう更新する(城壁攻撃と同様の扱い)
      if (unit.state === 'commanded') unit.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
      unit.path.unshift(next);
      return;
    }

    // 味方の王がいるマスには誰も入れない(合体もできないため)
    const ownKingAtTile = this.units.some(u => u.alive && u.isKing && u.team === unit.team && u.col === next.col && u.row === next.row);
    if (ownKingAtTile) {
      unit.path = [];
      if (unit.state === 'commanded') this.revertToAuto(unit, '自陣の王のマスで通行不可(next=' + next.col + ',' + next.row + ')');
      return;
    }

    // 敵の占有タイル(v4.5): 城壁と同様に、敵陣地のマスは乗り越えられない。
    // 隣接から攻撃してHPを削り、0になって未占領地に戻るまでは足止めされる。
    // ただし、タイル上に敵ユニットが立っている場合は下の戦闘処理を優先する(そちらが先に決着をつける)
    const enemyOwner = unit.team === 'player' ? 'enemy' : 'player';
    if (this.tileOwners[next.row][next.col] === enemyOwner) {
      const enemyUnitHere = this.units.some(o => o.alive && o.team !== unit.team && o.col === next.col && o.row === next.row);
      if (!enemyUnitHere) {
        // v4.9: 自動AIの場合、そのマスに家を建てられる状態なら、攻撃(HPを削る)より
        // 建築による上書き占領を優先する(resolveTerritorySiegesと同じ優先順位をここにも適用)
        // v4.28: [siege]ログは以前は無条件出力だったため、ログバッファを一番食っていた。
        // [AI]ログと同じ考え方で記録回数に上限を設ける(SIEGE_LOG_LIMITを調査終了後に小さくすればよい)
        const logSiege = (window.__siegeCount = (window.__siegeCount || 0) + 1) <= SIEGE_LOG_LIMIT;
        if (unit.state === 'auto' && this.canBuildHouseAt(next.col, next.row, unit.team)) {
          if (logSiege) window.__logDebug('[siege] ' + unit.id + '(' + unit.team + ') -> 移動中に敵タイル(' + next.col + ',' + next.row + ')に建築で上書き');
          this.setBubble(unit, 'build');
          this.buildHouseAdjacent(unit, next.col, next.row);
          unit.path = []; // 建てた後は仕切り直し、次tickでdecideAutoStepに再判断させる
          return;
        }
        if (unit.state === 'auto' && logSiege) {
          window.__logDebug('[siege] ' + unit.id + '(' + unit.team + ') -> 移動中に敵タイル(' + next.col + ',' + next.row + ')を攻撃(建築不可: ' + this.debugWhyCantBuildHouseAt(next.col, next.row, unit.team) + ')');
        }
        this.setBubble(unit, 'attack');
        this.hitTerritory(unit, next.col, next.row);
        // 城壁攻撃と同様、指示中ユニットが攻撃し続けている間は指示の有効期限を更新する
        if (unit.state === 'commanded') unit.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
        unit.path.unshift(next);
        return;
      }
    }

    // 通常は隣接した時点でresolveAdjacentBattlesが先に開戦させるため、
    // ここに到達するのは稀(移動先がたまたま敵と同じマスだった場合の保険)
    const defender = this.units.find(u => u.alive && u !== unit && u.team !== unit.team && u.col === next.col && u.row === next.row);
    if (defender) {
      const isGoalTile = !!(unit.goal && unit.goal.col === next.col && unit.goal.row === next.row);
      this.resolveBattle(unit, defender, next, isGoalTile);
      return;
    }

    const ally = this.units.find(u => u.alive && u !== unit && u.team === unit.team && !u.isKing && u.col === next.col && u.row === next.row);
    if (ally) {
      const isGoalTile = !!(unit.goal && unit.goal.col === next.col && unit.goal.row === next.row);
      // 経路上でたまたま味方と重なった場合でも足踏みさせず、指示中のユニットは常に前進を優先する。
      // 合体後にどちらの指示を引き継ぐかはmergeUnits()側で判定する
      // (動いている側=moverが指示中なら、強さに関わらず必ずmoverの指示を優先して引き継ぐ)
      this.mergeUnits(unit, ally, next, isGoalTile);
      return;
    }

    // 別の味方ユニットが同じtickで既にこのマスへ移動中(見た目に到着していないだけ)の場合は、
    // このtickは足踏みして次tickに再評価する(でないと双方が同じマスへ同時に進んでしまい、
    // 「合体せずに重なる」不具合が起きる)
    const claimedByAlly = this.units.some(o => o.alive && o !== unit && o.team === unit.team && o.moving &&
      o.moveTargetCol === next.col && o.moveTargetRow === next.row);
    if (claimedByAlly) {
      unit.path.unshift(next);
      return;
    }

    // 敵ユニットが同じtickで既にこのマスへ移動中の場合も同様に足踏みする。
    // (この時点ではまだ両者ともそのマスに到着していないため、下のdefenderチェックでは
    // 検出できず、敵味方が戦闘せずに同じマスへ同時到着して重なって見える不具合があった)
    // 次tickには敵の移動が完了しu.col/rowが更新されているため、defenderチェックで正しく開戦する
    const claimedByEnemy = this.units.some(o => o.alive && o.team !== unit.team && o.moving &&
      o.moveTargetCol === next.col && o.moveTargetRow === next.row);
    if (claimedByEnemy) {
      unit.path.unshift(next);
      return;
    }

    unit.moving = true;
    unit.moveTargetCol = next.col;
    unit.moveTargetRow = next.row;
    const pos = gridToPixel(next.col, next.row);
    this.updateUnitDepthAt(unit, next.col, next.row);
    this.tweens.add({
      targets: [unit.container],
      x: pos.x, y: pos.y + 6,
      duration: this.autoMoveInterval * 0.7,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.syncUnitVisuals(unit),
      onComplete: () => {
        try {
          unit.col = next.col;
          unit.row = next.row;
          unit.moving = false;
          unit.moveTargetCol = null;
          unit.moveTargetRow = null;
          // v4.0: 「ユニットが通っただけでタイルが占領される」旧仕様は廃止。
          // タイルの所有権は家の周囲1マス自動占有(autoClaimTerritoryAroundHouses)でのみ変化する

          // v4.17: 指示中ユニットが1マス移動を完了するたびに指示の有効期限を更新する。
          // これが無いと、遠く(例: 盤面の反対側の王)への指示は、障害物が無く順調に歩いているだけでも
          // 10tickを超えた時点で指示が勝手に切れてしまう(攻撃中の延長だけではカバーできていなかった)
          if (unit.state === 'commanded') unit.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;

          if (unit.intentType === 'build' && unit.buildTarget && unit.goal && unit.col === unit.goal.col && unit.row === unit.goal.row) {
            this.finishBuildIfReady(unit);
          } else if (unit.state === 'commanded' && unit.path.length === 0) {
            this.revertToAuto(unit, '経路完了(goal到達 or 経路探索結果が空)');
          }
        } catch (err) {
          unit.moving = false;
          unit.moveTargetCol = null;
          unit.moveTargetRow = null;
          window.__logDebug('[moveComplete:' + unit.id + '] ' + (err && err.message ? err.message : err));
        }
      }
    });
  }

  // ラベル・強さバー・選択リング・目的アイコンをキャラ本体の現在位置に追従させる
  // opts.skipShadow=true にすると影の位置追従だけ行わない(ジャンプ演出で影を地面に残す用。v4.28)
  syncUnitVisuals(unit, opts) {
    // removeUnit()はselectRing/targetMarkerを即座に破棄する一方、container/label/barBg/barFill
    // はフェードアウト演出の完了後に破棄するため、削除直後〜演出完了までの間は見た目パーツの
    // 破棄状態が不揃いになる。この間にsyncUnitVisualsが呼ばれると、既に破棄済みのselectRingへ
    // setPosition()しようとしてエラーになっていた(死んだユニットの見た目を追従させる必要は
    // そもそも無いので、alive判定で早期リターンする)
    if (!unit.alive) return;
    try {
      const x = unit.container.x, footY = unit.container.y; // originが(0.5,1)なので.yは足元の位置
      const h = unit.container.displayHeight, w = unit.container.displayWidth;
      const topY = footY - h;
      unit.label.setPosition(x, footY + 6);
      unit.selectRing.setPosition(x, footY - h * 0.5);
      unit.barBg.setPosition(x, topY - 6);
      unit.barFill.setPosition(x - 13, topY - 6);
      if (unit.shadow && !(opts && opts.skipShadow)) unit.shadow.setPosition(x, footY + 2);
      if (unit.intentIcon) unit.intentIcon.setPosition(x, topY - 22); // 頭上の吹き出し(v4.48: バーの真上、しっぽが頭に向く位置)
    } catch (err) {
      if (window.__logDebug) window.__logDebug('[syncUnitVisuals:' + unit.id + '] ' + (err && err.message ? err.message : err));
    }
  }

  // 戦闘に勝ったユニットを、隣接していた相手のマスへ滑らかに進出させる
  // 王(女王)のスプライトを状態違い(通常/泣き/喜び)に切り替える
  setKingSprite(king, variant) {
    if (!king) return;
    const newKey = `king_${king.team}_${variant}`;
    king.spriteKey = newKey;
    king.container.setTexture(newKey);
  }

  // 王が敗北した時の処理: ユニットとして除去はせず、その場に残したまま泣き顔に切り替える
  // (通常の敗北処理と違い、消滅させない・攻撃側もこのマスへは進出しない)
  defeatKing(king) {
    king.defeated = true;
    king.path = [];
    if (king.flusterTween) { king.flusterTween.stop(); king.flusterTween = null; }
    king.flustering = false;
    king.container.setAngle(0);
    if (king.homeX != null) king.container.x = king.homeX; // v4.28: 揺れ途中で止まった分のズレを戻す
    this.setKingSprite(king, 'crying');
    this.mournKing(king);
  }

  // 敗北した王に、左右に軽く揺れる「シクシク泣いている」ループ演出をつける
  // (小さく左右に揺れながら、わずかに傾く。影・ラベル・バーも一緒に追従させる)
  mournKing(king) {
    if (!king) return;
    if (king.mournTween) king.mournTween.stop();
    const baseX = king.container.x;
    const sway = 4;
    king.mournTween = this.tweens.add({
      targets: king.container,
      x: baseX - sway,
      angle: -3,
      duration: 420,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => this.syncUnitVisuals(king)
    });
  }

  // 勝利した側の王を喜びスプライトに切り替え、上下にピョンピョン跳ねるループ演出をつける
  // (影は地面に残したまま少し縮ませて、ジャンプしているように見せる)
  celebrateKing(king) {
    if (!king) return;
    if (king.flusterTween) { king.flusterTween.stop(); king.flusterTween = null; }
    king.flustering = false;
    king.container.setAngle(0);
    if (king.homeX != null) king.container.x = king.homeX; // v4.28: 揺れ途中で止まった分のズレを戻す
    this.setKingSprite(king, 'joyful');

    if (king.celebrateTween) king.celebrateTween.stop();
    const groundY = king.container.y;
    const hop = 14;
    king.celebrateTween = this.tweens.add({
      targets: king.container,
      y: groundY - hop,
      duration: 260,
      ease: 'Sine.easeOut',
      yoyo: true,
      repeat: -1,
      // 影は地面に残したいので、影の位置追従だけスキップして共通処理を再利用する(v4.28)
      onUpdate: () => this.syncUnitVisuals(king, { skipShadow: true })
    });

    // v4.28: 影のtweenも変数に保持する(以前は保持しておらず、後から停止できなかった)
    if (king.celebrateShadowTween) king.celebrateShadowTween.stop();
    if (king.shadow) {
      king.celebrateShadowTween = this.tweens.add({
        targets: king.shadow,
        scaleX: 0.6, scaleY: 0.6, alpha: 0.18,
        duration: 260,
        ease: 'Sine.easeOut',
        yoyo: true,
        repeat: -1
      });
    }
  }

  // 城壁が攻撃された陣営の王を「焦り顔」に切り替え、しばらく攻撃が止まったら通常顔に戻す(v4.25)。
  // hitWall()から毎tick呼ばれる想定なので、ここでは「いつまで焦り状態を保持するか」の期限を延長するだけに留め、
  // 実際の見た目切り替え・タイマー開始は状態が変わった時だけ行う(演出の作り直しを避けるため)
  notifyWallUnderAttack(team) {
    const king = this.units.find(u => u.alive && u.isKing && u.team === team);
    if (!king || king.defeated) return; // 敗北済みの王は焦らせない(泣き顔のまま優先)
    king.flusterHoldUntilTick = this.tickCount + FLUSTER_HOLD_TICKS;
    if (!king.flustering) this.flusterKing(king);
  }

  // 城壁を攻撃されている王を「焦り顔」に切り替え、左右に小刻みに(泣き顔より速く・大きく)
  // 右往左往するようなループ演出をつける
  flusterKing(king) {
    if (!king || king.defeated) return;
    king.flustering = true;
    this.setKingSprite(king, 'flustered');

    if (king.mournTween) king.mournTween.stop();
    if (king.celebrateTween) king.celebrateTween.stop();
    if (king.flusterTween) king.flusterTween.stop();
    // v4.28: 揺れ開始前の「本来の位置」を必ず1回だけ記録しておく。
    // 以前は毎回その時点のx(=揺れ途中で止められた位置)を基準にしていたため、
    // 焦り開始→解除を繰り返すたびに王が少しずつ左へずれていく不具合があった
    if (king.homeX == null) king.homeX = king.container.x;
    const baseX = king.homeX;
    king.container.x = baseX; // 前回の揺れが途中で止まっていた場合に備え、開始時に必ず正位置へ戻す
    const sway = 10; // 泣き顔の揺れ(4px)より大きく、焦っている感じを強調
    king.flusterTween = this.tweens.add({
      targets: king.container,
      x: baseX - sway,
      angle: -6,
      duration: 180, // 揺れ速度を半分に調整(v4.26)。泣き顔の揺れ(420ms)よりは速く、せわしなく右往左往させる
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => this.syncUnitVisuals(king)
    });
  }

  // 攻撃が止まって一定tick経過した王を、焦り顔・揺れ演出から通常状態へ戻す
  stopFlusterKing(king) {
    if (!king || !king.flustering) return;
    king.flustering = false;
    if (king.flusterTween) { king.flusterTween.stop(); king.flusterTween = null; }
    king.container.setAngle(0);
    // v4.28: tweenは揺れの途中で止まるため、位置を明示的に本来の位置へ戻す(戻さないと王がずれ続ける)
    if (king.homeX != null) king.container.x = king.homeX;
    if (!king.defeated) {
      const newKey = `king_${king.team}`;
      king.spriteKey = newKey;
      king.container.setTexture(newKey);
    }
    this.syncUnitVisuals(king);
  }

  // 毎tick呼ばれ、焦り状態の保持期限(直近で城壁を攻撃されてからのtick数)が切れた王を通常状態に戻す
  updateKingFluster() {
    this.units.forEach(u => {
      if (u.alive && u.isKing && u.flustering && (u.flusterHoldUntilTick == null || this.tickCount > u.flusterHoldUntilTick)) {
        this.stopFlusterKing(u);
      }
    });
  }

  // v4.7: advanceWinnerTo()は廃止(戦闘に勝っても敵のマスへは自動進出しない仕様に変更したため)
  // 戦闘解決:強さを比較し、負けた側を除去。勝者は隣接していたそのマスへ進出する
  // isGoalTile=false(通り道での遭遇)の場合、勝者は元の指示先へ向けて移動を継続する
  // 王が防衛側の場合は強さに関係なく必ず敗北する(王は隣接されたら即敗北)
  resolveBattle(attacker, defender, tile, isGoalTile) {
    attacker.path = [];
    const pos = gridToPixel(tile.col, tile.row);

    // v4.37: 全ユニット共通の攻撃モーション(対象方向への踏み込み+フラッシュ)。
    // 王は動けず待機のみのため対象外
    if (!attacker.isKing && attacker.container && attacker.container.active) {
      const homeX = attacker.container.x, homeY = attacker.container.y;
      const lungeX = homeX + (pos.x - homeX) * 0.3;
      const lungeY = homeY + (pos.y - homeY) * 0.3;
      this.tweens.add({
        targets: attacker.container,
        x: lungeX, y: lungeY,
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeOut',
        onUpdate: () => { if (attacker.container && attacker.container.active) this.syncUnitVisuals(attacker); }
      });
      const flash = this.add.circle(homeX, homeY - 20, 18, 0xffffff, 0.9);
      flash.setDepth((attacker.container.depth || 0) + 1);
      this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 180, onComplete: () => flash.destroy() });
    }

    const burst = this.add.star(pos.x, pos.y, 8, 8, 20, 0xffd166, 0.85);
    burst.setDepth(isoDepth(tile.col, tile.row, 9));
    this.tweens.add({ targets: burst, alpha: 0, scale: 1.6, angle: 25, duration: 380, onComplete: () => burst.destroy() });

    if (defender.isKing) {
      this.defeatKing(defender);
      if (attacker.state === 'commanded') this.revertToAuto(attacker, '王を撃破し指示達成');
      this.updateHud();
      return;
    }

    if (attacker.strength === defender.strength) {
      this.removeUnit(attacker);
      this.removeUnit(defender);
    } else if (attacker.strength > defender.strength) {
      this.removeUnit(defender);
      // v4.7: 勝者は倒した敵のマスへ自動で進出しない(その場に留まる)。タイルの所有権も変更しない

      if (attacker.state === 'commanded' && attacker.goal) {
        if (isGoalTile) {
          this.revertToAuto(attacker, '目的地の敵を撃破し指示達成');
        } else {
          attacker.path = this.buildPath(attacker.col, attacker.row, attacker.goal.col, attacker.goal.row, attacker.team);
          attacker.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
        }
      }
    } else {
      this.removeUnit(attacker);
    }

    this.updateHud();
  }

  // 同じ陣営のユニット同士が合流したら1体に合体し、強さを合算する
  // 同じ陣営のユニット同士が合流したら1体に合体し、強さを合算する。
  // 指示の引き継ぎルール: 動いている側(mover)が指示中なら、強さに関わらず必ずmoverの指示を優先する
  // (経路上でたまたま味方に重なっただけで、指示をしたユニットの目的地が失われないようにするため)。
  // mover側に指示が無い場合のみ、target側の指示があればそれを引き継ぐ
  mergeUnits(mover, target, tile, isGoalTile) {
    mover.path = [];
    mover.moving = true;
    const pos = gridToPixel(tile.col, tile.row);
    this.updateUnitDepthAt(mover, tile.col, tile.row);

    // 合体前の状態を保存しておく(合体後にどちらの指示を引き継ぐか判定するため)
    const moverStrength = mover.strength;
    const targetStrength = target.strength; // 現在は指示引き継ぎの判定には使わないが、合算後の値と比較できるよう保持
    const moverHasCommand = !isGoalTile && mover.state === 'commanded' && !!mover.goal;
    const targetHasCommand = target.state === 'commanded' && !!target.goal;
    const moverCmd = { goal: mover.goal, intentType: mover.intentType, buildTarget: mover.buildTarget };
    const targetCmd = { goal: target.goal, intentType: target.intentType, buildTarget: target.buildTarget };

    // v4.18: 指示の引き継ぎは、合体アニメーション(tween)の完了を待たずにここで即座に適用する。
    // 完了を待ってしまうと、targetは合体アニメーション中も自分の行動ができる仕様のため、
    // 指示が反映される前にtarget自身が「別の合体のmover」として消費されてしまい、
    // 引き継がれるはずだった指示(例: 王への攻撃)がそのまま消えてしまう不具合があった
    let winnerCmd = null;
    if (moverHasCommand) {
      winnerCmd = moverCmd;
    } else if (targetHasCommand) {
      winnerCmd = targetCmd;
    }
    window.__logDebug('[merge] ' + mover.id + '->' + target.id + '(' + target.team + ') moverHasCommand=' + moverHasCommand +
      ' targetHasCommand=' + targetHasCommand + ' isGoalTile=' + isGoalTile +
      ' winnerGoal=' + (winnerCmd ? '(' + winnerCmd.goal.col + ',' + winnerCmd.goal.row + ')' : 'なし'));

    if (winnerCmd) {
      target.state = 'commanded';
      target.goal = winnerCmd.goal;
      target.commandExpireAt = this.tickCount + COMMAND_TIMEOUT_TICKS;
      target.buildTarget = winnerCmd.buildTarget;
      target.path = this.buildPath(target.col, target.row, winnerCmd.goal.col, winnerCmd.goal.row, target.team);
      this.setExpression(target, 'focused');
      this.updateIntentIcon(target, winnerCmd.intentType);
    }

    // v4.19: mover自身の指示フラグ(state/goal)はここで必ずクリアする。
    // moverは実際にはこのtween完了まで(見た目上は)まだ存在しており、その間に別の
    // ユニットとの合体判定にmoverが「まだ指示中」のまま拾われてしまうと、
    // 既に引き継ぎ済みの指示が別経路でもう一度(重複して)処理され、結果的に
    // 本来の引き継ぎ先(target)からも指示が失われるという不具合があった
    mover.state = 'auto';
    mover.goal = null;
    mover.buildTarget = null;

    this.tweens.add({
      targets: [mover.container],
      x: pos.x, y: pos.y + 6,
      duration: this.autoMoveInterval * 0.5,
      ease: 'Sine.easeIn',
      onComplete: () => {
       try {
        // 合体アニメーション中(このtweenが完了するまでの間)に、合体先(target)が
        // 別の戦闘などで先に撃破されている可能性がある。target.aliveを見ずに
        // target.selectRing.setSize()等を呼ぶと、破棄済みの図形オブジェクトを
        // 操作してクラッシュする(「this.geom.setPosition」エラーの実際の原因)。
        // その場合は合体自体を諦め、行き場を失ったmoverも通常の撃破演出で消す。
        if (!target.alive) {
          mover.moving = false;
          if (mover.alive) this.removeUnit(mover);
          return;
        }

        target.strength += mover.strength;
        this.refreshAppearance(target);

        // ===== 合体演出(戦闘のオレンジ系エフェクトと差別化した、目立つ緑系のリング+ポップ+加算表示) =====
        const bumpScale = target.container.scaleX * 1.3;
        this.tweens.add({
          targets: target.container,
          scaleX: bumpScale,
          scaleY: bumpScale,
          duration: 160,
          yoyo: true,
          ease: 'Back.easeOut'
        });

        const ring = this.add.circle(pos.x, pos.y, 14, 0x000000, 0).setStrokeStyle(4, 0x9ccc65, 1);
        ring.setDepth(isoDepth(tile.col, tile.row, 9));
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

        const burst = this.add.star(pos.x, pos.y, 7, 6, 15, 0xc5e1a5, 0.95);
        burst.setDepth(isoDepth(tile.col, tile.row, 9));
        this.tweens.add({ targets: burst, alpha: 0, scale: 1.8, angle: 20, duration: 350, onComplete: () => burst.destroy() });

        const gainText = this.add.text(pos.x, pos.y - 26, '+' + moverStrength, {
          fontSize: '15px', color: '#c5e1a5', fontStyle: 'bold', stroke: '#1b3a12', strokeThickness: 3
        }).setOrigin(0.5);
        gainText.setDepth(isoDepth(tile.col, tile.row, 9.5));
        this.tweens.add({
          targets: gainText, y: pos.y - 50, alpha: 0, duration: 700, ease: 'Cubic.easeOut',
          onComplete: () => gainText.destroy()
        });

        const wasSelected = (this.selectedUnit === mover);
        this.removeUnit(mover);

        if (wasSelected) {
          this.selectedUnit = target;
          target.selectRing.setVisible(true);
          document.getElementById('selected-label').textContent = `ユニット${target.id}`;
        }

        this.updateHud();
       } catch (err) {
        mover.moving = false;
        if (mover.alive) { mover.alive = false; if (mover.container) mover.container.destroy(); }
        window.__logDebug('[mergeComplete:' + mover.id + '->' + target.id + '] ' + (err && err.message ? err.message : err));
       }
      }
    });
  }

  // 強さが変わった時に武器パーツを作り直す(短剣→剣→斧の階級が変わることがあるため)
  // 強さの階級が変わった場合、王/騎士/盾兵/剣士のスプライトを差し替える(旧: 武器パーツの作り直し)
  updateSpriteForStrength(unit) {
    const newKey = this.spriteKeyFor(unit.strength, unit.isKing, unit.team);
    if (newKey !== unit.spriteKey) {
      unit.spriteKey = newKey;
      unit.container.setTexture(newKey);
    }
  }

  // 強さバーの幅と色を現在の強さに合わせて更新(確実に反映されるよう作り直す)
  refreshBar(unit) {
    const barW = 26, barH = 4;
    const fillRatio = TIER_BAR_RATIO[strengthTier(unit.strength)];
    const barColor = TIER_BAR_COLOR[strengthTier(unit.strength)];
    const x = unit.barFill.x + barW / 2;
    const y = unit.barFill.y;
    unit.barFill.destroy();
    unit.barFill = this.add.rectangle(x - barW / 2, y, barW * fillRatio, barH, barColor).setOrigin(0, 0.5);
  }

  // 強さの変化を、スプライトの階級・サイズ・バー・選択リングにまとめて反映する
  refreshAppearance(unit) {
    // 呼び出し元(特に非同期のtween完了コールバック)によっては、この時点で既に
    // ユニットが撃破・削除済み(破棄済みの図形オブジェクトを持つ)可能性があるため、
    // 念のため二重にガードしておく(主なガードはmergeUnits側で行っている)
    if (!unit.alive) return;
    unit.scale = (unit.isKing ? KING_DISPLAY_SCALE : strengthToScale(unit.strength)) * (unit.isKing ? 1.25 : 1);
    this.updateSpriteForStrength(unit);

    const displayScale = (SPRITE_TARGET_H / unit.container.height) * unit.scale;
    unit.container.setScale(displayScale);
    unit.selectRing.setSize(unit.container.displayWidth * 1.3, unit.container.displayHeight * 1.15);
    if (unit.shadow) unit.shadow.setSize(unit.container.displayWidth * 0.9, unit.container.displayWidth * 0.35);

    this.refreshBar(unit);
    this.syncUnitVisuals(unit);
  }

  // 撃破演出(小さく縮んでフェードアウト)してから各オブジェクトを破棄
  removeUnit(unit) {
    unit.alive = false;
    if (this.selectedUnit === unit) {
      this.selectedUnit = null;
      document.getElementById('selected-label').textContent = 'なし';
    }

    this.tweens.add({
      targets: unit.container,
      scale: 0,
      alpha: 0,
      angle: 90,
      duration: 260,
      ease: 'Back.easeIn',
      onComplete: () => unit.container.destroy()
    });
    this.tweens.add({
      targets: [unit.label, unit.barBg, unit.barFill],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        unit.label.destroy();
        unit.barBg.destroy();
        unit.barFill.destroy();
      }
    });
    unit.targetMarker.destroy();
    unit.selectRing.destroy();
    if (unit.shadow) unit.shadow.destroy();
    if (unit.intentIcon) unit.intentIcon.destroy();
    if (unit.topStarMark) unit.topStarMark.destroy();
  }

  // 単純な最短経路(直線的なマンハッタン移動、障害物なしのMVP版)
  // 目的地までの経路を求める(v3.20でBFSによる本格的な経路探索に変更)。
  // 旧実装は「列方向に全部動いてから行方向に全部動く」という直線移動のみで、
  // 柵(マップ中央の縦の隔たり)や自陣の城壁を一切考慮していなかった。
  // そのため row=4(自然な通路)以外の行にいるユニットが柵を越える指示を受けると、
  // 柵にぶつかった時点でpathがクリアされ指示が失われる不具合があった
  // (「中央の柵まで進むと指示を忘れる」の直接の原因)。
  // team引数を渡すと、自陣の城壁も通行不可としてルートから除外する
  // (敵の城壁は破壊しながら進めるので通行可能なマスとして扱う)。
  buildPath(fromCol, fromRow, toCol, toRow, team) {
    if (fromCol === toCol && fromRow === toRow) return [];

    const isBlocked = (c, r) => {
      if (this.fences.some(cl => !cl.built && cl.col === c && cl.row === r)) return true;
      if (team && this.walls.some(w => w.alive && w.team === team && w.col === c && w.row === r)) return true;
      // v4.23: 敵の家は、敵の城壁と同様に経路探索上は「攻撃しながら通行可能」なマスとして扱う。
      // 実際の攻撃・破壊はadvanceAlongPath側で行う。これにより、唯一の通路を敵の家が
      // 塞いでいる場合でも、経路自体は見つかり、そこへ向かって攻撃できるようになる
      // (家に重なって見える不具合はadvanceAlongPath側の攻撃処理で防止済み)
      return false;
    };

    const key = (c, r) => c + ',' + r;
    const startKey = key(fromCol, fromRow);
    const visited = new Set([startKey]);
    const cameFrom = new Map();
    const queue = [{ col: fromCol, row: fromRow }];
    let found = false;

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.col === toCol && cur.row === toRow) { found = true; break; }
      const neighbors = [
        { col: cur.col + 1, row: cur.row }, { col: cur.col - 1, row: cur.row },
        { col: cur.col, row: cur.row + 1 }, { col: cur.col, row: cur.row - 1 }
      ];
      for (const n of neighbors) {
        if (!inBounds(n.col, n.row)) continue;
        const k = key(n.col, n.row);
        if (visited.has(k)) continue;
        // 目的地マスだけは通行判定を無視する(敵ユニット・王・敵の城壁のマスにも必ず到達できるように)
        const isDest = (n.col === toCol && n.row === toRow);
        if (!isDest && isBlocked(n.col, n.row)) continue;
        visited.add(k);
        cameFrom.set(k, cur);
        queue.push(n);
      }
    }

    if (!found) {
      window.__logDebug('[buildPath] BFS失敗 from=(' + fromCol + ',' + fromRow + ') to=(' + toCol + ',' + toRow + ') team=' + team);
      // v4.22: 経路が本当に存在しない場合(例: 中央の柵の唯一の通路に敵が家を建てて完全に
      // 塞いだ場合など)、障害物を無視した直線移動は高確率でそのまま柵や家に激突し、
      // 移動不可能な指示が即座に解除されてしまう。無理に動こうとせず、その場で待機して
      // 指示自体は保持する(経路が復活すれば次回のbuildPath呼び出しで自然に動き出せる)
      return [];
    }

    const path = [];
    let cur = { col: toCol, row: toRow };
    while (!(cur.col === fromCol && cur.row === fromRow)) {
      path.unshift(cur);
      cur = cameFrom.get(key(cur.col, cur.row));
    }
    return path;
  }
}

const config = {
  type: Phaser.CANVAS, // WebGLは個別図形を大量描画するこの作りと相性が悪くクラッシュの疑いがあるため、安定性重視でCanvas2Dに固定
  parent: 'phaser-target',
  width: 800, // v4.31: GRID_COLS拡張(12→14)に合わせて720→800に拡張
  height: 560,
  backgroundColor: '#14181f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MainScene]
};

new Phaser.Game(config);
