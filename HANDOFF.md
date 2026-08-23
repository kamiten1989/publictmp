# Jintoria 開発引き継ぎメモ(2026-08-23時点)

## 現在のバージョン
**v6.1**
デプロイ先: https://kamiten1989.github.io/publictmp/jintoria.html(必ずバージョン表示で確認。ブラウザキャッシュに注意し`?v=`付与や強制リロードを案内すること)

※このメモはしばらくv5.2止まりで更新されていなかった(実コードはv6.0まで進んでいた)。以後、毎セッション末に必ずここを更新すること。

## 今回セッションでやったこと(速度操作を「モナークモナーク」風の無段階ゲージ化)
ユーザーからの依頼: ゲーム仕様をファルコムの「モナークモナーク」(陣取り型リアルタイムSLG)に寄せたい、まずUI/操作フローから。Web検索で調べた結果(公式サイト・攻略サイトへの直接アクセスは本環境のegressプロキシでブロックされたため検索結果の要約ベース)、モナークモナークには速度をクリック/ドラッグで無段階(超ゆっくり〜超速い)に調整できるゲージがあることが分かり、まずここから着手することにした。

### 変更内容
- `src/game.js`:
  - 従来の3段階`SPEED_PRESETS = { slow: 2.0, normal: 1.0, fast: 0.5 }` + `setSpeed(mode)`を廃止。
  - 0(超ゆっくり)〜100(超速く)のスライダー値を指数補間で倍率に変換する`speedFactorFromValue(value)`と、それを適用する`setSpeedValue(value)`を追加(`SPEED_FACTOR_AT_MIN=2.5`〜`SPEED_FACTOR_AT_MAX=0.15`、デフォルト`SPEED_DEFAULT_VALUE=60`で旧デフォルト`fast`相当に近似)。
  - `this.speedMode`→`this.speedValue`に置き換え。
- `src/ui.jsx`:
  - `SettingsPanel`内の3ボタン(`#speed-slow/normal/fast`)を`<input type="range">`1本(`#speed-gauge`)+ラベル(`#speed-gauge-label`、5段階の日本語ラベルに丸める`speedValueLabel()`)の`SpeedGauge`コンポーネントに置き換え。
  - `setSpeedMode`→`setSpeedValue`、ストアの`speedMode`→`speedValue`に変更。
  - バージョン表示 v6.0 → **v6.1**。
- `src/shell.html`: `#speed-controls`のCSSをボタン列からスライダー用(`#speed-gauge`, `#speed-gauge-label`)に置き換え。

### 検証状況(重要: 今回はブラウザ実機/ヘッドレス確認が「できなかった」)
- `node --check src/game.js`: OK。
- `bash build.sh`: OK(`jintoria.html`再生成済み)。
- **ブラウザでの動作確認は未実施**: 本セッションの実行環境ではネットワークegressプロキシがCDN(`cdnjs.cloudflare.com`, `unpkg.com`)への接続を`ERR_TUNNEL_CONNECTION_FAILED`/403でブロックしており、`shell.html`がPhaser/React/ReactDOM/Babelを読み込めず、Playwright(ヘッドレスChromium)でも`Phaser is not defined`で落ちて検証できなかった。速度カーブの数式(`speedFactorFromValue`相当のロジック)はNode上で単体で計算し、0→3500ms(超ゆっくり)、60→647ms(旧fast相当に近い)、100→210ms(超速く)と単調減少になることのみ確認済み。
- 次回以降、CDNへ到達できる環境(ローカルPC等)で必ず実機/ヘッドレス確認を行うこと: 設定パネルを開き、ゲージをドラッグ/クリックして`speed-gauge-label`の表示切替とtick速度の体感変化を確認する。

## 前回セッションでやったこと(HUD/UIをReact化。案A: Phaser盤面は無改修、周辺UIだけ本格的にReact管理へ移行)
ユーザーからの依頼: 「jintoriaをReactに移行したらどのくらいの修正量になるか」の見積もり → Phaserの盤面(戦闘/AI/isometric描画/tickループ)はそのまま残し、HUD・アクションシート・各種バナー・デバッグログパネルなどの周辺DOM UIだけをReactで宣言的に管理する「案A」を採用し実装した。

### アーキテクチャ
- 新規ファイル `src/ui.jsx` を追加。JSXで`<GameUI/>`ツリーを組み、`ReactDOM.createRoot(...).render()`(`ReactDOM.flushSync`で同期化、詳細は下記「ハマった点」参照)でマウントする。
- 自前の最小ストア(`createStore`/`useSyncExternalStore`)でHUD状態を保持。`game.js`からは`window.__jintoriaUI.{setHud, setSelectedLabel, setPauseBannerVisible, setMultiSelectActive, setMultiSelectCount, setRunState, setSpeedMode, setZoomMode, setVictoryCharActive, showActionSheet, closeActionSheet, showResultBanner, showVictoryOverlay, hideVictoryOverlay}`という橋渡しAPIを呼ぶだけにした(`document.getElementById`によるDOM直接操作は`game.js`から全廃)。
- `game.js`側の盤面ロジック(戦闘解決・AI・経路探索・isometric描画・tickループ)は無改修。DOM結合部だった15メソッド・約35箇所のみ橋渡し呼び出しに置き換えた。
- Reactは実行時にBabel standalone(CDN)でJSXをトランスパイルする方式(ビルド不要方針を維持)。`build.sh`は`sprites_data.js`/`game.js`と同じパターンで`src/ui.jsx`も`<script type="text/babel">`としてインライン化するよう拡張済み。
- Phaserのcanvasは、Reactが二度と中身を再レンダリングしない専用の空div`#phaser-mount`(`#phaser-target`の子、他のオーバーレイ要素とは兄弟)に追加するよう`config.parent`を変更。React管理下のDOM木とPhaserが直接操作するDOM木を明確に分離した。

### ハマった点(重要・今後同種の変更をする時のために残す)
1. **`<script type="text/babel">`は非同期処理される**: Babel standaloneはこのタグをHTMLパーサの通常のスクリプト実行タイミングでは処理しない(ブラウザは`type`が未知のMIMEなので単に無視して次のタグへ進む)。実際の変換・実行はBabel側が別途(DOMContentLoaded等のタイミングで)行うため、後続の`<script src="game.js">`のほうが先に実行されることがある。そのため`game.js`末尾の`new Phaser.Game(config)`は、`window.__jintoriaUIReady`フラグ+`'jintoria-ui-ready'`イベントでReact側のマウント完了を待ってから実行するようにした。
2. **`ReactDOM.createRoot(...).render()`は必ずしも同期コミットではない**: トップレベルの`<script>`から呼んだ場合、React 18のスケジューラの都合でDOM反映が次のタスク/マイクロタスクまで遅延することが実機検証で判明した(`root.render()`直後に`document.getElementById('phaser-mount')`を呼んでも`null`だった)。`ReactDOM.flushSync(() => root.render(<GameUI/>))`で初回コミットを強制同期化することで解決した。この2点により、`new Phaser.Game()`実行時点で`#phaser-mount`が確実に存在し、canvasが正しくその中に追加されることを、ヘッドレスChrome(CDP)での実機検証で確認済み。
3. デバッグログ(`window.__logDebug`)は、Reactマウント前(ページ読み込み直後)からエラーを拾う必要があるため、バッファ管理はshell.html冒頭の生JSブロックに残し、パネル表示側だけReact化(購読リスト`window.__notifyDebugLog`経由)した。

### 検証方法・結果
- `node --check`で`src/game.js`の構文確認: OK(Node.jsは`C:\Program Files\nodejs\node.exe`にあるがPATH未設定、フルパス指定が必要)。
- `src/ui.jsx`はJSXのため`node --check`不可。`npx babel`(preset-react)でトランスパイル→`node --check`で確認: OK。
- ヘッドレスChrome(`--headless=new --remote-debugging-port`)+CDP(Node組み込みWebSocketで自前スクリプト)で実際にDOM操作・クリックをシミュレートして検証:
  - ユニット選択(`beginCommandMode`)→選択中ラベル・一時停止バナー表示→`cancelCommand`で解除、まで正常
  - `openActionSheet`→実際のボタンDOM生成→実クリック→`onPick`発火→バナー/シート閉じる、まで正常
  - 開始/停止ボタン(アイコン・ラベル切替+`run-pop`アニメーションクラス)正常
  - 複数選択トグル・設定パネル開閉・速度切替・デバッグログ記録→パネル表示、いずれも正常
  - コンソールエラーなし(Phaserバナー・Babel devモード通知のみ)
  - `bash build.sh`で生成した`jintoria.html`単体でも同様に動作確認済み(`#phaser-mount`内にcanvasが正しくネストされ、HUDに実データが反映されることを確認)
- 未実施: 実ブラウザ(PC/スマホ実機)での目視確認、勝敗成立時の結果バナー/勝利オーバーレイの実地確認、長時間プレイでのメモリリーク等

## 前々回セッションでやったこと(PCブラウザで左クリックがユニット選択に反応しないバグ修正)
- 症状: PCブラウザでユニットを(左)クリックしても指示を出す画面(コマンドモード)にならない。スマホでは問題なかった。
- 原因: `src/game.js`の`pointerdown`ハンドラで、タッチ以外(PC)は`pointer.rightButtonDown()`(右クリック)のみを受け付ける実装になっており、通常の左クリックが無視されていた(`if (!pointer.wasTouch && !pointer.rightButtonDown()) return;`)。
- 修正: 条件を反転し、PCでは右クリックの場合のみ早期returnするように変更(`if (!pointer.wasTouch && pointer.rightButtonDown()) return;`)。結果、PCでは左クリックでコマンドモードに入れるようになった(右クリックも従来通り動作)。
- 対象箇所: `src/game.js`内、`create()`メソッド内の`this.input.on('pointerdown', ...)`ハンドラ(300行目付近)。
- バージョン表示を v5.0 → **v5.1** に更新。
- `bash build.sh`で`jintoria.html`再生成済み。Node.js未インストール環境だったため`node --check`は未実施(目視確認のみ)。

## 前回セッションでやったこと(開始ボタンのアニメーション追加)
- `#run-toggle`(開始/停止ボタン)にCSSアニメーションを3種追加。
  1. `runIdlePulse`: 未開始の間、ボタンが呼吸するように拡縮+光の輪が広がる誘導アニメーション(常時ループ)。
  2. `runPop`: クリックした瞬間に拡大→縮小→戻るポップ演出(`toggleRun()`内でJSからクラス付与、`animationend`で自動除去)。
  3. `runIconSpin`: ▶→⏸に切り替わる瞬間、アイコンが回転しながらフェードインする演出。
- 実行中(`.running`クラス付与時)は`runIdlePulse`を`animation: none`で停止し、誘導演出が邪魔にならないようにした。
- バージョン表示を v4.56 → v4.57 → **v5.0** に更新(ユーザー指示によりメジャーバージョンをv5に繰り上げ)。
- `node --check`でJS構文チェック済み(OK)。

### 実装箇所メモ
- CSS: `#run-toggle` 周辺のスタイル定義ブロック(`@keyframes runIdlePulse` / `runPop` / `runIconSpin` を追加)。
- JS: `toggleRun()`メソッド内(`Scene`クラス、`main3.js`相当のインラインscript)。クリック時に`run-pop`クラスを一旦removeしてから`void btn.offsetWidth`で強制リフローし、再度addすることでアニメーションを毎回再トリガーしている。

## 主要ファイル・作業パス
- 出力HTML: `/mnt/user-data/outputs/jintoria.html`(単一HTMLファイルにゲーム本体JS・CSS・スプライトのbase64がすべて内包)
- 過去セッションでは `/home/claude/main3.js` を分離ファイルとして使うこともあったが、今回はHTML内インラインscriptを直接編集した
- 敵スプライト生成ルール: **B>Rの画素のみRとBを入れ替える**(既存の全キャラ・建物スプライトで統一使用中)

## 動作確認・デプロイ手順(毎回)
1. `node --check` でJS構文チェック。`src/game.js`はそのままcheck可能。`src/ui.jsx`はJSXなので`npx -p @babel/core -p @babel/cli -p @babel/preset-react babel src/ui.jsx --presets=@babel/preset-react -o <tmp>.js`でトランスパイルしてから`node --check`する(Windows環境ではnodeがPATH未設定のことがあり、`C:\Program Files\nodejs\node.exe`のフルパス指定が必要な場合あり)。
2. 実機確認(このセッションで確立した方法): `src/`をルートに`npx http-server`等でローカルサーバーを立て、ヘッドレスChrome(`chrome.exe --headless=new --remote-debugging-port=<port> --user-data-dir=<tmp>`)を起動し、Node組み込みの`WebSocket`でCDP(`Runtime.evaluate`等)に接続してDOM状態の確認・クリックシミュレートができる。`--dump-dom`だけでも初期表示・コンソールエラーの簡易確認は可能。
3. バージョン表示を必ずインクリメント(ユーザールール:バグ修正・機能追加のたびに版数を上げる)。React化以降、バージョン表示は`src/shell.html`ではなく`src/ui.jsx`内(`<span id="version-label">`)にある点に注意。
4. GitHub Pages (`kamiten1989/publictmp`)へのpush/コミットはユーザー側作業。反映確認は「ページ内バージョン表示」で行う(ブラウザキャッシュに注意、`?v=` 付与や強制リロードを案内すること)

## 未対応・持ち越し事項
-2. **速度ゲージ(v6.1)のブラウザ実機確認**、未実施(本セッションの実行環境ではCDN egressがブロックされておりPhaser/React自体を読み込めなかったため)。ゲージのドラッグ/クリック操作感、ラベル切替、tick速度の体感変化を確認すること。またこれは「モナークモナークにUI/操作フローを寄せる」取り組みの第一歩に過ぎず、ALL/INIT(新兵への初期命令)やドラッグによる範囲選択などが未着手として残っている(ユーザーと合意した進め方はセッション冒頭のやり取り参照)。
-1. **今回のReact化のブラウザ実機確認**、未実施(ヘッドレスChrome+CDPでの機能検証は済んでいるが、PC/スマホの実ブラウザでの目視確認・勝敗成立時のオーバーレイ確認は未実施)
0. **左クリック修正(v5.1)のブラウザ実機確認**、未実施(PC/スマホ両方でクリック・タップ・右クリックの動作確認が望ましい)
1. **開始ボタンアニメーションのブラウザ実機確認**、未実施(ヘッドレスChromeでの見た目チェックが望ましい)
2. **木のスプライト追加・HP20の障害物として実装**(以前のセッションで着手予定だったが未完了。ユーザーがGeminiで生成した木の画像`IMG_7844.PNG`をアップロード済みだったが、この作業自体はまだ実施できていない。次回、敵陣・味方陣地に試験配置するところから再開)
3. **v4.48 吹き出し(🤝🛡️)の位置・密度・タイミング**の視覚検証、未実施
4. **渋滞時の撤退バグ(v4.47修正)**、大規模合流シナリオでの動作再確認、未実施
5. **攻撃モーションスプライト不足**:knight/spear_shield/sword_lightの`_attack`系スプライトが無い
6. **ゲームバランス確認**:壁HP200、家HP100、タイルHP30、自動占有15%、家の生産間隔20tick(妥当性は未検証)

## 技術メモ(継続情報)
- スプライトキー命名: `keyname: "data:image/png;base64,<BASE64>"`
- グリッド: 14列(v4.31で12→14に拡張)
- 王の周囲城壁は`ringWallDefs()`で3x3の8マスを自動生成、角=ドーム/辺=壁
- 段差(自陣/敵陣の境目, `FENCE_COL`)、王手前の壁だけ低くする仕様あり(king上半身が見えるように)
- アイソメ変換は `gridToPixel()` / `pixelToGrid()`
- 城壁HP: `WALL_HP = 200`、家HP: `HOUSE_HP = 100`、通常タイルHP: `TERRITORY_TILE_HP = 30`
- ダメージ量: `TIER_DAMAGE = { weak: 10, mid: 20, strong: 50 }`(ユニット強さ帯ごとに1tickで削るHP量)
