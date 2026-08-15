# Jintoria 開発引き継ぎメモ(2026-08-15更新)

## 現在のバージョン
**v4.7**(このセッションではファイル分割のみ実施。ゲームロジック・見た目に変更なし)
出力ファイル: `/mnt/user-data/outputs/jintoria.html` + `/mnt/user-data/outputs/sprites_data.js`(**2ファイル一式**。次セッションでは両方をアップロードして続きから始めてください)
デプロイ先: https://kamiten1989.github.io/publictmp/jintoria.html(まだpush/コミットされていない可能性あり。必ずバージョン表示で確認)

### ⚠️ 重要: ファイル構成変更(トークン節約のため)
2026-08-15のセッションで、`SPRITE_DATA`(base64画像データ、約3MB)を`jintoria.html`から`sprites_data.js`に分離した。
- `jintoria.html`: `<script src="sprites_data.js"></script>` で読み込む(`<script src="...phaser.min.js">`の直後に配置)。ファイルサイズは3.9MB→約800KBに縮小。
- `sprites_data.js`: `const SPRITE_DATA = {...};` のみを含む単独ファイル(約3.1MB)
- **GitHub Pagesへのデプロイ時は2ファイルとも同じディレクトリに配置すること**(`kamiten1989/publictmp`リポジトリに両方push)
- 次セッションでスプライト追加・変更作業をする場合は `sprites_data.js` の方を編集する
- 次セッション開始時、私(Claude)に全文を読ませる必要がある場合は `sprites_data.js` は極力読み込まず、`grep -n`で該当キーだけ確認する運用にするとトークン節約になる
- 動作確認: `node --check` でJS構文チェック済み(OK)。両ファイルをローカルHTTPサーバーで配信し、SPRITE_DATAが正しく読み込まれることを確認すること(未実施 — Playwrightでの目視確認がこのセッションではタイムアウトしたため)

## 直近セッションでやったこと(塔スプライト刷新 → v4.56)
- `castle_corner_dome`(自軍・青ドーム塔)と `castle_corner_dome_enemy`(敵軍)のスプライトを、ユーザー提供の新規手描き画像(塔全体+ドーム屋根+先端スパイクが一体になった1枚絵)に完全差し替え。
- 背景(白)をアルファ透過化 → 撮影時の写り込みノイズ(右端の細い線アーティファクト)を除去 → 内容物にタイトクロップ。
- 敵軍カラーは既存ルール(B>Rの画素のみR/Bチャンネルを反転)で自動生成。
- バージョン表示を v4.55 → v4.7 に更新。
- `node --check` でJS構文チェック済み(OK)。

### 経緯(なぜ差し替えたか)
- v4.53〜v4.55では「ドーム屋根だけ」を別途リサイズ合成する方式を取っていたが、ユーザーのスクリーンショットで頂上が完全に平らな長方形に見える不具合が発覚。
- 原因調査で `ringWallDefs()` 内、王の手前(南側)の塔だけ `heightOverride: 48`(他は58)で低く表示する仕様があり、大幅な縮小スケール(元絵992px→48px相当)時にPhaserのスプライト表示で頂上の丸みが潰れて見えていた可能性が高いと判明(`main3.js` L120-126, L1049-1056 `createWall()` 参照)。
- 根本原因の完全特定より先に、ユーザーが「塔全体を描き直した新スプライト」を提供してくれたため、そちらへ全面差し替えることで解消。今後同様の合成方式(別レイヤーを重ねる)を取る場合は、上記heightOverride縮小時の見え方に注意すること。

## 主要ファイル・作業パス
- ゲーム本体JS: `/home/claude/main3.js`(SPRITE_DATAオブジェクトが行84〜付近から、base64埋め込みスプライト多数)※ただし出力用の`jintoria.html`側では2026-08-15時点でSPRITE_DATAは`sprites_data.js`に分離済み
- 出力HTML: `/mnt/user-data/outputs/jintoria.html`
- 出力JS(スプライトデータ): `/mnt/user-data/outputs/sprites_data.js`
- スプライト作業ディレクトリ: `/home/claude/sprites/`
  - `new_tower_src.png` / `new_tower_clean.png`(自軍・最終版) / `new_tower_enemy.png`(敵軍・最終版)
- 敵スプライト生成ルール: **B>Rの画素のみRとBを入れ替える**(既存の全キャラ・建物スプライトで統一使用中)

## 動作確認・デプロイ手順(毎回)
1. `node --check` でJS構文チェック(jintoria.html内のインラインscript部分と、sprites_data.jsの両方)
2. Playwright + ローカルHTTPサーバーで視覚確認(過去セッションで使用した方法。2026-08-15セッションではタイムアウトしたため未実施、次回要再確認)
3. バージョン表示を必ずインクリメント(ユーザールール:バグ修正のたびに版数を上げる)
4. GitHub Pages (`kamiten1989/publictmp`)へのpush/コミットはユーザー側作業。**jintoria.htmlとsprites_data.jsの2ファイルとも忘れずにpushすること**。反映確認は「ページ内バージョン表示」で行う(ブラウザキャッシュに注意、`?v=` 付与や強制リロードを案内すること)

## 未対応・持ち越し事項
1. **木のスプライト(破壊可能オブジェクト、HP20)の追加実装** — 別セッションで着手中だった可能性があるが、現在のjintoria.htmlにはまだ反映されていない
2. **v4.48 吹き出し(🤝🛡️)の位置・密度・タイミング**の視覚検証、未実施
3. **渋滞時の撤退バグ(v4.47修正)**、大規模合流シナリオでの動作再確認、未実施
4. **攻撃モーションスプライト不足**:knight/spear_shield/sword_lightの`_attack`系スプライトが無い
5. **ゲームバランス確認**:壁HP200、家HP100、タイルHP30、自動占有15%、家の生産間隔20tick(妥当性は未検証)
6. **sprites_data.js分離後の実機動作確認**(GitHub Pagesにデプロイし、iPhone Safariで正しく読み込まれるか確認すること)

## 技術メモ(継続情報)
- スプライトキー命名: `keyname: "data:image/png;base64,<BASE64>"`
- グリッド: 14列(v4.31で12→14に拡張)
- 王の周囲城壁は`ringWallDefs()`で3x3の8マスを自動生成、角=ドーム/辺=壁
- 段差(自陣/敵陣の境目, `FENCE_COL`)、王手前の壁だけ低くする仕様あり(king上半身が見えるように)
- アイソメ変換は `gridToPixel()` / `pixelToGrid()`
