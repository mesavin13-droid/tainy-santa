'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PrintableBannerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [game, setGame] = useState<any>(null);
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/games/' + encodeURIComponent(slug), { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Не удалось загрузить игру'); setGame(d.game); })
      .catch(e => setError(e.message || 'Ошибка загрузки'));
  }, [slug]);
  const url = origin + '/g/' + slug;
  const date = (s?: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Уточните у организатора';
  if (error) return <main style={{padding:24}}>{error}<p><a href={'/g/'+slug}>Назад в игру</a></p></main>;
  if (!game || !origin) return <main style={{padding:24}}>Готовим макет…</main>;
  return <main>
    <style jsx global>{`
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f1ede4; }
      .poster { width: 210mm; height: 297mm; margin: 12px auto; padding: 15mm; background: #17271e; color: #f3ebdd; font-family: 'DM Sans', Arial, sans-serif; text-align: center; }
      .frame { height: 100%; border: 1px solid #d5bd84; outline: 1px solid #c8a96a; outline-offset: 4mm; padding: 10mm 8mm; display:flex; flex-direction:column; align-items:center; }
      .kicker { color:#d5bd84; letter-spacing:.2em; font-size:10pt; font-weight:bold; }
      .stars { color:#d7bc7a; margin:8mm 0 2mm; font-size:18pt; }
      h1 { font-family: 'Playfair Display', Georgia,serif; font-size:40pt; line-height:1; margin:0; }
      .company { color:#ded0ac; font-size:17pt; letter-spacing:.14em; font-weight:bold; margin-top:7mm; }
      .rule { width:34mm; border-top:1px solid #c8a96a; margin:7mm 0; }
      .subtitle { font: 20pt Georgia,serif; margin:0; }
      .desc { font-size:11pt; line-height:1.55; max-width:140mm; margin:5mm auto; }
      .details { display:flex; gap:5mm; width:100%; margin-top:5mm; }
      .detail { flex:1; border:1px solid #c8a96a; padding:4mm 2mm; }
      .detail span { display:block; color:#d7bc7a; font-size:8pt; margin-bottom:2mm; letter-spacing:.08em; }
      .detail strong { font-size:11pt; }
      .cta { margin-top:auto; padding-top:7mm; font-size:14pt; font-weight:bold; }
      .qrbox { background:#fff; padding:4mm; margin-top:4mm; border-radius:3mm; }
      .qr { width:43mm; height:43mm; display:block; }
      .scan { color:#e6d5ad; font-size:9pt; margin-top:3mm; }
      .url { font-size:7pt; margin-top:2mm; overflow-wrap:anywhere; }
      .footer { color:#d7bc7a; font-size:8pt; letter-spacing:.12em; margin-top:6mm; }
      .actions { display:flex; justify-content:center; gap:12px; margin:16px; font-family:Arial,sans-serif; }
      .actions button,.actions a { background:#17271e; color:#f3ebdd; border:1px solid #d5bd84; border-radius:10px; padding:12px 16px; text-decoration:none; cursor:pointer; }
      @media print { body { background:#123b2e; print-color-adjust:exact; -webkit-print-color-adjust:exact; } .poster { margin:0; } .actions { display:none; } }
    `}</style>
    <section className="poster"><div className="frame">
      <div className="kicker">ПРАЗДНИЧНАЯ ИГРА КОМАНДЫ</div>
      <div className="stars">✦　✧　✦</div>
      <h1>Тайный<br/>Санта</h1>
      <div className="company">{game.company_name || 'ЛИДЕР-ФУД'}</div>
      <div className="rule"/>
      <p className="subtitle">Подари немного волшебства коллеге</p>
      <p className="desc">Присоединяйся к праздничному обмену подарками! Получи имя своего получателя, выбери подарок и сохрани секрет до самого вручения.</p>
      <div className="details"><div className="detail"><span>БЮДЖЕТ ПОДАРКА</span><strong>{Number(game.budget).toLocaleString('ru-RU')} ₽</strong></div><div className="detail"><span>ДЕНЬ ОБМЕНА</span><strong>{date(game.exchange_date)}</strong></div></div>
      <div className="cta">Сканируй QR-код и участвуй</div>
      <div className="qrbox"><img className="qr" src={'https://api.qrserver.com/v1/create-qr-code/?size=500x500&format=png&ecc=H&data='+encodeURIComponent(url)} alt="QR-код игры"/></div>
      <div className="scan">Откроется регистрация в игре «{game.name}»</div>
      <div className="url">{url}</div>
      <div className="footer">СЕКРЕТЫ • ПОДАРКИ • ПРАЗДНИЧНОЕ НАСТРОЕНИЕ</div>
    </div></section>
    <div className="actions"><button onClick={() => window.print()}>Распечатать / сохранить PDF</button><a href={'/g/'+slug}>Назад в игру</a></div>
  </main>;
}
