# Jintoria 開発引き継ぎメモ(2026-08-16時点)

## 現在のバージョン
**v5.0**
出力ファイル: `/mnt/user-data/outputs/jintoria.html`(このセッションの最新版。次セッションでは、これをアップロードして続きから始めてください)
デプロイ先: https://kamiten1989.github.io/publictmp/jintoria.html(このv5.0がまだpush/コミットされていない可能性あり。必ずバージョン表示で確認)

## 直近セッションでやったこと(開始ボタンのアニメーション追加)
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
1. `node --check` でJS構文チェック(scriptタグ内容を抽出して確認する方法: `re.findall(r'<script>(.*?)</script>', data, re.S)` でextracted.jsに書き出してcheck)
2. Playwright + ローカルHTTPサーバーで視覚確認(過去セッションで使用した方法。今回は未実施のため次回要検討)
3. バージョン表示を必ずインクリメント(ユーザールール:バグ修正・機能追加のたびに版数を上げる)
4. GitHub Pages (`kamiten1989/publictmp`)へのpush/コミットはユーザー側作業。反映確認は「ページ内バージョン表示」で行う(ブラウザキャッシュに注意、`?v=` 付与や強制リロードを案内すること)

## 未対応・持ち越し事項
1. **開始ボタンアニメーションのブラウザ実機確認**、未実施(Playwrightでの見た目チェックが望ましい)
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
