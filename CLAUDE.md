# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際にClaude Code(claude.ai/code)へ向けたガイダンスを提供します。

## これは何か

Jintoria(陣取り) — Phaser 3(CDN読み込み、バンドラ/ビルド不要)で作られたブラウザゲーム。配布物は単一ファイルの`jintoria.html`(ユーザーが「1ファイルで動く」ことを要件としているため)だが、**編集は`src/`配下の分割ソースに対して行い、`jintoria.html`は`build.sh`で生成する**(理由は下記「ファイル構成とトークン節約」参照)。`package.json`もテストスイートも存在せず、このリポジトリは静的アセットをそのままGitHub Pagesにpushしているだけ。

デプロイ先: https://kamiten1989.github.io/publictmp/jintoria.html

## ファイル構成とトークン節約

`jintoria.html`はスプライト画像をbase64の`data:` URIとしてJS内に直接埋め込んでおり、**画像データだけで数百万文字**ある(数行だけで290万文字超)。これを普通に`Read`すると、ロジックとは無関係な画像データでコンテキストの大半を消費してしまう。そのため編集用ソースを分割してある:

- `src/game.js` — ゲームロジック本体(旧`MainScene`クラス、定数、関数など)。**普段の改修はここだけを読み書きする。** 約130KB、通常の行長のみで、画像データは含まない。
- `src/sprites_data.js` — スプライト・画像のbase64データ(`SPRITE_DATA`、`VICTORY_IMAGE`など)。新しいスプライトを追加する時以外は触らない。**このファイルは絶対に`Read`しない**(数百万文字あり、コンテキストを消費するだけで得るものがない)。追記が必要な場合はAppend的な編集(ファイル末尾付近への追記)にとどめ、既存データは触らない。
- `src/shell.html` — HTML/CSS本体(head、style、HUD等のDOM)。`<script src="sprites_data.js">`/`<script src="game.js">`でsrc内の2ファイルを読み込む形になっており、`src/`をルートにしたローカルサーバーでこのファイルを開けばビルドなしでそのまま動作確認できる。
- `build.sh` — 上記3ファイルから配布用の単一ファイル`jintoria.html`を生成する(Node/Python不要、bash+awkのみ)。**リポジトリ直下で`bash build.sh`を実行**すると`jintoria.html`が再生成される。中身は`<script src>`参照を実インライン展開したものに置き換わるだけで、`src/game.js`・`src/sprites_data.js`の内容はバイト単位でそのまま反映される。

`jintoria.html`自体も(ビルド後の生成物として)依然として巨大なので、探索・確認目的であってもこのファイルを`Read`しない。中身を見る必要があるときは`src/game.js`を読むこと。

## ワークフロー

- `src/game.js`(必要ならごく稀に`src/shell.html`)を編集する。`jintoria.html`と`src/sprites_data.js`は直接編集しない。
- 動作確認は2通り: (1) ビルド不要ですぐ試すなら、ローカル静的サーバーを`src/`直下で立てて`shell.html`を開く。(2) 配布物として確認したいなら`bash build.sh`を実行してから`jintoria.html`を開く。
- **変更を完了とみなす前に必ずJS構文を確認する**: `src/game.js`(必要なら`src/sprites_data.js`も)に対して`node --check`を実行する。ロジックが独立ファイルになったため、以前のようにHTML全体から抽出する手間は不要。ただし本リポジトリの開発環境にNode.jsが入っていないことがある(未確認ならまず`node --version`で確認し、無ければその旨を伝えて他の方法(ブラウザで実際に開いてコンソール/画面上デバッグログを確認する等)で代替する)。
- **変更のたびに(バグ修正でも機能追加でも)バージョン表示をインクリメントする**: `src/shell.html`内の`<span id="version-label">Jintoria v5.0</span>`(ビルド後は`jintoria.html`側426行目付近にも反映される)。ユーザー/テスターがデプロイの反映を確認できる唯一の手段であるため(ブラウザキャッシュがあるためURLだけでは確認にならない)、確認を依頼する際はキャッシュ対策(`?v=`付与、強制リロード)にも言及すること。
- **`bash build.sh`を実行して`jintoria.html`を最新化してから**コミット/デプロイの準備をする(`jintoria.html`は生成物だが、GitHub Pagesがこのファイルを直接配信するためリポジトリにコミットして残す)。
- デプロイ(`main`へのgit push)はClaudeではなくユーザー側の作業 — GitHub Pagesはリポジトリから直接配信される。
- `HANDOFF.md`はセッション間の引き継ぎメモ(日本語)— 作業再開時にまず読み、セッション終了時には変更内容・未対応事項・関連コードの場所を更新すること。

## アーキテクチャ(すべて`src/game.js`内)

- **`MainScene extends Phaser.Scene`**がゲーム全体 — セットアップ、ゲームループ、入力処理、戦闘/AIロジックをすべてメソッドとして持つ1つの巨大なクラス。モジュール/ファイル分割はされていないため、このクラス内をメソッド名で辿って探すこと。
- **座標系**: アイソメトリック(等角投影)グリッド。`gridToPixel()` / `pixelToGrid()`がグリッド座標と画面座標を相互変換する。`isoDepth()` / `tileElevation()` / `drawIsoBlockAbs()`がアイソメ描画/重なり順(z-order)を担当。
- **戦闘/経済関連の定数**はスクリプト冒頭付近: `WALL_HP`、`HOUSE_HP`、`TERRITORY_TILE_HP`、`TIER_DAMAGE`(`strengthTier()`によるユニット強さ帯ごとの1tickあたりダメージ)。
- **tickごとのループ**: `update()`が`startAutoTimer()`を駆動し、各tickで`tickUnit()`(`decideAutoStep()`による自律的なユニット行動、`stepToward()`/`advanceAlongPath()`による移動)、`tickHouse()`(ユニット生産)、および`resolve*`系(`resolveAdjacentBattles`、`resolveAdjacentMerges`、`resolveHouseSieges`、`resolveTerritorySieges`)がタイル/戦闘の解決を行う。
- **プレイヤーのコマンドフロー**: `beginCommandMode()`/`beginMultiCommandMode()` → `handleCommandTarget()`/`handleMultiCommandTarget()` → `issueCommand()`。手動コマンドは後で`revertToAuto()`によりAI制御へ戻される。
- **陣地(territory)**: `claimTile()`/`unclaimTile()`/`redrawTerritory()`。各キングの周囲の基本城壁は`ringWallDefs()`で自動生成される。
- **スプライト**: base64埋め込みで、`spriteKeyFor()`により`strength`/チーム/ユニット種別をキーとして管理し、`preload()`で読み込む。敵側のスプライトはプレイヤー側のスプライトから、B(青) > R(赤)の画素だけRとBを入れ替えることで生成している(`HANDOFF.md`に記載)— 新ユニット追加時もこのルールを踏襲すること。
- **画面上デバッグログ**(`window.__logDebug`、最初の小さな`<script>`ブロックの冒頭): iOS Safariではテスターがコンソールにアクセスできないため、未捕捉のエラー/rejectionを固定サイズのバッファに記録し、パネルに表示する。バッファサイズは現在、一時的なデバッグ用の変更が入っている(該当ブロック冒頭のコメント参照) — 特に指示がなければ、その調査が終わり次第40行に戻すこと。
