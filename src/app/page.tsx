import Link from "next/link";

// ランディング（予告ページ）。
export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <span className="badge">大学生限定・8月12日 一斉スタート</span>

        <h2 className="headline">
          この夏、
          <br />
          “ちゃんとやった”
          <br />
          <span className="accent">側</span>になる。
        </h2>

        <p className="lead">
          3,000円を先に預けて、毎日証拠写真で報告。30日やり切れば
          <strong>預けた3,000円が返金</strong>。かかるのはシステム料500円だけ、
          実質ワンコインで最高に集中できる夏を。
        </p>

        <div className="pill" style={{ marginTop: 18 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--green)",
              flexShrink: 0,
            }}
          />
          先行予約 受付中　<span className="muted">／ 8月12日 一斉スタート 🔥</span>
        </div>

        <Link href="/signup?mode=signup" className="btn btn-lg" style={{ marginTop: 18 }}>
          この夏、自分に賭けてみる →
        </Link>
        <p className="sub">
          先行予約（無料）・決済はスタート確定後　·　すでに登録済みの方は{" "}
          <Link href="/signup?mode=login">ログイン</Link>
        </p>
        <p className="sub" style={{ marginTop: 4 }}>
          <Link href="/rooms">みんなの部屋をのぞいてみる →</Link>
        </p>

        <div className="stats">
          <div className="stat">
            <span className="stat-num">30日</span>
            <span className="stat-label">完走</span>
          </div>
          <div className="stat">
            <span className="stat-num">チーム</span>
            <span className="stat-label">匿名・ソロ可</span>
          </div>
          <div className="stat">
            <span className="stat-num">¥500</span>
            <span className="stat-label">参加費のみ</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <span className="eyebrow">The Pain</span>
        <h3>「今年こそ」が、毎年溶けていく。</h3>
        <p className="muted">
          やる気はある。でも一人だと続かない。気づけば夏は終わって、
          また「来年こそ」と先延ばし。意志の力だけに頼るのは、もうやめよう。
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <span className="eyebrow">How it works</span>
        <h3>仕組み</h3>
        <div className="card">
          <ol className="muted">
            <li>¥3,500を前払い（参加費¥500＋デポジット¥3,000）</li>
            <li>自分の目標を設定（部屋への参加は任意）</li>
            <li>毎日23:59までにテキスト＋写真で報告</li>
            <li>月末に「報告した日数 × ¥100」をデポジットから返金</li>
          </ol>
          <p className="muted" style={{ margin: 0 }}>
            毎日続ければ <strong>¥3,000まるごと返金</strong>。サボった日数 × ¥100 だけが失効します。
          </p>
        </div>
      </section>

      <section style={{ marginTop: 32 }} className="center">
        <Link href="/signup?mode=signup" className="btn btn-lg">
          この夏、自分に賭けてみる →
        </Link>
        <p className="sub">
          すでに登録済みの方は <Link href="/signup?mode=login">ログイン</Link>
        </p>
      </section>
    </div>
  );
}
